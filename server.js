// server.js - Sovereign Empire API Server
// CONSOLIDATED: agent registry now imported from config/agents.js (single source of
// truth, replaces the old inline AGENTS object + orphaned config/AgentDNA.js split).
// Approved deal-closer items now write into high-velocity-state.json for real.
// Trust Report endpoint reads real audit data — see lib/trustReport.js.
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { AGENTS, AGENT_TIER, getTier, getPrompt, selectAgent } from './config/agents.js';
import {
    loadJSON, saveJSON, logAction,
    loadAuditLog, loadPendingApprovals, savePendingApprovals,
    loadHighVelocityState, saveHighVelocityState,
    PENDING_APPROVALS_PATH
} from './lib/auditLog.js';
import { buildTrustReport } from './lib/trustReport.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        apiKeySet: !!OPENROUTER_API_KEY
    });
});

app.get('/', (req, res) => {
    res.json({ message: '🚀 Sovereign Empire AI Platform', version: '3.0.0', status: 'online', timestamp: new Date().toISOString() });
});

// ============================================
// DASHBOARDS
// ============================================
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/revenue-dashboard', (req, res) => res.sendFile(path.join(__dirname, 'revenue-dashboard.html')));
app.get('/multilingual-dashboard', (req, res) => res.sendFile(path.join(__dirname, 'multilingual-dashboard.html')));
app.get('/pipeline', (req, res) => res.sendFile(path.join(__dirname, 'pipeline-dashboard.html')));
app.get('/trust-report', (req, res) => res.sendFile(path.join(__dirname, 'trust-report.html')));

// ============================================
// EXECUTE AGENT — the actual model call
// ============================================
async function executeAgent(agentName, query) {
    const systemPrompt = getPrompt(agentName);

    if (!OPENROUTER_API_KEY) {
        return { success: true, result: '⚠️ OpenRouter API key not set.', agent: agentName, fallback: true };
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
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: query }],
                max_tokens: 1000,
                temperature: 0.7
            })
        });
        const data = await response.json();
        if (data.choices && data.choices[0]) {
            return { success: true, result: data.choices[0].message.content, agent: agentName, model: data.model || 'deepseek/deepseek-chat' };
        }
        return { success: false, error: data.error?.message || 'Unknown API error', agent: agentName, fallback: true };
    } catch (error) {
        console.error('API Error:', error.message);
        return { success: false, error: error.message, agent: agentName, fallback: true };
    }
}

// ============================================
// GATE — every request routes through tier logic first
// ============================================
async function handleAgentRequest(agentName, message) {
    const tier = getTier(agentName);

    if (tier === 'T2') {
        const approvals = loadPendingApprovals();
        const approvalId = 'appr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        approvals.push({
            id: approvalId, agent: agentName, tier, query: message,
            status: 'pending', createdAt: new Date().toISOString(), source: 'api-request'
        });
        savePendingApprovals(approvals);
        logAction({ agent: agentName, tier, action: 'escalated', approvalId });

        return {
            success: true, status: 'pending_approval', approvalId, agent: agentName, tier, result: null,
            message: 'This action requires approval before it executes. Approve via POST /api/approvals/' + approvalId + '/approve'
        };
    }

    const result = await executeAgent(agentName, message);
    logAction({ agent: agentName, tier, action: 'executed', success: result.success });
    return { ...result, tier };
}

// ============================================
// API ROUTES
// ============================================
app.get('/api/agents', (req, res) => {
    const list = Object.entries(AGENTS).map(([name, config]) => ({
        name, description: config.description, triggers: config.triggers.slice(0, 3), tier: getTier(name)
    }));
    res.json({ agents: list, count: list.length });
});

app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    const agentName = selectAgent(message);
    console.log('🎯 Selected:', agentName, '| tier:', getTier(agentName));
    const result = await handleAgentRequest(agentName, message);
    res.json({ ...result, query: message, timestamp: new Date().toISOString() });
});

app.post('/api/agent/:name', async (req, res) => {
    const { name } = req.params;
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    const result = await handleAgentRequest(name, message);
    res.json({ ...result, query: message, timestamp: new Date().toISOString() });
});

