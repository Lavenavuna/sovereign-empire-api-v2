// scheduler.js
// The missing piece — this is what "npm run agent" was always supposed to run.
// Runs the research → strategy → deal-proposal cycle on a schedule (default every
// 15 minutes, matching CLAUDE.md cycle discipline). Deal proposals go to the
// approval queue — this file NEVER writes directly into high-velocity-state.json.
// Only an approved item (via POST /api/approvals/:id/approve) reaches the pipeline.
//
// Run with: npm run agent   (or: node scheduler.js)

import cron from 'node-cron';
import { runRagLoop } from './lib/ragLoop.js';
import { logAction, loadPendingApprovals, savePendingApprovals } from './lib/auditLog.js';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const CYCLE_CRON = process.env.CYCLE_CRON || '*/15 * * * *';

async function callModel(systemPrompt, userPrompt) {
    if (!OPENROUTER_API_KEY) return { content: '⚠️ OPENROUTER_API_KEY not set.' };
    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + OPENROUTER_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'deepseek/deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 600,
                temperature: 0.6
            })
        });
        const data = await response.json();
        return { content: data.choices?.[0]?.message?.content || '' };
    } catch (e) {
        return { content: '', error: e.message };
    }
}

async function runCycle() {
    console.log('🔄 Cycle start:', new Date().toISOString());

    // T0 — bounded RAG loop research (honest about grounding — see lib/ragLoop.js)
    const research = await runRagLoop('market-researcher', 'target account buying signals this week', 3);
    const competitor = await runRagLoop('competitor-analyzer', 'recent competitor pricing or positioning changes', 3);

    // T1 — sales-consultant drafts an angle, logged but not gated
    const consultant = await callModel(
        'You are a sales strategist. You only use facts explicitly given to you — never invent account names or figures.',
        `Research findings:\n${research.result}\n\nCompetitor findings:\n${competitor.result}\n\nDraft ONE specific outreach angle for this cycle. If the research above is unverified/ungrounded, say so rather than treating it as fact.`
    );
    logAction({
        agent: 'sales-consultant', tier: 'T1', action: 'executed',
        success: true, grounded: research.grounded && competitor.grounded
    });

    // T2 — deal-closer drafts a proposal but NEVER executes directly.
    // It goes to the approval queue exactly like a manual request would.
    const dealDraft = await callModel(
        'You are a deal-closer drafting a proposal for human review, not executing a deal. Never claim a deal is confirmed. Flag clearly if any figure is an estimate.',
        `Based on this outreach angle:\n${consultant.content}\n\nDraft a brief deal proposal: target account (if known), proposed value estimate, next step.`
    );

    const approvals = loadPendingApprovals();
    const approvalId = 'appr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    approvals.push({
        id: approvalId,
        agent: 'deal-closer',
        tier: 'T2',
        query: 'scheduler-cycle deal proposal',
        draftResult: dealDraft.content,
        status: 'pending',
        createdAt: new Date().toISOString(),
        source: 'scheduler-cycle',
        grounded: research.grounded && competitor.grounded
    });
    savePendingApprovals(approvals);
    logAction({ agent: 'deal-closer', tier: 'T2', action: 'escalated', approvalId, source: 'scheduler-cycle' });

    console.log('✅ Cycle complete. Deal proposal queued:', approvalId,
        '| research grounded:', research.grounded, '| competitor grounded:', competitor.grounded);
}

runCycle().catch(e => console.error('Cycle error:', e.message));
cron.schedule(CYCLE_CRON, () => {
    runCycle().catch(e => console.error('Cycle error:', e.message));
});

console.log('🚀 Scheduler running. Cycle schedule:', CYCLE_CRON);
console.log('⚠️  No retrieval source is registered yet — research cycles will report as ungrounded until one is wired in lib/ragLoop.js.');

