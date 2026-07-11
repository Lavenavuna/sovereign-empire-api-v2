import express from 'express';
import { createId, loadWholesaleState, saveWholesaleState } from '../lib/wholesaleStore.js';
import { createInvoice, recordInvoicePayment, listInvoices } from '../lib/revenueOps.js';
import { loadPendingApprovals, savePendingApprovals, logAction } from '../lib/auditLog.js';
import {
  applyComplianceSettings,
  evaluateDealCompliance,
  evaluateForeignBuyerRisk,
  getDisclosureClause,
  getCompliancePlaybook,
  getSb17DesignatedCountries,
  normalizePropertyState
} from '../lib/legalPlaybook.js';

const router = express.Router();
const DEFAULT_DFW_TARGET_ZIPS = [
  '76179', '76104', '76105', '76115', '76103', '76060',
  '75210', '75215', '75216', '75217', '75224', '75232', '75241', '75212'
];
const DEAL_SOURCE_CHANNELS = ['propstream', 'batch', 'county', 'dfd', 'referral', 'manual'];
const DEAL_OUTCOMES = ['lead', 'dead', 'contract', 'closed'];
const CONFIDENCE_LEVELS = ['high', 'medium', 'low'];
const FOLLOWUP_OUTCOMES = [
  'not_interested',
  'wrong_number',
  'already_sold',
  'no_motivation',
  'no_response',
  'callback_requested',
  'contract_signed',
  'drafted',
  'sent'
];
const CLOSE_PATHS = ['assignment', 'double_close'];
const IMPORT_SOURCE_CHANNELS = ['tax', 'foreclosure', 'probate', 'divorce', 'code_enforcement', 'deed_lien'];
const DEFAULT_SIGNAL_BY_SOURCE = {
  tax: 'tax_delinquent',
  foreclosure: 'foreclosure_notice',
  probate: 'probate_filing',
  divorce: 'divorce_filing',
  code_enforcement: 'code_violation',
  deed_lien: 'lien_or_transfer_signal'
};
const SIGNAL_WEIGHTS = {
  tax_delinquent: 2,
  foreclosure_notice: 3,
  probate_filing: 3,
  divorce_filing: 2,
  code_violation: 1,
  lien_or_transfer_signal: 1,
  absentee_owner: 2,
  vacant: 2
};

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asIsoTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function asString(value) {
  return String(value || '').trim();
}

function monthKey(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}`;
}

function hoursDiff(start, end) {
  const s = asIsoTimestamp(start);
  const e = asIsoTimestamp(end);
  if (!s || !e) return null;
  return (new Date(e).getTime() - new Date(s).getTime()) / 36e5;
}

function getKpiTargets(state) {
  return Array.isArray(state.meta?.kpiTargets) ? state.meta.kpiTargets : [];
}

function findKpiTarget(state, month) {
  const key = monthKey(month);
  if (!key) return null;
  return getKpiTargets(state).find(t => t.month === key) || null;
}

function computeSlaBreaches(deal, state) {
  const t = deal.dispositionTimeline || {};
  const breaches = [];
  const contractToBlastHrs = hoursDiff(t.contractSignedAt, t.firstBlastSentAt);
  if (contractToBlastHrs !== null && contractToBlastHrs > 4) breaches.push('contract_to_first_blast_over_4h');
  const blastToResponseHrs = hoursDiff(t.firstBlastSentAt, t.firstResponseAt);
  if (blastToResponseHrs !== null && blastToResponseHrs > 24) breaches.push('blast_to_first_response_over_24h');
  const responseToEmdHrs = hoursDiff(t.firstResponseAt, t.emdReceivedAt);
  if (responseToEmdHrs !== null && responseToEmdHrs > 72) breaches.push('response_to_emd_over_72h');
  const emdToCloseHrs = hoursDiff(t.emdReceivedAt, t.closeDate);
  if (emdToCloseHrs !== null && emdToCloseHrs > 120) breaches.push('emd_to_close_over_5_business_days');

  const closeMonth = monthKey(t.closeDate || t.contractSignedAt || deal.updatedAt);
  const target = closeMonth ? findKpiTarget(state, closeMonth) : null;
  const targetDays = asNumber(target?.daysToCloseTarget, 0);
  if (targetDays > 0) {
    const contractToCloseHrs = hoursDiff(t.contractSignedAt, t.closeDate);
    if (contractToCloseHrs !== null && contractToCloseHrs > targetDays * 24) {
      breaches.push(`contract_to_close_over_${targetDays}_days`);
    }
  }

  return breaches;
}

function ensureOpsReadyForClose(deal) {
  const errors = [];
  const offer = deal.offerConfidence || {};
  const closePath = deal.closePath || {};
  const lowConfidence = [offer.arvConfidence, offer.rehabConfidence].includes('low');

  if (lowConfidence && !offer.manualOverrideApproved) {
    errors.push('Low-confidence offer requires manual override approval before close');
  }

  if (!closePath.path || !CLOSE_PATHS.includes(closePath.path)) {
    errors.push('closePath.path must be tagged as assignment or double_close');
  }
  if (!closePath.taggedBeforeBlast) {
    errors.push('closePath.taggedBeforeBlast must be true before closing');
  }
  if (closePath.path === 'double_close' && !closePath.fundingSourceConfirmed) {
    errors.push('double_close requires fundingSourceConfirmed=true');
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

function calculateDealMetrics(property) {
  const arv = asNumber(property.arv, 0);
  const rehabEstimate = asNumber(property.rehabEstimate, 0);
  const closingCosts = asNumber(property.closingCosts, 5000);
  const purchasePrice = asNumber(property.purchasePrice ?? property.askPrice, 0);

  const maxAllowableOffer = Math.max(0, arv * 0.7 - rehabEstimate - closingCosts);
  const assignmentPotential = Math.max(0, maxAllowableOffer - purchasePrice);
  const grossProfit = Math.max(0, arv - purchasePrice - rehabEstimate - closingCosts);
  const roiPercent = arv > 0 ? Number(((grossProfit / arv) * 100).toFixed(2)) : 0;

  return {
    arv,
    purchasePrice,
    rehabEstimate,
    closingCosts,
    maxAllowableOffer: Number(maxAllowableOffer.toFixed(2)),
    assignmentPotential: Number(assignmentPotential.toFixed(2)),
    grossProfit: Number(grossProfit.toFixed(2)),
    roiPercent
  };
}

function scoreInvestor(investor, property, metrics) {
  if (investor.qualificationStatus === 'rejected') {
    return { score: 0, reasons: ['qualification-rejected'] };
  }
  if (investor.foreignCompliance?.blocked) {
    return { score: 0, reasons: ['foreign-buyer-blocked-sb17'] };
  }

  let score = 0;
  const reasons = [];

  const minPrice = asNumber(investor.minPrice, 0);
  const maxPrice = asNumber(investor.maxPrice, Number.MAX_SAFE_INTEGER);
  const inBudget = metrics.purchasePrice >= minPrice && metrics.purchasePrice <= maxPrice;
  if (inBudget) {
    score += 40;
    reasons.push('budget-fit');
  }

  const investorZips = Array.isArray(investor.zipCodes) ? investor.zipCodes : [];
  if (!investorZips.length || investorZips.includes(property.zipCode)) {
    score += 20;
    reasons.push('zip-fit');
  }

  const maxRehab = asNumber(investor.maxRehab, Number.MAX_SAFE_INTEGER);
  if (metrics.rehabEstimate <= maxRehab) {
    score += 20;
    reasons.push('rehab-fit');
  }

  const investorArvMin = asNumber(investor.minArv, 0);
  const investorArvMax = asNumber(investor.maxArv, Number.MAX_SAFE_INTEGER);
  if (metrics.arv >= investorArvMin && metrics.arv <= investorArvMax) {
    score += 20;
    reasons.push('arv-fit');
  }

  if (investor.proofOfFundsStatus === 'verified') {
    score += 10;
    reasons.push('proof-of-funds-verified');
  } else {
    score = Math.max(0, score - 15);
    reasons.push('proof-of-funds-pending');
  }

  return { score, reasons };
}

function ensureDeal(state, propertyId) {
  let deal = state.deals.find(d => d.propertyId === propertyId);
  if (!deal) {
    deal = {
      id: createId('deal'),
      propertyId,
      stage: 'sourced',
      status: 'active',
      assignmentFeeTarget: 0,
      assignmentPotential: 0,
      investorMatches: [],
      followUps: [],
      calls: [],
      sourceEconomics: {
        channel: 'manual',
        channelCostAllocated: 0,
        zip: '',
        leadDate: new Date().toISOString(),
        contractDate: null,
        closeDate: null,
        outcome: 'lead',
        feeActual: 0
      },
      offerConfidence: {
        arvConfidence: 'low',
        arvSource: '',
        rehabConfidence: 'low',
        rehabSource: '',
        rentComp: 0,
        rentCompSource: '',
        manualOverrideApproved: false,
        manualOverrideNote: '',
        manualOverrideApprovedAt: null
      },
      dispositionTimeline: {
        contractSignedAt: null,
        firstBlastSentAt: null,
        firstResponseAt: null,
        emdReceivedAt: null,
        closeDate: null,
        slaBreachFlags: []
      },
      closePath: {
        path: 'assignment',
        fundingSourceConfirmed: false,
        fundingSourceName: '',
        doubleCloseCostBudgeted: 0,
        taggedBeforeBlast: false
      },
      contacts: {
        sellerName: '',
        sellerEmail: '',
        sellerPhone: '',
        buyerName: '',
        buyerEmail: '',
        buyerPhone: ''
      },
      notes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    state.deals.push(deal);
  }
  return deal;
}

function hasPendingCloseApproval(dealId) {
  const approvals = loadPendingApprovals();
  return approvals.some(
    a => a.status === 'pending' && a.actionType === 'close-deal' && a.payload?.dealId === dealId
  );
}

function queueCloseDealApproval({ deal, payload, source }) {
  const approvals = loadPendingApprovals();
  const existing = approvals.find(
    a => a.status === 'pending' && a.actionType === 'close-deal' && a.payload?.dealId === deal.id
  );
  if (existing) return existing;

  const approvalId = createId('appr');
  const approval = {
    id: approvalId,
    agent: 'deal-closer',
    tier: 'T2',
    actionType: 'close-deal',
    query: 'Close deal requires approval',
    payload,
    status: 'pending',
    createdAt: new Date().toISOString(),
    source
  };
  approvals.push(approval);
  savePendingApprovals(approvals);
  logAction({ agent: 'deal-closer', tier: 'T2', action: 'escalated', approvalId, source });
  return approval;
}

function ensureComplianceReady(state, deal) {
  const compliance = evaluateDealCompliance(state, deal);
  if (!compliance.ok) {
    return {
      success: false,
      error: 'Compliance gate blocked close action',
      compliance
    };
  }
  return { success: true, compliance };
}

function normalizeZipCode(value) {
  return String(value || '').trim().slice(0, 5);
}

function normalizeZipCodes(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(normalizeZipCode).filter(v => /^\d{5}$/.test(v)))];
}

function splitCsvLine(line) {
  const out = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out.map(v => v.trim());
}

function parseCsvText(csvText) {
  const lines = String(csvText || '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map(h => h.toLowerCase());
  return lines.slice(1).map(line => {
    const values = splitCsvLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    return row;
  });
}

function parseSignalList(value) {
  const raw = asString(value);
  if (!raw) return [];
  return [...new Set(raw.split(/[|;,]/).map(v => v.trim().toLowerCase()).filter(Boolean))];
}

function mapSourceToDealChannel(sourceChannel) {
  if (sourceChannel === 'tax' || sourceChannel === 'code_enforcement' || sourceChannel === 'deed_lien') {
    return 'county';
  }
  return sourceChannel === 'manual' ? 'manual' : 'referral';
}

function normalizeAddressKey(address, city, stateCode, zipCode) {
  const norm = (v) => asString(v).toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${norm(address)}|${norm(city)}|${norm(stateCode)}|${norm(zipCode)}`;
}

