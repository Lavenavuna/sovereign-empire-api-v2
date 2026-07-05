// live-notify.js - LIVE SMS Notifications for Agents
import { 
    sendSMS,
    notifyNewLead,
    notifyInterested,
    notifyProposalSent,
    notifyDealClosed,
    notifyPaymentReceived,
    notifyApprovalNeeded,
    notifyDailySummary
} from './sms-notify.js';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// MONITOR REAL DATA
// ============================================

// 1. Monitor High-Velocity State
function getHighVelocityState() {
    try {
        const filePath = path.join(__dirname, './high-velocity-state.json');
        if (!fs.existsSync(filePath)) {
            return { activeDeals: [], closedDeals: [], revenue: 0 };
        }
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return data;
    } catch (e) {
        console.error('Error reading high-velocity-state:', e.message);
        return { activeDeals: [], closedDeals: [], revenue: 0 };
    }
}

// 2. Monitor Apify Leads
function getApifyLeads() {
    try {
        const filePath = path.join(__dirname, './apify-leads-state.json');
        if (!fs.existsSync(filePath)) {
            return [];
        }
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return data.leads || [];
    } catch (e) {
        console.error('Error reading apify-leads-state:', e.message);
        return [];
    }
}

// 3. Monitor Revenue State
function getRevenueState() {
    try {
        const filePath = path.join(__dirname, './revenue-state.json');
        if (!fs.existsSync(filePath)) {
            return { revenue: 0, todayRevenue: 0 };
        }
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return data;
    } catch (e) {
        return { revenue: 0, todayRevenue: 0 };
    }
}

// ============================================
// TRACK CHANGES AND SEND NOTIFICATIONS
// ============================================
let previousState = {
    activeDeals: [],
    closedDeals: [],
    revenue: 0,
    leads: [],
    leadIds: []
};

