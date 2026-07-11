/**
 * normalize.js
 * ------------------------------------------------------------------
 * Maps raw Tarrant tax roll records into the unified `properties`
 * schema used across all six lateral sourcing channels (tax,
 * foreclosure, probate, divorce, code enforcement, deed/lien), and
 * computes a distress score. This is what lets the scoring-agent
 * treat records from different county sources identically once
 * they've passed through their respective normalizers.
 * ------------------------------------------------------------------
 */

const SOURCE_CHANNEL = 'tarrant_tax_roll';

/**
 * True if the mailing address differs meaningfully from the situs
 * (property) address — a classic absentee-owner signal.
 */
export function isAbsenteeOwner(raw) {
  if (!raw.owner_mailing_addr1 || !raw.situs_addr) return false;
  const norm = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return norm(raw.owner_mailing_addr1) !== norm(raw.situs_addr);
}

/**
 * True if delinquency has persisted 2+ tax years — stronger signal
 * than a single missed payment, which can be a simple oversight.
 */
export function isChronicDelinquent(raw) {
  return (raw.delinquent_years_count ?? 0) >= 2;
}

/**
 * Rough equity proxy: appraised value vs. what's actually owed in
 * delinquent tax. Not a substitute for a real equity/lien search,
 * but useful as a first-pass filter to deprioritize properties
 * where delinquency likely signals a deeper (mortgage) problem
 * rather than simple tax-only distress.
 */
function hasApparentEquityCushion(raw) {
  // Only meaningful in the context of an actual delinquency — a
  // property with $0 owed isn't "cushioned," it's simply not
  // distressed, and shouldn't pick up a score contribution here.
  if (!raw.total_appraised_value || raw.total_appraised_value <= 0) return false;
  if (!raw.delinquent_amount || raw.delinquent_amount <= 0) return false;
  const delinquentRatio = raw.delinquent_amount / raw.total_appraised_value;
  return delinquentRatio < 0.15; // delinquent tax is a small fraction of value
}

/**
 * Computes a 0-10 distress/opportunity score for a single-source
 * (tax-only) record. Multi-signal boosting (cross-referencing
 * against foreclosure/probate/divorce/code-enforcement sources)
 * happens in a separate merge step once those normalizers exist —
 * this function only scores what the tax roll alone can tell you.
 */
export function scoreTaxSignal(raw) {
  let score = 0;
  const signals = [];

  if ((raw.delinquent_amount ?? 0) > 0) {
    score += 2;
    signals.push('tax_delinquent');
  }
  if (isChronicDelinquent(raw)) {
    score += 1;
    signals.push('chronic_delinquent_2plus_years');
  }
  if (isAbsenteeOwner(raw)) {
    score += 2;
    signals.push('absentee_owner');
  }
  if (hasApparentEquityCushion(raw)) {
    score += 1;
    signals.push('apparent_equity_cushion');
  }

  return { score, signals };
}

/**
 * Converts a single raw parsed record into the unified properties
 * schema row, ready for dedup + upsert.
 */
export function normalizeRecord(raw) {
  const { score, signals } = scoreTaxSignal(raw);

  return {
    // --- identity / dedup key ---
    source_account_id: raw.account_id,
    source_channel: SOURCE_CHANNEL,

    // --- address ---
    situs_address: raw.situs_addr,
    situs_city: raw.situs_city,
    situs_zip: raw.situs_zip,
    county: 'Tarrant',

    // --- owner ---
    owner_name: raw.owner_name,
    owner_mailing_address: [raw.owner_mailing_addr1, raw.owner_mailing_addr2]
      .filter(Boolean)
      .join(', '),
    owner_mailing_city: raw.owner_mailing_city,
    owner_mailing_state: raw.owner_mailing_state,
    owner_mailing_zip: raw.owner_mailing_zip,
    is_absentee_owner: isAbsenteeOwner(raw),

    // --- valuation ---
    land_value: raw.land_value,
    improvement_value: raw.improvement_value,
    total_appraised_value: raw.total_appraised_value,

    // --- distress signal (tax-specific) ---
    tax_delinquent_amount: raw.delinquent_amount,
    tax_delinquent_since_year: raw.earliest_delinquent_year,
    tax_delinquent_years_count: raw.delinquent_years_count,
    is_chronic_delinquent: isChronicDelinquent(raw),
    last_payment_date: raw.last_payment_date,
    deed_date: raw.deed_date,

    // --- unified scoring fields (see scoring-agent for multi-source merge) ---
    single_source_score: score,
    single_source_signals: signals,

    // --- pipeline bookkeeping ---
    ingested_at: new Date().toISOString(),
    raw_source_ref: raw.account_id,
  };
}

/**
 * Normalizes an array of raw parsed records, filtering out ones
 * with no usable distress signal at all (score 0) so the properties
 * table doesn't fill up with the ~majority of non-delinquent
 * accounts that inevitably ride along in a full county tax roll.
 */
export function normalizeBatch(rawRecords, { minScore = 1 } = {}) {
  return rawRecords
    .map(normalizeRecord)
    .filter((r) => r.single_source_score >= minScore);
}