function findPropertyByAddress(state, address, city, stateCode, zipCode) {
  const key = normalizeAddressKey(address, city, stateCode, zipCode);
  return state.properties.find((p) =>
    normalizeAddressKey(p.address, p.city, p.state, p.zipCode) === key
  );
}

function computeMergedDistress(property) {
  const signals = Array.isArray(property.distressSignals) ? property.distressSignals : [];
  const weighted = signals.reduce((sum, sig) => sum + asNumber(SIGNAL_WEIGHTS[sig], 0), 0);
  const sourceLists = Array.isArray(property.sourceLists) ? property.sourceLists : [];
  const sourceBoost = sourceLists.length >= 2 ? 2 + Math.max(0, sourceLists.length - 2) : 0;
  const mergedDistressScore = weighted + sourceBoost;
  return {
    mergedDistressScore,
    mergedSignals: signals,
    sourceCount: sourceLists.length
  };
}

function normalizeCountryCodes(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(v => String(v || '').trim().toUpperCase()).filter(Boolean))];
}

function buildForeignBuyerProfile(payload) {
  return {
    isUsCitizen: Boolean(payload?.isUsCitizen),
    isLawfulPermanentResident: Boolean(payload?.isLawfulPermanentResident),
    domicileCountry: String(payload?.domicileCountry || '').trim().toUpperCase(),
    citizenshipCountries: normalizeCountryCodes(payload?.citizenshipCountries),
    entityHeadquartersCountry: String(payload?.entityHeadquartersCountry || '').trim().toUpperCase(),
    majorityControlCountries: normalizeCountryCodes(payload?.majorityControlCountries),
    isForeignGovernmentAgent: Boolean(payload?.isForeignGovernmentAgent),
    foreignGovernmentAgentCountry: String(payload?.foreignGovernmentAgentCountry || '').trim().toUpperCase()
  };
}

function refreshForeignCompliance(investor) {
  const profile = investor.foreignBuyerProfile || {};
  const result = evaluateForeignBuyerRisk(profile);
  investor.foreignCompliance = {
    blocked: result.blocked,
    blockedReasons: result.blockedReasons,
    checkVersion: result.checkVersion,
    screenedAt: result.screenedAt,
    designatedCountries: result.designatedCountries
  };
  return investor.foreignCompliance;
}

function ensureInvestorLegalEligibility(investor) {
  const compliance = investor.foreignCompliance || refreshForeignCompliance(investor);
  if (compliance.blocked) {
    return {
      ok: false,
      error: `Investor blocked by foreign buyer compliance gate: ${compliance.blockedReasons.join('; ')}`,
      compliance
    };
  }
  return { ok: true, compliance };
}

function resolveInvestorForClose(state, deal, preferredInvestorId) {
  const investorId = preferredInvestorId || deal.investorMatches?.[0]?.investorId || null;
  if (!investorId) {
    return {
      ok: false,
      error: 'No eligible investor assigned. Provide investorId or run investor matching first.'
    };
  }
  const investor = state.investors.find(i => i.id === investorId);
  if (!investor) {
    return { ok: false, error: 'Investor not found for close request' };
  }
  const legal = ensureInvestorLegalEligibility(investor);
  if (!legal.ok) {
    return { ok: false, error: legal.error, compliance: legal.compliance };
  }
  return { ok: true, investor };
}

function deriveQualificationStatus(investor) {
  if (investor.proofOfFundsStatus === 'rejected') return 'rejected';
  const q = investor.qualification || {};
  const hasTargetAreas = Array.isArray(q.targetAreas) && q.targetAreas.length > 0;
  const hasFunding = Boolean(String(q.fundingSource || '').trim());
  const hasDealType = Boolean(String(q.preferredDealType || '').trim());
  if (investor.proofOfFundsStatus === 'verified' && hasTargetAreas && hasFunding && hasDealType) {
    return 'qualified';
  }
  return 'pending';
}

function createInvestorRecord(payload) {
  const investor = {
    id: createId('inv'),
    name: payload.name,
    strategy: payload.strategy,
    email: payload.email || '',
    phone: payload.phone || '',
    minPrice: asNumber(payload.minPrice, 0),
    maxPrice: asNumber(payload.maxPrice, 1_000_000_000),
    minArv: asNumber(payload.minArv, 0),
    maxArv: asNumber(payload.maxArv, 1_000_000_000),
    maxRehab: asNumber(payload.maxRehab, 1_000_000_000),
    zipCodes: normalizeZipCodes(payload.zipCodes),
    preferredPropertyTypes: Array.isArray(payload.preferredPropertyTypes) ? payload.preferredPropertyTypes : [],
    conditionTolerance: payload.conditionTolerance || 'any',
    proofOfFundsStatus: payload.proofOfFundsStatus || 'unverified',
    proofOfFundsDocumentUrl: payload.proofOfFundsDocumentUrl || '',
    proofOfFundsVerifiedAt: payload.proofOfFundsVerifiedAt || null,
    qualification: {
      fundingSource: payload.fundingSource || '',
      lender: payload.lender || '',
      lastClosingTimelineDays: asNumber(payload.lastClosingTimelineDays, 0),
      targetAreas: normalizeZipCodes(payload.targetAreas || payload.zipCodes || []),
      preferredDealType: payload.preferredDealType || '',
      titleReference: payload.titleReference || ''
    },
    channels: Array.isArray(payload.channels) ? payload.channels.map(v => String(v).trim()).filter(Boolean) : [],
    sourcePlatform: payload.sourcePlatform ? String(payload.sourcePlatform).trim() : '',
    foreignBuyerProfile: buildForeignBuyerProfile(payload),
    foreignCompliance: null,
    qualificationStatus: 'pending',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  investor.qualificationStatus = deriveQualificationStatus(investor);
  refreshForeignCompliance(investor);
  return investor;
}

router.get('/overview', (req, res) => {
  const state = loadWholesaleState();
  const pendingProperties = state.properties.filter(p => p.status !== 'closed').length;
  const avgAssignmentPotential = state.deals.length
    ? Number(
        (
          state.deals.reduce((sum, deal) => sum + asNumber(deal.assignmentPotential, 0), 0) /
          state.deals.length
        ).toFixed(2)
      )
    : 0;
  const invoices = listInvoices().filter(i => i.dealId);
  const recognizedRevenueUsd = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + asNumber(i.totalUsd, 0), 0);
  const pendingRevenueUsd = invoices
    .filter(i => i.status !== 'paid')
    .reduce((sum, i) => sum + asNumber(i.totalUsd, 0), 0);

  res.json({
    success: true,
    vision: state.meta.vision,
    market: state.meta.market,
    summary: {
      properties: state.properties.length,
      pendingProperties,
      investors: state.investors.length,
      deals: state.deals.length,
      avgAssignmentPotential,
      recognizedRevenueUsd: Number(recognizedRevenueUsd.toFixed(2)),
      pendingRevenueUsd: Number(pendingRevenueUsd.toFixed(2))
    }
  });
});

