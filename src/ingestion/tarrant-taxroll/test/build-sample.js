// Builds synthetic fixed-width sample lines matching layout-config.js
// so we can verify the parser/normalizer logic works end-to-end
// before ever touching real county data.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MASTER_FILE_LAYOUT, RECORD_LENGTH } from '../layout-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function padField(value, length) {
  const str = String(value ?? '');
  return str.length >= length ? str.slice(0, length) : str.padEnd(length, ' ');
}

function buildLine(fields) {
  let line = '';
  for (const [name, spec] of Object.entries(MASTER_FILE_LAYOUT)) {
    line += padField(fields[name] ?? '', spec.length);
  }
  return line.padEnd(RECORD_LENGTH, ' ');
}

// Case 1: chronic delinquent + absentee owner (should score high)
const line1 = buildLine({
  account_id: 'TAD0001234',
  owner_name: 'SMITH JOHN R',
  owner_mailing_addr1: '900 MAIN ST APT 4',
  owner_mailing_city: 'HOUSTON',
  owner_mailing_state: 'TX',
  owner_mailing_zip: '77002',
  situs_addr: '1450 FRAZIER AVE',
  situs_city: 'FORT WORTH',
  situs_zip: '76104',
  total_appraised_value: '000000185000',
  delinquent_amount: '000000012500',
  earliest_delinquent_year: '2022',
  delinquent_years_count: '03',
  deed_date: '20100615',
});

// Case 2: current, owner-occupied, no distress (should be filtered out)
const line2 = buildLine({
  account_id: 'TAD0005678',
  owner_name: 'GARCIA MARIA',
  owner_mailing_addr1: '2200 OAK PARK LN',
  owner_mailing_city: 'FORT WORTH',
  owner_mailing_state: 'TX',
  owner_mailing_zip: '76179',
  situs_addr: '2200 OAK PARK LN',
  situs_city: 'FORT WORTH',
  situs_zip: '76179',
  total_appraised_value: '000000310000',
  delinquent_amount: '000000000000',
  delinquent_years_count: '00',
  deed_date: '20180301',
});

// Case 3: single-year delinquent, owner-occupied (mild signal)
const line3 = buildLine({
  account_id: 'TAD0009999',
  owner_name: 'JOHNSON DEBRA',
  owner_mailing_addr1: '76 STOP SIX BLVD',
  owner_mailing_city: 'FORT WORTH',
  owner_mailing_state: 'TX',
  owner_mailing_zip: '76105',
  situs_addr: '76 STOP SIX BLVD',
  situs_city: 'FORT WORTH',
  situs_zip: '76105',
  total_appraised_value: '000000098000',
  delinquent_amount: '000000003200',
  earliest_delinquent_year: '2025',
  delinquent_years_count: '01',
  deed_date: '19990512',
});

const fileText = [line1, line2, line3].join('\n');
const outPath = path.join(__dirname, '..', 'sample-data', 'sample-taxroll.txt');
fs.writeFileSync(outPath, fileText);
console.log('Sample file written to', outPath);
console.log('Line lengths:', [line1.length, line2.length, line3.length]);