// ---- Approval queue ----
app.get('/api/approvals', (req, res) => {
    const approvals = loadPendingApprovals();
    res.json({ pending: approvals.filter(a => a.status === 'pending'), all: approvals });
});

app.post('/api/approvals/:id/approve', async (req, res) => {
    const approvals = loadPendingApprovals();
    const item = approvals.find(a => a.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Approval not found' });
    if (item.status !== 'pending') return res.status(400).json({ error: 'Already ' + item.status });

    // Scheduler-originated items already have a drafted result; API-originated items execute now.
    const result = item.draftResult
        ? { success: true, result: item.draftResult, agent: item.agent }
        : await executeAgent(item.agent, item.query);

    item.status = 'approved';
    item.approvedAt = new Date().toISOString();
    item.result = result;
    savePendingApprovals(approvals);
    logAction({ agent: item.agent, tier: item.tier, action: 'approved_and_executed', approvalId: item.id });

    // NEW: an approved deal-closer item now actually lands in the high-velocity pipeline.
    if (item.agent === 'deal-closer') {
        const state = loadHighVelocityState();
        state.activeDeals = state.activeDeals || [];
        state.activeDeals.push({
            id: item.id,
            summary: result.result,
            approvedAt: item.approvedAt,
            status: 'active',
            grounded: item.grounded ?? null,
            source: item.source || 'manual'
        });
        saveHighVelocityState(state);
    }

    res.json({ success: true, approvalId: item.id, result });
});

app.post('/api/approvals/:id/reject', (req, res) => {
    const approvals = loadPendingApprovals();
    const item = approvals.find(a => a.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Approval not found' });
    item.status = 'rejected';
    item.rejectedAt = new Date().toISOString();
    savePendingApprovals(approvals);
    logAction({ agent: item.agent, tier: item.tier, action: 'rejected', approvalId: item.id });
    res.json({ success: true, approvalId: item.id, status: 'rejected' });
});

app.get('/api/audit-log', (req, res) => {
    res.json({ log: loadAuditLog() });
});

// ---- Trust Report — reads real audit data, see lib/trustReport.js ----
app.get('/api/trust-report', (req, res) => {
    const hours = parseInt(req.query.hours) || 168; // default: last 7 days
    res.json(buildTrustReport(hours));
});

// ============================================
// HIGH VELOCITY SALES API (now fed by real approvals, not just hand-edited JSON)
// ============================================
app.get('/api/sales/high-velocity', (req, res) => {
    try {
        const state = loadHighVelocityState();
        res.json({
            success: true,
            deals: state.activeDeals || [],
            closedDeals: state.closedDeals || [],
            revenue: state.revenue || 0,
            total: (state.activeDeals || []).length
        });
    } catch (error) {
        console.error('Error in /api/sales/high-velocity:', error);
        res.json({ success: false, error: error.message, deals: [], closedDeals: [], revenue: 0, total: 0 });
    }
});

// ============================================
// APIFY LEADS API (unchanged)
// ============================================
app.get('/api/apify/leads', (req, res) => {
    try {
        const apifyPath = path.join(__dirname, './apify-leads-state.json');
        if (!fs.existsSync(apifyPath)) {
            return res.json({ success: true, leads: [], qualifiedLeads: [], total: 0, message: 'No Apify leads yet' });
        }
        const data = JSON.parse(fs.readFileSync(apifyPath, 'utf8'));
        res.json({ success: true, leads: data.leads || [], qualifiedLeads: data.qualifiedLeads || [], total: (data.leads || []).length });
    } catch (error) {
        console.error('Error in /api/apify/leads:', error);
        res.json({ success: false, error: error.message, leads: [], qualifiedLeads: [], total: 0 });
    }
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Sovereign Empire Platform running on port ' + PORT);
    console.log('📊 Agents loaded: ' + Object.keys(AGENTS).length);
    console.log('🔒 T2-gated agents: ' + Object.entries(AGENT_TIER).filter(([_, t]) => t === 'T2').map(([n]) => n).join(', '));
    console.log('🔑 OpenRouter API: ' + (OPENROUTER_API_KEY ? '✅ Configured' : '❌ Missing'));
    console.log('📊 Dashboard: http://localhost:' + PORT + '/dashboard');
    console.log('🛡️  Trust Report: http://localhost:' + PORT + '/trust-report');
});

