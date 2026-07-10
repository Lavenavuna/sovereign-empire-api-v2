import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();
const wholesaleStatePath = path.join(__dirname, '..', 'wholesale-state.json');

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

    const filePath = path.join(__dirname, '..', 'high-velocity-state.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const leads = data.deals || data.leads || [];
      return res.json({ 
        success: true, 
        leads,
        count: leads.length,
        source: 'cache'
      });
    }
    res.json({ success: true, leads: [], count: 0 });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST search for new distressed property leads (placeholder for list integrations)
router.post('/search', async (req, res) => {
  const { query, sources = ['taxDefaults', 'foreclosures', 'codeViolations'] } = req.body;
  
  if (!query) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing query parameter' 
    });
  }

  try {
    // For now, return sample distressed property leads
    const sampleLeads = [
      { name: '3421 Cedar Springs Rd, Dallas', value: 18000, stage: 'sourced', source: 'Tax Default', status: 'active', updated: new Date().toISOString() },
      { name: '1802 Green Leaf Ct, Arlington', value: 12000, stage: 'analyzed', source: 'Foreclosure Feed', status: 'active', updated: new Date().toISOString() },
      { name: '992 Winding Creek Ln, Fort Worth', value: 9000, stage: 'matched', source: 'Code Violations', status: 'active', updated: new Date().toISOString() },
    ];
    
    // Save to high-velocity-state.json
    const filePath = path.join(__dirname, '..', 'high-velocity-state.json');
    let existing = { deals: [] };
    if (fs.existsSync(filePath)) {
      existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    
    // Merge
    const allLeads = [...existing.deals, ...sampleLeads];
    const unique = allLeads.filter((v, i, a) => 
      a.findIndex(t => t.name === v.name) === i
    );
    
    existing.deals = unique;
    fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
    
    res.json({
      success: true,
      message: `Found ${sampleLeads.length} new leads`,
      leads: sampleLeads,
      total: unique.length,
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;