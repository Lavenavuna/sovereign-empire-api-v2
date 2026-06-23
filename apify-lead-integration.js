// apify-lead-integration.js - Complete Apify Lead Integration with Email/Phone Extraction
import { ApifyClient } from 'apify-client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    apifyToken: process.env.APIFY_TOKEN || '',
    
    leadSources: {
        googleMaps: {
            enabled: true,
            actorId: 'compass/google-maps-extractor',
            maxResults: 50,
            searchStringsArray: [
                'SaaS companies San Francisco',
                'AI startups New York',
                'tech companies Austin',
                'software development Chicago'
            ],
            categoryFilterWords: ['software', 'technology', 'artificial intelligence', 'SaaS'],
            extractEmails: true,
            extractPhoneNumbers: true,
            extractSocialProfiles: true
        },
        googleMapsEmail: {
            enabled: true,
            actorId: 'lukaskrivka/google-maps-with-contact-details',
            maxResults: 50,
            searchStringsArray: [
                'AI companies New York',
                'tech startups San Francisco',
                'IT consulting Austin',
                'software development Chicago',
                'SaaS companies Los Angeles'
            ],
            extractEmails: true,
            extractPhoneNumbers: true,
            extractSocialProfiles: true
        }
    },
    
    qualification: {
        minScore: 60,
        maxResults: 50,
        autoCreateDeals: true
    }
};

// ============================================
// APIFY LEAD INTEGRATION CLASS
// ============================================
class ApifyLeadIntegration {
    constructor() {
        if (!CONFIG.apifyToken) {
            console.error('❌ APIFY_TOKEN not set!');
            console.log('Run: $env:APIFY_TOKEN = "your_token"');
            process.exit(1);
        }
        
        this.client = new ApifyClient({ token: CONFIG.apifyToken });
        this.leads = [];
        this.qualifiedLeads = [];
        this.stateFile = './apify-leads-state.json';
        this.loadState();
        console.log('🔗 Apify Lead Integration initialized');
    }

    loadState() {
        try {
            if (fs.existsSync(this.stateFile)) {
                const data = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
                this.leads = data.leads || [];
                this.qualifiedLeads = data.qualifiedLeads || [];
                console.log(`📂 Loaded ${this.leads.length} leads`);
            }
        } catch (e) {
            console.log('📂 Starting fresh lead state');
        }
    }

    saveState() {
        const state = {
            leads: this.leads,
            qualifiedLeads: this.qualifiedLeads,
            timestamp: new Date().toISOString()
        };
        fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
    }

    // ============================================
    // 1. FETCH GOOGLE MAPS LEADS
    // ============================================
    async fetchGoogleMapsLeads() {
        console.log('📍 Fetching Google Maps leads...');
        
        const input = {
            searchStringsArray: CONFIG.leadSources.googleMaps.searchStringsArray,
            maxResults: CONFIG.leadSources.googleMaps.maxResults,
            categoryFilterWords: CONFIG.leadSources.googleMaps.categoryFilterWords,
            extractEmails: CONFIG.leadSources.googleMaps.extractEmails,
            extractPhoneNumbers: CONFIG.leadSources.googleMaps.extractPhoneNumbers,
            extractSocialProfiles: CONFIG.leadSources.googleMaps.extractSocialProfiles
        };
        
        try {
            console.log('📋 Input:', JSON.stringify(input, null, 2));
            const run = await this.client.actor(CONFIG.leadSources.googleMaps.actorId).call(input);
            const { items } = await this.client.dataset(run.defaultDatasetId).listItems();
            
            const leads = items.map(function(item) {
                return {
                    name: item.title || item.name || 'Unknown',
                    company: item.title || item.name || 'Unknown Business',
                    email: item.email || item.primaryEmail || null,
                    phone: item.phone || item.telephone || null,
                    website: item.website || item.websiteUrl || null,
                    category: item.category || item.categories || 'Unknown',
                    rating: item.rating || null,
                    address: item.address || null,
                    score: item.rating ? item.rating * 10 : 50,
                    source: 'Google Maps',
                    sourceId: 'google_maps',
                    social: {
                        linkedin: item.linkedIn || null,
                        twitter: item.twitter || null,
                        facebook: item.facebook || null,
                        instagram: item.instagram || null
                    },
                    raw: item
                };
            });
            
            console.log('✅ Found ' + leads.length + ' Google Maps leads');
            console.log('📧 ' + leads.filter(function(l) { return l.email; }).length + ' have emails');
            console.log('📞 ' + leads.filter(function(l) { return l.phone; }).length + ' have phones');
            return leads;
        } catch (error) {
            console.error('❌ Google Maps error:', error.message);
            return [];
        }
    }

