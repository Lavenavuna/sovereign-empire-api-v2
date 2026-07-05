// high-velocity-sales.js - High-Velocity Sales Agent DNA
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// HIGH-VELOCITY SALES CONFIG
// ============================================
const CONFIG = {
    // Target: Close deals within 24-48 hours
    maxCloseTime: 48, // hours
    followUpInterval: 2, // hours
    maxFollowUps: 6,
    
    // Closing sequences
    closingSequences: {
        interested: {
            actions: [
                { hour: 0, action: 'send_proposal', channel: 'email' },
                { hour: 2, action: 'voice_followup', channel: 'voice' },
                { hour: 4, action: 'email_followup', channel: 'email' },
                { hour: 8, action: 'voice_closing', channel: 'voice' },
                { hour: 12, action: 'email_final', channel: 'email' },
                { hour: 24, action: 'voice_final', channel: 'voice' },
                { hour: 48, action: 'close_or_archive', channel: 'system' }
            ]
        },
        warm: {
            actions: [
                { hour: 0, action: 'value_email', channel: 'email' },
                { hour: 4, action: 'voice_qualify', channel: 'voice' },
                { hour: 8, action: 'proposal_draft', channel: 'email' },
                { hour: 12, action: 'voice_proposal', channel: 'voice' },
                { hour: 24, action: 'voice_close', channel: 'voice' },
                { hour: 48, action: 'email_close', channel: 'email' }
            ]
        }
    },
    
    // Objection handling scripts
    objections: {
        price: [
            "I understand the price concern. What if I showed you how other companies in your industry generated 3x ROI in 90 days?",
            "The cost is offset by the 20+ hours per week you'll save. That's like getting 3 free employees.",
            "We offer a 30-day money-back guarantee, so there's zero risk to try it.",
            "Think of it as an investment, not an expense. Our clients typically recoup their investment within 30 days."
        ],
        timing: [
            "I completely understand. Would you be open to a small pilot program to test the results yourself?",
            "We can start with a 30-day trial so you can see the results before committing.",
            "The sooner you start, the sooner you'll see the benefits. Every day you wait is another day of lost savings."
        ],
        competition: [
            "Great question. Unlike other platforms, our agents work autonomously 24/7 and require no human oversight.",
            "We've helped over 50 companies in your industry achieve these results. Would you like to see a case study?",
            "Our platform is the only one that offers fully autonomous agents that close deals without human intervention."
        ],
        trust: [
            "I understand your concern. We're fully transparent about our results and can provide references from clients in your industry.",
            "Our track record speaks for itself. We've helped companies save over $10M in operational costs.",
            "I completely understand. That's why we offer a 30-day risk-free trial."
        ]
    },
    
    // Closing scripts
    closingScripts: {
        proposal: [
            "Based on our conversation, I've prepared a personalized proposal for you. It outlines exactly how we can help you save 20+ hours per week and generate 40% more revenue.",
            "I've put together a detailed proposal that shows the ROI you can expect. Would you like me to walk you through it?",
            "Here's a proposal that addresses everything we discussed. It includes a 30-day implementation plan and clear success metrics."
        ],
        urgency: [
            "I should mention that our limited-time offer ends this week, which includes a 20% discount on the first 3 months.",
            "We're currently onboarding new clients, and our capacity is limited. I'd recommend securing your spot now.",
            "The sooner we start, the sooner you'll see results. We can have your agents running within 48 hours."
        ],
        final: [
            "Based on everything we've discussed, I'm confident we can help you achieve your goals. Are you ready to get started?",
            "I've outlined everything in the proposal. The next step is simply to sign and we can begin implementation immediately.",
            "You've seen the numbers. You know this works. Let's get started today."
        ]
    }
};

// ============================================
// HIGH-VELOCITY SALES AGENT
// ============================================
class HighVelocitySalesAgent {
    constructor() {
        this.leads = [];
        this.activeDeals = [];
        this.closedDeals = [];
        this.revenue = 0;
        this.stateFile = './high-velocity-state.json';
        this.loadState();
    }

    loadState() {
        try {
            if (fs.existsSync(this.stateFile)) {
                const data = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
                this.leads = data.leads || [];
                this.activeDeals = data.activeDeals || [];
                this.closedDeals = data.closedDeals || [];
                this.revenue = data.revenue || 0;
                console.log(`📂 Loaded high-velocity state: ${this.activeDeals.length} active deals, $${this.revenue} revenue`);
            }
        } catch (e) {
            console.log('📂 Starting fresh high-velocity state');
        }
    }

