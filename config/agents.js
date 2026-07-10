// config/agents.js
// SINGLE SOURCE OF TRUTH for the agent registry and risk tiers.
//
// v4.0 — DNA EVOLUTION LAYER: this file is now the BASELINE only. Runtime changes
// (tier adjustments the system has proposed AND you've approved) live in
// config/dna-overrides.json and are merged in at getTier()/getPrompt() time.
// You should rarely need to hand-edit this file again — approved evolution goes
// through lib/dnaEvolution.js instead. See DNA_NOTES.md for how that works.
//
// server.js, scheduler.js, and lib/*.js all import from here.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OVERRIDES_PATH = path.join(__dirname, 'dna-overrides.json');

export const AGENTS = {
    'competitor-analyzer': {
        triggers: ['competitor', 'wholesaling platforms', 'cash buyer network', 'disposition competitor'],
        description: 'Analyzes competitor wholesalers, buyers lists, and market positioning',
        prompt: 'You are a real-estate wholesaling competitor analyst. Compare competitor offer models, disposition speed, buyer network strength, and workflow gaps. Avoid unsourced claims.'
    },
    'content-generator': {
        triggers: ['deal summary', 'seller summary', 'investor summary'],
        description: 'Generates concise wholesaling deal summaries',
        prompt: 'You write concise, factual wholesaling deal summaries for internal team use. Include property basics, distress signals, numbers, and next action.'
    },
    'email-writer': {
        triggers: ['write email', 'seller follow-up', 'investor blast', 'draft email'],
        description: 'Writes seller and investor outreach messages',
        prompt: 'You are a real-estate wholesaling outreach writer. Draft clear, compliant seller and investor messages with urgency but no false claims.'
    },
    'headline-generator': {
        triggers: ['headline', 'deal title', 'listing title'],
        description: 'Creates deal-listing headlines',
        prompt: 'You create concise real-estate deal listing headlines focused on ARV, spread, location, and investor angle.'
    },
    'keyword-researcher': {
        triggers: ['keyword research', 'motivated seller keywords', 'cash buyer keywords'],
        description: 'Researches acquisition and disposition keywords',
        prompt: 'You are an acquisition marketing strategist for real-estate wholesaling. Suggest high-intent keywords for seller leads and buyer disposition.'
    },
    'performance-optimizer': {
        triggers: ['optimize performance', 'speed up', 'pipeline bottleneck'],
        description: 'Optimizes wholesaling pipeline throughput',
        prompt: 'You optimize wholesaling funnel performance: lead intake, analysis cycle time, buyer match speed, and close-rate bottlenecks.'
    },
    'podcast-script': {
        triggers: ['podcast script', 'investor podcast'],
        description: 'Writes investor education scripts',
        prompt: 'You write short investor education scripts focused on wholesaling deals, underwriting, and market insights.'
    },
    'revenue-tracker': {
        triggers: ['assignment fees', 'revenue', 'income', 'sales report'],
        description: 'Tracks assignment fee and deal revenue',
        prompt: 'You are a wholesaling revenue analyst. Track assignment fees, conversion rate, cycle time, and per-channel close performance.'
    },
    'seo-optimizer': {
        triggers: ['seo optimize', 'search engine optimize', 'seller seo'],
        description: 'Optimizes seller acquisition content for SEO',
        prompt: 'You optimize motivated-seller pages and investor acquisition content for search performance and conversion.'
    },
    'social-media': {
        triggers: ['social media', 'social post', 'investor post'],
        description: 'Creates social posts for buyers and sellers',
        prompt: 'You create real-estate wholesaling social posts targeting cash buyers, landlords, and motivated sellers.'
    },
    'trend-analyzer': {
        triggers: ['trend', 'market trend', 'distress trend', 'foreclosure trend'],
        description: 'Analyzes local distress and pricing trends',
        prompt: 'You analyze foreclosure pressure, tax-default trends, DOM shifts, and investor demand patterns relevant to wholesaling.'
    },
    'video-script': {
        triggers: ['video script', 'youtube script', 'deal walkthrough'],
        description: 'Writes deal walkthrough scripts',
        prompt: 'You write concise video scripts for property deal walkthroughs and investor briefs.'
    },
    'business-strategist': {
        triggers: ['business strategy', 'strategic planning', 'vertical integration', 'property management expansion'],
        description: 'Provides strategy for wholesaling-led vertical integration',
        prompt: 'You are a strategic advisor for a wholesaling business expanding into property management and marketplace operations. Prioritize defensibility and speed to close.'
    },
    'market-researcher': {
        triggers: ['market research', 'market analysis', 'dfw comps', 'distressed inventory'],
        description: 'Researches wholesaling market signals (RAG-loop grounded)',
        prompt: 'You are a real-estate wholesaling market researcher. Focus on distressed inventory, buyer demand, comp movement, and time-to-close dynamics.'
    },
    'customer-feedback': {
        triggers: ['seller feedback', 'investor feedback', 'customer feedback', 'feedback analysis'],
        description: 'Analyzes seller/investor feedback for workflow improvements',
        prompt: 'You analyze seller and investor feedback to improve conversion speed, trust, and close consistency in a wholesaling pipeline.'
    },
    'sales-consultant': {
        triggers: ['disposition strategy', 'sales strategy', 'investor outreach strategy', 'sales advice'],
        description: 'Provides wholesaling disposition strategy',
        prompt: 'You are a disposition strategist for real-estate wholesaling. Recommend next best action to move a deal from analysis to assignment in 7-14 days.'
    },
    'product-analyzer': {
        triggers: ['workflow analysis', 'product analysis', 'crm workflow'],
        description: 'Analyzes wholesaling workflow and tooling improvements',
        prompt: 'You analyze wholesaling workflow friction across lead sourcing, underwriting, investor matching, and disposition.'
    },
    'deal-closer': {
        triggers: ['follow-up', 'assignment contract', 'close deal', 'contract', 'closing', 'negotiate', 'proposal', 'disposition'],
        description: 'Drafts assignment/disposition proposals — ALWAYS gated, never executes without approval',
        prompt: 'You are a senior real-estate wholesaling closer drafting assignment/disposition proposals for human review. Never state that a contract is executed or a deal is closed. Mark assumptions and estimates clearly.'
    },
    'real-estate-law-compliance': {
        triggers: ['state law', 'legal compliance', 'disclosure requirement', 'assignment law', 'real estate law'],
        description: 'Reviews state-law constraints and disclosure requirements for wholesaling workflows',
        prompt: 'You are a real-estate legal compliance analyst for U.S. wholesaling operations. Identify state-level disclosure, assignment, and marketing constraints; flag uncertainty; and require attorney review before operational execution.'
    }
};

