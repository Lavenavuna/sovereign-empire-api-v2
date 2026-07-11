/**
 * scheduler.js
 * ------------------------------------------------------------------
 * Runs the ingestion pipeline on a recurring schedule so it fires
 * without manual triggering. Tarrant County creates the tax roll
 * file Fridays and it's live on the site the following Monday — so
 * we schedule for Monday mornings, with a Thursday safety re-check
 * in case the county's publish timing shifts.
 *
 * PREFERRED ALTERNATIVE: if you're deploying on Railway, use their
 * native Cron Job feature to run `node src/run-ingest.js` directly
 * on a schedule instead of keeping this process alive 24/7 — it's
 * cheaper and one less long-running process to monitor. This file
 * is provided for local/dev use or platforms without native cron.
 * ------------------------------------------------------------------
 */

import cron from 'node-cron';
import { runIngest } from './run-ingest.js';
import { fileURLToPath } from 'url';

// Monday 06:00 America/Chicago — gives buffer after county's Monday publish
const MONDAY_SCHEDULE = '0 6 * * 1';
// Thursday 06:00 as a safety re-check in case of publish delay
const THURSDAY_SAFETY_CHECK = '0 6 * * 4';

export function start() {
  console.log('[scheduler] Tarrant tax roll ingestion scheduler starting...');
  console.log(`[scheduler] Primary run: Monday 06:00 (cron: ${MONDAY_SCHEDULE})`);
  console.log(`[scheduler] Safety check: Thursday 06:00 (cron: ${THURSDAY_SAFETY_CHECK})`);

  const runWithLogging = (label) => async () => {
    console.log(`[scheduler] Triggered: ${label} at ${new Date().toISOString()}`);
    try {
      const result = await runIngest();
      console.log(`[scheduler] ${label} completed:`, result);
    } catch (err) {
      console.error(`[scheduler] ${label} FAILED:`, err);
      // TODO: wire this to your audit-agent / alerting so a failed
      // ingestion run doesn't silently go unnoticed for a week.
    }
  };

  cron.schedule(MONDAY_SCHEDULE, runWithLogging('Monday primary run'), {
    timezone: 'America/Chicago',
  });

  cron.schedule(THURSDAY_SAFETY_CHECK, runWithLogging('Thursday safety check'), {
    timezone: 'America/Chicago',
  });

  console.log('[scheduler] Scheduler active. Process will stay alive listening for cron triggers.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  start();
}
