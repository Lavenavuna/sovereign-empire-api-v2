/**
 * layout-config.js
 * ------------------------------------------------------------------
 * Fixed-width column layout for the Tarrant County Tax Roll flat file
 * (Master File). Tarrant County publishes an official
 * "Tax Roll Definition Layout" document alongside the download —
 * grab it from tarrantcountytx.gov/en/tax/property-tax/tarrant-county-tax-roll.html
 * and update the `start`/`length` values below to match it exactly
 * before running this in production. Flat-file layouts are
 * positional (not delimited), so a single wrong offset silently
 * corrupts every field after it — verify against the real doc first.
 *
 * Format: each field is { start, length, type }
 *   start  = 0-indexed character position where the field begins
 *   length = number of characters the field occupies
 *   type   = 'string' | 'number' | 'date' (YYYYMMDD assumed for dates)
 *
 * These placeholder positions are a reasonable starting structure
 * based on common county tax-roll conventions, NOT verified against
 * Tarrant's actual spec. Treat every offset here as provisional.
 * ------------------------------------------------------------------
 */

export const MASTER_FILE_LAYOUT = {
  account_id:        { start: 0,   length: 12, type: 'string' },
  owner_name:         { start: 12,  length: 40, type: 'string' },
  owner_mailing_addr1: { start: 52,  length: 40, type: 'string' },
  owner_mailing_addr2: { start: 92,  length: 40, type: 'string' },
  owner_mailing_city: { start: 132, length: 20, type: 'string' },
  owner_mailing_state: { start: 152, length: 2,  type: 'string' },
  owner_mailing_zip:  { start: 154, length: 10, type: 'string' },
  situs_addr:         { start: 164, length: 40, type: 'string' },
  situs_city:         { start: 204, length: 20, type: 'string' },
  situs_zip:          { start: 224, length: 10, type: 'string' },
  legal_description:  { start: 234, length: 60, type: 'string' },
  property_use_code:  { start: 294, length: 4,  type: 'string' },
  land_value:         { start: 298, length: 12, type: 'number' },
  improvement_value:  { start: 310, length: 12, type: 'number' },
  total_appraised_value: { start: 322, length: 12, type: 'number' },
  exemption_codes:    { start: 334, length: 20, type: 'string' },
  current_year_tax_levy: { start: 354, length: 12, type: 'number' },
  current_year_paid:  { start: 366, length: 12, type: 'number' },
  delinquent_amount:  { start: 378, length: 12, type: 'number' },
  earliest_delinquent_year: { start: 390, length: 4, type: 'number' },
  delinquent_years_count: { start: 394, length: 2,  type: 'number' },
  last_payment_date:  { start: 396, length: 8,  type: 'date' },
  deed_date:          { start: 404, length: 8,  type: 'date' },
};

// Record length must equal the sum of the last field's start+length.
// Used to sanity-check the layout and to slice lines defensively.
export const RECORD_LENGTH = 412;
