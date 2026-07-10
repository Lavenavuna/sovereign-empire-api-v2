import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const WHOLESALE_STATE_PATH = path.join(ROOT, 'wholesale-state.json');

const DEFAULT_STATE = {
  meta: {
    vision: 'real-estate-wholesaling',
    market: 'DFW',
    currency: 'USD',
    updatedAt: null
  },
  properties: [],
  investors: [],
  deals: []
};

export function loadWholesaleState() {
  try {
    if (!fs.existsSync(WHOLESALE_STATE_PATH)) {
      return structuredClone(DEFAULT_STATE);
    }

    const parsed = JSON.parse(fs.readFileSync(WHOLESALE_STATE_PATH, 'utf8'));
    return {
      meta: { ...DEFAULT_STATE.meta, ...(parsed.meta || {}) },
      properties: Array.isArray(parsed.properties) ? parsed.properties : [],
      investors: Array.isArray(parsed.investors) ? parsed.investors : [],
      deals: Array.isArray(parsed.deals) ? parsed.deals : []
    };
  } catch (error) {
    console.error('Failed to load wholesale-state.json:', error.message);
    return structuredClone(DEFAULT_STATE);
  }
}

export function saveWholesaleState(state) {
  const snapshot = {
    ...state,
    meta: {
      ...DEFAULT_STATE.meta,
      ...(state.meta || {}),
      updatedAt: new Date().toISOString()
    }
  };
  fs.writeFileSync(WHOLESALE_STATE_PATH, JSON.stringify(snapshot, null, 2));
}

export function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

