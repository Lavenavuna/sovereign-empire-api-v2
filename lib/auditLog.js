// lib/auditLog.js
// Shared storage helpers — audit log, approval queue, and high-velocity pipeline state.
// Same local-JSON-file pattern already used in this repo. If Railway's filesystem for
// this service isn't backed by a persistent volume, these reset on every redeploy —
// confirm volume config, or migrate to Supabase later.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

export const AUDIT_LOG_PATH = path.join(ROOT, 'audit-log.json');
export const PENDING_APPROVALS_PATH = path.join(ROOT, 'pending-approvals.json');
export const HIGH_VELOCITY_STATE_PATH = path.join(ROOT, 'high-velocity-state.json');

export function loadJSON(filePath, fallback) {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (e) {
        console.error('Failed to load', filePath, e.message);
    }
    return fallback;
}

export function saveJSON(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Failed to save', filePath, e.message);
    }
}

export function logAction(entry) {
    const log = loadJSON(AUDIT_LOG_PATH, []);
    log.push({ ...entry, timestamp: new Date().toISOString() });
    saveJSON(AUDIT_LOG_PATH, log.slice(-1000)); // keep last 1000 entries
}

export function loadAuditLog() {
    return loadJSON(AUDIT_LOG_PATH, []);
}

export function loadPendingApprovals() {
    return loadJSON(PENDING_APPROVALS_PATH, []);
}

export function savePendingApprovals(data) {
    saveJSON(PENDING_APPROVALS_PATH, data);
}

export function loadHighVelocityState() {
    return loadJSON(HIGH_VELOCITY_STATE_PATH, { activeDeals: [], closedDeals: [], revenue: 0 });
}

export function saveHighVelocityState(data) {
    saveJSON(HIGH_VELOCITY_STATE_PATH, data);
}

