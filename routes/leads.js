import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();
const wholesaleStatePath = path.join(__dirname, '..', 'wholesale-state.json');
const verifiedLeadsPath = path.join(__dirname, '..', 'verified-leads.json');
const apifyLeadsStatePath = path.join(__dirname, '..', 'apify-leads-state.json');
const highVelocityStatePath = path.join(__dirname, '..', 'high-velocity-state.json');

function mapApifyLead(lead, index = 0) {
  return {
    id: lead.id || lead.dealId || `apify_${index}`,
    name: lead.address
      ? `${lead.address}${lead.city ? `, ${lead.city}` : ''}`
      : (lead.name || lead.company || 'Unknown'),
    value: Number(lead.assignmentPotential || lead.score || 0),
    stage: lead.stage || (lead.processed ? 'matched' : 'sourced'),
    source: lead.source || 'apify',
    status: lead.status || (lead.verified ? 'active' : 'pending'),
    updated: lead.updated || lead.updatedAt || lead.verifiedAt || lead.createdAt || new Date().toISOString()
  };
}

// GET all leads (from high-velocity-state.json)
router.get('/', (req, res) => {
  try {
    if (fs.existsSync(wholesaleStatePath)) {
      const wholesale = JSON.parse(fs.readFileSync(wholesaleStatePath, 'utf8'));
      const properties = Array.isArray(wholesale.properties) ? wholesale.properties : [];
      const deals = Array.isArray(wholesale.deals) ? wholesale.deals : [];
      const leads = properties.map((property) => {
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
      return res.json({
        success: true,
        leads,
        count: leads.length,
        source: 'wholesale-state'
      });
    }

    if (fs.existsSync(verifiedLeadsPath)) {
      const verifiedData = JSON.parse(fs.readFileSync(verifiedLeadsPath, 'utf8'));
      const rawLeads = Array.isArray(verifiedData.leads) ? verifiedData.leads : [];
      const leads = rawLeads.map((lead, idx) => mapApifyLead(lead, idx));
      return res.json({
        success: true, 
        leads,
        count: leads.length,
        source: 'verified-leads'
      });
    }

    if (fs.existsSync(apifyLeadsStatePath)) {
      const apifyData = JSON.parse(fs.readFileSync(apifyLeadsStatePath, 'utf8'));
      const rawLeads = Array.isArray(apifyData.qualifiedLeads) && apifyData.qualifiedLeads.length
        ? apifyData.qualifiedLeads
        : (Array.isArray(apifyData.leads) ? apifyData.leads : []);
      const leads = rawLeads.map((lead, idx) => mapApifyLead(lead, idx));
      return res.json({
        success: true,
        leads,
        count: leads.length,
        source: 'apify-leads-state'
      });
    }

    if (req.query.includeLegacy === '1' && fs.existsSync(highVelocityStatePath)) {
      const data = JSON.parse(fs.readFileSync(highVelocityStatePath, 'utf8'));
      const leads = data.deals || data.leads || [];
      return res.json({
        success: true,
        leads,
        count: leads.length,
        source: 'legacy-cache'
      });
    }

    res.json({
      success: true,
      leads: [],
      count: 0,
      source: 'empty',
      message: 'No live lead feed found yet. Populate wholesale-state.json or apify/verified lead feeds.'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST search from existing live lead feed snapshots
router.post('/search', async (req, res) => {
  const { query } = req.body;
  
  if (!query) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing query parameter' 
    });
  }

  try {
    const basePayload = fs.existsSync(verifiedLeadsPath)
      ? JSON.parse(fs.readFileSync(verifiedLeadsPath, 'utf8'))
      : (fs.existsSync(apifyLeadsStatePath) ? JSON.parse(fs.readFileSync(apifyLeadsStatePath, 'utf8')) : { leads: [] });

    const raw = Array.isArray(basePayload.qualifiedLeads) && basePayload.qualifiedLeads.length
      ? basePayload.qualifiedLeads
      : (Array.isArray(basePayload.leads) ? basePayload.leads : []);
    const leads = raw.map((lead, idx) => mapApifyLead(lead, idx));
    const q = query.toLowerCase();
    const filtered = leads.filter(lead =>
      (lead.name || '').toLowerCase().includes(q) ||
      (lead.source || '').toLowerCase().includes(q) ||
      (lead.stage || '').toLowerCase().includes(q)
    );

    res.json({
      success: true,
      message: `Found ${filtered.length} matching live leads`,
      leads: filtered,
      total: filtered.length,
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;