router.get('/properties', (req, res) => {
  const state = loadWholesaleState();
  const status = req.query.status;
  const properties = status ? state.properties.filter(p => p.status === status) : state.properties;
  res.json({ success: true, count: properties.length, properties });
});

router.post('/properties', (req, res) => {
  const { address, city, state: stateCode, zipCode } = req.body || {};
  if (!address || !city || !stateCode) {
    return res.status(400).json({ success: false, error: 'address, city, and state are required' });
  }

  const state = loadWholesaleState();
  const property = {
    id: createId('prop'),
    address,
    city,
    state: normalizePropertyState(stateCode),
    zipCode: zipCode || '',
    market: req.body.market || state.meta.market || 'DFW',
    source: req.body.source || 'manual',
    sourceLists: Array.isArray(req.body.sourceLists) ? req.body.sourceLists : [],
    distressSignals: Array.isArray(req.body.distressSignals) ? req.body.distressSignals : [],
    propertyType: req.body.propertyType || 'single-family',
    purchasePrice: asNumber(req.body.purchasePrice, 0),
    askPrice: asNumber(req.body.askPrice, 0),
    arv: asNumber(req.body.arv, 0),
    rehabEstimate: asNumber(req.body.rehabEstimate, 0),
    closingCosts: asNumber(req.body.closingCosts, 5000),
    status: req.body.status || 'sourced',
    seller: req.body.seller || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  state.properties.push(property);
  const deal = ensureDeal(state, property.id);
  deal.sourceEconomics = deal.sourceEconomics || {};
  deal.sourceEconomics.zip = property.zipCode || '';
  deal.sourceEconomics.channel = property.source || deal.sourceEconomics.channel || 'manual';
  deal.updatedAt = new Date().toISOString();
  saveWholesaleState(state);

  res.status(201).json({ success: true, property });
});

router.patch('/properties/:id', (req, res) => {
  const state = loadWholesaleState();
  const property = state.properties.find(p => p.id === req.params.id);
  if (!property) {
    return res.status(404).json({ success: false, error: 'Property not found' });
  }

  const allowed = [
    'state',
    'source',
    'sourceLists',
    'distressSignals',
    'propertyType',
    'purchasePrice',
    'askPrice',
    'arv',
    'rehabEstimate',
    'closingCosts',
    'seller',
    'status'
  ];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      property[key] = key === 'state' ? normalizePropertyState(req.body[key]) : req.body[key];
    }
  }
  property.updatedAt = new Date().toISOString();

  saveWholesaleState(state);
  res.json({ success: true, property });
});