    saveState() {
        const state = {
            leads: this.leads,
            activeDeals: this.activeDeals,
            closedDeals: this.closedDeals,
            revenue: this.revenue,
            timestamp: new Date().toISOString()
        };
        fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
    }

    // ============================================
    // 1. LEAD INTAKE & CLASSIFICATION
    // ============================================
    intakeLead(leadData) {
        const lead = {
            id: `lead_${Date.now()}`,
            name: leadData.name || 'Unknown',
            company: leadData.company || 'Unknown',
            email: leadData.email || '',
            phone: leadData.phone || '',
            industry: leadData.industry || 'Unknown',
            language: leadData.language || 'en',
            interestLevel: leadData.interestLevel || 50,
            status: 'new',
            source: leadData.source || 'Sales Agent',
            created: new Date().toISOString(),
            lastContact: null,
            followUpCount: 0,
            objections: [],
            notes: []
        };
        
        this.leads.push(lead);
        this.saveState();
        console.log(`📋 New lead: ${lead.name} (${lead.company}) - Interest: ${lead.interestLevel}%`);
        return lead;
    }

    // ============================================
    // 2. DEAL CREATION - High Velocity
    // ============================================
    createDeal(lead) {
        const deal = {
            id: `deal_${Date.now()}`,
            leadId: lead.id,
            lead: lead,
            status: 'active',
            stage: 'qualification',
            created: new Date().toISOString(),
            lastAction: null,
            nextAction: null,
            nextActionTime: null,
            followUpCount: 0,
            lastFollowUp: null,
            value: 0,
            revenue: 0,
            closed: false,
            closedDate: null,
            sequence: 'interested',
            actions: [],
            objections: [],
            notes: []
        };
        
        // Determine sequence based on interest level
        if (lead.interestLevel >= 70) {
            deal.sequence = 'interested';
            deal.stage = 'proposal_ready';
        } else if (lead.interestLevel >= 40) {
            deal.sequence = 'warm';
            deal.stage = 'qualification';
        } else {
            deal.sequence = 'cold';
            deal.stage = 'nurture';
        }
        
        this.activeDeals.push(deal);
        this.saveState();
        console.log(`🚀 Deal created: ${lead.name} (${lead.company}) - Sequence: ${deal.sequence}`);
        return deal;
    }

    // ============================================
    // 3. AUTOMATED CLOSING SEQUENCE
    // ============================================
    async processDeal(deal) {
        console.log(`\n🔄 Processing deal: ${deal.lead.name} (${deal.lead.company})`);
        
        const sequence = CONFIG.closingSequences[deal.sequence] || CONFIG.closingSequences.interested;
        const now = new Date();
        const dealAge = (now - new Date(deal.created)) / (1000 * 60 * 60); // hours
        
        // Check if deal is stuck
        if (dealAge > CONFIG.maxCloseTime && !deal.closed) {
            console.log(`⏰ Deal ${deal.lead.name} is stuck. Escalating...`);
            return this.escalateDeal(deal);
        }
        
        // Find next action
        let nextAction = null;
        for (const action of sequence.actions) {
            if (action.hour <= dealAge && !this.actionCompleted(deal, action)) {
                nextAction = action;
                break;
            }
        }
        
        if (!nextAction) {
            console.log(`⏳ No pending actions for ${deal.lead.name}`);
            return deal;
        }
        
        console.log(`🎯 Next action: ${nextAction.action} at hour ${nextAction.hour}`);
        
        // Execute action
        switch(nextAction.action) {
            case 'send_proposal':
                await this.sendProposal(deal);
                break;
            case 'voice_followup':
                await this.voiceFollowup(deal);
                break;
            case 'email_followup':
                await this.emailFollowup(deal);
                break;
            case 'voice_closing':
                await this.voiceClosing(deal);
                break;
            case 'email_final':
                await this.emailFinal(deal);
                break;
            case 'voice_final':
                await this.voiceFinal(deal);
                break;
            case 'close_or_archive':
                await this.closeOrArchive(deal);
                break;
            case 'value_email':
                await this.valueEmail(deal);
                break;
            case 'voice_qualify':
                await this.voiceQualify(deal);
                break;
            case 'proposal_draft':
                await this.draftProposal(deal);
                break;
            case 'voice_proposal':
                await this.voiceProposal(deal);
                break;
            case 'voice_close':
                await this.voiceClose(deal);
                break;
            case 'email_close':
                await this.emailClose(deal);
                break;
        }
        
        deal.lastAction = nextAction.action;
        deal.followUpCount++;
        this.saveState();
        return deal;
    }

    // ============================================
    // 4. CLOSING ACTIONS
    // ============================================
    
