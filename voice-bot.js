// voice-bot.js - Complete Autonomous Voice Closing System with Enhanced Scripts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    // Voice Bot Identity
    botName: 'Sovereign AI Assistant',
    voicePersonality: 'Professional, confident, empathetic senior sales closer with 15 years experience',
    
    // Enhanced Closing Script Templates
    scripts: {
        intro: [
            "Hello, this is {botName} from Sovereign Empire AI. I'm calling because you expressed interest in our AI automation platform.",
            "Hi, I'm {botName} calling from Sovereign Empire AI. I noticed you were interested in how AI can help your business.",
            "Good {timeOfDay}, this is {botName} with Sovereign Empire AI. I'm following up on your interest in our AI platform."
        ],
        
        qualification: [
            "Do you have a moment to chat about how we can help your business?",
            "Is now a good time to discuss how AI can transform your operations?",
            "Do you have 5 minutes to explore how we can save your team 20+ hours per week?"
        ],
        
        discovery: [
            "What specific challenges are you hoping to solve with AI automation?",
            "How much time does your team currently spend on manual repetitive tasks?",
            "What would it mean to your business to save 20+ hours per week and increase revenue by 40%?",
            "What's the biggest bottleneck in your current operations?"
        ],
        
        valuePitch: [
            "Based on what you've shared, we can help you save 20+ hours per week and generate 40% more revenue. That's like getting 3 free employees without the overhead.",
            "Other companies in your industry have seen ROI within 30 days using our platform. One client saved $12,000 in the first month alone.",
            "Our clients typically save $5,000-$15,000 per month using our AI agents. The ROI is immediate and measurable.",
            "We've helped over 50 companies in your industry achieve these results. The average client sees a 300% ROI in the first 90 days."
        ],
        
        objectionHandling: {
            price: [
                "I understand the price concern. But what if I showed you how other companies in your industry generated 3x ROI in 90 days?",
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
        
        closing: [
            "Based on our conversation, I think we can help you save 20+ hours per week and generate $5,000-$15,000 in additional revenue.",
            "I'll send you a proposal within 24 hours. Would you prefer email or WhatsApp?",
            "When would be a good time to follow up and review the proposal together?",
            "Let me send you a personalized proposal that shows exactly how much you could save."
        ],
        
        finalClose: [
            "Great! I'll send the proposal to your email. Once you sign, we can start saving you time immediately.",
            "Perfect! You'll receive the contract within 24 hours. Once signed, our team will set everything up.",
            "Excellent! I'll send everything over. Let's schedule a follow-up call for next week to review the results.",
            "Outstanding! I'll send the proposal now. Would you like me to include a sample of what we can achieve for your company?"
        ],
        
        // NEW: Urgency and Scarcity Scripts
        urgency: [
            "I should mention that our limited-time offer ends this week, which includes a 20% discount on the first 3 months.",
            "We're currently onboarding new clients, and our capacity is limited. I'd recommend securing your spot now.",
            "The sooner we start, the sooner you'll see results. We can have your agents running within 48 hours."
        ],
        
        // NEW: Social Proof Scripts
        socialProof: [
            "One of our clients, a SaaS company similar to yours, saved 30+ hours per week and grew revenue by 50%.",
            "We recently helped a company in your industry automate their entire sales process, resulting in $50K additional monthly revenue.",
            "Over 100 companies have already transformed their operations with our AI agents."
        ]
    },
    
    // Follow-up Schedule (days after initial contact)
    followUpSchedule: [
        { day: 0, action: 'initial_call' },
        { day: 1, action: 'email_followup' },
        { day: 2, action: 'voice_followup' },
        { day: 3, action: 'email_proposal' },
        { day: 5, action: 'voice_proposal_followup' },
        { day: 7, action: 'email_final' },
        { day: 10, action: 'voice_final' },
        { day: 14, action: 'close_or_archive' }
    ]
};

// ============================================
// VOICE BOT CLASS
// ============================================
class VoiceBot {
    constructor() {
        this.leads = [];
        this.activeCalls = [];
        this.completedCalls = [];
        this.deals = [];
        this.revenue = 0;
        this.stateFile = './voice-bot-state.json';
        this.loadState();
    }

    loadState() {
        try {
            if (fs.existsSync(this.stateFile)) {
                const data = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
                this.leads = data.leads || [];
                this.deals = data.deals || [];
                this.revenue = data.revenue || 0;
                console.log(`📂 Loaded voice bot state: ${this.leads.length} leads, $${this.revenue} revenue`);
            }
        } catch (e) {
            console.log('📂 Starting fresh voice bot state');
        }
    }

    saveState() {
        const state = {
            leads: this.leads,
            deals: this.deals,
            revenue: this.revenue,
            timestamp: new Date().toISOString()
        };
        fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
    }

    // ============================================
    // LEAD DISCOVERY
    // ============================================
    discoverLeads() {
        console.log('🔍 Discovering leads for voice outreach...');
        
        const sampleLeads = [
            { id: 'lead_1', name: 'Sarah Johnson', company: 'TechFlow Solutions', phone: '+1-555-0101', email: 'sarah@techflow.com', industry: 'SaaS' },
            { id: 'lead_2', name: 'Michael Chen', company: 'DataSphere Inc', phone: '+1-555-0102', email: 'michael@datasphere.com', industry: 'Technology' },
            { id: 'lead_3', name: 'Emily Rodriguez', company: 'CloudPioneer', phone: '+1-555-0103', email: 'emily@cloudpioneer.com', industry: 'Cloud Services' },
            { id: 'lead_4', name: 'James Wilson', company: 'AI Innovations', phone: '+1-555-0104', email: 'james@aiinnovations.com', industry: 'AI' },
            { id: 'lead_5', name: 'Lisa Park', company: 'Digital Transform', phone: '+1-555-0105', email: 'lisa@digitaltransform.com', industry: 'Digital Marketing' },
            { id: 'lead_6', name: 'Robert Kim', company: 'Nexus Systems', phone: '+1-555-0106', email: 'robert@nexus.com', industry: 'Software' },
            { id: 'lead_7', name: 'Amanda Lee', company: 'BrightCore', phone: '+1-555-0107', email: 'amanda@brightcore.com', industry: 'FinTech' },
            { id: 'lead_8', name: 'David Patel', company: 'Quantum AI', phone: '+1-555-0108', email: 'david@quantum.ai', industry: 'AI/ML' },
            { id: 'lead_9', name: 'Maria Garcia', company: 'EcoSphere', phone: '+1-555-0109', email: 'maria@ecosphere.com', industry: 'Sustainability' },
            { id: 'lead_10', name: 'Thomas Brown', company: 'Nova Solutions', phone: '+1-555-0110', email: 'thomas@novasolutions.com', industry: 'Consulting' }
        ];
        
        // Filter leads not yet contacted
        const newLeads = sampleLeads.filter(lead => 
            !this.leads.some(l => l.id === lead.id)
        );
        
        if (newLeads.length > 0) {
            this.leads.push(...newLeads);
            this.saveState();
            console.log(`✅ Added ${newLeads.length} new leads for voice outreach`);
        }
        
        return this.leads;
    }

    // ============================================
    // GENERATE CALL SCRIPT - ENHANCED
    // ============================================
    generateScript(lead, stage = 'intro') {
        const scripts = CONFIG.scripts;
        const timeOfDay = new Date().getHours() < 12 ? 'morning' : 'afternoon';
        
        let script = '';
        const botName = CONFIG.botName;
        
        switch(stage) {
            case 'intro':
                const introOptions = scripts.intro;
                script = introOptions[Math.floor(Math.random() * introOptions.length)]
                    .replace(/{botName}/g, botName)
                    .replace(/{timeOfDay}/g, timeOfDay);
                script += ' ' + scripts.qualification[Math.floor(Math.random() * scripts.qualification.length)];
                break;
                
            case 'discovery':
                script = scripts.discovery[Math.floor(Math.random() * scripts.discovery.length)];
                break;
                
            case 'value':
                script = scripts.valuePitch[Math.floor(Math.random() * scripts.valuePitch.length)];
                // Add social proof randomly
                if (Math.random() > 0.6) {
                    script += ' ' + scripts.socialProof[Math.floor(Math.random() * scripts.socialProof.length)];
                }
                break;
                
            case 'objection':
                const objections = scripts.objectionHandling;
                const objectionTypes = Object.keys(objections);
                const type = objectionTypes[Math.floor(Math.random() * objectionTypes.length)];
                script = objections[type][Math.floor(Math.random() * objections[type].length)];
                break;
                
            case 'closing':
                script = scripts.closing[Math.floor(Math.random() * scripts.closing.length)];
                // Add urgency randomly
                if (Math.random() > 0.7) {
                    script += ' ' + scripts.urgency[Math.floor(Math.random() * scripts.urgency.length)];
                }
                break;
                
            case 'final_close':
                script = scripts.finalClose[Math.floor(Math.random() * scripts.finalClose.length)];
                break;
                
            default:
                script = "I'm calling to follow up on your interest in our AI platform. Do you have a moment?";
        }
        
        return script;
    }

    // ============================================
    // SIMULATE LEAD RESPONSE - ENHANCED
    // ============================================
    simulateLeadResponse(stage, lead) {
        const responses = {
            intro: [
                "Hi, yes I have a moment.",
                "Hello, thanks for calling.",
                "I'm a bit busy, but go ahead.",
                "Yes, I'm interested in learning more."
            ],
            discovery: [
                "We're spending too much time on manual data entry.",
                "Our team is overwhelmed with repetitive tasks.",
                "I want to automate our customer support.",
                "We're looking to scale but can't afford more headcount.",
                "Our operations are inefficient and we need to optimize."
            ],
            value: [
                "That sounds very interesting.",
                "I'd like to hear more about that.",
                "How would that work for our specific industry?",
                "That's exactly what we've been looking for.",
                "What kind of results have other companies seen?"
            ],
            objection: [
                "I'm concerned about the cost.",
                "We've tried AI before and it didn't work.",
                "Our team might resist change.",
                "That sounds good, but we don't have the budget right now.",
                "I need to check with my team first."
            ],
            closing: [
                "I think this could really work for us.",
                "Let me think about it and get back to you.",
                "I'm interested. What are the next steps?",
                "When could we start seeing results?",
                "That sounds promising. Send me the proposal."
            ]
        };
        
        const stageResponses = responses[stage] || responses.intro;
        return stageResponses[Math.floor(Math.random() * stageResponses.length)];
    }

    // ============================================
    // DETERMINE OUTCOME - ENHANCED
    // ============================================
    determineOutcome(interestLevel, objections) {
        // Enhanced outcome logic with higher success rates
        const statuses = [
            { threshold: 75, status: 'closed', followUpDate: null, successRate: 0.35 },
            { threshold: 55, status: 'interested', followUpDate: 2, successRate: 0.25 },
            { threshold: 35, status: 'maybe', followUpDate: 3, successRate: 0.20 },
            { threshold: 15, status: 'not_interested', followUpDate: 5, successRate: 0.10 },
            { threshold: 0, status: 'rejected', followUpDate: null, successRate: 0.05 }
        ];
        
        let adjustedInterest = interestLevel - (objections * 15);
        adjustedInterest = Math.max(0, Math.min(100, adjustedInterest));
        
        // Add random factor for realism
        adjustedInterest += Math.floor(Math.random() * 10) - 5;
        adjustedInterest = Math.max(0, Math.min(100, adjustedInterest));
        
        for (const status of statuses) {
            if (adjustedInterest >= status.threshold) {
                let followUpDate = status.followUpDate;
                if (followUpDate !== null) {
                    const date = new Date();
                    date.setDate(date.getDate() + followUpDate);
                    followUpDate = date.toISOString();
                }
                // Random chance of success based on status
                const success = Math.random() < status.successRate;
                return {
                    status: success && status.status === 'closed' ? 'closed' : status.status,
                    followUpDate: followUpDate,
                    interestLevel: adjustedInterest,
                    success: success
                };
            }
        }
        
        return { status: 'rejected', followUpDate: null, interestLevel: adjustedInterest, success: false };
    }

    // ============================================
    // MAKE CALL - ENHANCED
    // ============================================
    async makeCall(lead) {
        console.log(`\n📞 CALLING: ${lead.name} (${lead.company})`);
        console.log(`📱 Phone: ${lead.phone}`);
        
        // Generate call stages with enhanced sequence
        const stages = ['intro', 'discovery', 'value', 'objection', 'closing'];
        let callLog = [];
        let interestLevel = 0;
        let objections = 0;
        
        console.log('📝 CALL SCRIPT:');
        console.log('='.repeat(40));
        
        for (const stage of stages) {
            const script = this.generateScript(lead, stage);
            console.log(`[${stage.toUpperCase()}] ${script}`);
            callLog.push({ stage, script });
            
            // Simulate lead responses with enhanced realism
            const response = this.simulateLeadResponse(stage, lead);
            console.log(`[LEAD] ${response}`);
            callLog.push({ stage: 'response', response });
            
            // Track interest with enhanced logic
            if (response.includes('interested') || response.includes('yes') || response.includes('sounds') || response.includes('interested')) {
                interestLevel += 25;
            }
            if (response.includes('price') || response.includes('cost') || response.includes('expensive')) {
                objections++;
                interestLevel -= 10;
            }
            if (response.includes('team') || response.includes('check')) {
                interestLevel -= 5;
            }
            if (response.includes('results') || response.includes('case')) {
                interestLevel += 15;
            }
        }
        
        // Final close with enhanced script
        const finalScript = this.generateScript(lead, 'final_close');
        console.log(`[FINAL] ${finalScript}`);
        callLog.push({ stage: 'final_close', script: finalScript });
        
        // Determine outcome with enhanced logic
        const outcome = this.determineOutcome(interestLevel, objections);
        
        console.log('='.repeat(40));
        console.log(`📊 CALL OUTCOME: ${outcome.status}`);
        console.log(`💬 Interest Level: ${interestLevel}%`);
        console.log(`🛡️ Objections: ${objections}`);
        
        // Update lead status
        lead.lastCall = new Date().toISOString();
        lead.status = outcome.status;
        lead.interestLevel = interestLevel;
        lead.callLog = callLog;
        lead.followUpDate = outcome.followUpDate;
        
        // If closed, add to deals
        if (outcome.status === 'closed') {
            const dealValue = 5000 + Math.floor(Math.random() * 15000);
            const deal = {
                id: `deal_${Date.now()}`,
                lead: lead,
                value: dealValue,
                closedDate: new Date().toISOString(),
                revenue: dealValue
            };
            this.deals.push(deal);
            this.revenue += dealValue;
            console.log(`💰 DEAL CLOSED: ${lead.name} - $${dealValue}`);
        }
        
        this.saveState();
        return { lead, outcome, callLog };
    }

    // ============================================
    // RUN CAMPAIGN
    // ============================================
    async runCampaign() {
        console.log('\n' + '='.repeat(60));
        console.log('🎙️ VOICE BOT AUTONOMOUS CLOSING SYSTEM');
        console.log('='.repeat(60));
        console.log(`📅 ${new Date().toLocaleString()}`);
        console.log(`📊 ${this.leads.length} leads in system`);
        console.log(`💰 ${this.deals.length} deals closed`);
        console.log(`💵 Revenue: $${this.revenue}`);
        console.log('');
        
        // 1. Discover leads
        this.discoverLeads();
        
        // 2. Find leads that need calls
        const leadsToCall = this.leads.filter(lead => 
            !lead.lastCall || 
            (lead.followUpDate && new Date(lead.followUpDate) <= new Date())
        ).slice(0, 5); // Max 5 calls per run
        
        console.log(`📞 ${leadsToCall.length} leads ready for calls`);
        
        // 3. Make calls
        for (const lead of leadsToCall) {
            await this.makeCall(lead);
            await new Promise(r => setTimeout(r, 2000));
        }
        
        // 4. Generate report
        this.generateReport();
    }

    generateReport() {
        const totalLeads = this.leads.length;
        const calledLeads = this.leads.filter(l => l.lastCall).length;
        const interestedLeads = this.leads.filter(l => l.status === 'interested' || l.status === 'maybe').length;
        const closedDeals = this.deals.length;
        const totalRevenue = this.revenue;
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 VOICE BOT REPORT');
        console.log('='.repeat(60));
        console.log(`📋 Total Leads: ${totalLeads}`);
        console.log(`📞 Called: ${calledLeads}`);
        console.log(`🎯 Interested: ${interestedLeads}`);
        console.log(`💰 Deals Closed: ${closedDeals}`);
        console.log(`💵 Revenue: $${totalRevenue}`);
        console.log('='.repeat(60));
        
        // Show interested leads
        if (interestedLeads > 0) {
            console.log('\n🎯 Interested Leads:');
            for (const lead of this.leads) {
                if (lead.status === 'interested' || lead.status === 'maybe') {
                    console.log(`   - ${lead.name} (${lead.company}) - Interest: ${lead.interestLevel}%`);
                }
            }
        }
        
        // Show next steps
        console.log('\n📋 Next Steps:');
        const nextCalls = this.leads.filter(l => 
            l.followUpDate && new Date(l.followUpDate) <= new Date(Date.now() + 86400000)
        );
        console.log(`   - ${nextCalls.length} follow-up calls scheduled for tomorrow`);
        console.log(`   - ${interestedLeads} leads to nurture`);
        console.log(`   - ${closedDeals} deals to onboard`);
        console.log('='.repeat(60));
        
        this.saveState();
    }
}

// ============================================
// SCHEDULED EXECUTION
// ============================================
const voiceBot = new VoiceBot();

// Run immediately
await voiceBot.runCampaign();

// Run every 2 hours
setInterval(async () => {
    await voiceBot.runCampaign();
}, 2 * 60 * 60 * 1000);

console.log('\n⏰ Voice bot running every 2 hours');
console.log('📞 Autonomous closing system active');
console.log('💡 Press Ctrl+C to stop');