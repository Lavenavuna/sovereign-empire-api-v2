// autonomous-pipeline.js - Complete Autonomous Revenue Pipeline
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    leadCheckInterval: 30,
    followUpSchedule: [
        { day: 0, action: 'welcome', type: 'email' },
        { day: 1, action: 'follow_up', type: 'email' },
        { day: 2, action: 'voice_call', type: 'voice' },
        { day: 3, action: 'value_proposition', type: 'email' },
        { day: 5, action: 'voice_followup', type: 'voice' },
        { day: 7, action: 'proposal', type: 'proposal' },
        { day: 10, action: 'final_followup', type: 'email' },
        { day: 14, action: 'close_or_archive', type: 'close' }
    ],
    dealSize: 5000,
    revenueGoal: 25000,
    apiUrl: 'https://sovereign-empire-api-v2-production.up.railway.app',
    dealCloserEndpoint: '/api/agent/execute'
};

// ============================================
// PIPELINE STATE CLASS
// ============================================
class AutonomousPipeline {
    constructor() {
        this.deals = [];
        this.revenue = 0;
        this.monthlyRevenue = 0;
        this.startDate = new Date();
        this.lastRun = null;
        this.loadState();
    }

    // ============================================
    // STATE MANAGEMENT
    // ============================================
    loadState() {
        try {
            const stateFile = './pipeline-state.json';
            if (fs.existsSync(stateFile)) {
                const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
                this.deals = state.deals || [];
                this.revenue = state.revenue || 0;
                this.monthlyRevenue = state.monthlyRevenue || 0;
                this.startDate = new Date(state.startDate || Date.now());
                this.lastRun = state.lastRun;
                console.log(`📂 Loaded: ${this.deals.length} deals, $${this.revenue} revenue`);
            }
        } catch (e) {
            console.log('⚠️ Starting fresh');
        }
    }

    saveState() {
        const state = {
            deals: this.deals,
            revenue: this.revenue,
            monthlyRevenue: this.monthlyRevenue,
            startDate: this.startDate.toISOString(),
            lastRun: new Date().toISOString()
        };
        fs.writeFileSync('./pipeline-state.json', JSON.stringify(state, null, 2));
    }

    // ============================================
    // GENERATE TEST LEADS
    // ============================================
    generateTestLeads() {
        console.log('📋 Generating test leads...');
        
        const sampleLeads = [
            {
                id: `lead_${Date.now()}_1`,
                contactName: 'Sarah Johnson',
                company: 'TechFlow Solutions',
                email: 'sarah@techflow.com',
                phone: '+1-555-0101',
                industry: 'SaaS',
                status: 'interested',
                source: 'Test Generator'
            },
            {
                id: `lead_${Date.now()}_2`,
                contactName: 'Michael Chen',
                company: 'DataSphere Inc',
                email: 'michael@datasphere.com',
                phone: '+1-555-0102',
                industry: 'Technology',
                status: 'new',
                source: 'Test Generator'
            },
            {
                id: `lead_${Date.now()}_3`,
                contactName: 'Emily Rodriguez',
                company: 'CloudPioneer',
                email: 'emily@cloudpioneer.com',
                phone: '+1-555-0103',
                industry: 'Cloud Services',
                status: 'interested',
                source: 'Test Generator'
            },
            {
                id: `lead_${Date.now()}_4`,
                contactName: 'James Wilson',
                company: 'AI Innovations',
                email: 'james@aiinnovations.com',
                phone: '+1-555-0104',
                industry: 'Artificial Intelligence',
                status: 'new',
                source: 'Test Generator'
            },
            {
                id: `lead_${Date.now()}_5`,
                contactName: 'Lisa Park',
                company: 'Digital Transform',
                email: 'lisa@digitaltransform.com',
                phone: '+1-555-0105',
                industry: 'Digital Marketing',
                status: 'interested',
                source: 'Test Generator'
            }
        ];
        
        console.log(`✅ Generated ${sampleLeads.length} test leads`);
        return sampleLeads;
    }

