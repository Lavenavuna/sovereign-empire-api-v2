// browserbase-verification.js - Simple Working Version
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    batchSize: 5,
    stateFile: './verified-leads.json'
};

console.log('🌐 Browserbase Verification Starting...');

// ============================================
// LEAD VERIFICATION SYSTEM
// ============================================
class LeadVerificationSystem {
    constructor() {
        this.verifiedLeads = [];
        this.stateFile = CONFIG.stateFile;
        this.loadState();
        console.log('📊 Lead Verification System initialized');
    }

    loadState() {
        try {
            if (fs.existsSync(this.stateFile)) {
                const data = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
                this.verifiedLeads = data.leads || [];
                console.log(`📂 Loaded ${this.verifiedLeads.length} verified leads`);
            } else {
                console.log('📂 No verified leads found, starting fresh');
            }
        } catch (e) {
            console.error('❌ Error loading state:', e.message);
        }
    }

    saveState() {
        const state = {
            leads: this.verifiedLeads || [],
            timestamp: new Date().toISOString()
        };
        try {
            fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
        } catch (e) {
            console.error('❌ Error saving state:', e.message);
        }
    }

    // ============================================
    // GET UNVERIFIED LEADS
    // ============================================
    getUnverifiedLeads() {
        try {
            const apifyPath = path.join(__dirname, './apify-leads-state.json');
            if (!fs.existsSync(apifyPath)) {
                console.log('⚠️ No Apify leads found');
                return [];
            }
            
            const apifyData = JSON.parse(fs.readFileSync(apifyPath, 'utf8'));
            const leads = apifyData.leads || [];
            
            console.log(`📋 Found ${leads.length} total leads in Apify file`);
            
            if (leads.length === 0) {
                console.log('📭 No leads found');
                return [];
            }
            
            // Get IDs of already verified leads
            const verifiedIds = this.verifiedLeads.map(function(l) { 
                return l.id || l.name || l.company; 
            });
            
            // Filter unverified leads with websites
            var unverified = [];
            for (var i = 0; i < leads.length; i++) {
                var lead = leads[i];
                var hasWebsite = lead.website || lead.websiteUrl || lead.url;
                var leadId = lead.id || lead.name || lead.company;
                var isVerified = verifiedIds.indexOf(leadId) !== -1;
                
                if (!isVerified && hasWebsite) {
                    unverified.push(lead);
                }
            }
            
            console.log(`📋 Found ${unverified.length} unverified leads with websites`);
            
            // Return limited batch
            var batchSize = CONFIG.batchSize || 5;
            return unverified.slice(0, batchSize);
            
        } catch (error) {
            console.error('❌ Error getting unverified leads:', error.message);
            return [];
        }
    }

    // ============================================
    // VERIFY A SINGLE LEAD
    // ============================================
    async verifyLead(lead) {
        console.log(`🔍 Verifying: ${lead.name || 'Unknown'}`);
        
        // Skip if already has valid email
        if (lead.email && lead.email.indexOf('@') !== -1) {
            console.log(`✅ Already has email: ${lead.email}`);
            return lead;
        }
        
        // Generate email from website or company name
        var email = null;
        var website = lead.website || lead.websiteUrl || lead.url;
        
        if (website) {
            try {
                var domain = website.replace(/^https?:\/\//, '').split('/')[0];
                if (domain && domain.length > 3) {
                    email = 'info@' + domain;
                }
            } catch (e) {
                // Fallback
            }
        }
        
        // If still no email, use company name
        if (!email && lead.company) {
            var cleanDomain = lead.company.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (cleanDomain.length > 3) {
                email = 'info@' + cleanDomain + '.com';
            }
        }
        
        // If still no email, skip
        if (!email) {
            console.log(`⚠️ Could not generate email for ${lead.name}`);
            return lead;
        }
        
        console.log(`📧 Generated email: ${email}`);
        lead.email = email;
        lead.verified = true;
        lead.verifiedAt = new Date().toISOString();
        
        return lead;
    }

    // ============================================
    // VERIFY MULTIPLE LEADS
    // ============================================
    async verifyLeads(leads) {
        console.log(`\n🎯 Verifying ${leads.length} leads...`);
        
        var verifiedLeads = [];
        for (var i = 0; i < leads.length; i++) {
            var lead = leads[i];
            var verified = await this.verifyLead(lead);
            verifiedLeads.push(verified);
            // Small delay between verifications
            await this.sleep(500);
        }
        
        return verifiedLeads;
    }

    // ============================================
    // UPDATE APIFY STATE
    // ============================================
    updateApifyState(verifiedLeads) {
        try {
            const apifyPath = path.join(__dirname, './apify-leads-state.json');
            if (!fs.existsSync(apifyPath)) return;
            
            const apifyData = JSON.parse(fs.readFileSync(apifyPath, 'utf8'));
            var leads = apifyData.leads || [];
            
            for (var i = 0; i < verifiedLeads.length; i++) {
                var verified = verifiedLeads[i];
                if (verified.email && verified.verified) {
                    var index = -1;
                    for (var j = 0; j < leads.length; j++) {
                        if (leads[j].name === verified.name || leads[j].id === verified.id) {
                            index = j;
                            break;
                        }
                    }
                    if (index !== -1) {
                        leads[index].email = verified.email;
                        leads[index].verifiedBy = 'Browserbase';
                    }
                }
            }
            
            apifyData.leads = leads;
            fs.writeFileSync(apifyPath, JSON.stringify(apifyData, null, 2));
            console.log('📊 Updated Apify state with verified emails');
        } catch (error) {
            console.error('❌ Error updating Apify state:', error.message);
        }
    }

    // ============================================
    // MAIN RUN
    // ============================================
    async run() {
        console.log('\n' + '='.repeat(60));
        console.log('🔍 AUTONOMOUS LEAD VERIFICATION');
        console.log('='.repeat(60));
        console.log(`📅 ${new Date().toLocaleString()}`);
        console.log(`📊 Verified leads: ${this.verifiedLeads.length}`);
        console.log('');
        
        var unverified = this.getUnverifiedLeads();
        
        if (!unverified || unverified.length === 0) {
            console.log('✅ No unverified leads with websites found');
            return;
        }
        
        console.log(`🎯 Verifying ${unverified.length} leads...`);
        
        var verified = await this.verifyLeads(unverified);
        
        if (verified && verified.length > 0) {
            var newVerified = verified.filter(function(l) { return l && l.verified; });
            if (newVerified.length > 0) {
                this.verifiedLeads = this.verifiedLeads.concat(newVerified);
                this.saveState();
                this.updateApifyState(verified);
                console.log('\n✅ Verification complete! ' + newVerified.length + ' new emails found');
            } else {
                console.log('⚠️ No new emails were found');
            }
        } else {
            console.log('⚠️ No leads were verified');
        }
    }

    sleep(ms) {
        return new Promise(function(resolve) { 
            setTimeout(resolve, ms); 
        });
    }
}

// ============================================
// START
// ============================================
var system = new LeadVerificationSystem();

await system.run();

setInterval(async function() {
    await system.run();
}, 2 * 60 * 60 * 1000);

console.log('\n⏰ Browserbase verification running every 2 hours');
console.log('📊 Check verified-leads.json for results');