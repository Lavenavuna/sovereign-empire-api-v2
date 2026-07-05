import express from 'express';
import { calculateVAT } from '../lib/vat.js';
import Invoice from '../models/Invoice.js';

const router = express.Router();

router.post('/generate', async (req, res) => {
  try {
    const { productName, priceUsd, customerEmail, paypalTransactionId } = req.body;
    const vatData = await calculateVAT(priceUsd);
    const invoice = await Invoice.create({
      invoiceNumber: INV--\,
      productName,
      priceUsd: vatData.priceUsd,
      exchangeRate: vatData.exchangeRate,
      priceFjd: vatData.priceFjd,
      vatRate: vatData.vatRate,
      vatFjd: vatData.vatFjd,
      vatUsd: vatData.vatUsd,
      totalUsd: vatData.totalUsd,
      customerEmail,
      paypalTransactionId,
      status: 'paid'
    });
    res.json({ success: true, invoice, vatBreakdown: vatData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const invoices = await Invoice.findAll({ order: [['createdAt', 'DESC']] });
    res.json({ success: true, invoices });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });
    res.json({ success: true, invoice });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