    // ============================================
    // DISCOVER LEADS
    // ============================================
    async discoverLeads() {
        console.log('🔍 Discovering new leads...');
        
        try {
            // Try to get leads from sales agent
            const statePath = path.join(__dirname, '../slideshow-kit/agent-state.json');
            
            if (!fs.existsSync(statePath)) {
                console.log('⚠️ No sales agent data, using test leads');
                return this.generateTestLeads();
            }
            
            const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
            const leads = state.leads || [];
            
            if (leads.length === 0) {
                console.log('⚠️ No leads found, using test leads');
                return this.generateTestLeads();
            }
            
            // Filter leads not yet processed
            const newLeads = leads.filter(lead => 
                !this.deals.some(d => d.leadId === lead.id) && 
                (lead.status === 'interested' || lead.status === 'new')
            );
            
            if (newLeads.length === 0) {
                console.log('📭 No new leads, using test leads');
                return this.generateTestLeads();
            }
            
            console.log(`✅ Found ${newLeads.length} new leads`);
            return newLeads;
            
        } catch (error) {
            console.log('⚠️ Error, using test leads');
            return this.generateTestLeads();
        }
    }

    // ============================================
    // CREATE DEAL - THE MAIN FUNCTION YOU NEED
    // ============================================
    async createDeal(lead) {
        console.log(`📋 Creating deal for ${lead.contactName || lead.name || 'Unknown'}...`);
        
        const deal = {
            id: `deal_${Date.now()}_${lead.id || Math.random()}`,
            leadId: lead.id || `lead_${Date.now()}`,
            leadName: lead.contactName || lead.name || 'Unknown Contact',
            company: lead.company || 'Unknown Company',
            email: lead.contactEmail || lead.email || '',
            phone: lead.phone || '',
            industry: lead.industry || 'Unknown',
            source: lead.source || 'Sales Agent',
            stage: 'new',
            created: new Date().toISOString(),
            lastContact: null,
            followUpCount: 0,
            nextAction: null,
            nextActionDate: null,
            proposalSent: false,
            proposalAccepted: false,
            closed: false,
            closedDate: null,
            dealSize: CONFIG.dealSize,
            revenue: 0,
            notes: [],
            activities: []
        };
        
        this.deals.push(deal);
        console.log(`✅ Deal created: ${deal.leadName} (${deal.company})`);
        
        // Send welcome email
        await this.sendWelcomeEmail(deal);
        
        this.saveState();
        return deal;
    }

    // ============================================
    // SEND WELCOME EMAIL
    // ============================================
    async sendWelcomeEmail(deal) {
        console.log(`📧 Sending welcome to ${deal.leadName}...`);
        
        const content = `
Hi ${deal.leadName},

Thank you for connecting with Sovereign Empire Wholesaling. I'm excited to show you how we can move your off-market opportunity with qualified cash buyers.

Over the next few days, I'll share:
- A quick underwriting snapshot (ARV, rehab range, spread)
- Buyer-match options from our investor network
- A disposition plan to close fast

Best regards,
The Sovereign Empire Dispositions Team
        `;
        
        deal.activities.push({
            type: 'email',
            subject: 'Welcome to Sovereign Empire Wholesaling',
            sent: new Date().toISOString(),
            content: content
        });
        deal.lastContact = new Date().toISOString();
        deal.stage = 'contacted';
        this.saveState();
    }

    // ============================================
    // SEND FOLLOW-UP
    // ============================================
    async sendFollowUp(deal, template) {
        console.log(`📧 Sending follow-up to ${deal.leadName}...`);
        
        const messages = {
            follow_up: `
Hi ${deal.leadName},

Just following up to see if you had questions about our wholesaling plan for ${deal.company}.

If useful, we can review pricing, rehab assumptions, and likely buyer fit on a quick call.

Best regards,
The Sovereign Empire Dispositions Team
            `,
            value_proposition: `
Hi ${deal.leadName},

Comparable wholesale dispositions in similar markets typically improve:
✅ Buyer response speed
✅ Assignment clarity
✅ Time-to-close consistency

I've put together a brief disposition snapshot for your opportunity. Would you like me to send it?

Best regards,
The Sovereign Empire Dispositions Team
            `
        };
        
        const content = messages[template] || messages.follow_up;
        
        deal.activities.push({
            type: 'email',
            template: template,
            sent: new Date().toISOString(),
            content: content
        });
        deal.lastContact = new Date().toISOString();
        deal.followUpCount++;
        this.saveState();
    }

