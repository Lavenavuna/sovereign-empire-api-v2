// lib/dnaEvolution.js
// Lets the system propose changes to its own DNA (agent tiers, mainly) based on
// real audit-log evidence — without ever applying a change unsupervised.
//
// Flow: analyzeAndPropose() runs each scheduler cycle, looks for patterns, and
// writes proposals to dna-proposals.json with status 'pending'. Nothing changes
// until a human calls applyProposal() (wired to POST /api/dna/proposals/:id/approve
// in server.js) — identical pattern to the deal-closer approval queue.
//
// Hard safety rule: proposals can only ever tighten a tier (T0->T1, T1->T2),
// never loosen one. A proposal to loosen a gate is rejected automatically —
// loosening requires a deliberate code change to config/agents.js, not a runtime
// "evolution." See config/agents.js getTier() for the enforcement of this on
// the read side too (belt and suspenders).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadAuditLog } from './auditLog.js';
import { AGENT_TIER } from '../config/agents.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const PROPOSALS_PATH = path.join(ROOT, 'dna-proposals.json');
const OVERRIDES_PATH = path.join(ROOT, 'config', 'dna-overrides.json');
const CHANGELOG_PATH = path.join(ROOT, 'config', 'dna-changelog.json');

const TIER_RANK = { T0: 0, T1: 1, T2: 2 };

function loadJSON(filePath, fallback) {
    try {
        if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.error('Failed to load', filePath, e.message);
    }
    return fallback;
}

function saveJSON(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Failed to save', filePath, e.message);
    }
}

export function listProposals() {
    return loadJSON(PROPOSALS_PATH, []);
}

export function proposeChange({ agent, field, from, to, reason, evidence }) {
    const proposals = loadJSON(PROPOSALS_PATH, []);

    // De-dupe: don't stack identical pending proposals for the same agent/field.
    const alreadyPending = proposals.find(
        p => p.agent === agent && p.field === field && p.to === to && p.status === 'pending'
    );
    if (alreadyPending) return alreadyPending;

    const id = 'dna_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const proposal = {
        id, agent, field, from, to, reason, evidence,
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    proposals.push(proposal);
    saveJSON(PROPOSALS_PATH, proposals);
    return proposal;
}

export function applyProposal(id) {
    const proposals = loadJSON(PROPOSALS_PATH, []);
    const proposal = proposals.find(p => p.id === id);
    if (!proposal) return { success: false, error: 'Proposal not found' };
    if (proposal.status !== 'pending') return { success: false, error: 'Already ' + proposal.status };

    if (proposal.field === 'tier') {
        const baseline = AGENT_TIER[proposal.agent] || 'T2';
        // SAFETY: reject any proposal that would loosen the effective tier below baseline.
        if (TIER_RANK[proposal.to] <= TIER_RANK[baseline]) {
            proposal.status = 'rejected';
            proposal.rejectedAt = new Date().toISOString();
            proposal.rejectionReason = 'Refused automatically: proposal would loosen tier below baseline. Loosening requires a manual code change to config/agents.js, not a DNA override.';
            saveJSON(PROPOSALS_PATH, proposals);
            return { success: false, error: proposal.rejectionReason };
        }

        const overrides = loadJSON(OVERRIDES_PATH, { tierOverrides: {}, version: 0, updatedAt: null });
        overrides.tierOverrides = overrides.tierOverrides || {};
        overrides.tierOverrides[proposal.agent] = proposal.to;
        overrides.version = (overrides.version || 0) + 1;
        overrides.updatedAt = new Date().toISOString();
        saveJSON(OVERRIDES_PATH, overrides);

        const changelog = loadJSON(CHANGELOG_PATH, []);
        changelog.push({
            version: overrides.version,
            appliedAt: overrides.updatedAt,
            agent: proposal.agent,
            field: proposal.field,
            from: proposal.from,
            to: proposal.to,
            reason: proposal.reason,
            proposalId: proposal.id
        });
        saveJSON(CHANGELOG_PATH, changelog);
    }

    proposal.status = 'approved';
    proposal.approvedAt = new Date().toISOString();
    saveJSON(PROPOSALS_PATH, proposals);
    return { success: true, proposal };
}

export function rejectProposal(id, note) {
    const proposals = loadJSON(PROPOSALS_PATH, []);
    const proposal = proposals.find(p => p.id === id);
    if (!proposal) return { success: false, error: 'Proposal not found' };
    proposal.status = 'rejected';
    proposal.rejectedAt = new Date().toISOString();
    if (note) proposal.rejectionNote = note;
    saveJSON(PROPOSALS_PATH, proposals);
    return { success: true, proposal };
}

export function getChangelog() {
    return loadJSON(CHANGELOG_PATH, []);
}

/**
 * Looks at recent audit-log evidence and proposes DNA changes when a pattern
 * is strong enough to be worth a human's attention. Deliberately conservative —
 * this raises flags, it does not chase every blip.
 */
export function analyzeAndPropose(windowHours = 168) {
    const log = loadAuditLog();
    const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
    const recent = log.filter(e => new Date(e.timestamp).getTime() >= cutoff);
    const proposalsMade = [];

    // Pattern 1: a T1 agent has been rejected repeatedly -> propose tightening to T2.
    const byAgent = {};
    for (const entry of recent) {
        if (!entry.agent) continue;
        byAgent[entry.agent] = byAgent[entry.agent] || { executed: 0, rejected: 0, escalated: 0 };
        if (entry.action === 'executed') byAgent[entry.agent].executed++;
        if (entry.action === 'rejected') byAgent[entry.agent].rejected++;
        if (entry.action === 'escalated') byAgent[entry.agent].escalated++;
    }

    for (const [agent, stats] of Object.entries(byAgent)) {
        const baseline = AGENT_TIER[agent] || 'T2';
        if (baseline === 'T1' && stats.rejected >= 3) {
            const p = proposeChange({
                agent, field: 'tier', from: baseline, to: 'T2',
                reason: `${stats.rejected} rejected outputs in the last ${windowHours}h at T1 — pattern suggests this agent needs human review before executing, not just logging after the fact.`,
                evidence: { windowHours, ...stats }
            });
            proposalsMade.push(p);
        }
    }

    // Pattern 2: RAG-loop agents running consistently ungrounded -> flag, don't retier
    // (grounding is an infra gap, not a tier problem — surfaced via Trust Report already,
    // but worth a DNA-level flag too so it's visible in one place).
    const ragComplete = recent.filter(e => e.action === 'rag-loop-complete');
    const ungrounded = ragComplete.filter(e => !e.grounded);
    if (ragComplete.length >= 5 && ungrounded.length === ragComplete.length) {
        const p = proposeChange({
            agent: 'market-researcher', field: 'note', from: 'grounded-unknown', to: 'flagged-ungrounded',
            reason: `All ${ragComplete.length} RAG cycles in the last ${windowHours}h were ungrounded — no retrieval source has been producing results. This isn't a tier issue, it's an infrastructure gap (see lib/ragLoop.js).`,
            evidence: { windowHours, ragCycles: ragComplete.length, ungrounded: ungrounded.length }
        });
        proposalsMade.push(p);
    }

    return proposalsMade;
}

