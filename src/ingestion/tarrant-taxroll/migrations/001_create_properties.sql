-- 001_create_properties.sql
-- Unified properties table fed by all lateral sourcing channels
-- (tax roll, foreclosure notices, probate, divorce, code enforcement,
-- deed/lien records). Each channel's normalizer writes into this
-- same shape so the scoring-agent can treat them identically.

CREATE TABLE IF NOT EXISTS properties (
  id                          BIGSERIAL PRIMARY KEY,

  -- identity / dedup
  source_account_id           TEXT NOT NULL,
  source_channel              TEXT NOT NULL,
  county                      TEXT NOT NULL,

  -- address
  situs_address                TEXT,
  situs_city                   TEXT,
  situs_zip                    TEXT,

  -- owner
  owner_name                  TEXT,
  owner_mailing_address        TEXT,
  owner_mailing_city           TEXT,
  owner_mailing_state          TEXT,
  owner_mailing_zip            TEXT,
  is_absentee_owner           BOOLEAN DEFAULT FALSE,

  -- valuation
  land_value                  NUMERIC,
  improvement_value           NUMERIC,
  total_appraised_value        NUMERIC,

  -- tax distress signal
  tax_delinquent_amount        NUMERIC,
  tax_delinquent_since_year    INTEGER,
  tax_delinquent_years_count   INTEGER,
  is_chronic_delinquent       BOOLEAN DEFAULT FALSE,
  last_payment_date           DATE,
  deed_date                   DATE,

  -- scoring (per-source; multi-source merge score lives in a
  -- separate view/table once other channel normalizers exist)
  single_source_score          INTEGER DEFAULT 0,
  single_source_signals        JSONB DEFAULT '[]',
  merged_distress_score        INTEGER,        -- populated by scoring-agent merge step
  merged_signals               JSONB,          -- populated by scoring-agent merge step

  -- pipeline bookkeeping
  ingested_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_source_ref               TEXT,
  pipeline_status              TEXT DEFAULT 'new',  -- new | scored | queued | contacted | contract | closed | dead

  UNIQUE (source_channel, source_account_id)
);

CREATE INDEX IF NOT EXISTS idx_properties_zip ON properties (situs_zip);
CREATE INDEX IF NOT EXISTS idx_properties_score ON properties (single_source_score DESC);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties (pipeline_status);
CREATE INDEX IF NOT EXISTS idx_properties_owner_mailing_zip ON properties (owner_mailing_zip);
