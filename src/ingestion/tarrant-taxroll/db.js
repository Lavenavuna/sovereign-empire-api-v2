import { createId, loadWholesaleState, saveWholesaleState } from '../../../lib/wholesaleStore.js';

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeZip(value) {
  return String(value || '').trim().slice(0, 5);
}

function toIsoOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function mapToProperty(record, existingProperty) {
  const signals = Array.isArray(record.single_source_signals) ? record.single_source_signals : [];
  return {
    ...(existingProperty || {}),
    id: existingProperty?.id || createId('prop'),
    address: record.situs_address || existingProperty?.address || '',
    city: record.situs_city || existingProperty?.city || 'Fort Worth',
    state: 'TX',
    zipCode: normalizeZip(record.situs_zip || existingProperty?.zipCode),
    market: 'DFW',
    source: 'tarrant_tax_roll',
    sourceLists: ['county-tax-roll'],
    distressSignals: signals,
    propertyType: existingProperty?.propertyType || 'single-family',
    purchasePrice: asNumber(existingProperty?.purchasePrice, 0),
    askPrice: asNumber(existingProperty?.askPrice, 0),
    arv: asNumber(existingProperty?.arv, asNumber(record.total_appraised_value, 0)),
    rehabEstimate: asNumber(existingProperty?.rehabEstimate, 0),
    closingCosts: asNumber(existingProperty?.closingCosts, 5000),
    status: existingProperty?.status || 'sourced',
    pipelineStatus: existingProperty?.pipelineStatus || 'new',
    seller: {
      ...(existingProperty?.seller || {}),
      name: record.owner_name || existingProperty?.seller?.name || '',
      email: existingProperty?.seller?.email || '',
      phone: existingProperty?.seller?.phone || ''
    },
    taxRollMeta: {
      sourceAccountId: record.source_account_id,
      county: record.county || 'Tarrant',
      ownerMailingAddress: record.owner_mailing_address || '',
      ownerMailingCity: record.owner_mailing_city || '',
      ownerMailingState: record.owner_mailing_state || '',
      ownerMailingZip: record.owner_mailing_zip || '',
      isAbsenteeOwner: Boolean(record.is_absentee_owner),
      landValue: asNumber(record.land_value, 0),
      improvementValue: asNumber(record.improvement_value, 0),
      totalAppraisedValue: asNumber(record.total_appraised_value, 0),
      taxDelinquentAmount: asNumber(record.tax_delinquent_amount, 0),
      taxDelinquentSinceYear: asNumber(record.tax_delinquent_since_year, 0),
      taxDelinquentYearsCount: asNumber(record.tax_delinquent_years_count, 0),
      isChronicDelinquent: Boolean(record.is_chronic_delinquent),
      lastPaymentDate: record.last_payment_date || null,
      deedDate: record.deed_date || null,
      singleSourceScore: asNumber(record.single_source_score, 0),
      singleSourceSignals: signals,
      ingestedAt: toIsoOrNull(record.ingested_at) || new Date().toISOString(),
      rawSourceRef: record.raw_source_ref || record.source_account_id || ''
    },
    updatedAt: new Date().toISOString(),
    createdAt: existingProperty?.createdAt || new Date().toISOString()
  };
}

function ensureDeal(state, property, record) {
  let deal = state.deals.find(d => d.propertyId === property.id);
  if (!deal) {
    deal = {
      id: createId('deal'),
      propertyId: property.id,
      stage: 'sourced',
      status: 'active',
      assignmentFeeTarget: 0,
      assignmentPotential: 0,
      investorMatches: [],
      followUps: [],
      calls: [],
      sourceEconomics: {
        channel: 'county',
        channelCostAllocated: 0,
        zip: property.zipCode || '',
        leadDate: new Date().toISOString(),
        contractDate: null,
        closeDate: null,
        outcome: 'lead',
        feeActual: 0
      },
      offerConfidence: {
        arvConfidence: 'low',
        arvSource: 'tarrant_tax_roll',
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
        sellerName: property.seller?.name || '',
        sellerEmail: property.seller?.email || '',
        sellerPhone: property.seller?.phone || '',
        buyerName: '',
        buyerEmail: '',
        buyerPhone: ''
      },
      notes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    state.deals.push(deal);
  } else {
    deal.sourceEconomics = deal.sourceEconomics || {};
    deal.sourceEconomics.channel = 'county';
    deal.sourceEconomics.zip = property.zipCode || deal.sourceEconomics.zip || '';
    deal.sourceEconomics.outcome = deal.sourceEconomics.outcome || 'lead';
    deal.sourceEconomics.leadDate = deal.sourceEconomics.leadDate || new Date().toISOString();
    deal.contacts = deal.contacts || {};
    deal.contacts.sellerName = property.seller?.name || deal.contacts.sellerName || '';
    deal.updatedAt = new Date().toISOString();
  }

  if (asNumber(record.single_source_score, 0) >= 3 && deal.stage === 'sourced') {
    deal.stage = 'analyzed';
  }
}

function findPropertyBySourceAccount(state, sourceAccountId) {
  return state.properties.find(
    p => p.source === 'tarrant_tax_roll' && p.taxRollMeta?.sourceAccountId === sourceAccountId
  );
}

export async function upsertProperties(normalizedRecords) {
  const state = loadWholesaleState();
  let inserted = 0;
  let updated = 0;

  for (const record of normalizedRecords) {
    const existing = findPropertyBySourceAccount(state, record.source_account_id);
    const property = mapToProperty(record, existing);

    if (existing) {
      const idx = state.properties.findIndex(p => p.id === existing.id);
      state.properties[idx] = property;
      updated += 1;
    } else {
      state.properties.push(property);
      inserted += 1;
    }
    ensureDeal(state, property, record);
  }

  saveWholesaleState(state);
  return { inserted, updated, total: normalizedRecords.length };
}

