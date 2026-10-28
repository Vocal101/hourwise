// The saved data shape, defaults, and a sanitizer used on load and on backup import.
// Anything malformed is dropped or repaired so one bad record can't break the app.
import { num, clamp, round2 } from './calc.js';
import { CATEGORIES, INCOME_CATEGORIES, ROOM_ITEMS } from './data.js';

export const SCHEMA_VERSION = 1;

export function defaultSettings() {
  return {
    name: '',
    currency: 'USD',
    incomeType: 'hourly', // 'hourly' | 'salary'
    hourlyRate: 20,
    salary: 50000,
    hoursPerWeek: 40,
    daysPerWeek: 5,
    takeHome: false,
    taxRate: 20,
    birthday: '',
    retirementAge: 65,
    returnRate: 10,
    salesTaxOn: false,
    salesTaxRate: 8,
    monthlyBudget: 1500,
    showHours: false,
    cooldownMode: false,
    cooldownHours: 48,
    theme: 'system', // 'system' | 'light' | 'dark'
    weekStart: 0,
    notifications: false,
    haptics: true,
  };
}

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    onboarded: false,
    createdAt: new Date().toISOString(),
    settings: defaultSettings(),
    decisions: [],
    transactions: [],
    bills: [],
    noBuyDays: [],
    goals: [],
    envelopes: { filled: [], multiplier: 1, dates: {} },
    cooldown: [],
    shopBlock: { active: null, history: [] },
    pig: { name: 'Truffle', points: 0, lifetime: 0, owned: [], placed: {}, log: [] },
    challenge: { today: null, history: [] },
    achievements: {},
    monthsReviewed: {},
  };
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const str = (v, max = 120) => (typeof v === 'string' ? v.slice(0, max) : v == null ? '' : String(v).slice(0, max));
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const day = (v) => (typeof v === 'string' && DAY_RE.test(v) ? v : null);
const money = (v) => round2(Math.max(0, num(v)));
const arr = (v) => (Array.isArray(v) ? v : []);
const iso = (v) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null);
const id = (v) => (typeof v === 'string' && v ? v.slice(0, 40) : Math.random().toString(36).slice(2, 10));

const EXPENSE_IDS = new Set(CATEGORIES.map((c) => c.id));
const INCOME_IDS = new Set(INCOME_CATEGORIES.map((c) => c.id));
const ITEM_IDS = new Set(ROOM_ITEMS.map((i) => i.id));

function settings(raw) {
  const d = defaultSettings();
  if (!isObj(raw)) return d;
  return {
    name: str(raw.name, 40),
    currency: typeof raw.currency === 'string' && /^[A-Z]{3}$/.test(raw.currency) ? raw.currency : d.currency,
    incomeType: raw.incomeType === 'salary' ? 'salary' : 'hourly',
    hourlyRate: Math.max(0, num(raw.hourlyRate, d.hourlyRate)),
    salary: Math.max(0, num(raw.salary, d.salary)),
    hoursPerWeek: clamp(num(raw.hoursPerWeek, d.hoursPerWeek), 1, 168),
    daysPerWeek: clamp(Math.round(num(raw.daysPerWeek, d.daysPerWeek)), 1, 7),
    takeHome: !!raw.takeHome,
    taxRate: clamp(num(raw.taxRate, d.taxRate), 0, 95),
    birthday: day(raw.birthday) || '',
    retirementAge: clamp(Math.round(num(raw.retirementAge, d.retirementAge)), 18, 100),
    returnRate: clamp(num(raw.returnRate, d.returnRate), 0, 30),
    salesTaxOn: !!raw.salesTaxOn,
    salesTaxRate: clamp(num(raw.salesTaxRate, d.salesTaxRate), 0, 100),
    monthlyBudget: money(raw.monthlyBudget ?? d.monthlyBudget),
    showHours: !!raw.showHours,
    cooldownMode: !!raw.cooldownMode,
    cooldownHours: clamp(num(raw.cooldownHours, d.cooldownHours), 1, 24 * 90),
    theme: ['light', 'dark'].includes(raw.theme) ? raw.theme : 'system',
    weekStart: raw.weekStart === 1 ? 1 : 0,
    notifications: !!raw.notifications,
    haptics: raw.haptics !== false,
  };
}