    // ============================================
    // 2. FETCH GOOGLE MAPS EMAIL LEADS
    // ============================================
    async fetchGoogleMapsEmailLeads() {
        console.log('📧 Fetching Google Maps Email leads...');
        
        const input = {
            searchStringsArray: CONFIG.leadSources.googleMapsEmail.searchStringsArray,
            maxResults: CONFIG.leadSources.googleMapsEmail.maxResults,
            extractEmails: CONFIG.leadSources.googleMapsEmail.extractEmails,
            extractPhoneNumbers: CONFIG.leadSources.googleMapsEmail.extractPhoneNumbers,
            extractSocialProfiles: CONFIG.leadSources.googleMapsEmail.extractSocialProfiles
        };
        
        try {
            console.log('📋 Input:', JSON.stringify(input, null, 2));
            const run = await this.client.actor(CONFIG.leadSources.googleMapsEmail.actorId).call(input);
            const { items } = await this.client.dataset(run.defaultDatasetId).listItems();
            
            const leads = items.map(function(item) {
                return {
                    name: item.title || item.name || 'Unknown',
                    company: item.title || item.name || 'Unknown Business',
                    email: item.email || item.primaryEmail || null,
                    phone: item.phone || item.telephone || null,
                    website: item.website || item.websiteUrl || null,
                    category: item.categoryName || item.category || 'Business',
                    address: item.address || null,
                    rating: item.rating || null,
                    score: item.email ? 70 : (item.phone ? 60 : 50),
                    source: 'Google Maps Email',
                    sourceId: 'google_maps_email',
                    social: {
                        linkedin: item.linkedIn || null,
                        twitter: item.twitter || null,
                        facebook: item.facebook || null,
                        instagram: item.instagram || null
                    },
                    raw: item
                };
            });
            
            console.log('✅ Found ' + leads.length + ' Google Maps Email leads');
            console.log('📧 ' + leads.filter(function(l) { return l.email; }).length + ' have emails');
            console.log('📞 ' + leads.filter(function(l) { return l.phone; }).length + ' have phones');
            return leads;
        } catch (error) {
            console.error('❌ Google Maps Email error:', error.message);
            return [];
        }
    }

    // ============================================
    // 3. FETCH ALL LEADS
    // ============================================
    async fetchAllLeads() {
        console.log('\n🔍 Fetching leads from all sources...');
        
        var allLeads = [];
        
        if (CONFIG.leadSources.googleMaps.enabled) {
            var mapsLeads = await this.fetchGoogleMapsLeads();
            allLeads = allLeads.concat(mapsLeads);
        }
        
        if (CONFIG.leadSources.googleMapsEmail.enabled) {
            var emailLeads = await this.fetchGoogleMapsEmailLeads();
            allLeads = allLeads.concat(emailLeads);
        }
        
        var uniqueLeads = this.deduplicateLeads(allLeads);
        var qualified = this.qualifyLeads(uniqueLeads);
        
        this.leads = uniqueLeads;
        this.qualifiedLeads = qualified;
        this.saveState();
        
        console.log('\n📊 Summary: ' + uniqueLeads.length + ' total leads, ' + qualified.length + ' qualified');
        console.log('📧 ' + uniqueLeads.filter(function(l) { return l.email; }).length + ' have emails');
        console.log('📞 ' + uniqueLeads.filter(function(l) { return l.phone; }).length + ' have phones');
        
        return { total: uniqueLeads.length, qualified: qualified.length, leads: uniqueLeads };
    }

    // ============================================
    // 4. LEAD DEDUPLICATION & QUALIFICATION
    // ============================================
    deduplicateLeads(leads) {
        var seen = new Map();
        var unique = [];
        
        for (var i = 0; i < leads.length; i++) {
            var lead = leads[i];
            var key = lead.email || lead.website || lead.name;
            if (!seen.has(key)) {
                seen.set(key, true);
                unique.push(lead);
            }
        }
        
        console.log('🔍 Deduplicated: ' + leads.length + ' → ' + unique.length);
        return unique;
    }

