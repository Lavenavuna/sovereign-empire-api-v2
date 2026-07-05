// email-sms.js - Send SMS via Email to your iPhone
import nodemailer from 'nodemailer';
import fs from 'fs';

// ============================================
// 🔑 REPLACE THESE WITH YOUR ACTUAL VALUES
// ============================================
const YOUR_EMAIL = "sretonia@gmail.com";              // Your Gmail address
const YOUR_APP_PASSWORD = "trxtiqujjktpvtie";        // Your 16-char app password
const SMS_EMAIL = "6799278605@vodafone.com.fj";         // Your phone's SMS email

// ============================================
// SEND SMS
// ============================================
export async function sendSMS(message) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: YOUR_EMAIL,
                pass: YOUR_APP_PASSWORD
            }
        });

        const info = await transporter.sendMail({
            from: YOUR_EMAIL,
            to: SMS_EMAIL,
            subject: 'Sovereign Empire AI Alert',
            text: message
        });

        console.log('✅ SMS sent to your iPhone!');
        console.log('📱 Message ID:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ SMS error:', error.message);
        return { success: false, error: error.message };
    }
}

// ============================================
// SEND TEST SMS
// ============================================
export async function testSMS() {
    console.log('\n📱 Sending test SMS to your iPhone...');
    console.log('='.repeat(40));
    
    const result = await sendSMS(
        `🔔 *Sovereign Empire AI Test*\n\n` +
        `✅ Test message sent at: ${new Date().toLocaleString()}\n` +
        `📱 Your iPhone notifications are working!\n\n` +
        `🚀 System: ONLINE\n` +
        `🤖 Agents: 18 Active\n` +
        `📊 Dashboard: sovereign-empire-api-v2-production.up.railway.app/dashboard`
    );
    
    if (result.success) {
        console.log('\n📱 Check your iPhone! You should receive an SMS shortly.');
    }
    return result;
}

// ============================================
// SEND APPROVAL REQUEST
// ============================================
export async function sendApprovalSMS(lead, amount, dealId) {
    const message = 
        `🔔 *APPROVAL NEEDED*\n\n` +
        `Lead: ${lead.name}\n` +
        `Company: ${lead.company}\n` +
        `Amount: $${amount}\n` +
        `Deal ID: ${dealId || 'N/A'}\n\n` +
        `📊 Review: sovereign-empire-api-v2-production.up.railway.app/dashboard\n\n` +
        `Action required: Approve or reject this deal.`;
    
    return await sendSMS(message);
}

// ============================================
// SEND DEAL CLOSED NOTIFICATION
// ============================================
export async function sendDealClosedSMS(lead, amount) {
    const message = 
        `🎉 *DEAL CLOSED!*\n\n` +
        `Lead: ${lead.name}\n` +
        `Company: ${lead.company}\n` +
        `Amount: $${amount}\n\n` +
        `💰 Revenue generated!\n` +
        `📊 Dashboard: sovereign-empire-api-v2-production.up.railway.app/revenue-dashboard\n\n` +
        `🚀 Congratulations!`;
    
    return await sendSMS(message);
}

// ============================================
// SEND PAYMENT RECEIVED
// ============================================
export async function sendPaymentSMS(lead, amount) {
    const message = 
        `💳 *PAYMENT RECEIVED*\n\n` +
        `Client: ${lead.name}\n` +
        `Company: ${lead.company}\n` +
        `Amount: $${amount}\n\n` +
        `✅ Payment confirmed!\n` +
        `📊 Dashboard: sovereign-empire-api-v2-production.up.railway.app/revenue-dashboard`;
    
    return await sendSMS(message);
}

// ============================================
// SEND NEW LEAD ALERT
// ============================================
export async function sendNewLeadSMS(lead) {
    const message = 
        `🔥 *NEW LEAD ALERT!*\n\n` +
        `Name: ${lead.name}\n` +
        `Company: ${lead.company}\n` +
        `Industry: ${lead.industry || 'N/A'}\n` +
        `Score: ${lead.score || 'N/A'}\n\n` +
        `📊 Dashboard: sovereign-empire-api-v2-production.up.railway.app/dashboard\n\n` +
        `Follow up now!`;
    
    return await sendSMS(message);
}

// ============================================
// SEND DAILY SUMMARY
// ============================================
export async function sendDailySummarySMS() {
    try {
        // Read real data
        let totalLeads = 0;
        let interested = 0;
        let revenue = 0;
        
        try {
            const hvData = JSON.parse(fs.readFileSync('./high-velocity-state.json', 'utf8'));
            totalLeads = hvData.activeDeals ? hvData.activeDeals.length : 0;
            interested = hvData.activeDeals ? hvData.activeDeals.filter(d => d.stage === 'proposal_sent' || d.stage === 'negotiation').length : 0;
            revenue = hvData.revenue || 0;
        } catch (e) {}
        
        const message = 
            `📊 *DAILY SUMMARY*\n\n` +
            `📅 ${new Date().toLocaleDateString()}\n\n` +
            `👥 Leads: ${totalLeads}\n` +
            `🎯 Interested: ${interested}\n` +
            `💰 Revenue: $${revenue}\n\n` +
            `✅ System: Operational\n` +
            `🤖 Agents: 18 Active\n` +
            `📊 Dashboard: sovereign-empire-api-v2-production.up.railway.app/dashboard`;
        
        return await sendSMS(message);
    } catch (error) {
        console.error('❌ Daily summary error:', error.message);
        return { success: false, error: error.message };
    }
}

// ============================================
// RUN TEST (when executed directly)
// ============================================
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('📱 SOVEREIGN EMPIRE AI - SMS NOTIFICATIONS');
    console.log('='.repeat(40));
    testSMS();
}

// ============================================
// EXPORT ALL FUNCTIONS
// ============================================
export default {
    sendSMS,
    testSMS,
    sendApprovalSMS,
    sendDealClosedSMS,
    sendPaymentSMS,
    sendNewLeadSMS,
    sendDailySummarySMS
};