import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Get API key from environment variable
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

app.use(cors());
app.use(express.json());

// Serve static files (dashboard)
app.use(express.static(path.join(__dirname)));

// ============================================
// HEALTH CHECK - MUST RESPOND QUICKLY
// ============================================
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        apiKeySet: !!OPENROUTER_API_KEY
    });
});

// ============================================
// WELCOME ROUTE
// ============================================
app.get('/', (req, res) => {
    res.json({
        message: '🚀 Sovereign Empire AI Platform',
        version: '2.0.0',
        status: 'online',
        timestamp: new Date().toISOString()
    });
});

// ============================================
// SERVE DASHBOARD
// ============================================
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// ============================================
// AGENT CONFIGURATION (YOUR 17 AGENTS)
// ============================================
const AGENTS = {
    'competitor-analyzer': {
        triggers: ['competitor', 'market research', 'analyze competition'],
        description: 'Analyzes competitors'
    },
    'content-generator': {
        triggers: ['write blog', 'generate content', 'create article'],
        description: 'Generates blog posts'
    },
    'email-writer': {
        triggers: ['write email', 'draft email', 'email campaign'],
        description: 'Writes emails'
    },
    'headline-generator': {
        triggers: ['headline', 'title', 'catchy title'],
        description: 'Creates headlines'
    },
    'keyword-researcher': {
        triggers: ['keyword research', 'seo keywords'],
        description: 'Researches keywords'
    },
    'performance-optimizer': {
        triggers: ['optimize performance', 'speed up'],
        description: 'Optimizes performance'
    },
    'podcast-script': {
        triggers: ['podcast script', 'podcast episode'],
        description: 'Writes podcast scripts'
    },
    'revenue-tracker': {
        triggers: ['revenue', 'income', 'sales report'],
        description: 'Tracks revenue'
    },
    'seo-optimizer': {
        triggers: ['seo optimize', 'search engine optimize'],
        description: 'Optimizes for SEO'
    },
    'social-media': {
        triggers: ['social media', 'social post', 'twitter'],
        description: 'Creates social posts'
    },
    'trend-analyzer': {
        triggers: ['trend', 'market trend'],
        description: 'Analyzes trends'
    },
    'video-script': {
        triggers: ['video script', 'youtube script'],
        description: 'Writes video scripts'
    },
    'business-strategist': {
        triggers: ['business strategy', 'strategic planning', 'business growth'],
        description: 'Provides business strategy advice'
    },
    'market-researcher': {
        triggers: ['market research', 'market analysis', 'industry research'],
        description: 'Conducts market research'
    },
    'customer-feedback': {
        triggers: ['customer feedback', 'feedback analysis', 'customer sentiment'],
        description: 'Analyzes customer feedback'
    },
    'sales-consultant': {
        triggers: ['sales strategy', 'sales pitch', 'sales advice'],
        description: 'Provides sales consulting'
    },
    'product-analyzer': {
        triggers: ['product analysis', 'product review', 'product improvement'],
        description: 'Analyzes products and suggests improvements'
    }
};

// ============================================
// SELECT AGENT
// ============================================
function selectAgent(query) {
    const lower = query.toLowerCase();
    let best = null;
    let bestScore = 0;

    for (const [name, config] of Object.entries(AGENTS)) {
        let score = 0;
        for (const trigger of config.triggers) {
            if (lower.includes(trigger.toLowerCase())) {
                score += 10;
            }
        }
        if (score > bestScore) {
            bestScore = score;
            best = name;
        }
    }

    return best || 'content-generator';
}