router.post('/ingestion/import-csv', (req, res) => {
  const sourceChannel = asString(req.body?.sourceChannel).toLowerCase();
  if (!IMPORT_SOURCE_CHANNELS.includes(sourceChannel)) {
    return res.status(400).json({
      success: false,
      error: `sourceChannel must be one of: ${IMPORT_SOURCE_CHANNELS.join(', ')}`
    });
  }
  if (!asString(req.body?.csvText)) {
    return res.status(400).json({ success: false, error: 'csvText is required' });
  }

  const rows = parseCsvText(req.body.csvText);
  if (!rows.length) {
    return res.status(400).json({ success: false, error: 'No data rows found in csvText' });
  }

  const state = loadWholesaleState();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const address = asString(row.address || row.situs_address || row.property_address || row.street);
    const city = asString(row.city || row.situs_city || req.body?.defaultCity || 'Fort Worth');
    const stateCode = normalizePropertyState(row.state || row.situs_state || req.body?.defaultState || 'TX');
    const zipCode = normalizeZipCode(row.zip || row.zipcode || row.situs_zip || row.postal_code);
    if (!address || !city || !stateCode) {
      skipped += 1;
      continue;
    }

    const importedSignals = parseSignalList(row.distress_signals || row.signals || row.distress_signal);
    const defaultSignal = DEFAULT_SIGNAL_BY_SOURCE[sourceChannel];
    const distressSignals = [...new Set([defaultSignal, ...importedSignals].filter(Boolean))];

    let property = findPropertyByAddress(state, address, city, stateCode, zipCode);
    if (!property) {
      property = {
        id: createId('prop'),
        address,
        city,
        state: stateCode,
        zipCode,
        market: asString(req.body?.market || state.meta?.market || 'DFW'),
        source: sourceChannel,
        sourceLists: [sourceChannel],
        distressSignals,
        propertyType: asString(row.property_type || req.body?.defaultPropertyType || 'single-family'),
        purchasePrice: asNumber(row.purchase_price || row.ask_price, 0),
        askPrice: asNumber(row.ask_price || row.purchase_price, 0),
        arv: asNumber(row.arv || row.total_appraised_value, 0),
        rehabEstimate: asNumber(row.rehab_estimate || 0, 0),
        closingCosts: asNumber(row.closing_costs || 5000, 5000),
        status: asString(row.status || 'sourced').toLowerCase(),
        pipelineStatus: 'new',
        seller: {
          name: asString(row.owner_name || row.seller_name),
          email: asString(row.seller_email),
          phone: asString(row.seller_phone)
        },
        importMeta: {
          sourceChannel,
          externalRecordId: asString(row.record_id || row.account_id || row.case_id),
          importedAt: new Date().toISOString()
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const merged = computeMergedDistress(property);
      property.analysis = {
        ...(property.analysis || {}),
        mergedDistressScore: merged.mergedDistressScore,
        mergedSignals: merged.mergedSignals,
        sourceCount: merged.sourceCount,
        scoredAt: new Date().toISOString()
      };
      state.properties.push(property);
      inserted += 1;
    } else {
      property.sourceLists = [...new Set([...(property.sourceLists || []), sourceChannel])];
      property.distressSignals = [...new Set([...(property.distressSignals || []), ...distressSignals])];
      property.source = property.source || sourceChannel;
      property.pipelineStatus = 'new';
      property.updatedAt = new Date().toISOString();
      property.importMeta = {
        ...(property.importMeta || {}),
        sourceChannel,
        externalRecordId: asString(row.record_id || row.account_id || row.case_id || property.importMeta?.externalRecordId),
        importedAt: new Date().toISOString()
      };
      const merged = computeMergedDistress(property);
      property.analysis = {
        ...(property.analysis || {}),
        mergedDistressScore: merged.mergedDistressScore,
        mergedSignals: merged.mergedSignals,
        sourceCount: merged.sourceCount,
        scoredAt: new Date().toISOString()
      };
      updated += 1;
    }

    const deal = ensureDeal(state, property.id);
    deal.sourceEconomics = deal.sourceEconomics || {};
    deal.sourceEconomics.channel = mapSourceToDealChannel(sourceChannel);
    deal.sourceEconomics.zip = zipCode || deal.sourceEconomics.zip || '';
    deal.sourceEconomics.leadDate = deal.sourceEconomics.leadDate || new Date().toISOString();
    deal.stage = deal.stage === 'sourced' ? 'analyzed' : deal.stage;
    deal.updatedAt = new Date().toISOString();
  }

  saveWholesaleState(state);
  res.json({
    success: true,
    sourceChannel,
    summary: { inserted, updated, skipped, totalRows: rows.length }
  });
});

router.post('/ingestion/merge-score', (req, res) => {
  const state = loadWholesaleState();
  const onlyNew = req.body?.onlyPipelineNew !== false;
  let updated = 0;
  for (const property of state.properties) {
    if (onlyNew && property.pipelineStatus && property.pipelineStatus !== 'new') continue;
    const merged = computeMergedDistress(property);
    property.analysis = {
      ...(property.analysis || {}),
      mergedDistressScore: merged.mergedDistressScore,
      mergedSignals: merged.mergedSignals,
      sourceCount: merged.sourceCount,
      scoredAt: new Date().toISOString()
    };
    property.pipelineStatus = 'scored';
    property.updatedAt = new Date().toISOString();
    updated += 1;
  }
  saveWholesaleState(state);
  res.json({ success: true, summary: { scoredProperties: updated, onlyPipelineNew: onlyNew } });
});

router.get('/properties/queue/new', (req, res) => {
  const state = loadWholesaleState();
  const properties = state.properties
    .filter(p => (p.pipelineStatus || 'new') === 'new')
    .sort((a, b) => asNumber(b.analysis?.mergedDistressScore, 0) - asNumber(a.analysis?.mergedDistressScore, 0));
  res.json({ success: true, count: properties.length, properties });
});

router.post('/properties/:id/analyze', (req, res) => {
  const state = loadWholesaleState();
  const property = state.properties.find(p => p.id === req.params.id);
  if (!property) {
    return res.status(404).json({ success: false, error: 'Property not found' });
  }

  if (req.body) {
    if (req.body.purchasePrice !== undefined) property.purchasePrice = asNumber(req.body.purchasePrice, property.purchasePrice);
    if (req.body.askPrice !== undefined) property.askPrice = asNumber(req.body.askPrice, property.askPrice);
    if (req.body.arv !== undefined) property.arv = asNumber(req.body.arv, property.arv);
    if (req.body.rehabEstimate !== undefined) property.rehabEstimate = asNumber(req.body.rehabEstimate, property.rehabEstimate);
    if (req.body.closingCosts !== undefined) property.closingCosts = asNumber(req.body.closingCosts, property.closingCosts);
  }

  const metrics = calculateDealMetrics(property);
  property.analysis = {
    ...metrics,
    analyzedAt: new Date().toISOString()
  };
  property.status = 'analyzed';
  property.updatedAt = new Date().toISOString();

  const deal = ensureDeal(state, property.id);
  deal.stage = 'analyzed';
  deal.assignmentPotential = metrics.assignmentPotential;
  deal.assignmentFeeTarget = asNumber(req.body?.assignmentFeeTarget, deal.assignmentFeeTarget || metrics.assignmentPotential);
  deal.updatedAt = new Date().toISOString();

  saveWholesaleState(state);
  res.json({ success: true, property, metrics, deal });
});

router.get('/investors', (req, res) => {
  const state = loadWholesaleState();
  res.json({ success: true, count: state.investors.length, investors: state.investors });
});

router.get('/compliance/foreign-buyers', (req, res) => {
  res.json({
    success: true,
    law: 'TX SB17',
    effectiveDate: '2025-09-01',
    designatedCountries: getSb17DesignatedCountries()
  });
});

router.post('/buyers/intake', (req, res) => {
  const { name, strategy } = req.body || {};
  if (!name || !strategy) {
    return res.status(400).json({ success: false, error: 'name and strategy are required' });
  }

  const state = loadWholesaleState();
  const investor = createInvestorRecord({
    ...req.body,
    proofOfFundsStatus: req.body?.proofOfFundsProvided ? 'pending_verification' : 'unverified'
  });
  state.investors.push(investor);
  saveWholesaleState(state);
  res.status(201).json({ success: true, buyer: investor });
});

router.post('/buyers/import-csv', (req, res) => {
  if (!asString(req.body?.csvText)) {
    return res.status(400).json({ success: false, error: 'csvText is required' });
  }

  const rows = parseCsvText(req.body.csvText);
  if (!rows.length) {
    return res.status(400).json({ success: false, error: 'No data rows found in csvText' });
  }

  const state = loadWholesaleState();
  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const name = asString(row.name || row.buyer_name || row.investor_name);
    const strategy = asString(row.strategy || row.preferred_deal_type || 'buy-and-hold');
    if (!name || !strategy) {
      skipped += 1;
      continue;
    }

    const investor = createInvestorRecord({
      name,
      strategy,
      email: asString(row.email),
      phone: asString(row.phone),
      minPrice: asNumber(row.min_price || row.minprice, 0),
      maxPrice: asNumber(row.max_price || row.maxprice, 1_000_000_000),
      minArv: asNumber(row.min_arv || row.minarv, 0),
      maxArv: asNumber(row.max_arv || row.maxarv, 1_000_000_000),
      maxRehab: asNumber(row.max_rehab || row.maxrehab, 1_000_000_000),
      zipCodes: normalizeZipCodes(parseSignalList(row.zip_codes || row.zips || row.target_zips).map(v => v.replace(/\D/g, ''))),
      preferredPropertyTypes: parseSignalList(row.preferred_property_types || row.property_types),
      conditionTolerance: asString(row.condition_tolerance || 'any'),
      proofOfFundsStatus: asString(row.proof_of_funds_status || row.proofoffunds || 'unverified').toLowerCase(),
      proofOfFundsDocumentUrl: asString(row.proof_of_funds_url || row.pof_url),
      fundingSource: asString(row.funding_source),
      lender: asString(row.lender),
      lastClosingTimelineDays: asNumber(row.last_closing_timeline_days || row.closing_days, 0),
      targetAreas: normalizeZipCodes(parseSignalList(row.target_areas || row.target_zips).map(v => v.replace(/\D/g, ''))),
      preferredDealType: asString(row.preferred_deal_type),
      titleReference: asString(row.title_reference),
      channels: parseSignalList(row.channels || row.channel),
      sourcePlatform: asString(row.source_platform || row.source),
      isUsCitizen: String(row.is_us_citizen || '').toLowerCase() === 'true',
      isLawfulPermanentResident: String(row.is_lawful_permanent_resident || '').toLowerCase() === 'true',
      domicileCountry: asString(row.domicile_country),
      citizenshipCountries: parseSignalList(row.citizenship_countries),
      entityHeadquartersCountry: asString(row.entity_headquarters_country),
      majorityControlCountries: parseSignalList(row.majority_control_countries),
      isForeignGovernmentAgent: String(row.is_foreign_government_agent || '').toLowerCase() === 'true',
      foreignGovernmentAgentCountry: asString(row.foreign_government_agent_country)
    });

    state.investors.push(investor);
    inserted += 1;
  }

  saveWholesaleState(state);
  res.json({
    success: true,
    summary: {
      inserted,
      skipped,
      totalRows: rows.length
    }
  });
});

router.post('/investors', (req, res) => {
  const { name, strategy } = req.body || {};
  if (!name || !strategy) {
    return res.status(400).json({ success: false, error: 'name and strategy are required' });
  }

  const state = loadWholesaleState();
  const investor = createInvestorRecord(req.body);

  state.investors.push(investor);
  saveWholesaleState(state);
  res.status(201).json({ success: true, investor });
});

router.patch('/investors/:id/verify', (req, res) => {
  const state = loadWholesaleState();
  const investor = state.investors.find(i => i.id === req.params.id);
  if (!investor) {
    return res.status(404).json({ success: false, error: 'Investor not found' });
  }

  const status = String(req.body?.proofOfFundsStatus || '').trim();
  const allowed = ['verified', 'rejected', 'pending_verification', 'unverified'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ success: false, error: `proofOfFundsStatus must be one of: ${allowed.join(', ')}` });
  }

  investor.proofOfFundsStatus = status;
  if (req.body?.proofOfFundsDocumentUrl !== undefined) {
    investor.proofOfFundsDocumentUrl = String(req.body.proofOfFundsDocumentUrl || '').trim();
  }
  if (req.body?.fundingSource !== undefined) {
    investor.qualification = investor.qualification || {};
    investor.qualification.fundingSource = String(req.body.fundingSource || '').trim();
  }
  if (req.body?.lender !== undefined) {
    investor.qualification = investor.qualification || {};
    investor.qualification.lender = String(req.body.lender || '').trim();
  }
  if (req.body?.lastClosingTimelineDays !== undefined) {
    investor.qualification = investor.qualification || {};
    investor.qualification.lastClosingTimelineDays = asNumber(req.body.lastClosingTimelineDays, 0);
  }
  if (req.body?.targetAreas !== undefined) {
    investor.qualification = investor.qualification || {};
    investor.qualification.targetAreas = normalizeZipCodes(req.body.targetAreas);
  }
  if (req.body?.preferredDealType !== undefined) {
    investor.qualification = investor.qualification || {};
    investor.qualification.preferredDealType = String(req.body.preferredDealType || '').trim();
  }
  if (req.body?.titleReference !== undefined) {
    investor.qualification = investor.qualification || {};
    investor.qualification.titleReference = String(req.body.titleReference || '').trim();
  }

  investor.proofOfFundsVerifiedAt = status === 'verified' ? new Date().toISOString() : null;
  investor.qualificationStatus = deriveQualificationStatus(investor);
  refreshForeignCompliance(investor);
  investor.updatedAt = new Date().toISOString();
  saveWholesaleState(state);
  res.json({ success: true, investor });
});

