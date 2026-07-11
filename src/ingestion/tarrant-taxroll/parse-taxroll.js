/**
 * parse-taxroll.js
 * ------------------------------------------------------------------
 * Parses the fixed-width Tarrant County tax roll Master File into
 * an array of structured records. Pure function, no I/O — makes it
 * easy to unit test against sample lines before pointing it at the
 * real multi-million-record file.
 * ------------------------------------------------------------------
 */

import { MASTER_FILE_LAYOUT, RECORD_LENGTH } from './layout-config.js';

/**
 * Parses a single fixed-width line into a raw field object.
 * @param {string} line
 * @returns {object} raw parsed fields (strings/numbers/dates, untrimmed of business logic)
 */
export function parseLine(line) {
  const record = {};

  for (const [fieldName, spec] of Object.entries(MASTER_FILE_LAYOUT)) {
    const raw = line.slice(spec.start, spec.start + spec.length);
    const trimmed = raw.trim();

    switch (spec.type) {
      case 'number': {
        // County flat files often store numbers with implied decimals
        // or leading zeros. Empty/blank -> null rather than 0, so we
        // don't silently treat "no data" as "zero dollars owed."
        record[fieldName] = trimmed === '' ? null : Number(trimmed);
        break;
      }
      case 'date': {
        // Expecting YYYYMMDD; treat all-zero or blank as null.
        if (!trimmed || /^0+$/.test(trimmed)) {
          record[fieldName] = null;
        } else {
          const y = trimmed.slice(0, 4);
          const m = trimmed.slice(4, 6);
          const d = trimmed.slice(6, 8);
          record[fieldName] = `${y}-${m}-${d}`;
        }
        break;
      }
      default: {
        record[fieldName] = trimmed;
      }
    }
  }

  return record;
}

/**
 * Parses the full flat-file text into an array of records.
 * Skips blank lines and lines that don't match the expected length
 * (logged, not silently dropped, so layout drift is caught early).
 *
 * @param {string} fileText - full contents of the Master File
 * @returns {{ records: object[], skipped: number, warnings: string[] }}
 */
export function parseTaxRollFile(fileText) {
  const lines = fileText.split(/\r?\n/);
  const records = [];
  const warnings = [];
  let skipped = 0;

  lines.forEach((line, idx) => {
    if (!line || line.trim().length === 0) return;

    if (line.length < RECORD_LENGTH) {
      skipped += 1;
      if (warnings.length < 20) {
        warnings.push(
          `Line ${idx + 1}: length ${line.length} < expected ${RECORD_LENGTH} — skipped`
        );
      }
      return;
    }

    records.push(parseLine(line));
  });

  return { records, skipped, warnings };
}
