import express from 'express';
import { createId, loadWholesaleState, saveWholesaleState } from '../lib/wholesaleStore.js';
import { createInvoice, recordInvoicePayment, listInvoices } from '../lib/revenueOps.js';
import { loadPendingApprovals, savePendingApprovals, logAction } from '../lib/auditLog.js';

const router = express.Router();

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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
    state: stateCode,
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
  ensureDeal(state, property.id);
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
    if (req.body[key] !== undefined) property[key] = req.body[key];
  }
  property.updatedAt = new Date().toISOString();

  saveWholesaleState(state);
  res.json({ success: true, property });
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

router.post('/investors', (req, res) => {
  const { name, strategy } = req.body || {};
  if (!name || !strategy) {
    return res.status(400).json({ success: false, error: 'name and strategy are required' });
  }

  const state = loadWholesaleState();
  const investor = {
    id: createId('inv'),
    name,
    strategy,
    email: req.body.email || '',
    phone: req.body.phone || '',
    minPrice: asNumber(req.body.minPrice, 0),
    maxPrice: asNumber(req.body.maxPrice, 1_000_000_000),
    minArv: asNumber(req.body.minArv, 0),
    maxArv: asNumber(req.body.maxArv, 1_000_000_000),
    maxRehab: asNumber(req.body.maxRehab, 1_000_000_000),
    zipCodes: Array.isArray(req.body.zipCodes) ? req.body.zipCodes : [],
    preferredPropertyTypes: Array.isArray(req.body.preferredPropertyTypes) ? req.body.preferredPropertyTypes : [],
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  state.investors.push(investor);
  saveWholesaleState(state);
  res.status(201).json({ success: true, investor });
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
        reasons: scored.reasons
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

router.get('/pipeline', (req, res) => {
  const state = loadWholesaleState();
  const invoices = listInvoices();
  const approvals = loadPendingApprovals();
  const items = state.deals.map(deal => {
    const invoice = invoices.find(i => i.dealId === deal.id || i.invoiceNumber === deal.invoiceNumber);
    const pendingClose = approvals.find(
      a => a.status === 'pending' && a.actionType === 'close-deal' && a.payload?.dealId === deal.id
    );
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

  const followUp = {
    id: createId('followup'),
    channel: req.body?.channel || 'email',
    message: req.body?.message || '',
    outcome: req.body?.outcome || 'sent',
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
  if (requireApproval) {
    const payload = {
      dealId: deal.id,
      investorId: req.body?.investorId || null,
      buyerName: req.body?.buyerName || deal.contacts?.buyerName || '',
      buyerEmail: req.body?.buyerEmail || deal.contacts?.buyerEmail || '',
      buyerPhone: req.body?.buyerPhone || deal.contacts?.buyerPhone || '',
      assignmentFeeUsd: asNumber(req.body?.assignmentFeeUsd, deal.assignmentFeeTarget || deal.assignmentPotential || 0),
      paymentMethod: req.body?.paymentMethod || 'Wire Transfer',
      dueInDays: asNumber(req.body?.dueInDays, 7)
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
  const investor = req.body?.investorId
    ? state.investors.find(i => i.id === req.body.investorId)
    : null;

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
    investorId: req.body?.investorId || null,
    buyerName: req.body?.buyerName || deal.contacts?.buyerName || '',
    buyerEmail: req.body?.buyerEmail || deal.contacts?.buyerEmail || '',
    buyerPhone: req.body?.buyerPhone || deal.contacts?.buyerPhone || '',
    assignmentFeeUsd: asNumber(req.body?.assignmentFeeUsd, deal.assignmentFeeTarget || deal.assignmentPotential || 0),
    paymentMethod: req.body?.paymentMethod || 'Wire Transfer',
    dueInDays: asNumber(req.body?.dueInDays, 7)
  };

  if (payload.assignmentFeeUsd <= 0) {
    return res.status(400).json({ success: false, error: 'assignmentFeeUsd must be greater than 0' });
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
          dueInDays: 7
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
      dealsMarkedForApproval
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
  deal.updatedAt = new Date().toISOString();
  if (property) {
    property.status = 'closed';
    property.updatedAt = new Date().toISOString();
  }

  saveWholesaleState(state);
  res.json({ success: true, deal, invoice: payment.invoice, receipt: payment.receipt });
});

export default router;
