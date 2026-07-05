import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// Read high-velocity-state.json
router.get('/', (req, res) => {
  try {
    const filePath = path.join(__dirname, '..', 'high-velocity-state.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      res.json({ success: true, leads: data.deals || [] });
    } else {
      res.json({ success: true, leads: [] });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;