// BASELINE tiers — the fail-safe defaults. Only change these via a deliberate
// code edit + commit, not at runtime.
// T0 = autonomous · T1 = logged autonomous · T2 = gated (requires approval)
// Any agent not listed here defaults to T2 — fail safe, not fail open.
export const AGENT_TIER = {
    'competitor-analyzer': 'T0',
    'content-generator': 'T0',
    'headline-generator': 'T0',
    'keyword-researcher': 'T0',
    'performance-optimizer': 'T0',
    'podcast-script': 'T0',
    'revenue-tracker': 'T0',
    'seo-optimizer': 'T0',
    'trend-analyzer': 'T0',
    'video-script': 'T0',
    'business-strategist': 'T0',
    'market-researcher': 'T0',
    'customer-feedback': 'T0',
    'product-analyzer': 'T0',
    'email-writer': 'T1',
    'social-media': 'T1',
    'sales-consultant': 'T1',
    'deal-closer': 'T2',
    'real-estate-law-compliance': 'T2'
};

// Agents that run a bounded RAG loop instead of a single-shot call.
export const RAG_LOOP_AGENTS = new Set(['market-researcher', 'competitor-analyzer']);

// --- DNA EVOLUTION LAYER: read approved overrides, merge over baseline ---
// IMPORTANT SAFETY RULE, enforced here: overrides can only ever move a tier UP
// in strictness (T0->T1->T2), never down. A T2 agent can never be demoted to
// T0/T1 by an override — that would let approved "evolution" quietly loosen a
// gate. Loosening a tier requires an actual code change to AGENT_TIER above,
// not a runtime override. See lib/dnaEvolution.js for how overrides are proposed.
const TIER_RANK = { T0: 0, T1: 1, T2: 2 };

function loadOverrides() {
    try {
        if (fs.existsSync(OVERRIDES_PATH)) {
            return JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf8'));
        }
    } catch (e) {
        console.error('Failed to load dna-overrides.json:', e.message);
    }
    return { tierOverrides: {}, version: 0, updatedAt: null };
}

export function getTier(agentName) {
    const baseline = AGENT_TIER[agentName] || 'T2';
    const overrides = loadOverrides();
    const override = overrides.tierOverrides?.[agentName];
    if (!override) return baseline;
    // Only allow the override to be stricter (higher rank) than baseline, never looser.
    return TIER_RANK[override] > TIER_RANK[baseline] ? override : baseline;
}

export function getDnaVersion() {
    return loadOverrides().version || 0;
}

export function getPrompt(agentName) {
    return AGENTS[agentName]?.prompt || 'You are a helpful AI assistant.';
}

export function selectAgent(query) {
    const lower = query.toLowerCase();
    let best = null;
    let bestScore = 0;
    for (const [name, config] of Object.entries(AGENTS)) {
        let score = 0;
        for (const trigger of config.triggers) {
            if (lower.includes(trigger.toLowerCase())) score += 10;
        }
        if (score > bestScore) {
            bestScore = score;
            best = name;
        }
    }
    return best || 'content-generator';
}
