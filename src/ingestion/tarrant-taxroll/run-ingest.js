/**
 * run-ingest.js
 * ------------------------------------------------------------------
 * Orchestrates the full weekly Tarrant tax roll ingestion:
 *   download -> parse -> normalize/score -> upsert into properties
 *
 * This is Layer 1 + Layer 2 + part of Layer 3 from the architecture
 * we discussed (ingestion, normalization, scoring). It runs fully
 * autonomously (T2) — no human gate needed here, since it's
 * read-only data collection with no outbound contact and no
 * liability exposure.
 * ------------------------------------------------------------------
 */

import { fetchAndExtractTaxRoll } from './download-taxroll.js';
import { parseTaxRollFile } from './parse-taxroll.js';
import { normalizeBatch } from './normalize.js';
import { upsertProperties } from './db.js';
import { fileURLToPath } from 'url';

export async function runIngest({ minScore = 1 } = {}) {
  const startedAt = Date.now();
  console.log('[run-ingest] Starting Tarrant tax roll ingestion...');

  // 1. Download + extract
  const rawText = await fetchAndExtractTaxRoll();
  console.log(`[run-ingest] Extracted ${rawText.length.toLocaleString()} chars of raw text.`);

  // 2. Parse fixed-width records
  const { records, skipped, warnings } = parseTaxRollFile(rawText);
  console.log(`[run-ingest] Parsed ${records.length.toLocaleString()} records, skipped ${skipped}.`);
  if (warnings.length) {
    console.warn('[run-ingest] Layout warnings (first 20):');
    warnings.forEach((w) => console.warn(`  - ${w}`));
  }

  // 3. Normalize + score, filtering out zero-signal records
  const normalized = normalizeBatch(records, { minScore });
  console.log(
    `[run-ingest] ${normalized.length.toLocaleString()} records met minScore=${minScore} ` +
    `(${records.length - normalized.length} filtered out as non-distressed).`
  );

  // 4. Upsert into properties table
  const result = await upsertProperties(normalized);
  console.log(
    `[run-ingest] Upsert complete: ${result.inserted} inserted, ` +
    `${result.updated} updated, ${result.total} total.`
  );

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[run-ingest] Done in ${elapsedSec}s.`);

  return { ...result, skipped, warnings };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runIngest()
    .then((r) => {
      console.log('[run-ingest] Summary:', r);
    })
    .catch((err) => {
      console.error('[run-ingest] FAILED:', err);
      process.exitCode = 1;
    });
}
