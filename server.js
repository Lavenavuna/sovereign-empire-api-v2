import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Sovereign Empire API is running' });
});

// GET all invoices (dashboard)
app.get('/api/invoices', (req, res) => {
  res.json({ 
    success: true, 
    message: 'VAT system ready!',
    vat_rate: '12.5%',
    currency: 'FJD'
  });
});

// POST generate invoice with VAT
app.post('/api/invoices/generate', (req, res) => {
  try {
    const { productName, priceUsd, customerEmail, paypalTransactionId } = req.body;
    
    if (!productName || !priceUsd) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: productName, priceUsd' 
      });
    }

    // Fixed exchange rate (you can make this dynamic later)
    const exchangeRate = 2.25; // FJD per USD
    const vatRate = 12.5; // Fiji VAT %
    
    const priceFjd = priceUsd * exchangeRate;
    const vatFjd = priceFjd * (vatRate / 100);
    const vatUsd = vatFjd / exchangeRate;
    const totalUsd = priceUsd + vatUsd;
    
    const invoice = {
      invoiceNumber: `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      productName,
      priceUsd: parseFloat(priceUsd.toFixed(2)),
      exchangeRate: parseFloat(exchangeRate.toFixed(4)),
      priceFjd: parseFloat(priceFjd.toFixed(2)),
      vatRate: vatRate,
      vatFjd: parseFloat(vatFjd.toFixed(2)),
      vatUsd: parseFloat(vatUsd.toFixed(2)),
      totalUsd: parseFloat(totalUsd.toFixed(2)),
      customerEmail: customerEmail || 'N/A',
      paypalTransactionId: paypalTransactionId || 'N/A',
      createdAt: new Date().toISOString(),
      status: 'paid'
    };
    
    res.json({ 
      success: true, 
      message: 'Invoice generated successfully',
      invoice: invoice,
      vatBreakdown: {
        basePriceUsd: parseFloat(priceUsd.toFixed(2)),
        exchangeRate: parseFloat(exchangeRate.toFixed(4)),
        priceFjd: parseFloat(priceFjd.toFixed(2)),
        vatRate: vatRate + '%',
        vatFjd: parseFloat(vatFjd.toFixed(2)),
        vatUsd: parseFloat(vatUsd.toFixed(2)),
        totalUsd: parseFloat(totalUsd.toFixed(2))
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Start server

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});