import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Healthcheck (must respond quickly)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Simple root
app.get('/', (req, res) => {
  res.json({ status: 'running' });
});

// Invoice route
app.get('/api/invoices', (req, res) => {
  res.json({ 
    success: true, 
    message: 'VAT system ready!',
    vat_rate: '12.5%',
    currency: 'FJD'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});