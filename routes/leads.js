import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// GET all leads (from high-velocity-state.json)
router.get('/', (req, res) => {
  try {
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

// POST search for new leads (placeholder for Apify integration)
router.post('/search', async (req, res) => {
  const { query, sources = ['googleMaps', 'linkedIn'] } = req.body;
  
  if (!query) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing query parameter' 
    });
  }

  try {
    // For now, return sample leads
    const sampleLeads = [
      { name: 'AI Solutions Inc', value: 20000, stage: 'negotiation', source: 'Apify', status: 'pending', updated: new Date().toISOString() },
      { name: 'TechStart Corp', value: 12000, stage: 'proposal', source: 'LinkedIn', status: 'won', updated: new Date().toISOString() },
      { name: 'DataFlow Ltd', value: 7500, stage: 'discovery', source: 'Website', status: 'open', updated: new Date().toISOString() },
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