import express from 'express';
import { createId, loadWholesaleState, saveWholesaleState } from '../lib/wholesaleStore.js';

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
      notes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    state.deals.push(deal);
  }
  return deal;
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

  res.json({
    success: true,
    vision: state.meta.vision,
    market: state.meta.market,
    summary: {
      properties: state.properties.length,
      pendingProperties,
      investors: state.investors.length,
      deals: state.deals.length,
      avgAssignmentPotential
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

export default router;

