// sms-notify.js - SMS Notification Module for Agents
import nodemailer from 'nodemailer';

// ============================================
// CONFIGURATION
// ============================================
const YOUR_EMAIL = "sretonia@gmail.com";
const YOUR_APP_PASSWORD = "hfjdfstodcjinnue";
const YOUR_PHONE = "6799278605";
const CARRIER = `${YOUR_PHONE}@vodafone.com.fj`;

// ============================================
// SEND SMS FUNCTION
// ============================================
async function sendSMS(message, subject = 'Sovereign Empire AI Alert') {
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
            to: CARRIER,
            subject: subject,
            text: message
        });
        console.log(`📱 SMS sent: ${message.substring(0, 50)}...`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ SMS error:', error.message);
        return { success: false, error: error.message };
    }
}

// ============================================
// NOTIFICATION FUNCTIONS
// ============================================

// 1. New Lead Alert
async function notifyNewLead(lead) {
    const message = 
        `🔥 NEW LEAD!\n\n` +
        `Name: ${lead.name || 'Unknown'}\n` +
        `Company: ${lead.company || 'Unknown'}\n` +
        `Industry: ${lead.industry || 'N/A'}\n` +
        `Score: ${lead.score || 'N/A'}\n\n` +
        `📊 Follow up: sovereign-empire-api-v2-production.up.railway.app/dashboard`;
    
    return await sendSMS(message, '🔥 New Lead Alert');
}

// 2. Lead Became Interested
async function notifyInterested(lead) {
    const message = 
        `🎯 LEAD INTERESTED!\n\n` +
        `Name: ${lead.name || 'Unknown'}\n` +
        `Company: ${lead.company || 'Unknown'}\n` +
        `Interest: ${lead.interest || 'High'}\n\n` +
        `📊 Send proposal: sovereign-empire-api-v2-production.up.railway.app/dashboard`;
    
    return await sendSMS(message, '🎯 Lead Interested');
}

// 3. Proposal Sent
async function notifyProposalSent(lead, amount) {
    const message = 
        `📄 PROPOSAL SENT!\n\n` +
        `To: ${lead.name || 'Unknown'}\n` +
        `Company: ${lead.company || 'Unknown'}\n` +
        `Amount: $${amount || '0'}\n\n` +
        `📊 Track: sovereign-empire-api-v2-production.up.railway.app/dashboard`;
    
    return await sendSMS(message, '📄 Proposal Sent');
}

// 4. Deal Closed
async function notifyDealClosed(lead, amount) {
    const message = 
        `🎉 DEAL CLOSED!\n\n` +
        `Lead: ${lead.name || 'Unknown'}\n` +
        `Company: ${lead.company || 'Unknown'}\n` +
        `Amount: $${amount || '0'}\n\n` +
        `💰 Revenue generated!`;
    
    return await sendSMS(message, '🎉 Deal Closed');
}

// 5. Payment Received
async function notifyPaymentReceived(lead, amount) {
    const message = 
        `💳 PAYMENT RECEIVED!\n\n` +
        `From: ${lead.name || 'Unknown'}\n` +
        `Company: ${lead.company || 'Unknown'}\n` +
        `Amount: $${amount || '0'}\n\n` +
        `✅ Payment confirmed!`;
    
    return await sendSMS(message, '💳 Payment Received');
}

// 6. Approval Needed
async function notifyApprovalNeeded(lead, amount) {
    const message = 
        `🔔 APPROVAL NEEDED!\n\n` +
        `Lead: ${lead.name || 'Unknown'}\n` +
        `Company: ${lead.company || 'Unknown'}\n` +
        `Amount: $${amount || '0'}\n\n` +
        `📊 Review: sovereign-empire-api-v2-production.up.railway.app/dashboard`;
    
    return await sendSMS(message, '🔔 Approval Needed');
}

// 7. Daily Summary
async function notifyDailySummary(stats) {
    const message = 
        `📊 DAILY SUMMARY\n\n` +
        `📅 ${new Date().toLocaleDateString()}\n` +
        `👥 New Leads: ${stats.newLeads || 0}\n` +
        `🎯 Interested: ${stats.interested || 0}\n` +
        `📄 Proposals: ${stats.proposals || 0}\n` +
        `💰 Revenue: $${stats.revenue || 0}\n\n` +
        `📊 Dashboard: sovereign-empire-api-v2-production.up.railway.app/dashboard`;
    
    return await sendSMS(message, '📊 Daily Summary');
}

// ============================================
// TEST FUNCTION
// ============================================
async function testAllNotifications() {
    console.log('\n📱 Testing all notifications...');
    console.log('='.repeat(40));
    console.log(`📧 Email: ${YOUR_EMAIL}`);
    console.log(`📱 Phone: ${YOUR_PHONE}`);
    console.log(`📧 Carrier: ${CARRIER}`);
    console.log('');
    
    const testLead = {
        name: 'Test Client',
        company: 'Test Company',
        industry: 'Technology',
        score: 85,
        interest: 'High'
    };
    
    await notifyNewLead(testLead);
    await new Promise(r => setTimeout(r, 1000));
    
    await notifyInterested(testLead);
    await new Promise(r => setTimeout(r, 1000));
    
    await notifyProposalSent(testLead, 5000);
    await new Promise(r => setTimeout(r, 1000));
    
    await notifyDealClosed(testLead, 5000);
    await new Promise(r => setTimeout(r, 1000));
    
    await notifyPaymentReceived(testLead, 5000);
    await new Promise(r => setTimeout(r, 1000));
    
    await notifyApprovalNeeded(testLead, 5000);
    await new Promise(r => setTimeout(r, 1000));
    
    await notifyDailySummary({
        newLeads: 5,
        interested: 3,
        proposals: 2,
        revenue: 10000
    });
    
    console.log('\n✅ All tests sent! Check your phone.');
}

// ============================================
// RUN TEST
// ============================================
testAllNotifications();

// ============================================
// EXPORT
// ============================================
export {
    sendSMS,
    notifyNewLead,
    notifyInterested,
    notifyProposalSent,
    notifyDealClosed,
    notifyPaymentReceived,
    notifyApprovalNeeded,
    notifyDailySummary
};