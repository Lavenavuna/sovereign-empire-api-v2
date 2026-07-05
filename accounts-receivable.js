// accounts-receivable.js - Accounts Receivable Agent with Full Audit Trail
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// ACCOUNTS RECEIVABLE CONFIG
// ============================================
const CONFIG = {
    stateFile: './accounts-receivable.json',
    invoicesFile: './invoices.json',
    receiptsFile: './receipts.json',
    auditFile: './audit-trail.json',
    vatRate: 0.125, // 12.5% VAT (Fiji) - Effective 1 August 2025
    currency: 'FJD'
};

// ============================================
// ACCOUNTS RECEIVABLE AGENT
// ============================================
class AccountsReceivableAgent {
    constructor() {
        this.invoices = [];
        this.receipts = [];
        this.auditTrail = [];
        this.clients = [];
        this.revenue = 0;
        this.pendingInvoices = 0;
        this.overdueInvoices = 0;
        this.loadState();
        console.log('📊 Accounts Receivable Agent initialized');
    }

    loadState() {
        try {
            if (fs.existsSync(CONFIG.invoicesFile)) {
                this.invoices = JSON.parse(fs.readFileSync(CONFIG.invoicesFile, 'utf8'));
            }
            if (fs.existsSync(CONFIG.receiptsFile)) {
                this.receipts = JSON.parse(fs.readFileSync(CONFIG.receiptsFile, 'utf8'));
            }
            if (fs.existsSync(CONFIG.auditFile)) {
                this.auditTrail = JSON.parse(fs.readFileSync(CONFIG.auditFile, 'utf8'));
            }
            this.calculateMetrics();
        } catch (e) {
            console.log('📂 Starting fresh accounts receivable');
        }
    }

    saveState() {
        fs.writeFileSync(CONFIG.invoicesFile, JSON.stringify(this.invoices, null, 2));
        fs.writeFileSync(CONFIG.receiptsFile, JSON.stringify(this.receipts, null, 2));
        fs.writeFileSync(CONFIG.auditFile, JSON.stringify(this.auditTrail, null, 2));
    }

