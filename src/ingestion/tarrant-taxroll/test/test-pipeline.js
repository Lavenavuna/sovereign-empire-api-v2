import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseTaxRollFile } from '../parse-taxroll.js';
import { normalizeBatch, normalizeRecord } from '../normalize.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const samplePath = path.join(__dirname, '..', 'sample-data', 'sample-taxroll.txt');
const fileText = fs.readFileSync(samplePath, 'utf8');

console.log('=== STEP 1: Parsing ===');
const { records, skipped, warnings } = parseTaxRollFile(fileText);
console.log(`Parsed: ${records.length}, Skipped: ${skipped}`);
if (warnings.length) console.log('Warnings:', warnings);

console.log('\n=== STEP 2: Raw parsed fields (record 1 - chronic delinquent case) ===');
console.log(JSON.stringify(records[0], null, 2));

console.log('\n=== STEP 3: Normalized + scored (all records, no filter) ===');
records.forEach((r, i) => {
  const normalized = normalizeRecord(r);
  console.log(
    `[${i + 1}] account=${normalized.source_account_id} ` +
    `score=${normalized.single_source_score} ` +
    `signals=${JSON.stringify(normalized.single_source_signals)} ` +
    `absentee=${normalized.is_absentee_owner} ` +
    `chronic=${normalized.is_chronic_delinquent}`
  );
});

console.log('\n=== STEP 4: Batch normalize with minScore=1 (production filter) ===');
const filtered = normalizeBatch(records, { minScore: 1 });
console.log(`${filtered.length} of ${records.length} records passed minScore=1 filter.`);
filtered.forEach((r) => {
  console.log(`  - ${r.situs_address}, ${r.situs_city} ${r.situs_zip} | score=${r.single_source_score} | owner=${r.owner_name}`);
});

console.log('\n=== EXPECTATIONS CHECK ===');
const expectations = [
  { desc: 'Record 1 (chronic + absentee) should score >= 4', pass: filtered.find(r => r.source_account_id === 'TAD0001234')?.single_source_score >= 4 },
  { desc: 'Record 2 (no delinquency) should be filtered out entirely', pass: !filtered.find(r => r.source_account_id === 'TAD0005678') },
  { desc: 'Record 3 (mild single-year delinquent, owner-occupied) should score low but pass filter', pass: (() => {
      const rec = filtered.find(r => r.source_account_id === 'TAD0009999');
      return rec && rec.single_source_score >= 1 && rec.single_source_score < 4 && rec.is_absentee_owner === false;
    })() },
];
expectations.forEach((e) => console.log(`${e.pass ? '✅ PASS' : '❌ FAIL'} — ${e.desc}`));

const allPass = expectations.every((e) => e.pass);
console.log(`\n${allPass ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}`);
process.exitCode = allPass ? 0 : 1;
