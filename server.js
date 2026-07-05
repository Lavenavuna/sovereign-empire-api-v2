import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Import routes
import invoiceRoutes from './routes/invoice.js';
import leadsRoutes from './routes/leads.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// ── Middleware ──
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// ── Routes ──
app.use('/api/invoices', invoiceRoutes);
app.use('/api/leads', leadsRoutes);

// ── Health Check (must respond fast for Railway) ──
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// ── Root ──
app.get('/', (req, res) => {
  res.json({ 
    message: 'Sovereign Empire API is running',
    version: '2.0.0',
    endpoints: {
      invoices: '/api/invoices',
      leads: '/api/leads',
      health: '/health',
      dashboard: '/dashboard.html'
    }
  });
});

// ── Start Server ──
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Sovereign Empire API running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Invoices: http://localhost:${PORT}/api/invoices`);
  console.log(`   Leads: http://localhost:${PORT}/api/leads`);
  console.log(`   Dashboard: http://localhost:${PORT}/dashboard.html`);
});