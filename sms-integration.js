// sms-integration.js - Complete SMS System with Receipts
import twilio from 'twilio';
import fs from 'fs';

// ============================================
// CONFIGURATION
// ============================================
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '';
const OWNER_PHONE_NUMBER = process.env.OWNER_PHONE_NUMBER || '';

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.log('⚠️ Twilio credentials not set. SMS features disabled.');
}

const client = TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) : null;

// ============================================
// SMS RECEIPT FUNCTIONS
// ============================================

// 1. Send Payment Receipt
export async function sendPaymentReceipt(clientData) {
    if (!client) return console.log('⚠️ SMS disabled - no Twilio client');
    try {
        const message = `
🧾 *SOVEREIGN EMPIRE AI - RECEIPT*

Client: ${clientData.name}
Plan: ${clientData.plan || 'Business'}
Amount: $${clientData.amount || '0.00'}
Payment Method: ${clientData.paymentMethod || 'PayPal'}
Receipt #: ${clientData.receiptNumber || 'REC-' + Date.now()}

✅ Payment Confirmed
📅 ${new Date().toLocaleDateString()}

Thank you for choosing Sovereign Empire AI!
Your 18 AI agents are now active.`;

        await client.messages.create({
            body: message,
            from: TWILIO_PHONE_NUMBER,
            to: clientData.phone
        });
        console.log(`✅ Receipt sent to ${clientData.name} (${clientData.phone})`);
        return { success: true };
    } catch (error) {
        console.error('❌ Receipt SMS error:', error.message);
        return { success: false, error: error.message };
    }
}

// 2. Send Welcome SMS (No Receipt)
export async function sendWelcomeSMS(clientData) {
    if (!client) return console.log('⚠️ SMS disabled - no Twilio client');
    try {
        const message = `
🎉 *WELCOME TO SOVEREIGN EMPIRE AI*

Hi ${clientData.name},

Your 18 AI agents are now active and working 24/7!

📊 Dashboard: https://sovereign-empire-api-v2-production.up.railway.app/dashboard
📧 Support: support@sovereign-empire.ai

Your business just went autonomous!

- Sovereign Empire AI Team`;

        await client.messages.create({
            body: message,
            from: TWILIO_PHONE_NUMBER,
            to: clientData.phone
        });
        console.log(`✅ Welcome SMS sent to ${clientData.name}`);
        return { success: true };
    } catch (error) {
        console.error('❌ Welcome SMS error:', error.message);
        return { success: false, error: error.message };
    }
}

// 3. Send Invoice Reminder
export async function sendInvoiceReminder(clientData) {
    if (!client) return console.log('⚠️ SMS disabled - no Twilio client');
    try {
        const message = `
📋 *INVOICE REMINDER*

Hi ${clientData.name},

Your invoice #${clientData.invoiceNumber || 'INV-001'} is due in ${clientData.daysUntilDue || '3'} days.

Amount: $${clientData.amount || '0.00'}
Due Date: ${clientData.dueDate || 'Soon'}

🔗 Pay Now: paypal.me/sovereignempire/${clientData.amount || 0}

Reply PAY if you've already paid.

- Sovereign Empire AI`;

        await client.messages.create({
            body: message,
            from: TWILIO_PHONE_NUMBER,
            to: clientData.phone
        });
        console.log(`✅ Invoice reminder sent to ${clientData.name}`);
        return { success: true };
    } catch (error) {
        console.error('❌ Invoice reminder error:', error.message);
        return { success: false, error: error.message };
    }
}

// 4. Send Payment Confirmation
export async function sendPaymentConfirmation(clientData) {
    if (!client) return console.log('⚠️ SMS disabled - no Twilio client');
    try {
        const message = `
✅ *PAYMENT CONFIRMED*

Hi ${clientData.name},

We've received your payment of $${clientData.amount || '0.00'} for ${clientData.plan || 'Business'} plan.

Your 18 AI agents are fully active and working 24/7.

🎯 Next: Check your dashboard to see your agents in action!

- Sovereign Empire AI`;

        await client.messages.create({
            body: message,
            from: TWILIO_PHONE_NUMBER,
            to: clientData.phone
        });
        console.log(`✅ Payment confirmation sent to ${clientData.name}`);
        return { success: true };
    } catch (error) {
        console.error('❌ Payment confirmation error:', error.message);
        return { success: false, error: error.message };
    }
}

// 5. Send New Lead Alert
export async function sendNewLeadAlert(leadData) {
    if (!client) return console.log('⚠️ SMS disabled - no Twilio client');
    if (!OWNER_PHONE_NUMBER) return console.log('⚠️ Owner phone not set');
    try {
        const message = `
🔥 *NEW LEAD!*

Name: ${leadData.name || 'Unknown'}
Company: ${leadData.company || 'Unknown'}
Email: ${leadData.email || 'N/A'}
Phone: ${leadData.phone || 'N/A'}
Source: ${leadData.source || 'Apify'}

📊 ${new Date().toLocaleString()}

Follow up now!`;

        await client.messages.create({
            body: message,
            from: TWILIO_PHONE_NUMBER,
            to: OWNER_PHONE_NUMBER
        });
        console.log(`✅ Lead alert sent to owner for ${leadData.name}`);
        return { success: true };
    } catch (error) {
        console.error('❌ Lead alert error:', error.message);
        return { success: false, error: error.message };
    }
}