router.patch('/investors/:id/foreign-screening', (req, res) => {
  const state = loadWholesaleState();
  const investor = state.investors.find(i => i.id === req.params.id);
  if (!investor) return res.status(404).json({ success: false, error: 'Investor not found' });

  investor.foreignBuyerProfile = {
    ...(investor.foreignBuyerProfile || {}),
    ...buildForeignBuyerProfile(req.body || {})
  };
  const compliance = refreshForeignCompliance(investor);
  investor.updatedAt = new Date().toISOString();
  saveWholesaleState(state);
  res.json({ success: true, investor, foreignCompliance: compliance });
});

router.post('/properties/:id/match-investors', (req, res) => {
  const state = loadWholesaleState();
  const property = state.properties.find(p => p.id === req.params.id);
  if (!property) {
    return res.status(404).json({ success: false, error: 'Property not found' });
  }

  const metrics = property.analysis || calculateDealMetrics(property);
  const matches = state.investors
    .map(investor => {
      const scored = scoreInvestor(investor, property, metrics);
      return {
        investorId: investor.id,
        investorName: investor.name,
        strategy: investor.strategy,
        score: scored.score,
        reasons: scored.reasons,
        foreignEligible: !(investor.foreignCompliance?.blocked),
        foreignComplianceBlockedReasons: investor.foreignCompliance?.blockedReasons || []
      };
    })
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score);

  const deal = ensureDeal(state, property.id);
  deal.investorMatches = matches;
  deal.stage = matches.length ? 'matched' : deal.stage;
  deal.contacts.sellerName = property.seller?.name || deal.contacts.sellerName;
  deal.contacts.sellerEmail = property.seller?.email || deal.contacts.sellerEmail;
  deal.contacts.sellerPhone = property.seller?.phone || deal.contacts.sellerPhone;
  deal.updatedAt = new Date().toISOString();

  property.analysis = {
    ...metrics,
    matchedAt: new Date().toISOString()
  };
  property.updatedAt = new Date().toISOString();

  saveWholesaleState(state);
  res.json({ success: true, propertyId: property.id, matches });
});

router.get('/deals', (req, res) => {
  const state = loadWholesaleState();
  res.json({ success: true, count: state.deals.length, deals: state.deals });
});

router.get('/kpi/targets', (req, res) => {
  const state = loadWholesaleState();
  const month = req.query.month;
  if (!month) {
    return res.json({ success: true, count: getKpiTargets(state).length, targets: getKpiTargets(state) });
  }
  const target = findKpiTarget(state, month);
  if (!target) return res.status(404).json({ success: false, error: 'KPI target not found for month' });
  res.json({ success: true, target });
});

router.put('/kpi/targets/:month', (req, res) => {
  const state = loadWholesaleState();
  const key = monthKey(req.params.month);
  if (!key) return res.status(400).json({ success: false, error: 'month must be YYYY-MM' });

  const payload = {
    month: key,
    revenueTarget: asNumber(req.body?.revenueTarget, 0),
    avgFeeTarget: asNumber(req.body?.avgFeeTarget, 0),
    closesTarget: asNumber(req.body?.closesTarget, 0),
    contractsTarget: asNumber(req.body?.contractsTarget, 0),
    leadsTarget: asNumber(req.body?.leadsTarget, 0),
    daysToCloseTarget: asNumber(req.body?.daysToCloseTarget, 0),
    updatedAt: new Date().toISOString()
  };

  state.meta = state.meta || {};
  state.meta.kpiTargets = getKpiTargets(state);
  const existing = state.meta.kpiTargets.find(t => t.month === key);
  if (existing) {
    Object.assign(existing, payload);
  } else {
    state.meta.kpiTargets.push(payload);
  }

  saveWholesaleState(state);
  res.json({ success: true, target: payload });
});

router.patch('/deals/:id/source-economics', (req, res) => {
  const state = loadWholesaleState();
  const deal = state.deals.find(d => d.id === req.params.id);
  if (!deal) return res.status(404).json({ success: false, error: 'Deal not found' });
  deal.sourceEconomics = deal.sourceEconomics || {};

  if (req.body?.channel !== undefined) {
    const channel = String(req.body.channel || '').trim().toLowerCase();
    if (!DEAL_SOURCE_CHANNELS.includes(channel)) {
      return res.status(400).json({ success: false, error: `channel must be one of: ${DEAL_SOURCE_CHANNELS.join(', ')}` });
    }
    deal.sourceEconomics.channel = channel;
  }
  if (req.body?.channelCostAllocated !== undefined) {
    deal.sourceEconomics.channelCostAllocated = asNumber(req.body.channelCostAllocated, 0);
  }
  if (req.body?.zip !== undefined) {
    deal.sourceEconomics.zip = normalizeZipCode(req.body.zip);
  }
  if (req.body?.leadDate !== undefined) {
    const leadDate = asIsoTimestamp(req.body.leadDate);
    if (!leadDate) return res.status(400).json({ success: false, error: 'leadDate must be a valid ISO timestamp' });
    deal.sourceEconomics.leadDate = leadDate;
  }
  if (req.body?.contractDate !== undefined) {
    const contractDate = asIsoTimestamp(req.body.contractDate);
    if (!contractDate) return res.status(400).json({ success: false, error: 'contractDate must be a valid ISO timestamp' });
    deal.sourceEconomics.contractDate = contractDate;
  }
  if (req.body?.closeDate !== undefined) {
    const closeDate = asIsoTimestamp(req.body.closeDate);
    if (!closeDate) return res.status(400).json({ success: false, error: 'closeDate must be a valid ISO timestamp' });
    deal.sourceEconomics.closeDate = closeDate;
  }
  if (req.body?.outcome !== undefined) {
    const outcome = String(req.body.outcome || '').trim().toLowerCase();
    if (!DEAL_OUTCOMES.includes(outcome)) {
      return res.status(400).json({ success: false, error: `outcome must be one of: ${DEAL_OUTCOMES.join(', ')}` });
    }
    deal.sourceEconomics.outcome = outcome;
  }
  if (req.body?.feeActual !== undefined) {
    deal.sourceEconomics.feeActual = asNumber(req.body.feeActual, 0);
  }

  deal.updatedAt = new Date().toISOString();
  saveWholesaleState(state);
  res.json({ success: true, sourceEconomics: deal.sourceEconomics, deal });
});

router.patch('/deals/:id/offer-confidence', (req, res) => {
  const state = loadWholesaleState();
  const deal = state.deals.find(d => d.id === req.params.id);
  if (!deal) return res.status(404).json({ success: false, error: 'Deal not found' });
  deal.offerConfidence = deal.offerConfidence || {};

  if (req.body?.arvConfidence !== undefined) {
    const value = String(req.body.arvConfidence || '').trim().toLowerCase();
    if (!CONFIDENCE_LEVELS.includes(value)) {
      return res.status(400).json({ success: false, error: `arvConfidence must be one of: ${CONFIDENCE_LEVELS.join(', ')}` });
    }
    deal.offerConfidence.arvConfidence = value;
  }
  if (req.body?.rehabConfidence !== undefined) {
    const value = String(req.body.rehabConfidence || '').trim().toLowerCase();
    if (!CONFIDENCE_LEVELS.includes(value)) {
      return res.status(400).json({ success: false, error: `rehabConfidence must be one of: ${CONFIDENCE_LEVELS.join(', ')}` });
    }
    deal.offerConfidence.rehabConfidence = value;
  }
  if (req.body?.arvSource !== undefined) deal.offerConfidence.arvSource = String(req.body.arvSource || '').trim();
  if (req.body?.rehabSource !== undefined) deal.offerConfidence.rehabSource = String(req.body.rehabSource || '').trim();
  if (req.body?.rentComp !== undefined) deal.offerConfidence.rentComp = asNumber(req.body.rentComp, 0);
  if (req.body?.rentCompSource !== undefined) {
    deal.offerConfidence.rentCompSource = String(req.body.rentCompSource || '').trim();
  }
  if (req.body?.manualOverrideApproved !== undefined) {
    deal.offerConfidence.manualOverrideApproved = Boolean(req.body.manualOverrideApproved);
    deal.offerConfidence.manualOverrideApprovedAt = deal.offerConfidence.manualOverrideApproved
      ? new Date().toISOString()
      : null;
  }
  if (req.body?.manualOverrideNote !== undefined) {
    deal.offerConfidence.manualOverrideNote = String(req.body.manualOverrideNote || '').trim();
  }

  deal.updatedAt = new Date().toISOString();
  saveWholesaleState(state);
  res.json({ success: true, offerConfidence: deal.offerConfidence, deal });
});

