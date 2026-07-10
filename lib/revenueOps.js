import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const INVOICES_PATH = path.join(ROOT, 'invoices.json');
const RECEIPTS_PATH = path.join(ROOT, 'receipts.json');

const EXCHANGE_RATE = 2.25; // FJD per USD
const VAT_RATE = 12.5;

function loadArray(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveArray(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function nextInvoiceNumber() {
  return `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function nextReceiptNumber() {
  return `REC-${Date.now()}`;
}

function asAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(2));
}

export function listInvoices() {
  return loadArray(INVOICES_PATH);
}

export function listReceipts() {
  return loadArray(RECEIPTS_PATH);
}

export function createInvoice({
  productName,
  priceUsd,
  customerName = 'N/A',
  customerEmail = 'N/A',
  customerPhone = 'N/A',
  dealId = null,
  paymentMethod = 'Wire Transfer',
  dueInDays = 7
}) {
  const base = asAmount(priceUsd);
  const priceFjd = asAmount(base * EXCHANGE_RATE);
  const vatFjd = asAmount(priceFjd * (VAT_RATE / 100));
  const vatUsd = asAmount(vatFjd / EXCHANGE_RATE);
  const totalUsd = asAmount(base + vatUsd);

  const invoice = {
    invoiceNumber: nextInvoiceNumber(),
    productName,
    dealId,
    customerName,
    customerEmail,
    customerPhone,
    priceUsd: base,
    exchangeRate: EXCHANGE_RATE,
    priceFjd,
    vatRate: VAT_RATE,
    vatFjd,
    vatUsd,
    totalUsd,
    createdAt: new Date().toISOString(),
    dueDate: new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000).toISOString(),
    paymentMethod,
    status: 'pending',
    paymentReceived: false
  };

  const invoices = listInvoices();
  invoices.push(invoice);
  saveArray(INVOICES_PATH, invoices);
  return invoice;
}

export function recordInvoicePayment({
  invoiceNumber,
  paymentMethod = 'Wire Transfer',
  paymentReference = '',
  paymentNotes = '',
  paidAt
}) {
  const invoices = listInvoices();
  const invoice = invoices.find(i => i.invoiceNumber === invoiceNumber);
  if (!invoice) return { success: false, error: 'Invoice not found' };
  if (invoice.paymentReceived) return { success: true, invoice, receipt: null, alreadyPaid: true };

  invoice.paymentReceived = true;
  invoice.paymentMethod = paymentMethod || invoice.paymentMethod || 'Wire Transfer';
  invoice.paymentReference = paymentReference || '';
  invoice.paymentNotes = paymentNotes || '';
  invoice.paymentDate = paidAt || new Date().toISOString();
  invoice.status = 'paid';

  const receipt = {
    receiptNumber: nextReceiptNumber(),
    invoiceNumber: invoice.invoiceNumber,
    dealId: invoice.dealId || null,
    customerName: invoice.customerName || 'N/A',
    customerEmail: invoice.customerEmail || 'N/A',
    customerPhone: invoice.customerPhone || 'N/A',
    priceUsd: invoice.priceUsd,
    vatUsd: invoice.vatUsd,
    totalUsd: invoice.totalUsd,
    currency: 'USD',
    paymentMethod: invoice.paymentMethod,
    paymentReference: invoice.paymentReference || '',
    paymentDate: invoice.paymentDate,
    status: 'confirmed',
    createdAt: new Date().toISOString()
  };

  invoice.receiptNumber = receipt.receiptNumber;
  invoice.receiptGenerated = true;

  const receipts = listReceipts();
  receipts.push(receipt);
  saveArray(INVOICES_PATH, invoices);
  saveArray(RECEIPTS_PATH, receipts);

  return { success: true, invoice, receipt };
}