// 6. Send Deal Update
export async function sendDealUpdate(dealData) {
    if (!client) return console.log('⚠️ SMS disabled - no Twilio client');
    if (!OWNER_PHONE_NUMBER) return console.log('⚠️ Owner phone not set');
    try {
        const message = `
💼 *DEAL UPDATE*

Company: ${dealData.company || 'Unknown'}
Stage: ${dealData.stage || 'New'}
Value: $${dealData.value || '0'}
Status: ${dealData.status || 'Active'}

📅 ${new Date().toLocaleString()}

Action required: ${dealData.action || 'Monitor progress'}`;

        await client.messages.create({
            body: message,
            from: TWILIO_PHONE_NUMBER,
            to: OWNER_PHONE_NUMBER
        });
        console.log(`✅ Deal update sent to owner`);
        return { success: true };
    } catch (error) {
        console.error('❌ Deal update error:', error.message);
        return { success: false, error: error.message };
    }
}

// 7. Send Daily Summary Report
export async function sendDailySummary(summaryData) {
    if (!client) return console.log('⚠️ SMS disabled - no Twilio client');
    if (!OWNER_PHONE_NUMBER) return console.log('⚠️ Owner phone not set');
    try {
        const message = `
📊 *DAILY SUMMARY*

📅 ${new Date().toLocaleDateString()}

👥 New Leads: ${summaryData.newLeads || 0}
🎯 Interested: ${summaryData.interested || 0}
💼 Deals Active: ${summaryData.activeDeals || 0}
💰 Revenue Today: $${summaryData.revenueToday || 0}
📈 Total Revenue: $${summaryData.totalRevenue || 0}

✅ System Status: Operational
🤖 18 Agents Active

- Sovereign Empire AI`;

        await client.messages.create({
            body: message,
            from: TWILIO_PHONE_NUMBER,
            to: OWNER_PHONE_NUMBER
        });
        console.log(`✅ Daily summary sent to owner`);
        return { success: true };
    } catch (error) {
        console.error('❌ Daily summary error:', error.message);
        return { success: false, error: error.message };
    }
}

// 8. Send Client Receipt (with full details)
export async function sendDetailedReceipt(clientData) {
    if (!client) return console.log('⚠️ SMS disabled - no Twilio client');
    try {
        const receiptId = 'REC-' + Date.now().toString().slice(-8);
        const message = `
══════════════════════════════
🧾 *SOVEREIGN EMPIRE AI*
══════════════════════════════

*RECEIPT*: ${receiptId}
*Date*: ${new Date().toLocaleDateString()}
*Client*: ${clientData.name}
*Plan*: ${clientData.plan || 'Business'}

──────────────────────────────
*ITEM*                   *AMOUNT*
──────────────────────────────
${clientData.plan || 'Business'} Tier        $${(clientData.amount || 0).toFixed(2)}
VAT (15%)               $${((clientData.amount || 0) * 0.15).toFixed(2)}
──────────────────────────────
*TOTAL*                $${((clientData.amount || 0) * 1.15).toFixed(2)}
──────────────────────────────

*Status*: ✅ PAID
*Method*: ${clientData.paymentMethod || 'PayPal'}

Thank you for your trust in Sovereign Empire AI!
Your 18 AI agents are now active and working 24/7.

📊 Dashboard: sovereign-empire-api-v2-production.up.railway.app/dashboard
📧 Support: support@sovereign-empire.ai

Have a great day! 🚀`;

        await client.messages.create({
            body: message,
            from: TWILIO_PHONE_NUMBER,
            to: clientData.phone
        });
        console.log(`✅ Detailed receipt sent to ${clientData.name} (${clientData.phone})`);
        return { success: true };
    } catch (error) {
        console.error('❌ Receipt error:', error.message);
        return { success: false, error: error.message };
    }
}

// 9. Check SMS Status
export function getSMSStatus() {
    return {
        configured: !!client,
        accountSid: TWILIO_ACCOUNT_SID ? '✅ Set' : '❌ Missing',
        authToken: TWILIO_AUTH_TOKEN ? '✅ Set' : '❌ Missing',
        phoneNumber: TWILIO_PHONE_NUMBER || '❌ Not set',
        ownerPhone: OWNER_PHONE_NUMBER || '❌ Not set'
    };
}

// 10. Test SMS
export async function testSMS() {
    console.log('\n📱 TESTING SMS INTEGRATION');
    console.log('='.repeat(40));
    
    const status = getSMSStatus();
    console.log('Status:', status);
    
    if (!client) {
        console.log('❌ SMS not configured. Set Twilio credentials.');
        return;
    }
    
    if (!OWNER_PHONE_NUMBER) {
        console.log('❌ Owner phone not set.');
        return;
    }
    
    try {
        const testMessage = `🧪 Sovereign Empire AI SMS test: ${new Date().toLocaleString()}`;
        await client.messages.create({
            body: testMessage,
            from: TWILIO_PHONE_NUMBER,
            to: OWNER_PHONE_NUMBER
        });
        console.log('✅ Test SMS sent to owner!');
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// ============================================
// EXPORT
// ============================================
console.log('📱 SMS Integration Module loaded');
console.log('   ✅ Receipt functions available');
console.log('   ✅ Lead alerts available');
console.log('   ✅ Daily summaries available');