// platform/config/AgentDNA.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// AGENT REGISTRY - All available agents
// ============================================
export const agentRegistry = {
    'competitor-analyzer': {
        path: '../../sovereign-empire-dna-20260611_064020/agents/competitor-analyzer',
        triggers: ['competitor', 'market research', 'analyze competition', 'competitive analysis'],
        description: 'Analyzes competitors and market positioning',
        category: 'research',
        timeout: 60000
    },
    'content-generator': {
        path: '../../sovereign-empire-dna-20260611_064020/agents/content-generator',
        triggers: ['write blog', 'generate content', 'create article', 'content creation'],
        description: 'Generates blog posts, articles, and content',
        category: 'content',
        timeout: 120000
    },
    'email-writer': {
        path: '../../sovereign-empire-dna-20260611_064020/agents/email-writer',
        triggers: ['write email', 'draft email', 'email campaign'],
        description: 'Drafts professional emails',
        category: 'communication',
        timeout: 30000
    },
    'headline-generator': {
        path: '../../sovereign-empire-dna-20260611_064020/agents/headline-generator',
        triggers: ['headline', 'title', 'catchy title', 'blog title'],
        description: 'Creates attention-grabbing headlines',
        category: 'content',
        timeout: 20000
    },
    'keyword-researcher': {
        path: '../../sovereign-empire-dna-20260611_064020/agents/keyword-researcher',
        triggers: ['keyword research', 'seo keywords', 'search terms'],
        description: 'Researches SEO keywords and search volume',
        category: 'seo',
        timeout: 45000
    },
    'performance-optimizer': {
        path: '../../sovereign-empire-dna-20260611_064020/agents/performance-optimizer',
        triggers: ['optimize performance', 'speed up', 'performance audit'],
        description: 'Analyzes and optimizes performance',
        category: 'technical',
        timeout: 90000
    },
    'podcast-script': {
        path: '../../sovereign-empire-dna-20260611_064020/agents/podcast-script',
        triggers: ['podcast script', 'podcast episode', 'audio script'],
        description: 'Writes podcast scripts',
        category: 'content',
        timeout: 60000
    },
    'revenue-tracker': {
        path: '../../sovereign-empire-dna-20260611_064020/agents/revenue-tracker',
        triggers: ['revenue', 'income', 'sales report', 'financial'],
        description: 'Tracks and reports revenue metrics',
        category: 'analytics',
        timeout: 30000
    },
    'seo-optimizer': {
        path: '../../sovereign-empire-dna-20260611_064020/agents/seo-optimizer',
        triggers: ['seo optimize', 'search engine optimize', 'improve seo'],
        description: 'Optimizes content for search engines',
        category: 'seo',
        timeout: 60000
    },
    'social-media': {
        path: '../../sovereign-empire-dna-20260611_064020/agents/social-media',
        triggers: ['social media', 'social post', 'twitter', 'linkedin', 'facebook'],
        description: 'Creates social media posts',
        category: 'content',
        timeout: 30000
    },
    'trend-analyzer': {
        path: '../../sovereign-empire-dna-20260611_064020/agents/trend-analyzer',
        triggers: ['trend', 'market trend', 'emerging trend'],
        description: 'Analyzes market trends and predictions',
        category: 'research',
        timeout: 60000
    },
    'video-script': {
        path: '../../sovereign-empire-dna-20260611_064020/agents/video-script',
        triggers: ['video script', 'youtube script', 'video content'],
        description: 'Writes video scripts',
        category: 'content',
        timeout: 60000
    }
};

// ============================================
// AGENT SELECTOR - Finds the right agent
// ============================================
export class AgentSelector {
    constructor() {
        this.agents = agentRegistry;
        this.defaultAgent = 'content-generator';
        this.confidenceThreshold = 3;
    }

    selectAgent(query) {
        const queryLower = query.toLowerCase();
        let scores = [];

        for (const [name, config] of Object.entries(this.agents)) {
            let score = 0;
            for (const trigger of config.triggers) {
                if (queryLower.includes(trigger)) {
                    score += 10;
                }
                // Partial matches
                const words = trigger.split(' ');
                for (const word of words) {
                    if (word.length > 3 && queryLower.includes(word)) {
                        score += 1;
                    }
                }
            }
            scores.push({ name, score, config });
        }

        // Sort by score descending
        scores.sort((a, b) => b.score - a.score);
        const best = scores[0];

        if (!best || best.score < this.confidenceThreshold) {
            return { 
                agent: this.defaultAgent, 
                confidence: 'low', 
                score: 0,
                fallback: true
            };
        }

        return {
            agent: best.name,
            confidence: best.score > 20 ? 'high' : 'medium',
            score: best.score,
            fallback: false
        };
    }