router.patch('/deals/:id/close-path', (req, res) => {
  const state = loadWholesaleState();
  const deal = state.deals.find(d => d.id === req.params.id);
  if (!deal) return res.status(404).json({ success: false, error: 'Deal not found' });
  deal.closePath = deal.closePath || {};

  if (req.body?.path !== undefined) {
    const pathValue = String(req.body.path || '').trim().toLowerCase();
    if (!CLOSE_PATHS.includes(pathValue)) {
      return res.status(400).json({ success: false, error: `path must be one of: ${CLOSE_PATHS.join(', ')}` });
    }
    deal.closePath.path = pathValue;
  }
  if (req.body?.fundingSourceConfirmed !== undefined) {
    deal.closePath.fundingSourceConfirmed = Boolean(req.body.fundingSourceConfirmed);
  }
  if (req.body?.fundingSourceName !== undefined) {
    deal.closePath.fundingSourceName = String(req.body.fundingSourceName || '').trim();
  }
  if (req.body?.doubleCloseCostBudgeted !== undefined) {
    deal.closePath.doubleCloseCostBudgeted = asNumber(req.body.doubleCloseCostBudgeted, 0);
  }
  if (req.body?.taggedBeforeBlast !== undefined) {
    deal.closePath.taggedBeforeBlast = Boolean(req.body.taggedBeforeBlast);
  }

  deal.updatedAt = new Date().toISOString();
  saveWholesaleState(state);
  res.json({ success: true, closePath: deal.closePath, deal });
});

router.patch('/deals/:id/disposition-timeline', (req, res) => {
  const state = loadWholesaleState();
  const deal = state.deals.find(d => d.id === req.params.id);
  if (!deal) return res.status(404).json({ success: false, error: 'Deal not found' });
  deal.dispositionTimeline = deal.dispositionTimeline || {};

  const fields = ['contractSignedAt', 'firstBlastSentAt', 'firstResponseAt', 'emdReceivedAt', 'closeDate'];
  for (const field of fields) {
    if (req.body?.[field] === undefined) continue;
    const value = asIsoTimestamp(req.body[field]);
    if (!value) return res.status(400).json({ success: false, error: `${field} must be a valid ISO timestamp` });
    if (field === 'firstBlastSentAt' && !(deal.closePath?.taggedBeforeBlast)) {
      return res.status(400).json({ success: false, error: 'closePath.taggedBeforeBlast must be true before firstBlastSentAt' });
    }
    deal.dispositionTimeline[field] = value;
  }

  deal.dispositionTimeline.slaBreachFlags = computeSlaBreaches(deal, state);
  deal.updatedAt = new Date().toISOString();
  saveWholesaleState(state);
  res.json({ success: true, dispositionTimeline: deal.dispositionTimeline, deal });
});

router.get('/compliance/playbook', (req, res) => {
  const state = loadWholesaleState();
  res.json({ success: true, playbook: getCompliancePlaybook(state) });
});

router.get('/market/target-zips', (req, res) => {
  const state = loadWholesaleState();
  const configured = state.meta?.acquisition?.targetZipCodes;
  const targetZipCodes = Array.isArray(configured) && configured.length
    ? configured
    : DEFAULT_DFW_TARGET_ZIPS;
  res.json({
    success: true,
    market: state.meta?.market || 'DFW',
    source: Array.isArray(configured) && configured.length ? 'configured' : 'default-dfw-hypothesis',
    targetZipCodes
  });
});

router.patch('/market/target-zips', (req, res) => {
  const state = loadWholesaleState();
  const targetZipCodes = normalizeZipCodes(req.body?.targetZipCodes);
  if (!targetZipCodes.length) {
    return res.status(400).json({ success: false, error: 'targetZipCodes must include at least one valid 5-digit ZIP' });
  }
  state.meta = state.meta || {};
  state.meta.acquisition = state.meta.acquisition || {};
  state.meta.acquisition.targetZipCodes = targetZipCodes;
  state.meta.acquisition.updatedAt = new Date().toISOString();
  saveWholesaleState(state);
  res.json({ success: true, targetZipCodes });
});

router.patch('/compliance/settings', (req, res) => {
  const state = loadWholesaleState();
  const result = applyComplianceSettings(state, req.body || {});
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }
  saveWholesaleState(state);
  res.json({ success: true, targetStateCodes: result.targetStateCodes });
});

router.post('/deals/:id/compliance/disclosures', (req, res) => {
  const state = loadWholesaleState();
  const deal = state.deals.find(d => d.id === req.params.id);
  if (!deal) return res.status(404).json({ success: false, error: 'Deal not found' });

  deal.legal = deal.legal || {};
  if (req.body?.sellerDisclosureProvidedAt) {
    deal.legal.sellerDisclosureProvidedAt = req.body.sellerDisclosureProvidedAt;
  } else if (req.body?.sellerDisclosureProvided === true && !deal.legal.sellerDisclosureProvidedAt) {
    deal.legal.sellerDisclosureProvidedAt = new Date().toISOString();
  }

  if (req.body?.buyerDisclosureProvidedAt) {
    deal.legal.buyerDisclosureProvidedAt = req.body.buyerDisclosureProvidedAt;
  } else if (req.body?.buyerDisclosureProvided === true && !deal.legal.buyerDisclosureProvidedAt) {
    deal.legal.buyerDisclosureProvidedAt = new Date().toISOString();
  }

  if (req.body?.disclosureVersion !== undefined) {
    deal.legal.disclosureVersion = String(req.body.disclosureVersion || '').trim();
  }
  if (req.body?.attorneyReviewedTemplate !== undefined) {
    deal.legal.attorneyReviewedTemplate = Boolean(req.body.attorneyReviewedTemplate);
  }
  if (req.body?.marketingMode !== undefined) {
    deal.legal.marketingMode = String(req.body.marketingMode || '').trim() || 'contract_only';
  }
  if (req.body?.notes !== undefined) {
    deal.legal.notes = String(req.body.notes || '').trim();
  }

  deal.updatedAt = new Date().toISOString();
  const compliance = evaluateDealCompliance(state, deal);
  saveWholesaleState(state);
  res.json({ success: true, deal, compliance });
});

router.get('/pipeline', (req, res) => {
  const state = loadWholesaleState();
  const invoices = listInvoices();
  const approvals = loadPendingApprovals();
  const items = state.deals.map(deal => {
    const invoice = invoices.find(i => i.dealId === deal.id || i.invoiceNumber === deal.invoiceNumber);
    const pendingClose = approvals.find(
      a => a.status === 'pending' && a.actionType === 'close-deal' && a.payload?.dealId === deal.id
    );
    const compliance = evaluateDealCompliance(state, deal);
    return {
      id: deal.id,
      propertyId: deal.propertyId,
      stage: deal.stage,
      status: deal.status,
      assignmentFeeTarget: deal.assignmentFeeTarget || 0,
      assignmentPotential: deal.assignmentPotential || 0,
      buyerName: deal.contacts?.buyerName || '',
      buyerEmail: deal.contacts?.buyerEmail || '',
      buyerPhone: deal.contacts?.buyerPhone || '',
      invoiceNumber: deal.invoiceNumber || invoice?.invoiceNumber || null,
      invoiceStatus: invoice?.status || null,
      totalUsd: invoice?.totalUsd || null,
      pendingCloseApprovalId: pendingClose?.id || null,
      complianceReady: compliance.ok,
      complianceErrors: compliance.errors,
      offerConfidence: deal.offerConfidence || null,
      closePath: deal.closePath || null,
      sourceEconomics: deal.sourceEconomics || null,
      dispositionTimeline: deal.dispositionTimeline || null,
      targetState: compliance.stateCode || '',
      updatedAt: deal.updatedAt
    };
  });
  res.json({ success: true, count: items.length, deals: items });
});

router.patch('/deals/:id/status', (req, res) => {
  const state = loadWholesaleState();
  const deal = state.deals.find(d => d.id === req.params.id);
  if (!deal) {
    return res.status(404).json({ success: false, error: 'Deal not found' });
  }

  if (req.body?.status) deal.status = req.body.status;
  if (req.body?.stage) deal.stage = req.body.stage;
  if (req.body?.note) {
    deal.notes = Array.isArray(deal.notes) ? deal.notes : [];
    deal.notes.push({ note: req.body.note, timestamp: new Date().toISOString() });
  }
  deal.updatedAt = new Date().toISOString();

  saveWholesaleState(state);
  res.json({ success: true, deal });
});