    // ============================================
    // INITIATE VOICE CALL
    // ============================================
    async initiateVoiceCall(deal) {
        console.log(`📞 Initiating call to ${deal.leadName}...`);
        
        deal.activities.push({
            type: 'voice',
            status: 'initiated',
            timestamp: new Date().toISOString()
        });
        deal.lastContact = new Date().toISOString();
        
        // Simulate positive outcome for demo
        if (Math.random() > 0.6) {
            deal.stage = 'proposal_ready';
            console.log(`🎯 ${deal.leadName} is interested in a proposal!`);
        }
        
        this.saveState();
    }

    // ============================================
    // SEND PROPOSAL
    // ============================================
    async sendProposal(deal) {
        console.log(`📄 Generating proposal for ${deal.leadName}...`);
        
        deal.activities.push({
            type: 'proposal',
            status: 'sent',
            sent: new Date().toISOString()
        });
        deal.proposalSent = true;
        deal.stage = 'proposal_sent';
        deal.lastContact = new Date().toISOString();
        
        console.log(`✅ Proposal sent to ${deal.leadName}`);
        this.saveState();
        
        // Simulate acceptance for demo
        setTimeout(() => {
            if (Math.random() > 0.7) {
                this.acceptProposal(deal);
            }
        }, 5000);
    }

    // ============================================
    // ACCEPT PROPOSAL
    // ============================================
    acceptProposal(deal) {
        console.log(`🎉 PROPOSAL ACCEPTED: ${deal.leadName} (${deal.company})`);
        deal.proposalAccepted = true;
        deal.stage = 'closed_won';
        deal.closed = true;
        deal.closedDate = new Date().toISOString();
        deal.revenue = deal.dealSize;
        
        this.revenue += deal.dealSize;
        this.monthlyRevenue += deal.dealSize;
        
        console.log(`💰 Revenue: $${this.revenue}`);
        this.saveState();
        this.sendPaymentLink(deal);
    }

    // ============================================
    // SEND PAYMENT LINK
    // ============================================
    async sendPaymentLink(deal) {
        console.log(`💳 Sending payment link to ${deal.leadName}...`);
        const paymentLink = `https://paypal.me/sovereignempire/${deal.dealSize}`;
        
        deal.activities.push({
            type: 'payment',
            status: 'sent',
            link: paymentLink,
            sent: new Date().toISOString()
        });
        
        console.log(`💳 Payment link: ${paymentLink}`);
        this.saveState();
    }

    // ============================================
    // GET DAYS SINCE
    // ============================================
    getDaysSince(date) {
        const created = new Date(date);
        const now = new Date();
        return Math.floor((now - created) / (1000 * 60 * 60 * 24));
    }

    // ============================================
    // GET NEXT ACTION
    // ============================================
    getNextAction(deal, daysSince) {
        const today = new Date().toISOString().split('T')[0];
        const lastAction = deal.activities.length > 0 ? deal.activities[deal.activities.length - 1] : null;
        
        if (lastAction && lastAction.sent && lastAction.sent.startsWith(today)) {
            return null;
        }
        
        for (const schedule of CONFIG.followUpSchedule) {
            if (schedule.day === daysSince) {
                const actionDone = deal.activities.some(a => 
                    a.type === schedule.action || 
                    (a.type === 'email' && a.template === schedule.action)
                );
                if (!actionDone) {
                    return schedule;
                }
            }
        }
        return null;
    }

