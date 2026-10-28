// Holds the one state object, saves it to localStorage, and tells the UI when it changes.
import { sanitize, defaultState, SCHEMA_VERSION } from './schema.js';
import { tick } from './actions.js';
import { category } from './data.js';

const KEY = 'hourwise:v1';
let state = defaultState();
let storageOk = true;
const listeners = new Set();

export const getState = () => state;
export const isStorageOk = () => storageOk;

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = sanitize(JSON.parse(raw));
  } catch (err) {
    console.error('Saved data could not be read; keeping a copy and starting fresh.', err);
    try { localStorage.setItem(`${KEY}:corrupt:${Date.now()}`, localStorage.getItem(KEY) || ''); } catch { /* storage unavailable */ }
    state = defaultState();
  }
  return state;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    storageOk = true;
  } catch (err) {
    storageOk = false;
    console.error('Could not save', err);
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Runs a mutation, does housekeeping (badges, rollovers), saves, re-renders.
// Returns { result, events } so callers can celebrate points and badges.
export function commit(mutator, now = new Date()) {
  const result = mutator(state);
  const events = tick(state, now);
  save();
  for (const fn of listeners) fn(state, events);
  return { result, events };
}

export function replaceState(next) {
  state = sanitize(next);
  save();
  for (const fn of listeners) fn(state, { badges: [], months: [], blockPoints: 0 });
}

export function resetAll() {
  state = defaultState();
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  for (const fn of listeners) fn(state, { badges: [], months: [], blockPoints: 0 });
}

// ---------- backup ----------

export function exportJSON() {
  return JSON.stringify({ app: 'hourwise', exportedAt: new Date().toISOString(), schema: SCHEMA_VERSION, data: state }, null, 2);
}

export function parseBackup(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('That file isn’t valid JSON.'); }
  const data = parsed?.app === 'hourwise' ? parsed.data : parsed;
  if (!data || typeof data !== 'object' || !('settings' in data)) throw new Error('That doesn’t look like an Hourwise backup.');
  return sanitize({ ...data, onboarded: true });
}

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : '') + s.replace(/"/g, '""')}"` : s;
};

export function exportCSV() {
  const rows = [['Date', 'Type', 'Name', 'Category', 'Amount', 'Currency', 'Note']];
  const cur = state.settings.currency;
  for (const t of [...state.transactions].sort((a, b) => a.date.localeCompare(b.date))) {
    rows.push([t.date, t.type, t.name, category(t.category).label, t.amount.toFixed(2), cur, t.note]);
  }
  for (const d of state.decisions.filter((x) => x.verdict === 'skip')) {
    rows.push([d.date, 'skipped (saved)', d.name, category(d.category).label, d.total.toFixed(2), cur, 'Worth It? said bye']);
  }
  for (const c of state.cooldown.filter((x) => x.status === 'skipped')) {
    rows.push([c.decidedAt?.slice(0, 10) || '', 'skipped (saved)', c.name, category(c.category).label, c.total.toFixed(2), cur, 'Skipped after cooldown']);
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}