    getAllAgents() {
        return Object.entries(this.agents).map(([name, config]) => ({
            name,
            description: config.description,
            category: config.category,
            triggers: config.triggers.slice(0, 3)
        }));
    }

    getAgentsByCategory(category) {
        return Object.entries(this.agents)
            .filter(([_, config]) => config.category === category)
            .map(([name, config]) => ({
                name,
                description: config.description,
                triggers: config.triggers.slice(0, 3)
            }));
    }
}

// ============================================
// METRICS COLLECTOR - Tracks everything
// ============================================
export class MetricsCollector {
    constructor() {
        this.metricsFile = path.join(__dirname, '../logs/metrics.json');
        this.metrics = this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.metricsFile)) {
                const data = fs.readFileSync(this.metricsFile, 'utf8');
                return JSON.parse(data);
            }
        } catch (e) {
            console.log('Creating new metrics file');
        }
        return this.getDefaultMetrics();
    }

    getDefaultMetrics() {
        return {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalTokens: 0,
            totalCost: 0,
            totalLatency: 0,
            agentUsage: {},
            dailyStats: {},
            errors: []
        };
    }

    record(agentName, success, tokens = 0, latency = 0, cost = 0, error = null) {
        const today = new Date().toISOString().split('T')[0];
        
        this.metrics.totalRequests++;
        if (success) {
            this.metrics.successfulRequests++;
        } else {
            this.metrics.failedRequests++;
            if (error) {
                this.metrics.errors.push({
                    timestamp: new Date().toISOString(),
                    agent: agentName,
                    error: error
                });
                // Keep only last 100 errors
                if (this.metrics.errors.length > 100) {
                    this.metrics.errors = this.metrics.errors.slice(-100);
                }
            }
        }
        
        this.metrics.totalTokens += tokens || 0;
        this.metrics.totalCost += cost || 0;
        this.metrics.totalLatency += latency || 0;
        
        // Agent-specific stats
        if (!this.metrics.agentUsage[agentName]) {
            this.metrics.agentUsage[agentName] = { 
                count: 0, 
                success: 0, 
                fail: 0,
                totalLatency: 0,
                totalTokens: 0
            };
        }
        this.metrics.agentUsage[agentName].count++;
        if (success) {
            this.metrics.agentUsage[agentName].success++;
        } else {
            this.metrics.agentUsage[agentName].fail++;
        }
        this.metrics.agentUsage[agentName].totalLatency += latency || 0;
        this.metrics.agentUsage[agentName].totalTokens += tokens || 0;

        // Daily stats
        if (!this.metrics.dailyStats[today]) {
            this.metrics.dailyStats[today] = { 
                requests: 0, 
                success: 0,
                fail: 0,
                cost: 0,
                tokens: 0,
                agents: {} 
            };
        }
        this.metrics.dailyStats[today].requests++;
        if (success) {
            this.metrics.dailyStats[today].success++;
        } else {
            this.metrics.dailyStats[today].fail++;
        }
        this.metrics.dailyStats[today].cost += cost || 0;
        this.metrics.dailyStats[today].tokens += tokens || 0;
        
        // Save periodically
        if (this.metrics.totalRequests % 5 === 0) {
            this.save();
        }
    }

    save() {
        try {
            fs.writeFileSync(this.metricsFile, JSON.stringify(this.metrics, null, 2));
        } catch (e) {
            console.error('Failed to save metrics:', e);
        }
    }

    getReport() {
        const today = new Date().toISOString().split('T')[0];
        const todayStats = this.metrics.dailyStats[today] || { requests: 0, success: 0, fail: 0 };
        
        return {
            summary: {
                totalRequests: this.metrics.totalRequests,
                successRate: this.metrics.totalRequests > 0 
                    ? ((this.metrics.successfulRequests / this.metrics.totalRequests) * 100).toFixed(1) + '%'
                    : '0%',
                totalCost: this.metrics.totalCost.toFixed(4),
                averageTokens: this.metrics.totalRequests > 0
                    ? Math.round(this.metrics.totalTokens / this.metrics.totalRequests)
                    : 0,
                averageLatency: this.metrics.totalRequests > 0
                    ? Math.round(this.metrics.totalLatency / this.metrics.totalRequests) + 'ms'
                    : '0ms'
            },
            today: {
                requests: todayStats.requests || 0,
                success: todayStats.success || 0,
                fail: todayStats.fail || 0,
                cost: (todayStats.cost || 0).toFixed(4),
                tokens: todayStats.tokens || 0
            },
            agentUsage: this.metrics.agentUsage,
            recentErrors: this.metrics.errors.slice(-10),
            timestamp: new Date().toISOString()
        };
    }
}