    qualifyLeads(leads) {
        var qualified = leads.filter(function(lead) {
            var hasContact = lead.email || lead.phone;
            var hasWebsite = lead.website || lead.company;
            var minScore = lead.score >= CONFIG.qualification.minScore;
            
            return hasContact && hasWebsite && minScore;
        });
        
        console.log('🎯 Qualified: ' + qualified.length + ' leads meet criteria');
        return qualified;
    }

    // ============================================
    // 5. CREATE DEALS FROM LEADS
    // ============================================
    async createDealsFromLeads() {
        if (!CONFIG.qualification.autoCreateDeals) {
            console.log('⏸️ Auto-deal creation disabled');
            return;
        }
        
        console.log('\n🤖 Creating deals from qualified leads...');
        
        var newQualified = this.qualifiedLeads.filter(function(lead) { return !lead.processed; });
        var deals = [];
        
        for (var i = 0; i < Math.min(newQualified.length, CONFIG.qualification.maxResults); i++) {
            var lead = newQualified[i];
            try {
                var dealData = {
                    name: lead.name || 'Lead',
                    company: lead.company || 'Company',
                    email: lead.email || '',
                    phone: lead.phone || '',
                    industry: lead.category || 'Technology',
                    interestLevel: Math.min(lead.score + 10, 100),
                    source: lead.source || 'Apify Lead Integration',
                    language: 'en'
                };
                
                var statePath = path.join(__dirname, './high-velocity-state.json');
                var state = { activeDeals: [], closedDeals: [], revenue: 0 };
                
                if (fs.existsSync(statePath)) {
                    state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
                }
                
                var deal = {
                    id: 'deal_' + Date.now(),
                    lead: {
                        name: dealData.name,
                        company: dealData.company,
                        email: dealData.email,
                        phone: dealData.phone,
                        industry: dealData.industry
                    },
                    stage: 'new',
                    created: new Date().toISOString(),
                    lastAction: 'lead_intake',
                    source: dealData.source,
                    score: dealData.interestLevel,
                    revenue: 0,
                    closed: false
                };
                
                state.activeDeals.push(deal);
                fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
                
                lead.processed = true;
                lead.dealId = deal.id;
                deals.push(deal);
                console.log('✅ Created deal for: ' + lead.name + ' (' + lead.company + ')');
                
            } catch (error) {
                console.error('❌ Deal creation error:', error.message);
            }
        }
        
        this.saveState();
        console.log('📋 Created ' + deals.length + ' new deals');
        return deals;
    }

    // ============================================
    // 6. RUN
    // ============================================
    async run() {
        console.log('\n' + '='.repeat(60));
        console.log('🔄 APIFY LEAD INTEGRATION - AUTOMATED RUN');
        console.log('='.repeat(60));
        console.log('📅 ' + new Date().toLocaleString());
        console.log('📊 Existing leads: ' + this.leads.length);
        console.log('🎯 Existing qualified: ' + this.qualifiedLeads.length);
        console.log('');
        
        var result = await this.fetchAllLeads();
        
        if (result.qualified > 0) {
            await this.createDealsFromLeads();
        }
        
        this.generateReport();
        return result;
    }

    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 APIFY LEAD INTEGRATION REPORT');
        console.log('='.repeat(60));
        console.log('📋 Total Leads Found: ' + this.leads.length);
        console.log('🎯 Qualified Leads: ' + this.qualifiedLeads.length);
        console.log('💼 Deals Created: ' + this.qualifiedLeads.filter(function(l) { return l.processed; }).length);
        console.log('📧 With Email: ' + this.leads.filter(function(l) { return l.email; }).length);
        console.log('📞 With Phone: ' + this.leads.filter(function(l) { return l.phone; }).length);
        console.log('='.repeat(60));
        
        var topLeads = this.qualifiedLeads
            .filter(function(l) { return !l.processed; })
            .sort(function(a, b) { return b.score - a.score; })
            .slice(0, 5);
        
        if (topLeads.length > 0) {
            console.log('\n🎯 Top Qualified Leads:');
            for (var i = 0; i < topLeads.length; i++) {
                var lead = topLeads[i];
                console.log('   - ' + lead.name + ' (' + lead.company + ') - Score: ' + lead.score + ' - Email: ' + (lead.email || 'N/A'));
            }
        }
    }
}

// ============================================
// START
// ============================================
var apifyIntegration = new ApifyLeadIntegration();

await apifyIntegration.run();

setInterval(async function() {
    await apifyIntegration.run();
}, 2 * 60 * 60 * 1000);

console.log('\n⏰ Apify lead integration running every 2 hours');