// config/agents.js
// SINGLE SOURCE OF TRUTH for the agent registry and risk tiers.
// server.js, scheduler.js, and lib/*.js all import from here.
// If you add or retier an agent, do it here — not inline anywhere else.
// Mirrors AGENTS.md — keep both in sync when either changes.

export const AGENTS = {
    'competitor-analyzer': {
        triggers: ['competitor', 'market research', 'analyze competition'],
        description: 'Analyzes competitors',
        prompt: 'You are a competitor analysis expert. Analyze competitors and provide strategic insights.'
    },
    'content-generator': {
        triggers: ['write blog', 'generate content', 'create article'],
        description: 'Generates blog posts',
        prompt: 'You are a professional content writer. Create engaging, well-structured blog posts.'
    },
    'email-writer': {
        triggers: ['write email', 'draft email', 'email campaign'],
        description: 'Writes emails',
        prompt: 'You are a professional email writer. Draft clear, persuasive emails.'
    },
    'headline-generator': {
        triggers: ['headline', 'title', 'catchy title'],
        description: 'Creates headlines',
        prompt: 'You are a headline expert. Create catchy, click-worthy headlines.'
    },
    'keyword-researcher': {
        triggers: ['keyword research', 'seo keywords'],
        description: 'Researches keywords',
        prompt: 'You are an SEO expert. Research and suggest valuable keywords.'
    },
    'performance-optimizer': {
        triggers: ['optimize performance', 'speed up'],
        description: 'Optimizes performance',
        prompt: 'You are a performance optimization expert. Suggest improvements for speed and efficiency.'
    },
    'podcast-script': {
        triggers: ['podcast script', 'podcast episode'],
        description: 'Writes podcast scripts',
        prompt: 'You are a podcast script writer. Create engaging, well-structured podcast scripts.'
    },
    'revenue-tracker': {
        triggers: ['revenue', 'income', 'sales report'],
        description: 'Tracks revenue',
        prompt: 'You are a financial analyst. Track and report revenue metrics.'
    },
    'seo-optimizer': {
        triggers: ['seo optimize', 'search engine optimize'],
        description: 'Optimizes for SEO',
        prompt: 'You are an SEO expert. Optimize content for search engines.'
    },
    'social-media': {
        triggers: ['social media', 'social post', 'twitter'],
        description: 'Creates social posts',
        prompt: 'You are a social media expert. Create engaging posts for various platforms.'
    },
    'trend-analyzer': {
        triggers: ['trend', 'market trend'],
        description: 'Analyzes trends',
        prompt: 'You are a market trend analyst. Identify and analyze emerging trends.'
    },
    'video-script': {
        triggers: ['video script', 'youtube script'],
        description: 'Writes video scripts',
        prompt: 'You are a video script writer. Create compelling video content scripts.'
    },
    'business-strategist': {
        triggers: ['business strategy', 'strategic planning', 'business growth'],
        description: 'Provides business strategy advice',
        prompt: 'You are a business strategy expert. Provide strategic advice for business growth and planning.'
    },
    'market-researcher': {
        triggers: ['market research', 'market analysis', 'industry research'],
        description: 'Conducts market research (RAG-loop grounded)',
        prompt: 'You are a market research expert. Conduct thorough market analysis and provide insights.'
    },
    'customer-feedback': {
        triggers: ['customer feedback', 'feedback analysis', 'customer sentiment'],
        description: 'Analyzes customer feedback',
        prompt: 'You are a customer experience expert. Analyze feedback and provide actionable insights.'
    },
    'sales-consultant': {
        triggers: ['sales strategy', 'sales pitch', 'sales advice'],
        description: 'Provides sales consulting',
        prompt: 'You are a sales expert. Provide sales strategies and advice to improve conversions.'
    },
    'product-analyzer': {
        triggers: ['product analysis', 'product review', 'product improvement'],
        description: 'Analyzes products and suggests improvements',
        prompt: 'You are a product management expert. Analyze products and suggest improvements.'
    },
    'deal-closer': {
        triggers: ['follow-up', 'schedule call', 'close deal', 'contract', 'closing', 'negotiate', 'proposal', 'deal'],
        description: 'Drafts deal proposals — ALWAYS gated, never executes without approval',
        prompt: 'You are a senior sales closer drafting a proposal for human review. Draft personalized follow-up emails, call scripts, and proposals. Never claim a deal is confirmed or closed — you are drafting for approval, not executing.'
    }
};

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
    'deal-closer': 'T2'
};

// Agents that run a bounded RAG loop instead of a single-shot call.
export const RAG_LOOP_AGENTS = new Set(['market-researcher', 'competitor-analyzer']);

export function getTier(agentName) {
    return AGENT_TIER[agentName] || 'T2';
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

