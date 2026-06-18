import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8080;

// Get API key from environment variable
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

app.use(cors());
app.use(express.json());

// ============================================
// AGENT CONFIGURATION
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
// EXECUTE AGENT WITH OPENROUTER
// ============================================
async function executeAgent(agentName, query) {
    console.log(`🎯 Executing: ${agentName}`);

    // System prompts for each agent
    const systemPrompts = {
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
        'video-script': 'You are a video script writer. Create compelling video content scripts.'
    };

    const systemPrompt = systemPrompts[agentName] || 'You are a helpful AI assistant.';

    // Check if API key is set
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
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
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

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        apiKeySet: !!OPENROUTER_API_KEY
    });
});

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
    console.log(`🎯 Selected: ${agentName}`);

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
// START SERVER
// ============================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Sovereign Empire Platform running on port ${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/api/agents`);
    console.log(`🤖 Agents loaded: ${Object.keys(AGENTS).length}`);
    console.log(`🔑 OpenRouter API: ${OPENROUTER_API_KEY ? '✅ Configured' : '❌ Missing'}`);
});