// ============================================
// SYSTEM PROMPTS
// ============================================
function getSystemPrompt(agentName) {
    const prompts = {
        'competitor-analyzer': 'You are a competitor analysis expert. Analyze competitors and provide strategic insights.',
        'content-generator': 'You are a professional content writer. Create engaging, well-structured blog posts.',
        'email-writer': 'You are a professional email writer. Draft clear, persuasive emails.',
        'headline-generator': 'You are a headline expert. Create catchy, click-worthy headlines.',
        'keyword-researcher': 'You are an SEO expert. Research and suggest valuable keywords.',
        'performance-optimizer': 'You are a performance optimization expert. Suggest improvements for speed and efficiency.',
        'podcast-script': 'You are a podcast script writer. Create engaging, well-structured podcast scripts.',
        'revenue-tracker': 'You are a financial analyst. Track and report revenue metrics.',
        'seo-optimizer': 'You are an SEO expert. Optimize content for search engines.',
        'social-media': 'You are a social media expert. Create engaging posts for various platforms.',
        'trend-analyzer': 'You are a market trend analyst. Identify and analyze emerging trends.',
        'video-script': 'You are a video script writer. Create compelling video content scripts.',
        'business-strategist': 'You are a business strategy expert. Provide strategic advice for business growth and planning.',
        'market-researcher': 'You are a market research expert. Conduct thorough market analysis and provide insights.',
        'customer-feedback': 'You are a customer experience expert. Analyze feedback and provide actionable insights.',
        'sales-consultant': 'You are a sales expert. Provide sales strategies and advice to improve conversions.',
        'product-analyzer': 'You are a product management expert. Analyze products and suggest improvements.'
    };
    return prompts[agentName] || 'You are a helpful AI assistant.';
}

// ============================================
// EXECUTE AGENT
// ============================================
async function executeAgent(agentName, query) {
    console.log('🎯 Executing:', agentName);

    const systemPrompt = getSystemPrompt(agentName);

    if (!OPENROUTER_API_KEY) {
        return {
            success: true,
            result: '⚠️ OpenRouter API key not set. Please set OPENROUTER_API_KEY environment variable.',
            agent: agentName,
            fallback: true
        };
    }

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + OPENROUTER_API_KEY,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://sovereign-empire.com',
                'X-Title': 'Sovereign Empire AI Agent'
            },
            body: JSON.stringify({
                model: 'deepseek/deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: query }
                ],
                max_tokens: 1000,
                temperature: 0.7
            })
        });

        const data = await response.json();
        
        if (data.choices && data.choices[0]) {
            return {
                success: true,
                result: data.choices[0].message.content,
                agent: agentName,
                model: data.model || 'deepseek/deepseek-chat'
            };
        } else {
            return {
                success: false,
                error: data.error?.message || 'Unknown API error',
                agent: agentName,
                fallback: true
            };
        }
    } catch (error) {
        console.error('API Error:', error.message);
        return {
            success: false,
            error: error.message,
            agent: agentName,
            fallback: true
        };
    }
}

// ============================================
// API ROUTES
// ============================================

app.get('/api/agents', (req, res) => {
    const list = Object.entries(AGENTS).map(([name, config]) => ({
        name,
        description: config.description,
        triggers: config.triggers.slice(0, 3)
    }));
    res.json({ agents: list, count: list.length });
});

app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'Message required' });
    }

    const agentName = selectAgent(message);
    console.log('🎯 Selected:', agentName);

    const result = await executeAgent(agentName, message);
    res.json({
        ...result,
        query: message,
        timestamp: new Date().toISOString()
    });
});

app.post('/api/agent/:name', async (req, res) => {
    const { name } = req.params;
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message required' });
    }

    const result = await executeAgent(name, message);
    res.json({
        ...result,
        query: message,
        timestamp: new Date().toISOString()
    });
});