    // ============================================
    // CREATE INVOICE
    // ============================================
    createInvoice(clientData) {
        const invoiceNumber = 'INV-' + String(Date.now()).slice(-8) + '-' + String(this.invoices.length + 1).padStart(3, '0');
        const vat = clientData.amount * CONFIG.vatRate;
        const total = clientData.amount + vat;

        const invoice = {
            invoiceNumber: invoiceNumber,
            clientName: clientData.name,
            clientEmail: clientData.email,
            clientPhone: clientData.phone,
            clientAddress: clientData.address || 'N/A',
            clientTIN: clientData.tin || 'N/A',
            plan: clientData.plan || 'Business',
            amount: clientData.amount,
            vatRate: CONFIG.vatRate * 100 + '%',
            vatAmount: vat,
            totalAmount: total,
            currency: CONFIG.currency,
            status: 'pending',
            issuedDate: new Date().toISOString(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            paymentMethod: clientData.paymentMethod || 'PayPal',
            items: clientData.items || [
                { description: clientData.plan + ' Tier - 18 AI Agents', quantity: 1, unitPrice: clientData.amount }
            ],
            notes: clientData.notes || 'Thank you for choosing Sovereign Empire AI',
            paymentReceived: false,
            paymentDate: null,
            receiptNumber: null,
            receiptGenerated: false,
            auditId: null
        };

        this.invoices.push(invoice);
        this.audit('INVOICE_CREATED', invoiceNumber, 'Invoice created for ' + clientData.name);
        this.saveState();
        this.calculateMetrics();

        console.log(`📄 Invoice ${invoiceNumber} created for ${clientData.name}`);
        return invoice;
    }

    // ============================================
    // RECORD PAYMENT
    // ============================================
    recordPayment(invoiceNumber, paymentData) {
        const invoice = this.invoices.find(i => i.invoiceNumber === invoiceNumber);
        if (!invoice) {
            console.error(`❌ Invoice ${invoiceNumber} not found`);
            return null;
        }

        if (invoice.paymentReceived) {
            console.log(`⚠️ Invoice ${invoiceNumber} already paid`);
            return invoice;
        }

        const receiptNumber = 'REC-' + String(Date.now()).slice(-8);

        // Update invoice
        invoice.paymentReceived = true;
        invoice.paymentDate = new Date().toISOString();
        invoice.status = 'paid';
        invoice.receiptNumber = receiptNumber;
        invoice.paymentMethod = paymentData.method || invoice.paymentMethod;
        invoice.paymentReference = paymentData.reference || 'N/A';
        invoice.paymentNotes = paymentData.notes || '';

        // Create receipt
        const receipt = {
            receiptNumber: receiptNumber,
            invoiceNumber: invoiceNumber,
            clientName: invoice.clientName,
            clientEmail: invoice.clientEmail,
            clientPhone: invoice.clientPhone,
            amount: invoice.amount,
            vatAmount: invoice.vatAmount,
            totalAmount: invoice.totalAmount,
            currency: invoice.currency,
            plan: invoice.plan,
            paymentMethod: invoice.paymentMethod,
            paymentDate: invoice.paymentDate,
            paymentReference: invoice.paymentReference,
            status: 'confirmed',
            generatedBy: 'Accounts Receivable Agent',
            timestamp: new Date().toISOString()
        };

        this.receipts.push(receipt);
        this.revenue += invoice.totalAmount;
        invoice.receiptGenerated = true;

        this.audit('PAYMENT_RECEIVED', invoiceNumber, 'Payment received from ' + invoice.clientName);
        this.saveState();
        this.calculateMetrics();

        console.log(`💰 Payment recorded for ${invoiceNumber} - Receipt ${receiptNumber}`);
        return receipt;
    }

    // ============================================
    // GENERATE RECEIPT (Carbon Copy)
    // ============================================
    generateReceipt(invoiceNumber) {
        const invoice = this.invoices.find(i => i.invoiceNumber === invoiceNumber);
        if (!invoice) {
            console.error(`❌ Invoice ${invoiceNumber} not found`);
            return null;
        }

        if (!invoice.paymentReceived) {
            console.log(`⚠️ Invoice ${invoiceNumber} not yet paid`);
            return null;
        }

        const receipt = this.receipts.find(r => r.invoiceNumber === invoiceNumber);
        if (!receipt) {
            console.error(`❌ Receipt for ${invoiceNumber} not found`);
            return null;
        }

        // Create carbon copy (duplicate)
        const carbonCopy = {
            ...receipt,
            carbonCopy: true,
            copyNumber: 'CC-' + String(Date.now()).slice(-6),
            generatedAt: new Date().toISOString()
        };

        this.audit('RECEIPT_COPY_GENERATED', invoiceNumber, 'Carbon copy generated for ' + invoice.clientName);
        this.saveState();

        return carbonCopy;
    }

    // ============================================
    // GENERATE RECEIPT TEXT (For SMS/Email)
    // ============================================
    generateReceiptText(receipt) {
        const vat = receipt.amount * CONFIG.vatRate;
        const total = receipt.amount + vat;

        return `
══════════════════════════════
🧾 SOVEREIGN EMPIRE AI
══════════════════════════════

RECEIPT: ${receipt.receiptNumber}
INVOICE: ${receipt.invoiceNumber}
Date: ${new Date(receipt.paymentDate).toLocaleDateString()}
Client: ${receipt.clientName}
Plan: ${receipt.plan}

──────────────────────────────
ITEM                       AMOUNT
──────────────────────────────
${receipt.plan} Tier            $${receipt.amount.toFixed(2)}
VAT (15%)                    $${vat.toFixed(2)}
──────────────────────────────
TOTAL                      $${total.toFixed(2)}
──────────────────────────────

Status: ✅ PAID
Method: ${receipt.paymentMethod}
Ref: ${receipt.paymentReference || 'N/A'}

Thank you for your trust in Sovereign Empire AI!
Your 18 AI agents are now active and working 24/7.

📊 Dashboard: sovereign-empire-api-v2-production.up.railway.app/dashboard
📧 Support: support@sovereign-empire.ai

Have a great day! 🚀
`;
    }

    // ============================================
    // AUDIT TRAIL
    // ============================================
    audit(action, reference, details) {
        const entry = {
            id: 'AUDIT-' + String(Date.now()).slice(-10),
            timestamp: new Date().toISOString(),
            action: action,
            reference: reference,
            details: details,
            user: 'Accounts Receivable Agent',
            ip: 'N/A'
        };
        this.auditTrail.push(entry);
    }

    // ============================================
    // CALCULATE METRICS
    // ============================================
    calculateMetrics() {
        this.pendingInvoices = this.invoices.filter(i => i.status === 'pending').length;
        this.overdueInvoices = this.invoices.filter(i => 
            i.status === 'pending' && new Date(i.dueDate) < new Date()
        ).length;
        this.totalInvoices = this.invoices.length;
        this.paidInvoices = this.invoices.filter(i => i.status === 'paid').length;
    }

    // ============================================
    // GENERATE REPORT
    // ============================================
    generateReport() {
        this.calculateMetrics();

        const report = {
            summary: {
                totalInvoices: this.totalInvoices,
                paidInvoices: this.paidInvoices,
                pendingInvoices: this.pendingInvoices,
                overdueInvoices: this.overdueInvoices,
                totalRevenue: this.revenue,
                averageInvoice: this.totalInvoices > 0 ? this.revenue / this.totalInvoices : 0
            },
            recentInvoices: this.invoices.slice(-5).map(i => ({
                invoiceNumber: i.invoiceNumber,
                clientName: i.clientName,
                amount: i.totalAmount,
                status: i.status,
                date: i.issuedDate
            })),
            recentReceipts: this.receipts.slice(-5).map(r => ({
                receiptNumber: r.receiptNumber,
                clientName: r.clientName,
                amount: r.totalAmount,
                date: r.paymentDate
            })),
            recentAudit: this.auditTrail.slice(-10),
            timestamp: new Date().toISOString()
        };

        return report;
    }

    // ============================================
    // DISPLAY REPORT
    // ============================================
    displayReport() {
        const report = this.generateReport();
        console.log('\n' + '='.repeat(60));
        console.log('📊 ACCOUNTS RECEIVABLE REPORT');
        console.log('='.repeat(60));
        console.log(`📋 Total Invoices: ${report.summary.totalInvoices}`);
        console.log(`✅ Paid: ${report.summary.paidInvoices}`);
        console.log(`⏳ Pending: ${report.summary.pendingInvoices}`);
        console.log(`⚠️ Overdue: ${report.summary.overdueInvoices}`);
        console.log(`💰 Total Revenue: $${report.summary.totalRevenue.toFixed(2)}`);
        console.log(`📊 Average Invoice: $${report.summary.averageInvoice.toFixed(2)}`);
        console.log('='.repeat(60));

        if (report.recentInvoices.length > 0) {
            console.log('\n📄 Recent Invoices:');
            for (const inv of report.recentInvoices) {
                console.log(`   ${inv.invoiceNumber} - ${inv.clientName} - $${inv.amount} - ${inv.status}`);
            }
        }

        if (report.recentReceipts.length > 0) {
            console.log('\n🧾 Recent Receipts:');
            for (const rec of report.recentReceipts) {
                console.log(`   ${rec.receiptNumber} - ${rec.clientName} - $${rec.amount}`);
            }
        }

        console.log('\n📋 Recent Audit Trail:');
        for (const audit of report.recentAudit) {
            console.log(`   ${audit.timestamp.slice(0, 10)} ${audit.action} - ${audit.details}`);
        }
        console.log('='.repeat(60));
    }

    // ============================================
    // DAILY RUN
    // ============================================
    async run() {
        console.log('\n🔄 Running Accounts Receivable Agent...');
        this.displayReport();
        this.saveState();
    }
}

// ============================================
// START
// ============================================
const arAgent = new AccountsReceivableAgent();

// Run immediately
await arAgent.run();

// Run every 6 hours
setInterval(async function() {
    await arAgent.run();
}, 6 * 60 * 60 * 1000);

console.log('\n⏰ Accounts Receivable Agent running every 6 hours');
console.log('📄 Invoices: invoices.json');
console.log('🧾 Receipts: receipts.json');
console.log('📋 Audit Trail: audit-trail.json');

// ============================================
// EXPORT
// ============================================
export { AccountsReceivableAgent };