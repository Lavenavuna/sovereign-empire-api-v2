import express from 'express';
import cors from 'cors';

import invoiceRoutes from './routes/invoice.js';
import leadsRoutes from './routes/leads.js';  // ← ADD THIS

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

app.use('/api/invoices', invoiceRoutes);
app.use('/api/leads', leadsRoutes);  // ← ADD THIS

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({ message: 'Sovereign Empire API is running' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});