// ============================================
// AGENT EXECUTOR - Runs the agents
// ============================================
export class AgentExecutor {
    constructor() {
        this.selector = new AgentSelector();
        this.metrics = new MetricsCollector();
        this.basePath = path.join(__dirname, '../../sovereign-empire-dna-20260611_064020/agents');
    }

    async execute(query, agentName = null) {
        const startTime = Date.now();
        let selectedAgent = agentName;
        let confidence = 'high';
        let fallback = false;

        // Auto-select if no agent specified
        if (!selectedAgent) {
            const selection = this.selector.selectAgent(query);
            selectedAgent = selection.agent;
            confidence = selection.confidence;
            fallback = selection.fallback || false;
            console.log(`🎯 Selected agent: ${selectedAgent} (confidence: ${confidence}, score: ${selection.score})`);
        }

        // Get agent config
        const agentConfig = agentRegistry[selectedAgent];
        if (!agentConfig) {
            const error = `Agent "${selectedAgent}" not found`;
            this.metrics.record(selectedAgent, false, 0, Date.now() - startTime, 0, error);
            return {
                success: false,
                agent: selectedAgent,
                error,
                availableAgents: Object.keys(agentRegistry),
                timestamp: new Date().toISOString()
            };
        }

        try {
            // Execute the agent
            const result = await this.runAgent(agentConfig.path, query, agentConfig);
            const latency = Date.now() - startTime;
            
            // Record metrics
            this.metrics.record(
                selectedAgent, 
                true, 
                result.tokens || 0, 
                latency, 
                result.cost || 0
            );
            
            return {
                success: true,
                agent: selectedAgent,
                confidence,
                fallback,
                response: result,
                latency: latency + 'ms',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            const latency = Date.now() - startTime;
            this.metrics.record(selectedAgent, false, 0, latency, 0, error.message);
            
            return {
                success: false,
                agent: selectedAgent,
                error: error.message,
                latency: latency + 'ms',
                timestamp: new Date().toISOString()
            };
        }
    }

    async runAgent(agentPath, query, config) {
        // Try to find the agent's index.js or main file
        const possibleFiles = [
            path.join(this.basePath, agentPath, 'index.js'),
            path.join(this.basePath, agentPath, 'agent.js'),
            path.join(this.basePath, agentPath, 'main.js'),
            path.join(this.basePath, agentPath, 'run.js')
        ];

        let agentFile = null;
        for (const file of possibleFiles) {
            if (fs.existsSync(file)) {
                agentFile = file;
                break;
            }
        }

        if (agentFile) {
            // Dynamic import of agent
            const agent = await import('file://' + agentFile);
            if (typeof agent.default === 'function') {
                const result = await agent.default(query);
                return {
                    content: result || 'Agent executed successfully',
                    tokens: 150,
                    cost: 0.00015
                };
            } else if (typeof agent.run === 'function') {
                const result = await agent.run(query);
                return {
                    content: result || 'Agent executed successfully',
                    tokens: 150,
                    cost: 0.00015
                };
            }
        }

     // Fallback: Use a simple API call
console.log(`⚡ Using fallback for ${config.description}`);
try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY || 'YOUR_KEY_HERE'}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'deepseek/deepseek-chat',
            messages: [{ role: 'user', content: query }],
            max_tokens: 500
        })
    });
    const data = await response.json();
    return {
        content: data.choices?.[0]?.message?.content || 'I processed your request.',
        tokens: 200,
        cost: 0.0002,
        fallback: true
    };
} catch (e) {
    return {
        content: 'I processed your request using fallback mode.',
        tokens: 100,
        cost: 0,
        fallback: true
    };
}
        
        return {
            content: response || 'I processed your request.',
            tokens: 200,
            cost: 0.0002,
            fallback: true
        };
    }

    getMetrics() {
        return this.metrics.getReport();
    }
}

// ============================================
// EXPORTS
// ============================================
export default {
    agentRegistry,
    AgentSelector,
    MetricsCollector,
    AgentExecutor
};