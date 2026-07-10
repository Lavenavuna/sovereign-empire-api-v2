import express from 'express';
import { createInvoice, listInvoices, listReceipts, recordInvoicePayment } from '../lib/revenueOps.js';

const router = express.Router();

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : fallback;
}

function normalizeInvoice(raw) {
  const priceUsd = asNumber(raw.priceUsd, asNumber(raw.amount, 0));
  const vatUsd = asNumber(raw.vatUsd, asNumber(raw.vatAmount, 0));
  const totalUsd = asNumber(raw.totalUsd, asNumber(raw.totalAmount, priceUsd + vatUsd));
  return {
    ...raw,
    productName: raw.productName || raw.plan || 'N/A',
    priceUsd,
    vatUsd,
    totalUsd,
    customerEmail: raw.customerEmail || raw.clientEmail || 'N/A',
    customerPhone: raw.customerPhone || raw.clientPhone || 'N/A',
    createdAt: raw.createdAt || raw.issuedDate || raw.paymentDate || null,
    status: raw.status || (raw.paymentReceived ? 'paid' : 'pending')
  };
}

// GET all invoices
router.get('/', (req, res) => {
  const invoices = listInvoices().map(normalizeInvoice);
  res.json({ 
    success: true, 
    message: 'VAT system ready!',
    invoices,
    count: invoices.length,
    vat_rate: '12.5%',
    currency: 'FJD'
  });
});

// POST generate invoice with VAT
router.post('/generate', (req, res) => {
  try {
    const { productName, priceUsd, customerName, customerEmail, customerPhone, paymentMethod, dueInDays } = req.body;
    
    if (!productName || !priceUsd) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: productName, priceUsd' 
      });
    }

    const invoice = createInvoice({
      productName,
      priceUsd,
      customerName,
      customerEmail,
      customerPhone,
      paymentMethod: paymentMethod || 'Wire Transfer',
      dueInDays: Number(dueInDays) || 7
    });
    
    res.json({ 
      success: true, 
      message: 'Invoice generated successfully',
      invoice: invoice,
      vatBreakdown: {
        basePriceUsd: invoice.priceUsd,
        exchangeRate: invoice.exchangeRate,
        priceFjd: invoice.priceFjd,
        vatRate: invoice.vatRate + '%',
        vatFjd: invoice.vatFjd,
        vatUsd: invoice.vatUsd,
        totalUsd: invoice.totalUsd
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.post('/:invoiceNumber/pay', (req, res) => {
  const payment = recordInvoicePayment({
    invoiceNumber: req.params.invoiceNumber,
    paymentMethod: req.body?.paymentMethod,
    paymentReference: req.body?.paymentReference,
    paymentNotes: req.body?.paymentNotes,
    paidAt: req.body?.paidAt
  });
  if (!payment.success) {
    return res.status(404).json(payment);
  }
  res.json(payment);
});

router.get('/receipts', (req, res) => {
  const receipts = listReceipts();
  res.json({ success: true, count: receipts.length, receipts });
});

export default router;