    // Send Proposal
    async sendProposal(deal) {
        console.log(`📄 Sending proposal to ${deal.lead.name}...`);
        const proposalScript = CONFIG.closingScripts.proposal[Math.floor(Math.random() * CONFIG.closingScripts.proposal.length)];
        const urgencyScript = CONFIG.closingScripts.urgency[Math.floor(Math.random() * CONFIG.closingScripts.urgency.length)];
        
        deal.actions.push({
            type: 'proposal_sent',
            content: `${proposalScript}\n\n${urgencyScript}`,
            timestamp: new Date().toISOString()
        });
        deal.stage = 'proposal_sent';
        deal.lastContact = new Date().toISOString();
        console.log(`✅ Proposal sent to ${deal.lead.name}`);
    }
    
    // Voice Follow-up
    async voiceFollowup(deal) {
        console.log(`📞 Voice follow-up to ${deal.lead.name}...`);
        const scripts = [
            `Hi ${deal.lead.name}, this is Sovereign AI Assistant calling to follow up on your interest. Did you have a chance to review the proposal?`,
            `Hello ${deal.lead.name}, I'm calling to see if you had any questions about our proposal. I'm available to walk you through it.`,
            `Hi ${deal.lead.name}, I wanted to personally follow up on the proposal I sent. Do you have a few minutes to discuss?`
        ];
        
        deal.actions.push({
            type: 'voice_followup',
            script: scripts[Math.floor(Math.random() * scripts.length)],
            timestamp: new Date().toISOString()
        });
        deal.lastContact = new Date().toISOString();
        console.log(`📞 Voice follow-up completed`);
    }
    
    // Voice Closing
    async voiceClosing(deal) {
        console.log(`🔒 Voice closing call to ${deal.lead.name}...`);
        const closeScript = CONFIG.closingScripts.final[Math.floor(Math.random() * CONFIG.closingScripts.final.length)];
        const urgencyScript = CONFIG.closingScripts.urgency[Math.floor(Math.random() * CONFIG.closingScripts.urgency.length)];
        
        deal.actions.push({
            type: 'voice_closing',
            script: `${closeScript}\n\n${urgencyScript}`,
            timestamp: new Date().toISOString()
        });
        deal.stage = 'negotiation';
        deal.lastContact = new Date().toISOString();
        console.log(`🔒 Voice closing call completed`);
    }
    
    // Email Final
    async emailFinal(deal) {
        console.log(`📧 Final email to ${deal.lead.name}...`);
        const finalScript = CONFIG.closingScripts.final[Math.floor(Math.random() * CONFIG.closingScripts.final.length)];
        
        deal.actions.push({
            type: 'email_final',
            content: `Dear ${deal.lead.name},\n\n${finalScript}\n\nThis is my final follow-up. I'd love to help you achieve your goals, but I understand if the timing isn't right.\n\nBest regards,\nThe Sovereign Empire Team`,
            timestamp: new Date().toISOString()
        });
        deal.stage = 'final_followup';
        deal.lastContact = new Date().toISOString();
        console.log(`📧 Final email sent`);
    }
    
    // Voice Final
    async voiceFinal(deal) {
        console.log(`📞 Final voice call to ${deal.lead.name}...`);
        const script = `Hi ${deal.lead.name}, this is my final follow-up call. I've sent you the proposal and tried to reach out a few times. If you're still interested, please let me know. If not, I'll close this out.`;
        
        deal.actions.push({
            type: 'voice_final',
            script: script,
            timestamp: new Date().toISOString()
        });
        deal.lastContact = new Date().toISOString();
        console.log(`📞 Final voice call completed`);
    }
    
    // Close or Archive
    async closeOrArchive(deal) {
        console.log(`📊 Closing or archiving deal: ${deal.lead.name}...`);
        
        // Simulate close decision based on follow-ups
        const success = Math.random() > 0.7 && deal.followUpCount >= 3;
        
        if (success) {
            await this.closeDeal(deal);
        } else {
            deal.status = 'archived';
            deal.closed = true;
            deal.closedDate = new Date().toISOString();
            console.log(`📁 Deal archived: ${deal.lead.name}`);
        }
        this.saveState();
    }
    
    // Close Deal
    async closeDeal(deal) {
        console.log(`🎉 CLOSING DEAL: ${deal.lead.name} (${deal.lead.company})`);
        
        const dealValue = 5000 + Math.floor(Math.random() * 15000);
        deal.closed = true;
        deal.closedDate = new Date().toISOString();
        deal.value = dealValue;
        deal.revenue = dealValue;
        deal.stage = 'closed_won';
        
        this.revenue += dealValue;
        
        // Move from active to closed
        const index = this.activeDeals.indexOf(deal);
        if (index !== -1) {
            this.activeDeals.splice(index, 1);
        }
        this.closedDeals.push(deal);
        
        console.log(`💰 DEAL CLOSED: ${deal.lead.name} - $${dealValue}`);
        this.saveState();
    }
    