router.post('/deals/:id/follow-up', (req, res) => {
  const state = loadWholesaleState();
  const deal = state.deals.find(d => d.id === req.params.id);
  if (!deal) return res.status(404).json({ success: false, error: 'Deal not found' });
  const outcome = String(req.body?.outcome || '').trim().toLowerCase();
  if (!outcome || !FOLLOWUP_OUTCOMES.includes(outcome)) {
    return res.status(400).json({
      success: false,
      error: `outcome is required and must be one of: ${FOLLOWUP_OUTCOMES.join(', ')}`
    });
  }

  const followUp = {
    id: createId('followup'),
    channel: req.body?.channel || 'email',
    message: req.body?.message || '',
    outcome,
    contactType: req.body?.contactType || 'seller',
    contactName: req.body?.contactName || '',
    email: req.body?.email || '',
    phone: req.body?.phone || '',
    nextStepAt: req.body?.nextStepAt || null,
    timestamp: new Date().toISOString()
  };

  deal.followUps = Array.isArray(deal.followUps) ? deal.followUps : [];
  deal.followUps.push(followUp);
  if (followUp.contactType === 'seller') {
    deal.contacts.sellerName = followUp.contactName || deal.contacts.sellerName;
    deal.contacts.sellerEmail = followUp.email || deal.contacts.sellerEmail;
    deal.contacts.sellerPhone = followUp.phone || deal.contacts.sellerPhone;
  } else if (followUp.contactType === 'buyer') {
    deal.contacts.buyerName = followUp.contactName || deal.contacts.buyerName;
    deal.contacts.buyerEmail = followUp.email || deal.contacts.buyerEmail;
    deal.contacts.buyerPhone = followUp.phone || deal.contacts.buyerPhone;
  }
  if (deal.stage === 'matched') deal.stage = 'followup';
  deal.updatedAt = new Date().toISOString();

  saveWholesaleState(state);
  res.json({ success: true, deal, followUp });
});

router.post('/deals/:id/outreach-draft', (req, res) => {
  const state = loadWholesaleState();
  const deal = state.deals.find(d => d.id === req.params.id);
  if (!deal) return res.status(404).json({ success: false, error: 'Deal not found' });
  const property = state.properties.find(p => p.id === deal.propertyId);
  if (!property) return res.status(404).json({ success: false, error: 'Property not found for deal' });

  const channel = String(req.body?.channel || 'sms').trim().toLowerCase();
  const audience = String(req.body?.audience || 'seller').trim().toLowerCase();
  const supportedChannels = ['sms', 'email', 'call'];
  const supportedAudiences = ['seller', 'buyer'];
  if (!supportedChannels.includes(channel)) {
    return res.status(400).json({ success: false, error: `channel must be one of: ${supportedChannels.join(', ')}` });
  }
  if (!supportedAudiences.includes(audience)) {
    return res.status(400).json({ success: false, error: `audience must be one of: ${supportedAudiences.join(', ')}` });
  }

  const stateCode = normalizePropertyState(property.state);
  const disclosureClause = getDisclosureClause(stateCode);
  const addressLine = `${property.address}, ${property.city}, ${property.state} ${property.zipCode || ''}`.trim();
  const assignmentPotential = asNumber(deal.assignmentPotential, 0);
  const feeTarget = asNumber(deal.assignmentFeeTarget, assignmentPotential);

  const sellerDraft = {
    sms: `Hi ${deal.contacts?.sellerName || 'there'}, this is a quick follow-up on ${addressLine}. We are seeking a direct purchase agreement and may assign contractual interest to a qualified end buyer depending on closing path. ${disclosureClause}`,
    email: `Subject: Purchase follow-up for ${addressLine}\n\nHello ${deal.contacts?.sellerName || ''},\n\nWe are ready to discuss terms for ${addressLine}. Our process may include assignment of contractual interest to a qualified end buyer where allowed.\n\n${disclosureClause}\n\nRegards,\nSovereign Empire`,
    call: `Call script: confirm motivation, timeline, and condition for ${addressLine}. State clearly that your team may assign contractual interest and read disclosure: "${disclosureClause}"`
  };

  const buyerDraft = {
    sms: `Assignable contract opportunity in ${property.zipCode || property.city}: ${addressLine}. ARV/rehab available on request. Target assignment fee: $${feeTarget.toFixed(2)}. ${disclosureClause}`,
    email: `Subject: Assignable contract opportunity — ${property.city} ${property.zipCode || ''}\n\nDeal snapshot:\n- Address: ${addressLine}\n- Target assignment fee: $${feeTarget.toFixed(2)}\n- Distress signals: ${(property.distressSignals || []).join(', ') || 'N/A'}\n\nThis is an assignable contractual interest opportunity.\n${disclosureClause}\n\nReply with proof of funds and close timeline.`,
    call: `Buyer call script: present deal metrics, confirm buy-box fit and proof of funds, and state this is an assignable contract opportunity. Disclosure: "${disclosureClause}"`
  };

  const draft = audience === 'seller' ? sellerDraft[channel] : buyerDraft[channel];
  res.json({
    success: true,
    dealId: deal.id,
    audience,
    channel,
    draft,
    disclosureClause,
    note: 'Draft only. Dispatch remains human-approved.'
  });
});

router.post('/deals/:id/call', (req, res) => {
  const state = loadWholesaleState();
  const deal = state.deals.find(d => d.id === req.params.id);
  if (!deal) return res.status(404).json({ success: false, error: 'Deal not found' });

  const call = {
    id: createId('call'),
    contactType: req.body?.contactType || 'seller',
    contactName: req.body?.contactName || '',
    phone: req.body?.phone || '',
    durationSeconds: asNumber(req.body?.durationSeconds, 0),
    outcome: req.body?.outcome || 'connected',
    notes: req.body?.notes || '',
    timestamp: new Date().toISOString()
  };

  deal.calls = Array.isArray(deal.calls) ? deal.calls : [];
  deal.calls.push(call);
  if (call.contactType === 'seller') {
    deal.contacts.sellerName = call.contactName || deal.contacts.sellerName;
    deal.contacts.sellerPhone = call.phone || deal.contacts.sellerPhone;
  } else if (call.contactType === 'buyer') {
    deal.contacts.buyerName = call.contactName || deal.contacts.buyerName;
    deal.contacts.buyerPhone = call.phone || deal.contacts.buyerPhone;
  }
  if (deal.stage === 'followup' || deal.stage === 'matched') deal.stage = 'negotiation';
  deal.updatedAt = new Date().toISOString();

  saveWholesaleState(state);
  res.json({ success: true, deal, call });
});

router.post('/deals/:id/close', (req, res) => {
  const state = loadWholesaleState();
  const deal = state.deals.find(d => d.id === req.params.id);
  if (!deal) return res.status(404).json({ success: false, error: 'Deal not found' });

  const requireApproval = req.body?.requireApproval !== false;
  const complianceResult = ensureComplianceReady(state, deal);
  if (!complianceResult.success) {
    return res.status(400).json({
      success: false,
      error: complianceResult.error,
      compliance: complianceResult.compliance
    });
  }
  const opsReady = ensureOpsReadyForClose(deal);
  if (!opsReady.ok) {
    return res.status(400).json({
      success: false,
      error: 'Revenue ops gate blocked close action',
      opsErrors: opsReady.errors
    });
  }

  if (requireApproval) {
    const investorResolution = resolveInvestorForClose(state, deal, req.body?.investorId);
    if (!investorResolution.ok) {
      return res.status(400).json({ success: false, error: investorResolution.error, compliance: investorResolution.compliance });
    }
    const payload = {
      dealId: deal.id,
      investorId: investorResolution.investor.id,
      buyerName: req.body?.buyerName || deal.contacts?.buyerName || '',
      buyerEmail: req.body?.buyerEmail || deal.contacts?.buyerEmail || '',
      buyerPhone: req.body?.buyerPhone || deal.contacts?.buyerPhone || '',
      assignmentFeeUsd: asNumber(req.body?.assignmentFeeUsd, deal.assignmentFeeTarget || deal.assignmentPotential || 0),
      paymentMethod: req.body?.paymentMethod || 'Wire Transfer',
      dueInDays: asNumber(req.body?.dueInDays, 7),
      legal: deal.legal || {}
    };
    const approval = queueCloseDealApproval({ deal, payload, source: 'wholesale-close-request' });
    deal.stage = 'approval_pending';
    deal.updatedAt = new Date().toISOString();
    saveWholesaleState(state);
    return res.json({
      success: true,
      gated: true,
      approvalId: approval.id,
      message: 'Close request queued for approval.'
    });
  }

  const property = state.properties.find(p => p.id === deal.propertyId);
  const investorResolution = resolveInvestorForClose(state, deal, req.body?.investorId);
  if (!investorResolution.ok) {
    return res.status(400).json({ success: false, error: investorResolution.error, compliance: investorResolution.compliance });
  }
  const investor = investorResolution.investor;

  const assignmentFeeUsd = asNumber(req.body?.assignmentFeeUsd, deal.assignmentFeeTarget || deal.assignmentPotential || 0);
  if (assignmentFeeUsd <= 0) {
    return res.status(400).json({ success: false, error: 'assignmentFeeUsd must be greater than 0' });
  }

  const customerName = investor?.name || req.body?.buyerName || deal.contacts?.buyerName || 'Investor Buyer';
  const customerEmail = investor?.email || req.body?.buyerEmail || deal.contacts?.buyerEmail || 'N/A';
  const customerPhone = investor?.phone || req.body?.buyerPhone || deal.contacts?.buyerPhone || 'N/A';

  const invoice = createInvoice({
    productName: `Assignment fee - ${property?.address || deal.propertyId}`,
    priceUsd: assignmentFeeUsd,
    customerName,
    customerEmail,
    customerPhone,
    dealId: deal.id,
    paymentMethod: req.body?.paymentMethod || 'Wire Transfer',
    dueInDays: asNumber(req.body?.dueInDays, 7)
  });

  deal.status = 'awaiting_payment';
  deal.stage = 'closed_pending_payment';
  deal.assignmentFeeUsd = assignmentFeeUsd;
  deal.invoiceNumber = invoice.invoiceNumber;
  deal.contacts.buyerName = customerName;
  deal.contacts.buyerEmail = customerEmail;
  deal.contacts.buyerPhone = customerPhone;
  deal.closedAt = new Date().toISOString();
  deal.sourceEconomics = deal.sourceEconomics || {};
  deal.sourceEconomics.outcome = 'contract';
  deal.sourceEconomics.contractDate = deal.sourceEconomics.contractDate || deal.closedAt;
  deal.dispositionTimeline = deal.dispositionTimeline || {};
  deal.dispositionTimeline.contractSignedAt = deal.dispositionTimeline.contractSignedAt || deal.closedAt;
  deal.updatedAt = new Date().toISOString();
  property && (property.status = 'under_contract');
  property && (property.updatedAt = new Date().toISOString());

  saveWholesaleState(state);
  res.json({ success: true, deal, invoice });
});

