import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// ── Routes (existing) ──
import invoiceRoutes from './routes/invoice.js';
import leadsRoutes from './routes/leads.js';
import wholesaleRoutes from './routes/wholesale.js';

// ── DNA layer (previously built, never wired — wired in now) ──
import { AGENTS, getTier, getPrompt, selectAgent, getDnaVersion } from './config/agents.js';
import { logAction, loadAuditLog, loadPendingApprovals, savePendingApprovals } from './lib/auditLog.js';
import { buildTrustReport } from './lib/trustReport.js';
import { executeApprovedAction } from './lib/approvalActions.js';
import {
    listProposals, applyProposal, rejectProposal, getChangelog, analyzeAndPropose
} from './lib/dnaEvolution.js';

function isLegacySchedulerDemoApproval(approval) {
    return approval?.source === 'scheduler-cycle'
        && approval?.query === 'scheduler-cycle deal proposal'
        && !approval?.actionType;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

// ── Middleware ──
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// ── Existing routes ──
app.use('/api/invoices', invoiceRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/wholesale', wholesaleRoutes);

// ── Health Check (must respond fast for Railway) ──
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// ===================================================================
// AGENT EXECUTION — single source of truth (config/agents.js).
// This replaces the duplicate hardcoded AGENTS/executeAgent that lived
// in api/server.js — that file is now dead code, safe to delete.
// ===================================================================
async function callModel(systemPrompt, userPrompt) {
    if (!OPENROUTER_API_KEY) {
        return { content: '⚠️ OPENROUTER_API_KEY not set.' };
    }
    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + OPENROUTER_API_KEY,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://sovereign-empire.com',
                'X-Title': 'Sovereign Empire API'
            },
            body: JSON.stringify({
                model: 'deepseek/deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 700,
                temperature: 0.5
            })
        });
        const data = await response.json();
        return { content: data.choices?.[0]?.message?.content || '' };
    } catch (e) {
        return { content: '', error: e.message };
    }
}

// Executes a T0/T1 agent directly. T2 agents must NEVER reach this function
// except from the /api/approvals/:id/approve handler below — that's the
// architectural guarantee lib/trustReport.js's integrityStatement relies on.
async function executeAgent(agentName, query) {
    const prompt = getPrompt(agentName);
    const result = await callModel(prompt, query);
    return { success: true, agent: agentName, result: result.content, fallback: !OPENROUTER_API_KEY };
}

// GET /api/agents — list the live agent registry + current (possibly DNA-evolved) tiers
app.get('/api/agents', (req, res) => {
    const agents = Object.keys(AGENTS).map(name => ({
        name,
        description: AGENTS[name].description,
        tier: getTier(name)
    }));
    res.json({ success: true, dnaVersion: getDnaVersion(), agents });
});

// POST /api/agent/execute  { query } or { agent, query }
// T0 -> runs immediately, logged.
// T1 -> runs immediately, logged (audited but not gated).
// T2 -> NEVER runs here. Goes to the approval queue instead.
app.post('/api/agent/execute', async (req, res) => {
    const { query, agent } = req.body || {};
    if (!query) return res.status(400).json({ success: false, error: 'query is required' });

    const agentName = agent || selectAgent(query);
    const tier = getTier(agentName);

    if (tier === 'T2') {
        const approvals = loadPendingApprovals();
        const approvalId = 'appr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        approvals.push({
            id: approvalId, agent: agentName, tier, query,
            status: 'pending', createdAt: new Date().toISOString(), source: 'api-request'
        });
        savePendingApprovals(approvals);
        logAction({ agent: agentName, tier, action: 'escalated', approvalId, source: 'api-request' });
        return res.json({
            success: true, gated: true, approvalId,
            message: `${agentName} is tier T2 — queued for approval, not executed. See /api/approvals/${approvalId}`
        });
    }

    const result = await executeAgent(agentName, query);
    logAction({ agent: agentName, tier, action: 'executed', success: result.success });
    res.json(result);
});

// ── Approval queue (T2 gate) ──
app.get('/api/approvals', (req, res) => {
    const approvals = loadPendingApprovals().filter(a => !isLegacySchedulerDemoApproval(a));
    res.json({ success: true, approvals });
});

