const DAILY_CRON = '0 1 * * *';
const WEEKLY_CRON = '0 2 * * 0';
const MONTHLY_CRON = '0 3 1 * *';

const CHANNELS = [
  { name: 'tax', envKey: 'CSV_URL_TAX' },
  { name: 'foreclosure', envKey: 'CSV_URL_FORECLOSURE' },
  { name: 'probate', envKey: 'CSV_URL_PROBATE' },
  { name: 'divorce', envKey: 'CSV_URL_DIVORCE' },
  { name: 'code_enforcement', envKey: 'CSV_URL_CODE_ENFORCEMENT' },
  { name: 'deed_lien', envKey: 'CSV_URL_DEED_LIEN' }
];

function resolveFrequency() {
  const override = String(process.env.RUN_FREQUENCY_OVERRIDE || '').trim().toLowerCase();
  if (['daily', 'weekly', 'monthly', 'manual'].includes(override)) return override;

  const cron = String(process.env.SCHEDULE_CRON || '').trim();
  if (cron === DAILY_CRON) return 'daily';
  if (cron === WEEKLY_CRON) return 'weekly';
  if (cron === MONTHLY_CRON) return 'monthly';
  return 'manual';
}

function shouldRunChannel(channel, frequency) {
  if (frequency === 'daily') return channel !== 'tax';
  return true; // weekly/monthly/manual
}

function normalizeBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/\/+$/, '');
}

async function fetchCsvText(url, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${url}`);
  }
  const text = await response.text();
  if (!String(text || '').trim()) {
    throw new Error(`Downloaded CSV is empty for ${url}`);
  }
  return text;
}

async function postJson(url, payload, headers = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify(payload)
  });
  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw };
  }
  if (!response.ok || data?.success === false) {
    throw new Error(`POST ${url} failed: ${data?.error || response.statusText || raw}`);
  }
  return data;
}

async function main() {
  const frequency = resolveFrequency();
  const baseUrl = normalizeBaseUrl(process.env.INGEST_API_BASE_URL);
  const defaultCity = process.env.INGEST_DEFAULT_CITY || 'Fort Worth';
  const defaultState = process.env.INGEST_DEFAULT_STATE || 'TX';
  const ingestApiKey = String(process.env.INGEST_API_KEY || '').trim();
  const csvAuthHeader = String(process.env.CSV_AUTH_HEADER || '').trim();
  const csvAuthToken = String(process.env.CSV_AUTH_TOKEN || '').trim();

  if (!baseUrl) {
    throw new Error('INGEST_API_BASE_URL is required');
  }

  const apiHeaders = ingestApiKey ? { 'x-api-key': ingestApiKey } : {};
  const csvHeaders = csvAuthHeader && csvAuthToken ? { [csvAuthHeader]: csvAuthToken } : {};

  console.log(`[ingest] Starting ${frequency} run against ${baseUrl}`);

  let importedChannels = 0;
  let importedRowsEstimate = 0;

  for (const entry of CHANNELS) {
    if (!shouldRunChannel(entry.name, frequency)) {
      console.log(`[ingest] skip ${entry.name} for ${frequency} schedule`);
      continue;
    }

    const sourceUrl = String(process.env[entry.envKey] || '').trim();
    if (!sourceUrl) {
      console.log(`[ingest] skip ${entry.name}; ${entry.envKey} not configured`);
      continue;
    }

    console.log(`[ingest] downloading ${entry.name} CSV from ${sourceUrl}`);
    const csvText = await fetchCsvText(sourceUrl, csvHeaders);

    const result = await postJson(
      `${baseUrl}/ingestion/import-csv`,
      {
        sourceChannel: entry.name,
        defaultCity,
        defaultState,
        csvText
      },
      apiHeaders
    );

    importedChannels += 1;
    const rows = Number(result?.summary?.totalRows || 0);
    importedRowsEstimate += rows;
    console.log(`[ingest] ${entry.name}: ${rows} rows (inserted=${result?.summary?.inserted || 0}, updated=${result?.summary?.updated || 0})`);
  }

  if (importedChannels === 0) {
    console.log('[ingest] No channel imports ran (no configured URLs for this schedule).');
    return;
  }

  const mergeResult = await postJson(
    `${baseUrl}/ingestion/merge-score`,
    { onlyPipelineNew: true },
    apiHeaders
  );
  console.log(`[ingest] merge-score complete: scored=${mergeResult?.summary?.scoredProperties || 0}`);

  const queueResponse = await fetch(`${baseUrl}/properties/queue/new`, {
    headers: apiHeaders
  });
  const queueJson = await queueResponse.json();
  console.log(`[ingest] pending queue size=${queueJson?.count || 0}; importedChannels=${importedChannels}; rows=${importedRowsEstimate}`);
}

main().catch((error) => {
  console.error('[ingest] FAILED:', error.message);
  process.exitCode = 1;
});