router.post('/deals/:id/request-close-approval', (req, res) => {
  const state = loadWholesaleState();
  const deal = state.deals.find(d => d.id === req.params.id);
  if (!deal) return res.status(404).json({ success: false, error: 'Deal not found' });

  const payload = {
    dealId: deal.id,
    investorId: null,
    buyerName: req.body?.buyerName || deal.contacts?.buyerName || '',
    buyerEmail: req.body?.buyerEmail || deal.contacts?.buyerEmail || '',
    buyerPhone: req.body?.buyerPhone || deal.contacts?.buyerPhone || '',
    assignmentFeeUsd: asNumber(req.body?.assignmentFeeUsd, deal.assignmentFeeTarget || deal.assignmentPotential || 0),
    paymentMethod: req.body?.paymentMethod || 'Wire Transfer',
    dueInDays: asNumber(req.body?.dueInDays, 7),
    legal: deal.legal || {}
  };
  const investorResolution = resolveInvestorForClose(state, deal, req.body?.investorId);
  if (!investorResolution.ok) {
    return res.status(400).json({ success: false, error: investorResolution.error, compliance: investorResolution.compliance });
  }
  payload.investorId = investorResolution.investor.id;

  if (payload.assignmentFeeUsd <= 0) {
    return res.status(400).json({ success: false, error: 'assignmentFeeUsd must be greater than 0' });
  }

  const complianceResult = ensureComplianceReady(state, deal);
  if (!complianceResult.success) {
    return res.status(400).json({
      success: false,
      error: complianceResult.error,
      compliance: complianceResult.compliance
    });
  }
  const opsReady = ensureOpsReadyForClose(deal);
  if (!opsReady.ok) {
    return res.status(400).json({
      success: false,
      error: 'Revenue ops gate blocked close approval request',
      opsErrors: opsReady.errors
    });
  }

  const approval = queueCloseDealApproval({ deal, payload, source: 'wholesale-manual-approval' });
  deal.stage = 'approval_pending';
  deal.updatedAt = new Date().toISOString();
  saveWholesaleState(state);

  res.json({ success: true, approvalId: approval.id, deal });
});

router.post('/autopilot/hunt', (req, res) => {
  const state = loadWholesaleState();
  let followUpsDrafted = 0;
  let approvalsQueued = 0;
  let dealsMarkedForApproval = 0;
  let complianceBlockedDeals = 0;
  let opsBlockedDeals = 0;

  for (const deal of state.deals) {
    if (deal.status !== 'active' && deal.status !== 'awaiting_payment') continue;
    if (deal.invoiceNumber || deal.status === 'closed') continue;

    const hasMatches = Array.isArray(deal.investorMatches) && deal.investorMatches.length > 0;
    if (hasMatches && (!deal.followUps || deal.followUps.length === 0)) {
      deal.followUps = deal.followUps || [];
      deal.followUps.push({
        id: createId('followup'),
        channel: 'email',
        message: 'Auto-drafted investor disposition outreach',
        outcome: 'drafted',
        contactType: 'buyer',
        contactName: deal.contacts?.buyerName || '',
        email: deal.contacts?.buyerEmail || '',
        phone: deal.contacts?.buyerPhone || '',
        timestamp: new Date().toISOString()
      });
      deal.stage = deal.stage === 'matched' ? 'followup' : deal.stage;
      followUpsDrafted++;
    }

    const closeReady = hasMatches && ['matched', 'followup', 'negotiation', 'approval_pending'].includes(deal.stage);
    if (closeReady && !hasPendingCloseApproval(deal.id)) {
      const complianceResult = ensureComplianceReady(state, deal);
      if (!complianceResult.success) {
        complianceBlockedDeals++;
        deal.notes = Array.isArray(deal.notes) ? deal.notes : [];
        deal.notes.push({
          note: `Compliance blocked close queue: ${complianceResult.compliance.errors.join('; ')}`,
          timestamp: new Date().toISOString()
        });
        deal.updatedAt = new Date().toISOString();
        continue;
      }
      const opsReady = ensureOpsReadyForClose(deal);
      if (!opsReady.ok) {
        opsBlockedDeals++;
        deal.notes = Array.isArray(deal.notes) ? deal.notes : [];
        deal.notes.push({
          note: `Ops gate blocked close queue: ${opsReady.errors.join('; ')}`,
          timestamp: new Date().toISOString()
        });
        deal.updatedAt = new Date().toISOString();
        continue;
      }

      const approval = queueCloseDealApproval({
        deal,
        payload: {
          dealId: deal.id,
          investorId: deal.investorMatches?.[0]?.investorId || null,
          buyerName: deal.contacts?.buyerName || '',
          buyerEmail: deal.contacts?.buyerEmail || '',
          buyerPhone: deal.contacts?.buyerPhone || '',
          assignmentFeeUsd: asNumber(deal.assignmentFeeTarget || deal.assignmentPotential || 0),
          paymentMethod: 'Wire Transfer',
          dueInDays: 7,
          legal: deal.legal || {}
        },
        source: 'wholesale-autopilot'
      });
      if (approval?.id) approvalsQueued++;
      deal.stage = 'approval_pending';
      dealsMarkedForApproval++;
    }

    deal.updatedAt = new Date().toISOString();
  }

  saveWholesaleState(state);
  res.json({
    success: true,
    summary: {
      followUpsDrafted,
      approvalsQueued,
      dealsMarkedForApproval,
      complianceBlockedDeals,
      opsBlockedDeals
    }
  });
});

router.post('/deals/:id/revenue-received', (req, res) => {
  const state = loadWholesaleState();
  const deal = state.deals.find(d => d.id === req.params.id);
  if (!deal) return res.status(404).json({ success: false, error: 'Deal not found' });
  if (!deal.invoiceNumber) {
    return res.status(400).json({ success: false, error: 'Deal has no invoice. Close the deal first.' });
  }

  const payment = recordInvoicePayment({
    invoiceNumber: deal.invoiceNumber,
    paymentMethod: req.body?.paymentMethod || 'Wire Transfer',
    paymentReference: req.body?.paymentReference || '',
    paymentNotes: req.body?.paymentNotes || '',
    paidAt: req.body?.paidAt
  });
  if (!payment.success) return res.status(404).json(payment);

  const property = state.properties.find(p => p.id === deal.propertyId);
  deal.status = 'closed';
  deal.stage = 'paid';
  deal.revenueRecognized = true;
  deal.revenueAmountUsd = asNumber(payment.invoice?.totalUsd, 0);
  deal.receiptNumber = payment.receipt?.receiptNumber || deal.receiptNumber || null;
  deal.paidAt = payment.invoice?.paymentDate || new Date().toISOString();
  deal.sourceEconomics = deal.sourceEconomics || {};
  deal.sourceEconomics.outcome = 'closed';
  deal.sourceEconomics.feeActual = deal.revenueAmountUsd;
  deal.sourceEconomics.closeDate = deal.paidAt;
  deal.dispositionTimeline = deal.dispositionTimeline || {};
  if (!deal.dispositionTimeline.closeDate) {
    deal.dispositionTimeline.closeDate = deal.paidAt;
  }
  deal.dispositionTimeline.slaBreachFlags = computeSlaBreaches(deal, state);
  deal.updatedAt = new Date().toISOString();
  if (property) {
    property.status = 'closed';
    property.updatedAt = new Date().toISOString();
  }

  saveWholesaleState(state);
  res.json({ success: true, deal, invoice: payment.invoice, receipt: payment.receipt });
});

export default router;
