// revenue-engine.js - Complete Working Revenue Engine
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('='.repeat(50));
console.log('💰 SOVEREIGN EMPIRE REVENUE ENGINE');
console.log('='.repeat(50));
console.log(`📅 Started: ${new Date().toLocaleString()}`);
console.log('');

// ============================================
// STATE MANAGEMENT
// ============================================
const STATE_FILE = './revenue-state.json';

function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
            console.log('📂 Loaded revenue state');
            return data;
        }
    } catch (e) {
        console.log('⚠️ Error loading state, creating new');
    }
    return {
        revenue: 0,
        monthlyRevenue: 0,
        clients: [],
        deals: [],
        transactions: [],
        creators: [],
        agents: [],
        lastRun: null
    };
}

function saveState(state) {
    state.lastRun = new Date().toISOString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    console.log('💾 State saved');
}

// ============================================
// REVENUE FUNCTIONS
// ============================================
function addClient(state, name, email, tier = 'assist') {
    const tiers = {
        assist: { price: 29, label: 'Assist' },
        suggest: { price: 99, label: 'Suggest' },
        act: { price: 499, label: 'Act' }
    };

    const client = {
        id: `client_${Date.now()}`,
        name: name,
        email: email,
        tier: tier,
        price: tiers[tier].price,
        joined: new Date().toISOString(),
        revenue: 0
    };

    state.clients.push(client);
    console.log(`✅ New client: ${name} (${tiers[tier].label} - $${tiers[tier].price}/month)`);
    return state;
}

function addDeal(state, company, value, contact) {
    const deal = {
        id: `deal_${Date.now()}`,
        company: company,
        value: value,
        contact: contact,
        status: 'open',
        created: new Date().toISOString()
    };

    state.deals.push(deal);
    state.revenue += value;
    state.monthlyRevenue += value;
    console.log(`💼 New deal: ${company} - $${value}`);
    return state;
}

function addTransaction(state, clientId, amount, type = 'subscription') {
    const transaction = {
        id: `tx_${Date.now()}`,
        clientId: clientId,
        amount: amount,
        type: type,
        timestamp: new Date().toISOString()
    };

    state.transactions.push(transaction);
    state.revenue += amount;
    state.monthlyRevenue += amount;
    console.log(`💳 Transaction: $${amount} (${type})`);
    return state;
}

// ============================================
// REPORT GENERATION
// ============================================
function generateReport(state) {
    const totalClients = state.clients.length;
    const totalDeals = state.deals.length;
    const openDeals = state.deals.filter(d => d.status === 'open').length;
    const closedDeals = state.deals.filter(d => d.status === 'closed').length;
    const totalTransactions = state.transactions.length;
    const totalRevenue = state.revenue;
    const monthlyRevenue = state.monthlyRevenue;

    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            totalRevenue: totalRevenue,
            monthlyRevenue: monthlyRevenue,
            totalClients: totalClients,
            totalDeals: totalDeals,
            openDeals: openDeals,
            closedDeals: closedDeals,
            totalTransactions: totalTransactions,
            averageDealSize: totalDeals > 0 ? Math.round(totalRevenue / totalDeals) : 0
        },
        clients: state.clients.slice(0, 5).map(c => ({
            name: c.name,
            tier: c.tier,
            price: c.price
        })),
        recentDeals: state.deals.slice(-5),
        recentTransactions: state.transactions.slice(-5)
    };

    return report;
}

function displayReport(report) {
    console.log('');
    console.log('='.repeat(50));
    console.log('📊 REVENUE REPORT');
    console.log('='.repeat(50));
    console.log(`💰 Total Revenue: $${report.summary.totalRevenue}`);
    console.log(`📈 Monthly Revenue: $${report.summary.monthlyRevenue}`);
    console.log(`👥 Clients: ${report.summary.totalClients}`);
    console.log(`📋 Deals: ${report.summary.totalDeals} (${report.summary.openDeals} open, ${report.summary.closedDeals} closed)`);
    console.log(`💳 Transactions: ${report.summary.totalTransactions}`);
    console.log(`📊 Average Deal Size: $${report.summary.averageDealSize}`);
    console.log('');
    console.log('👤 Recent Clients:');
    for (const client of report.clients) {
        console.log(`   - ${client.name} (${client.tier}) - $${client.price}/month`);
    }
    console.log('='.repeat(50));
}

// ============================================
// MAIN ENGINE
// ============================================
function runEngine() {
    console.log('🔄 Running revenue engine...');
    
    // Load state
    let state = loadState();
    
    // Add sample data if empty
    if (state.clients.length === 0) {
        console.log('📋 No clients found. Adding sample data...');
        state = addClient(state, 'TechFlow Solutions', 'sarah@techflow.com', 'assist');
        state = addClient(state, 'DataSphere Inc', 'michael@datasphere.com', 'suggest');
        state = addClient(state, 'CloudPioneer', 'emily@cloudpioneer.com', 'act');
        state = addDeal(state, 'AI Innovations', 25000, 'james@aiinnovations.com');
        state = addDeal(state, 'Digital Transform', 15000, 'lisa@digitaltransform.com');
        state = addTransaction(state, 'client_1', 29, 'subscription');
        state = addTransaction(state, 'client_2', 99, 'subscription');
        state = addTransaction(state, 'client_3', 499, 'subscription');
    }
    
    // Generate and display report
    const report = generateReport(state);
    displayReport(report);
    
    // Save state
    saveState(state);
    
    console.log('');
    console.log('✅ Revenue engine run complete');
    console.log(`📅 Next run: ${new Date(Date.now() + 7200000).toLocaleString()}`);
    console.log('');
}

// ============================================
// SCHEDULE
// ============================================
// Run immediately
runEngine();

// Run every 2 hours
setInterval(runEngine, 2 * 60 * 60 * 1000);

console.log('⏰ Revenue engine scheduled: Every 2 hours');
console.log('📊 Check revenue-state.json for details');
console.log('💡 Press Ctrl+C to stop');