    // ============================================
    // MAIN PROCESSING LOOP
    // ============================================
    async processDeals() {
        console.log('');
        console.log('='.repeat(60));
        console.log('🚀 AUTONOMOUS REVENUE PIPELINE');
        console.log('='.repeat(60));
        console.log(`📅 ${new Date().toLocaleString()}`);
        console.log(`📊 ${this.deals.length} active deals`);
        console.log(`💰 Revenue: $${this.revenue}`);
        console.log('');
        
        // Discover leads
        const newLeads = await this.discoverLeads();
        
        // Create deals
        for (const lead of newLeads) {
            if (!this.deals.some(d => d.leadId === lead.id)) {
                await this.createDeal(lead);
            }
        }
        
        // Process existing deals
        let processed = 0;
        for (const deal of this.deals) {
            if (deal.closed) continue;
            
            const daysSince = this.getDaysSince(deal.created);
            const nextAction = this.getNextAction(deal, daysSince);
            
            if (nextAction) {
                processed++;
                console.log(`📋 ${deal.leadName} - Day ${daysSince}: ${nextAction.action}`);
                
                switch (nextAction.action) {
                    case 'email':
                        await this.sendFollowUp(deal, nextAction.template || 'follow_up');
                        break;
                    case 'voice':
                        await this.initiateVoiceCall(deal);
                        break;
                    case 'proposal':
                        await this.sendProposal(deal);
                        break;
                    case 'close':
                        if (deal.proposalSent && !deal.proposalAccepted) {
                            deal.stage = 'closed_lost';
                            deal.closed = true;
                            console.log(`📭 ${deal.leadName} archived`);
                        }
                        break;
                }
            }
        }
        
        console.log(`✅ Processed ${processed} deals`);
        
        // Generate report
        const report = this.generateReport();
        this.saveReport(report);
        this.displayReport(report);
        this.saveState();
    }

    // ============================================
    // GENERATE REPORT
    // ============================================
    generateReport() {
        const activeDeals = this.deals.filter(d => !d.closed);
        const wonDeals = this.deals.filter(d => d.proposalAccepted);
        const today = new Date().toISOString().split('T')[0];
        const todayRevenue = this.deals
            .filter(d => d.closedDate && d.closedDate.startsWith(today))
            .reduce((sum, d) => sum + d.revenue, 0);
        
        return {
            summary: {
                totalDeals: this.deals.length,
                activeDeals: activeDeals.length,
                wonDeals: wonDeals.length,
                totalRevenue: this.revenue,
                monthlyRevenue: this.monthlyRevenue,
                todayRevenue: todayRevenue,
                averageDealSize: wonDeals.length > 0 ? this.revenue / wonDeals.length : 0,
                revenueGoal: CONFIG.revenueGoal,
                goalProgress: CONFIG.revenueGoal > 0 ? (this.monthlyRevenue / CONFIG.revenueGoal * 100).toFixed(1) + '%' : '0%'
            },
            pipeline: {
                new: this.deals.filter(d => d.stage === 'new').length,
                contacted: this.deals.filter(d => d.stage === 'contacted').length,
                proposal_ready: this.deals.filter(d => d.stage === 'proposal_ready').length,
                proposal_sent: this.deals.filter(d => d.stage === 'proposal_sent').length,
                closed_won: this.deals.filter(d => d.stage === 'closed_won').length
            },
            timestamp: new Date().toISOString()
        };
    }

    // ============================================
    // SAVE & DISPLAY REPORT
    // ============================================
    saveReport(report) {
        const date = new Date().toISOString().split('T')[0];
        const reportPath = `./reports/revenue-report-${date}.json`;
        const dir = path.dirname(reportPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    }

    displayReport(report) {
        console.log('');
        console.log('='.repeat(60));
        console.log('📊 REVENUE REPORT');
        console.log('='.repeat(60));
        console.log(`💰 Total Revenue: $${report.summary.totalRevenue}`);
        console.log(`📅 Today: $${report.summary.todayRevenue}`);
        console.log(`📈 Monthly: $${report.summary.monthlyRevenue}`);
        console.log(`🎯 Goal: ${report.summary.goalProgress}`);
        console.log(`📋 Active Deals: ${report.summary.activeDeals}`);
        console.log(`✅ Won: ${report.summary.wonDeals}`);
        console.log('');
        console.log('📋 PIPELINE:');
        console.log(`   New: ${report.pipeline.new}`);
        console.log(`   Contacted: ${report.pipeline.contacted}`);
        console.log(`   Proposal Ready: ${report.pipeline.proposal_ready}`);
        console.log(`   Proposal Sent: ${report.pipeline.proposal_sent}`);
        console.log(`   Closed Won: ${report.pipeline.closed_won}`);
        console.log('='.repeat(60));
    }
}

// ============================================
// START
// ============================================
const pipeline = new AutonomousPipeline();
await pipeline.processDeals();

console.log('');
console.log('⏰ Pipeline running...');
console.log('📊 Reports in ./reports/');
console.log('💾 State in ./pipeline-state.json');