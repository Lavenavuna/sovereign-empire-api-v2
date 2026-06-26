// server.js - Complete Sovereign Empire API Server
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
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
// HEALTH CHECK - Must respond quickly for Railway
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
// SERVE DASHBOARDS
// ============================================
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/revenue-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'revenue-dashboard.html'));
});

app.get('/multilingual-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'multilingual-dashboard.html'));
});

app.get('/pipeline', (req, res) => {
    res.sendFile(path.join(__dirname, 'pipeline-dashboard.html'));
});

// ============================================
// AGENT CONFIGURATION - 18 AGENTS
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
    },
    'deal-closer': {
        triggers: ['follow-up', 'schedule call', 'close deal', 'contract', 'closing', 'negotiate', 'proposal', 'deal'],
        description: 'Handles follow-ups, calls, and deal closing'
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
        'product-analyzer': 'You are a product management expert. Analyze products and suggest improvements.',
        'deal-closer': 'You are a senior sales closer with 15 years of experience in B2B sales. Your goal is to guide prospects through the final steps of the deal and close it. Draft personalized follow-up emails, generate call scripts, create persuasive proposals, and craft contract summary emails. Move every deal from "Interested" to "Closed-Won."'
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

// Get all agents
app.get('/api/agents', (req, res) => {
    const list = Object.entries(AGENTS).map(([name, config]) => ({
        name,
        description: config.description,
        triggers: config.triggers.slice(0, 3)
    }));
    res.json({ agents: list, count: list.length });
});

// Chat with auto-select
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

// Chat with specific agent
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
// SALES AGENT STATE
// ============================================
app.get('/api/sales/state', (req, res) => {
    try {
        const statePath = path.join(__dirname, '../slideshow-kit/agent-state.json');
        if (!fs.existsSync(statePath)) {
            return res.json({ 
                performance: { 
                    totalLeads: 0, 
                    totalOutreach: 0, 
                    totalResponses: 0,
                    totalConversions: 0, 
                    totalRevenue: 0 
                },
                clients: [],
                status: 'No data yet - run sales agent first'
            });
        }
        const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        res.json({ ...state, status: 'ok' });
    } catch (error) {
        res.json({ 
            performance: { 
                totalLeads: 0, 
                totalOutreach: 0, 
                totalResponses: 0,
                totalConversions: 0, 
                totalRevenue: 0 
            },
            clients: [],
            error: error.message,
            status: 'degraded'
        });
    }
});

// ============================================
// UNIFIED LEADS API
// ============================================
app.get('/api/leads', (req, res) => {
    try {
        const leads = [];
        
        const pipelinePath = path.join(__dirname, './pipeline-state.json');
        if (fs.existsSync(pipelinePath)) {
            const pipeline = JSON.parse(fs.readFileSync(pipelinePath, 'utf8'));
            if (pipeline.deals) {
                pipeline.deals.forEach(deal => {
                    leads.push({
                        id: deal.leadId || deal.id,
                        name: deal.leadName,
                        company: deal.company,
                        email: deal.email,
                        phone: deal.phone,
                        industry: deal.industry,
                        status: deal.stage || 'new',
                        source: deal.source || 'Pipeline',
                        created: deal.created,
                        lastContact: deal.lastContact,
                        revenue: deal.revenue || 0,
                        stage: deal.stage || 'new',
                        activities: deal.activities || []
                    });
                });
            }
        }
        
        const agentPath = path.join(__dirname, '../slideshow-kit/agent-state.json');
        if (fs.existsSync(agentPath)) {
            const agentState = JSON.parse(fs.readFileSync(agentPath, 'utf8'));
            if (agentState.leads) {
                agentState.leads.forEach(lead => {
                    const exists = leads.some(l => l.id === lead.id);
                    if (!exists) {
                        leads.push({
                            id: lead.id,
                            name: lead.contactName || lead.name,
                            company: lead.company,
                            email: lead.contactEmail || lead.email,
                            phone: lead.phone || '',
                            industry: lead.industry || '',
                            status: lead.status || 'new',
                            source: lead.source || 'Sales Agent',
                            created: lead.discoveredAt || lead.created,
                            lastContact: null,
                            revenue: 0,
                            stage: lead.status || 'new',
                            activities: []
                        });
                    }
                });
            }
        }
        
        if (leads.length === 0) {
            const sampleLeads = [
                { id: 'sample_1', name: 'Sarah Johnson', company: 'TechFlow Solutions', email: 'sarah@techflow.com', status: 'interested' },
                { id: 'sample_2', name: 'Michael Chen', company: 'DataSphere Inc', email: 'michael@datasphere.com', status: 'new' },
                { id: 'sample_3', name: 'Emily Rodriguez', company: 'CloudPioneer', email: 'emily@cloudpioneer.com', status: 'interested' },
                { id: 'sample_4', name: 'James Wilson', company: 'AI Innovations', email: 'james@aiinnovations.com', status: 'new' },
                { id: 'sample_5', name: 'Lisa Park', company: 'Digital Transform', email: 'lisa@digitaltransform.com', status: 'interested' }
            ];
            sampleLeads.forEach(lead => {
                leads.push({
                    id: lead.id,
                    name: lead.name,
                    company: lead.company,
                    email: lead.email,
                    phone: '',
                    industry: '',
                    status: lead.status,
                    source: 'Sample',
                    created: new Date().toISOString(),
                    lastContact: null,
                    revenue: 0,
                    stage: lead.status,
                    activities: []
                });
            });
        }
        
        res.json({
            success: true,
            count: leads.length,
            leads: leads,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message,
            leads: [],
            count: 0
        });
    }
});

// ============================================
// HIGH VELOCITY SALES API
// ============================================
// Get high-velocity sales data
app.get('/api/sales/high-velocity', (req, res) => {
    try {
        const statePath = path.join(__dirname, './high-velocity-state.json');
        if (!fs.existsSync(statePath)) {
            return res.json({ 
                success: true, 
                deals: [],
                closedDeals: [],
                revenue: 0,
                message: 'No pipeline data yet'
            });
        }
        const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        
        // Check different possible structures
        let deals = [];
        let closedDeals = [];
        let revenue = 0;
        
        // Case 1: State has 'activeDeals' array
        if (state.activeDeals && Array.isArray(state.activeDeals)) {
            deals = state.activeDeals;
            closedDeals = state.closedDeals || [];
            revenue = state.revenue || 0;
        }
        // Case 2: State has 'deals' array at top level
        else if (state.deals && Array.isArray(state.deals)) {
            deals = state.deals;
            closedDeals = state.closedDeals || [];
            revenue = state.revenue || 0;
        }
        // Case 3: State has 'leads' array (from apify)
        else if (state.leads && Array.isArray(state.leads)) {
            // Convert leads to deals format
            deals = state.leads.map(lead => ({
                id: lead.id || 'lead_' + Date.now(),
                lead: {
                    name: lead.name || 'Unknown',
                    company: lead.company || 'Unknown',
                    email: lead.email || '',
                    phone: lead.phone || '',
                    industry: lead.industry || 'Unknown'
                },
                stage: lead.stage || 'new',
                created: lead.created || new Date().toISOString(),
                revenue: 0,
                closed: false
            }));
            closedDeals = [];
            revenue = 0;
        }
        
        const response = {
            success: true,
            deals: deals,
            closedDeals: closedDeals,
            revenue: revenue,
            total: deals.length
        };
        
        res.json(response);
    } catch (error) {
        console.error('Error in /api/sales/high-velocity:', error);
        res.json({ 
            success: false, 
            error: error.message,
            deals: [],
            closedDeals: [],
            revenue: 0
        });
    }
});
// ============================================
// TIMESFM FORECASTING ROUTES
// ============================================

// Get full forecast data
app.get('/api/forecast', (req, res) => {
    try {
        const forecastPath = path.join(__dirname, './timesfm-forecasts.json');
        if (!fs.existsSync(forecastPath)) {
            return res.json({ 
                success: false, 
                message: 'No forecast data yet. Run timesfm-forecast.js first.'
            });
        }
        const forecast = JSON.parse(fs.readFileSync(forecastPath, 'utf8'));
        res.json({ success: true, data: forecast });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get forecast summary
app.get('/api/forecast/summary', (req, res) => {
    try {
        const forecastPath = path.join(__dirname, './timesfm-forecasts.json');
        if (!fs.existsSync(forecastPath)) {
            return res.json({ 
                success: false, 
                message: 'No forecast data yet'
            });
        }
        const forecast = JSON.parse(fs.readFileSync(forecastPath, 'utf8'));
        
        const summary = {
            timestamp: new Date().toISOString(),
            horizon: 30,
            sales: null,
            leads: null,
            revenue: null
        };
        
        if (forecast.sales && forecast.sales.prediction) {
            const f = forecast.sales;
            const values = f.prediction.map(d => d.value);
            const total = values.reduce((a, b) => a + b, 0);
            summary.sales = {
                trend: values[values.length - 1] > values[0] ? 'increasing' : 'decreasing',
                avg: Math.round(total / values.length),
                peak: Math.max(...values),
                final: values[values.length - 1]
            };
        }
        
        if (forecast.leads && forecast.leads.prediction) {
            const f = forecast.leads;
            const values = f.prediction.map(d => d.value);
            const total = values.reduce((a, b) => a + b, 0);
            summary.leads = {
                trend: values[values.length - 1] > values[0] ? 'increasing' : 'decreasing',
                avg: Math.round(total / values.length),
                peak: Math.max(...values),
                final: values[values.length - 1]
            };
        }
        
        if (forecast.revenue && forecast.revenue.prediction) {
            const f = forecast.revenue;
            const values = f.prediction.map(d => d.value);
            const total = values.reduce((a, b) => a + b, 0);
            summary.revenue = {
                trend: values[values.length - 1] > values[0] ? 'increasing' : 'decreasing',
                avg: Math.round(total / values.length),
                peak: Math.max(...values),
                final: values[values.length - 1]
            };
        }
        
        res.json({ success: true, data: summary });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Run forecast manually
app.post('/api/forecast/run', async (req, res) => {
    try {
        const module = await import('./timesfm-forecast.js');
        const engine = new module.TimesFMEngine();
        await engine.generateFullForecast();
        res.json({ success: true, message: 'Forecast generated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// START SERVER
// ============================================
// ============================================
// APIFY LEADS API
// ============================================
app.get('/api/apify/leads', (req, res) => {
    try {
        const apifyPath = path.join(__dirname, './apify-leads-state.json');
        if (!fs.existsSync(apifyPath)) {
            return res.json({ 
                success: true, 
                leads: [],
                qualifiedLeads: [],
                total: 0,
                message: 'No Apify leads yet'
            });
        }
        const data = JSON.parse(fs.readFileSync(apifyPath, 'utf8'));
        res.json({
            success: true,
            leads: data.leads || [],
            qualifiedLeads: data.qualifiedLeads || [],
            total: (data.leads || []).length
        });
    } catch (error) {
        console.error('Error in /api/apify/leads:', error);
        res.json({ 
            success: false, 
            error: error.message,
            leads: [],
            qualifiedLeads: [],
            total: 0
        });
    }
});