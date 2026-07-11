/**
 * download-taxroll.js
 * ------------------------------------------------------------------
 * Downloads and extracts the weekly Tarrant County Tax Roll zip.
 *
 * IMPORTANT: Tarrant County publishes a new file every Friday,
 * live on the site the following Monday. Point TAXROLL_URL at the
 * current download link from:
 *   https://www.tarrantcountytx.gov/en/tax/property-tax/tarrant-county-tax-roll.html
 * The exact URL can change with each refresh — verify it's current
 * before wiring this into an unattended weekly cron job, or scrape
 * the download link off that page dynamically (left as a TODO below
 * so a link change doesn't silently break ingestion).
 * ------------------------------------------------------------------
 */

import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TAXROLL_URL = process.env.TARRANT_TAXROLL_URL || '';
const DOWNLOAD_DIR = path.join(__dirname, '..', 'downloads');

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status} ${res.statusText} for ${url}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
  return destPath;
}

/**
 * Downloads the zip, extracts it, and returns the raw text of the
 * Master File (the file that matches layout-config.js).
 *
 * @returns {Promise<string>} raw flat-file text
 */
export async function fetchAndExtractTaxRoll() {
  if (!TAXROLL_URL) {
    throw new Error(
      'TARRANT_TAXROLL_URL is not set. Grab the current download link from ' +
      'tarrantcountytx.gov/en/tax/property-tax/tarrant-county-tax-roll.html ' +
      'and set it as an environment variable before running.'
    );
  }

  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

  const zipPath = path.join(DOWNLOAD_DIR, `taxroll-${Date.now()}.zip`);
  console.log(`[download-taxroll] Downloading ${TAXROLL_URL} ...`);
  await downloadFile(TAXROLL_URL, zipPath);

  console.log('[download-taxroll] Extracting archive ...');
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  // The zip contains a Master File, Receivable File, and Text File.
  // We want the Master File — match loosely since the county may
  // change the exact filename between refreshes.
  const masterEntry = entries.find((e) =>
    /master/i.test(e.entryName)
  );

  if (!masterEntry) {
    const names = entries.map((e) => e.entryName).join(', ');
    throw new Error(
      `Could not find a "Master" file in the archive. Entries found: ${names}`
    );
  }

  const rawText = masterEntry.getData().toString('utf8');

  // Clean up the downloaded zip — keep the extracted text only if
  // you want an audit trail; here we remove it to save disk.
  fs.unlinkSync(zipPath);

  return rawText;
}