async function checkForChanges() {
    console.log('\n🔍 Checking for changes...', new Date().toLocaleTimeString());
    
    const hvState = getHighVelocityState();
    const apifyLeads = getApifyLeads();
    const revenueState = getRevenueState();
    
    // Get current lead IDs for tracking
    const currentLeadIds = apifyLeads.map(l => l.id || l.name || 'unknown');
    
    // Check for new leads
    if (apifyLeads.length > previousState.leads.length) {
        const newLeads = apifyLeads.filter(l => {
            const id = l.id || l.name || 'unknown';
            return !previousState.leadIds.includes(id);
        });
        
        for (const lead of newLeads) {
            await notifyNewLead({
                name: lead.name || 'Unknown',
                company: lead.company || 'Unknown',
                industry: lead.industry || 'N/A',
                score: lead.score || 'N/A'
            });
            console.log(`✅ New lead notification sent: ${lead.name}`);
            // Wait 2 seconds between notifications
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    
    // Check for new deals (active)
    const currentActiveDeals = hvState.activeDeals || [];
    const previousActiveDeals = previousState.activeDeals || [];
    
    if (currentActiveDeals.length > previousActiveDeals.length) {
        const newDeals = currentActiveDeals.filter(d => {
            return !previousActiveDeals.some(pd => pd.id === d.id);
        });
        
        for (const deal of newDeals) {
            const lead = deal.lead || {};
            const amount = deal.amount || deal.value || 0;
            
            if (deal.stage === 'proposal_sent' || deal.stage === 'negotiation') {
                await notifyProposalSent(
                    { name: lead.name || 'Unknown', company: lead.company || 'Unknown' },
                    amount
                );
            } else if (deal.stage === 'interested') {
                await notifyInterested({
                    name: lead.name || 'Unknown',
                    company: lead.company || 'Unknown'
                });
            }
            console.log(`✅ New deal notification sent: ${lead.name}`);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    
    // Check for closed deals
    const currentClosedDeals = hvState.closedDeals || [];
    const previousClosedDeals = previousState.closedDeals || [];
    
    if (currentClosedDeals.length > previousClosedDeals.length) {
        const newClosed = currentClosedDeals.filter(d => {
            return !previousClosedDeals.some(pd => pd.id === d.id);
        });
        
        for (const deal of newClosed) {
            const lead = deal.lead || {};
            const amount = deal.amount || deal.value || 0;
            await notifyDealClosed(
                { name: lead.name || 'Unknown', company: lead.company || 'Unknown' },
                amount
            );
            console.log(`✅ Deal closed notification sent: ${lead.name}`);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    
    // Check for revenue increase
    const currentRevenue = revenueState.revenue || hvState.revenue || 0;
    if (currentRevenue > previousState.revenue) {
        const increase = currentRevenue - previousState.revenue;
        await sendSMS(
            `💳 PAYMENT RECEIVED!\n\n` +
            `Amount: $${increase.toFixed(2)}\n` +
            `Total Revenue: $${currentRevenue.toFixed(2)}\n\n` +
            `📊 Dashboard: sovereign-empire-api-v2-production.up.railway.app/revenue-dashboard`
        );
        console.log(`✅ Payment notification sent: $${increase}`);
    }
    
    // Update previous state
    previousState = {
        activeDeals: currentActiveDeals,
        closedDeals: currentClosedDeals,
        revenue: currentRevenue,
        leads: apifyLeads,
        leadIds: currentLeadIds
    };
}

// ============================================
// DAILY SUMMARY (6:00 PM)
// ============================================
async function sendDailySummary() {
    console.log('\n📊 Sending daily summary...');
    
    const hvState = getHighVelocityState();
    const apifyLeads = getApifyLeads();
    const revenueState = getRevenueState();
    
    const activeDeals = hvState.activeDeals || [];
    const interested = activeDeals.filter(d => d.stage === 'interested' || d.stage === 'proposal_sent' || d.stage === 'negotiation').length;
    const proposals = activeDeals.filter(d => d.stage === 'proposal_sent').length;
    
    const stats = {
        newLeads: apifyLeads.length,
        interested: interested,
        proposals: proposals,
        revenue: revenueState.revenue || hvState.revenue || 0
    };
    
    await notifyDailySummary(stats);
    console.log('📊 Daily summary sent');
}

// ============================================
// DAILY SUMMARY AT 6:00 PM
// ============================================
function scheduleDailySummary() {
    const now = new Date();
    const sixPM = new Date();
    sixPM.setHours(18, 0, 0, 0);
    
    let timeUntilSixPM = sixPM - now;
    if (timeUntilSixPM < 0) {
        // If 6 PM has passed, schedule for tomorrow
        sixPM.setDate(sixPM.getDate() + 1);
        timeUntilSixPM = sixPM - now;
    }
    
    console.log(`⏰ Daily summary scheduled for: ${sixPM.toLocaleTimeString()}`);
    
    setTimeout(() => {
        sendDailySummary();
        // Schedule again every 24 hours
        setInterval(sendDailySummary, 24 * 60 * 60 * 1000);
    }, timeUntilSixPM);
}

// ============================================
// START LIVE MONITORING
// ============================================
async function startLiveMonitoring() {
    console.log('\n' + '='.repeat(50));
    console.log('🚀 SOVEREIGN EMPIRE AI - LIVE NOTIFICATION SYSTEM');
    console.log('='.repeat(50));
    console.log(`📱 Phone: 6799278605`);
    console.log(`📧 Email: sretonia@gmail.com`);
    console.log(`⏰ Checking every 30 seconds`);
    console.log(`📊 Dashboard: sovereign-empire-api-v2-production.up.railway.app/dashboard`);
    console.log('='.repeat(50));
    console.log('\n📱 You will receive notifications for:');
    console.log('   🔥 New leads discovered');
    console.log('   🎯 Leads showing interest');
    console.log('   📄 Proposals sent');
    console.log('   🎉 Deals closed');
    console.log('   💳 Payments received');
    console.log('   📊 Daily summary at 6:00 PM');
    console.log('\n✅ System is LIVE! Press Ctrl+C to stop.\n');
    
    // Send system start notification
    await sendSMS(
        '🚀 Sovereign Empire AI LIVE!\n\n' +
        'System is ONLINE and monitoring for changes.\n' +
        `📅 ${new Date().toLocaleString()}\n` +
        '📊 Dashboard: sovereign-empire-api-v2-production.up.railway.app/dashboard'
    );
    
    // Initial check
    await checkForChanges();
    
    // Check every 30 seconds
    setInterval(checkForChanges, 30000);
    
    // Schedule daily summary at 6:00 PM
    scheduleDailySummary();
}

// ============================================
// HANDLE EXIT
// ============================================
process.on('SIGINT', function() {
    console.log('\n\n🛑 Stopping live notification system...');
    sendSMS('🛑 Sovereign Empire AI notification system stopped.');
    process.exit(0);
});

// ============================================
// RUN
// ============================================
startLiveMonitoring();

// ============================================
// EXPORT
// ============================================
export {
    checkForChanges,
    sendDailySummary,
    startLiveMonitoring
};