// ============================================
// PLANS API (Revenue)
// ============================================
const PLANS = {
    FREE: {
        id: 'free',
        name: 'Free',
        price: 0,
        features: ['1 agent', '10 requests/day', 'Basic support']
    },
    PRO: {
        id: 'pro',
        name: 'Pro',
        price: 29.99,
        features: ['All 17 agents', '500 requests/day', 'Email support', 'Daily reports']
    },
    BUSINESS: {
        id: 'business',
        name: 'Business',
        price: 99.99,
        features: ['All 17 agents', 'Unlimited requests', 'Priority support', 'Custom agents', 'Team sharing']
    },
    ENTERPRISE: {
        id: 'enterprise',
        name: 'Enterprise',
        price: 499.99,
        features: ['Everything in Business', 'Dedicated support', 'Custom training', 'SLA guarantee', 'White-label']
    }
};

app.get('/api/plans', (req, res) => {
    res.json(Object.values(PLANS));
});

// ============================================
// BUNDLES API (Revenue)
// ============================================
const BUNDLES = {
    'ecommerce': {
        name: 'E-Commerce Growth Suite',
        description: 'Complete AI solution for online stores',
        price: 49.99,
        agents: ['content-generator', 'email-writer', 'headline-generator', 'social-media', 'seo-optimizer', 'customer-feedback'],
        industry: 'Retail & E-Commerce'
    },
    'realestate': {
        name: 'Real Estate AI Suite',
        description: 'AI-powered tools for real estate professionals',
        price: 59.99,
        agents: ['content-generator', 'email-writer', 'trend-analyzer', 'competitor-analyzer', 'social-media', 'video-script'],
        industry: 'Real Estate'
    },
    'saas': {
        name: 'SaaS Growth Engine',
        description: 'AI agents for software companies',
        price: 79.99,
        agents: ['content-generator', 'email-writer', 'business-strategist', 'market-researcher', 'competitor-analyzer', 'revenue-tracker', 'seo-optimizer'],
        industry: 'SaaS & Technology'
    },
    'marketing': {
        name: 'Digital Marketing AI Suite',
        description: 'Complete marketing automation toolkit',
        price: 69.99,
        agents: ['content-generator', 'headline-generator', 'keyword-researcher', 'social-media', 'seo-optimizer', 'email-writer', 'trend-analyzer'],
        industry: 'Digital Marketing'
    }
};

app.get('/api/bundles', (req, res) => {
    const list = Object.entries(BUNDLES).map(([id, bundle]) => ({
        id,
        ...bundle,
        agentCount: bundle.agents.length
    }));
    res.json(list);
});

app.get('/api/bundles/:id', (req, res) => {
    const bundle = BUNDLES[req.params.id];
    if (!bundle) {
        return res.status(404).json({ error: 'Bundle not found' });
    }
    res.json({ id: req.params.id, ...bundle });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Sovereign Empire Platform running on port ' + PORT);
    console.log('📊 Agents loaded: ' + Object.keys(AGENTS).length);
    console.log('🔑 OpenRouter API: ' + (OPENROUTER_API_KEY ? '✅ Configured' : '❌ Missing'));
    console.log('💰 Plans: ' + Object.keys(PLANS).length + ' tiers');
    console.log('📦 Bundles: ' + Object.keys(BUNDLES).length + ' industry bundles');
});// Add this new endpoint to get the latest sales report
app.get('/api/sales/latest', (req, res) => {
    try {
        // Path to your sales agent report (adjust if your path is different)
        const reportPath = path.join(__dirname, '../slideshow-kit/reports');
        const files = fs.readdirSync(reportPath).filter(f => f.startsWith('report-')).sort();
        if (files.length === 0) {
            return res.json({ error: 'No reports found' });
        }
        const latestReport = JSON.parse(fs.readFileSync(path.join(reportPath, files[files.length - 1]), 'utf8'));
        res.json(latestReport);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add this to get the sales agent state
app.get('/api/sales/state', (req, res) => {
    try {
        const statePath = path.join(__dirname, '../slideshow-kit/agent-state.json');
        if (!fs.existsSync(statePath)) {
            return res.json({ performance: { totalLeads: 0, totalConversions: 0, totalRevenue: 0 } });
        }
        const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        res.json(state);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
