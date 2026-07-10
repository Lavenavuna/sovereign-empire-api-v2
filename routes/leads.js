import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();
const wholesaleStatePath = path.join(__dirname, '..', 'wholesale-state.json');

function loadWholesaleState() {
  if (!fs.existsSync(wholesaleStatePath)) {
    return { properties: [], deals: [] };
  }
  const data = JSON.parse(fs.readFileSync(wholesaleStatePath, 'utf8'));
  return {
    properties: Array.isArray(data.properties) ? data.properties : [],
    deals: Array.isArray(data.deals) ? data.deals : []
  };
}

function toLeadRows(properties, deals) {
  return properties.map((property) => {
    const deal = deals.find(d => d.propertyId === property.id);
    return {
      id: property.id,
      name: `${property.address}, ${property.city}`,
      value: deal?.assignmentPotential || property?.analysis?.assignmentPotential || 0,
      stage: deal?.stage || property.status || 'sourced',
      source: property.source || 'wholesale-state',
      status: deal?.status || 'active',
      updated: property.updatedAt || property.createdAt || new Date().toISOString()
    };
  });
}

// GET wholesaling-only leads from wholesale-state.json
router.get('/', (req, res) => {
  try {
    const { properties, deals } = loadWholesaleState();
    const leads = toLeadRows(properties, deals);
    res.json({
      success: true,
      leads,
      count: leads.length,
      source: 'wholesale-state'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST search within wholesaling-only leads
router.post('/search', async (req, res) => {
  const { query } = req.body || {};
  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'Missing query parameter'
    });
  }

  try {
    const { properties, deals } = loadWholesaleState();
    const leads = toLeadRows(properties, deals);
    const q = query.toLowerCase();
    const filtered = leads.filter(lead =>
      (lead.name || '').toLowerCase().includes(q) ||
      (lead.source || '').toLowerCase().includes(q) ||
      (lead.stage || '').toLowerCase().includes(q) ||
      (lead.status || '').toLowerCase().includes(q)
    );

    res.json({
      success: true,
      message: `Found ${filtered.length} matching wholesaling leads`,
      leads: filtered,
      total: filtered.length,
      source: 'wholesale-state'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;

