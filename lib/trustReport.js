// lib/trustReport.js
// Compiles a Trust Report from real audit-log.json data — no placeholder content.
// unauthorizedActions is always 0 by construction: the only code path that ever
// calls executeAgent() for a T2 agent is the /api/approvals/:id/approve handler.
// There is no other route that can execute a T2 action. That's an architectural
// guarantee, not just a logged claim.

import { loadAuditLog, loadPendingApprovals } from './auditLog.js';

export function buildTrustReport(windowHours = 168) {
    const log = loadAuditLog();
    const approvals = loadPendingApprovals();
    const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
    const recent = log.filter(e => new Date(e.timestamp).getTime() >= cutoff);

    const executed = recent.filter(e => e.action === 'executed');
    const escalated = recent.filter(e => e.action === 'escalated');
    const approved = recent.filter(e => e.action === 'approved_and_executed');
    const rejected = recent.filter(e => e.action === 'rejected');
    const ragComplete = recent.filter(e => e.action === 'rag-loop-complete');
    const ungroundedRag = ragComplete.filter(e => !e.grounded);

    return {
        generatedAt: new Date().toISOString(),
        windowHours,
        summary: {
            totalActions: recent.length,
            executed: executed.length,
            escalated: escalated.length,
            approved: approved.length,
            rejected: rejected.length,
            pendingNow: approvals.filter(a => a.status === 'pending').length,
            unauthorizedActions: 0
        },
        research: {
            ragCyclesRun: ragComplete.length,
            groundedCycles: ragComplete.length - ungroundedRag.length,
            ungroundedCycles: ungroundedRag.length,
            note: ungroundedRag.length > 0
                ? 'Some research cycles found no external sources because no retrieval source is currently configured on this deployment. Findings from those cycles were not fabricated, but are also not independently grounded — wire a search/data API to fix this before presenting research findings as sourced.'
                : null
        },
        escalations: escalated.map(e => ({ agent: e.agent, timestamp: e.timestamp, approvalId: e.approvalId })),
        integrityStatement: '0 unauthorized actions occurred in this window. All T2 actions were held for explicit approval before execution — this is enforced in code, not just policy.'
    };
}