    // ============================================
    // 5. ESCALATION
    // ============================================
    escalateDeal(deal) {
        console.log(`🚨 ESCALATING: ${deal.lead.name} (${deal.lead.company})`);
        deal.status = 'escalated';
        deal.notes.push({
            timestamp: new Date().toISOString(),
            note: `Deal escalated after ${CONFIG.maxCloseTime} hours without closing`
        });
        this.saveState();
        return deal;
    }

    // ============================================
    // 6. MAIN PROCESSING LOOP
    // ============================================
    actionCompleted(deal, action) {
        return deal.actions.some(a => 
            a.type === action.action || 
            a.type === action.action.replace('_', '')
        );
    }

    // Placeholder methods for completeness
    async valueEmail(deal) { console.log(`📧 Value email to ${deal.lead.name}`); }
    async voiceQualify(deal) { console.log(`📞 Voice qualify ${deal.lead.name}`); }
    async draftProposal(deal) { console.log(`📄 Draft proposal for ${deal.lead.name}`); }
    async voiceProposal(deal) { console.log(`📞 Voice proposal to ${deal.lead.name}`); }
    async voiceClose(deal) { console.log(`🔒 Voice close ${deal.lead.name}`); }
    async emailClose(deal) { console.log(`📧 Email close ${deal.lead.name}`); }

    // ============================================
    // 7. DAILY RUN
    // ============================================
    async run() {
        console.log('\n' + '='.repeat(60));
        console.log('🚀 HIGH-VELOCITY SALES AGENT');
        console.log('='.repeat(60));
        console.log(`📅 ${new Date().toLocaleString()}`);
        console.log(`📊 ${this.activeDeals.length} active deals`);
        console.log(`💰 ${this.closedDeals.length} closed deals`);
        console.log(`💵 Revenue: $${this.revenue}`);
        console.log(`⏰ Max Close Time: ${CONFIG.maxCloseTime} hours`);
        console.log('');
        
        // Process active deals
        for (const deal of this.activeDeals) {
            await this.processDeal(deal);
        }
        
        // Generate report
        this.generateReport();
    }

    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 HIGH-VELOCITY SALES REPORT');
        console.log('='.repeat(60));
        console.log(`📋 Active Deals: ${this.activeDeals.length}`);
        console.log(`💰 Closed Deals: ${this.closedDeals.length}`);
        console.log(`💵 Total Revenue: $${this.revenue}`);
        console.log('');
        console.log('📋 DEAL STAGES:');
        const stages = ['new', 'qualification', 'proposal_ready', 'proposal_sent', 'negotiation', 'final_followup', 'closed_won'];
        for (const stage of stages) {
            const count = this.activeDeals.filter(d => d.stage === stage).length;
            const closedCount = this.closedDeals.filter(d => d.stage === stage).length;
            console.log(`   ${stage}: ${count + closedCount}`);
        }
        console.log('='.repeat(60));
        this.saveState();
    }
}

// ============================================
// START
// ============================================
const salesAgent = new HighVelocitySalesAgent();

// Add sample leads
const sampleLeads = [
    { name: 'Sarah Johnson', company: 'TechFlow Solutions', email: 'sarah@techflow.com', industry: 'SaaS', interestLevel: 80 },
    { name: 'Michael Chen', company: 'DataSphere Inc', email: 'michael@datasphere.com', industry: 'Technology', interestLevel: 65 },
    { name: 'Emily Rodriguez', company: 'CloudPioneer', email: 'emily@cloudpioneer.com', industry: 'Cloud Services', interestLevel: 75 },
    { name: 'James Wilson', company: 'AI Innovations', email: 'james@aiinnovations.com', industry: 'AI', interestLevel: 55 },
    { name: 'Lisa Park', company: 'Digital Transform', email: 'lisa@digitaltransform.com', industry: 'Digital Marketing', interestLevel: 85 }
];

for (const leadData of sampleLeads) {
    const lead = salesAgent.intakeLead(leadData);
    salesAgent.createDeal(lead);
}

// Run immediately
await salesAgent.run();

// Run every 2 hours
setInterval(async () => {
    await salesAgent.run();
}, 2 * 60 * 60 * 1000);

console.log('\n⏰ High-velocity sales agent running every 2 hours');
console.log('🎯 Target: Close deals within 48 hours');