export function sanitize(raw) {
  const d = defaultState();
  if (!isObj(raw)) return d;
  const out = { ...d, version: SCHEMA_VERSION, onboarded: !!raw.onboarded, createdAt: iso(raw.createdAt) || d.createdAt };
  out.settings = settings(raw.settings);

  out.decisions = arr(raw.decisions).filter(isObj).map((x) => ({
    id: id(x.id),
    name: str(x.name, 80),
    price: money(x.price),
    total: money(x.total ?? x.price),
    category: EXPENSE_IDS.has(x.category) ? x.category : 'other',
    verdict: x.verdict === 'buy' ? 'buy' : 'skip',
    date: day(x.date) || day(String(x.at || '').slice(0, 10)) || new Date().toISOString().slice(0, 10),
    at: iso(x.at) || new Date().toISOString(),
    txId: typeof x.txId === 'string' ? x.txId : null,
    pts: Math.max(0, Math.round(num(x.pts))),
  })).filter((x) => x.price > 0);

  out.transactions = arr(raw.transactions).filter(isObj).map((x) => {
    const type = x.type === 'income' ? 'income' : 'expense';
    const ids = type === 'income' ? INCOME_IDS : EXPENSE_IDS;
    return {
      id: id(x.id),
      type,
      amount: money(x.amount),
      name: str(x.name, 80),
      category: ids.has(x.category) ? x.category : type === 'income' ? 'other-in' : 'other',
      date: day(x.date) || new Date().toISOString().slice(0, 10),
      note: str(x.note, 300),
      source: ['decision', 'bill', 'cooldown'].includes(x.source) ? x.source : null,
      sourceId: typeof x.sourceId === 'string' ? x.sourceId : null,
    };
  }).filter((x) => x.amount > 0);

  out.bills = arr(raw.bills).filter(isObj).map((x) => ({
    id: id(x.id),
    name: str(x.name, 60) || 'Bill',
    amount: money(x.amount),
    dueDay: clamp(Math.round(num(x.dueDay, 1)), 1, 31),
    category: EXPENSE_IDS.has(x.category) ? x.category : 'bills',
    paid: isObj(x.paid) ? Object.fromEntries(Object.entries(x.paid).filter(([k, v]) => MONTH_RE.test(k) && typeof v === 'string')) : {},
    archived: !!x.archived,
  }));

  out.noBuyDays = [...new Set(arr(raw.noBuyDays).filter(day))].sort();

  out.goals = arr(raw.goals).filter(isObj).map((x) => ({
    id: id(x.id),
    name: str(x.name, 60) || 'Goal',
    emoji: str(x.emoji, 8) || '🎯',
    target: money(x.target),
    deadline: day(x.deadline) || '',
    created: day(x.created) || new Date().toISOString().slice(0, 10),
    deposits: arr(x.deposits).filter(isObj).map((p) => ({
      id: id(p.id), amount: round2(num(p.amount)), date: day(p.date) || new Date().toISOString().slice(0, 10), note: str(p.note, 80),
    })).filter((p) => p.amount !== 0),
  }));

  const env = isObj(raw.envelopes) ? raw.envelopes : {};
  out.envelopes = {
    filled: [...new Set(arr(env.filled).map((n) => Math.round(num(n))).filter((n) => n >= 1 && n <= 100))].sort((a, b) => a - b),
    multiplier: [0.25, 0.5, 1, 2, 5, 10].includes(num(env.multiplier)) ? num(env.multiplier) : 1,
    dates: isObj(env.dates) ? Object.fromEntries(Object.entries(env.dates).filter(([, v]) => day(v))) : {},
  };

  out.cooldown = arr(raw.cooldown).filter(isObj).map((x) => ({
    id: id(x.id),
    name: str(x.name, 80) || 'Item',
    price: money(x.price),
    total: money(x.total ?? x.price),
    category: EXPENSE_IDS.has(x.category) ? x.category : 'shopping',
    url: typeof x.url === 'string' && /^https?:\/\//i.test(x.url) ? x.url.slice(0, 500) : '',
    note: str(x.note, 300),
    created: iso(x.created) || new Date().toISOString(),
    until: iso(x.until) || new Date().toISOString(),
    status: ['waiting', 'bought', 'skipped'].includes(x.status) ? x.status : 'waiting',
    decidedAt: iso(x.decidedAt),
    notified: !!x.notified,
  })).filter((x) => x.price > 0);

  const sb = isObj(raw.shopBlock) ? raw.shopBlock : {};
  const active = isObj(sb.active) && iso(sb.active.start) && iso(sb.active.end)
    ? { start: sb.active.start, end: sb.active.end, shops: arr(sb.active.shops).map((s) => str(s, 40)).filter(Boolean).slice(0, 20), overrides: Math.max(0, Math.round(num(sb.active.overrides))) }
    : null;
  out.shopBlock = {
    active,
    history: arr(sb.history).filter(isObj).map((h) => ({
      start: iso(h.start), end: iso(h.end), result: h.result === 'broken' ? 'broken' : 'done', overrides: Math.max(0, Math.round(num(h.overrides))),
    })).filter((h) => h.start && h.end).slice(-200),
  };

  const pig = isObj(raw.pig) ? raw.pig : {};
  const owned = [...new Set(arr(pig.owned).filter((i) => ITEM_IDS.has(i)))];
  const placed = {};
  if (isObj(pig.placed)) for (const [slot, item] of Object.entries(pig.placed)) if (owned.includes(item)) placed[slot] = item;
  out.pig = {
    name: str(pig.name, 24) || 'Truffle',
    points: Math.max(0, Math.round(num(pig.points))),
    lifetime: Math.max(0, Math.round(num(pig.lifetime))),
    owned,
    placed,
    log: arr(pig.log).filter(isObj).map((l) => ({ pts: Math.round(num(l.pts)), reason: str(l.reason, 80), at: iso(l.at) || new Date().toISOString() })).slice(-100),
  };

  const ch = isObj(raw.challenge) ? raw.challenge : {};
  const today = isObj(ch.today) && day(ch.today.date) && typeof ch.today.text === 'string'
    ? { date: ch.today.date, text: str(ch.today.text, 200), status: ['offered', 'accepted', 'done', 'missed'].includes(ch.today.status) ? ch.today.status : 'offered' }
    : null;
  out.challenge = {
    today,
    history: arr(ch.history).filter(isObj).filter((h) => day(h.date)).map((h) => ({ date: h.date, text: str(h.text, 200), status: h.status === 'done' ? 'done' : 'missed' })).slice(-365),
  };

  out.achievements = isObj(raw.achievements) ? Object.fromEntries(Object.entries(raw.achievements).filter(([, v]) => iso(v))) : {};
  out.monthsReviewed = isObj(raw.monthsReviewed) ? Object.fromEntries(Object.entries(raw.monthsReviewed).filter(([k, v]) => MONTH_RE.test(k) && ['under', 'over'].includes(v))) : {};
  return out;
}