app.post('/api/approvals/:id/approve', async (req, res) => {
    const approvals = loadPendingApprovals();
    const approval = approvals.find(a => a.id === req.params.id);
    if (!approval) return res.status(404).json({ success: false, error: 'Approval not found' });
    if (approval.status !== 'pending') {
        return res.status(400).json({ success: false, error: 'Already ' + approval.status });
    }

    let result;
    if (approval.actionType) {
        result = await executeApprovedAction(approval);
        if (!result.success) {
            return res.status(400).json({ success: false, error: result.error || 'Approval action failed' });
        }
    } else {
        // This is the ONLY code path allowed to execute a T2 agent.
        result = await executeAgent(approval.agent, approval.query || approval.draftResult || '');
    }
    approval.status = 'approved_and_executed';
    approval.approvedAt = new Date().toISOString();
    approval.result = result.result || result.message || result;
    savePendingApprovals(approvals);
    logAction({ agent: approval.agent, tier: approval.tier, action: 'approved_and_executed', approvalId: approval.id });

    res.json({ success: true, approval, result });
});

app.post('/api/approvals/:id/reject', (req, res) => {
    const approvals = loadPendingApprovals();
    const approval = approvals.find(a => a.id === req.params.id);
    if (!approval) return res.status(404).json({ success: false, error: 'Approval not found' });
    approval.status = 'rejected';
    approval.rejectedAt = new Date().toISOString();
    if (req.body?.note) approval.rejectionNote = req.body.note;
    savePendingApprovals(approvals);
    logAction({ agent: approval.agent, tier: approval.tier, action: 'rejected', approvalId: approval.id });
    res.json({ success: true, approval });
});

// ── DNA evolution layer ──
app.get('/api/dna/proposals', (req, res) => {
    res.json({ success: true, dnaVersion: getDnaVersion(), proposals: listProposals() });
});

app.post('/api/dna/proposals/:id/approve', (req, res) => {
    const result = applyProposal(req.params.id);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
});

app.post('/api/dna/proposals/:id/reject', (req, res) => {
    const result = rejectProposal(req.params.id, req.body?.note);
    if (!result.success) return res.status(404).json(result);
    res.json(result);
});

app.get('/api/dna/changelog', (req, res) => {
    res.json({ success: true, changelog: getChangelog() });
});

// Manually trigger the same evidence-scan the scheduler runs each cycle.
app.post('/api/dna/analyze', (req, res) => {
    const windowHours = Number(req.body?.windowHours) || 168;
    const proposals = analyzeAndPropose(windowHours);
    res.json({ success: true, newProposals: proposals.length, proposals });
});

// ── Trust Report + Audit Log (read-only visibility) ──
app.get('/api/trust-report', (req, res) => {
    const windowHours = Number(req.query.windowHours) || 168;
    res.json(buildTrustReport(windowHours));
});

app.get('/api/audit-log', (req, res) => {
    const log = loadAuditLog();
    res.json({ success: true, count: log.length, entries: log.slice(-200) });
});

// ── Root ──
app.get('/', (req, res) => {
  res.json({
    message: 'Sovereign Empire API is running',
    version: '2.0.0',
    dnaVersion: getDnaVersion(),
    endpoints: {
      invoices: '/api/invoices',
      leads: '/api/leads',
      wholesale: '/api/wholesale',
      wholesaleOverview: '/api/wholesale/overview',
      agents: '/api/agents',
      agentExecute: 'POST /api/agent/execute',
      approvals: '/api/approvals',
      dnaProposals: '/api/dna/proposals',
      trustReport: '/api/trust-report',
      auditLog: '/api/audit-log',
      health: '/health',
      dashboard: '/dashboard.html'
    }
  });
});

// ── Start Server ──
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Sovereign Empire API running on port ${PORT}`);
  console.log(`   DNA layer wired: agents=${Object.keys(AGENTS).length}, dnaVersion=${getDnaVersion()}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Trust Report: http://localhost:${PORT}/api/trust-report`);
  console.log(`   Dashboard: http://localhost:${PORT}/dashboard.html`);
});
