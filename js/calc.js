// Pure money/time math. No DOM, no storage, so it runs under node for tests.

export const DAY_MS = 86400000;

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export const num = (v, fallback = 0) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
};

// ---------- dates (always local time) ----------

export const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monthKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const parseDay = (key) => {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
export const daysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate();
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const shiftMonth = (key, delta) => {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
};

// ---------- income ----------

export function hoursPerDay(s) {
  const days = clamp(num(s.daysPerWeek, 5), 1, 7);
  return clamp(num(s.hoursPerWeek, 40), 1, 168) / days;
}

// What one hour of work is worth, after income tax when "take-home" is on.
export function hourlyRate(s) {
  const hoursPerWeek = clamp(num(s.hoursPerWeek, 40), 1, 168);
  let rate = s.incomeType === 'salary' ? num(s.salary) / (52 * hoursPerWeek) : num(s.hourlyRate);
  if (s.takeHome) rate *= 1 - clamp(num(s.taxRate), 0, 95) / 100;
  return rate > 0 && Number.isFinite(rate) ? rate : 0;
}

export function withSalesTax(price, s) {
  return s.salesTaxOn ? round2(price * (1 + clamp(num(s.salesTaxRate), 0, 100) / 100)) : price;
}

export function workHours(amount, s) {
  const rate = hourlyRate(s);
  return rate ? Math.abs(amount) / rate : 0;
}

// Splits hours into work days (of the user's day length), hours and minutes.
export function splitWorkTime(hours, s) {
  const perDay = hoursPerDay(s);
  let minutes = Math.round(hours * 60);
  const dayMinutes = Math.round(perDay * 60);
  const days = Math.floor(minutes / dayMinutes);
  minutes -= days * dayMinutes;
  const h = Math.floor(minutes / 60);
  return { days, hours: h, minutes: minutes - h * 60, totalHours: hours };
}

// Share of a normal working month this many hours represents.
export function shareOfMonth(hours, s) {
  const monthHours = (clamp(num(s.hoursPerWeek, 40), 1, 168) * 52) / 12;
  return hours / monthHours;
}

// ---------- investing ----------

export function ageOn(birthday, now = new Date()) {
  if (!birthday) return null;
  const b = parseDay(birthday);
  if (Number.isNaN(b.getTime()) || b > now) return null;
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
}

// Years the money could compound: until retirement, or 30 years with no birthday set.
export function investYears(s, now = new Date()) {
  const age = ageOn(s.birthday, now);
  if (age == null) return 30;
  return clamp(num(s.retirementAge, 65) - age, 1, 80);
}

export function futureValue(amount, ratePct, years) {
  return amount * (1 + num(ratePct) / 100) ** Math.max(0, years);
}

export function investedInstead(amount, s, now = new Date()) {
  const years = investYears(s, now);
  return { years, value: futureValue(amount, s.returnRate, years), age: ageOn(s.birthday, now) };
}

// ---------- decisions ----------

export function savingsStats(state, now = new Date()) {
  const s = state.settings;
  const skipped = [
    ...state.decisions.filter((d) => d.verdict === 'skip').map((d) => d.total),
    ...state.cooldown.filter((c) => c.status === 'skipped').map((c) => c.total ?? c.price),
  ];
  const bought = state.decisions.filter((d) => d.verdict === 'buy');
  const saved = round2(skipped.reduce((a, b) => a + b, 0));
  const years = investYears(s, now);
  return {
    saved,
    skipCount: skipped.length,
    buyCount: bought.length,
    spentOnBuys: round2(bought.reduce((a, d) => a + d.total, 0)),
    hours: workHours(saved, s),
    invested: futureValue(saved, s.returnRate, years),
    years,
  };
}

export function decisionPoints(hours) {
  return clamp(10 + Math.floor(hours * 2), 10, 60);
}

// ---------- budget ----------

export function monthTransactions(state, key) {
  return state.transactions.filter((t) => t.date.startsWith(key));
}

export function budgetSummary(state, key, now = new Date()) {
  const s = state.settings;
  const txs = monthTransactions(state, key);
  const spent = round2(txs.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0));
  const income = round2(txs.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0));
  const bills = state.bills.filter((b) => !b.archived);
  const unpaidBills = round2(bills.filter((b) => !b.paid?.[key]).reduce((a, b) => a + b.amount, 0));
  const budget = num(s.monthlyBudget);
  const left = round2(budget - spent);
  const safe = round2(left - unpaidBills);

  const [y, m] = key.split('-').map(Number);
  const total = daysInMonth(y, m - 1);
  const current = monthKey(now) === key;
  const past = key < monthKey(now);
  const daysLeft = current ? total - now.getDate() + 1 : past ? 0 : total;
  return {
    budget, spent, income, left, unpaidBills, safe,
    net: round2(income - spent),
    pct: budget > 0 ? spent / budget : 0,
    daysLeft,
    perDay: daysLeft > 0 ? Math.max(0, safe) / daysLeft : 0,
    current, past, totalDays: total,
  };
}

export function categoryTotals(transactions) {
  const map = new Map();
  for (const t of transactions) if (t.type === 'expense') map.set(t.category, (map.get(t.category) || 0) + t.amount);
  return [...map.entries()].map(([category, amount]) => ({ category, amount: round2(amount) })).sort((a, b) => b.amount - a.amount);
}

// ---------- no-buy days ----------

// Consecutive no-buy days ending today, or yesterday if today isn't marked yet.
export function noBuyStreak(days, now = new Date()) {
  const set = new Set(days);
  let d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!set.has(dayKey(d))) d = addDays(d, -1);
  let streak = 0;
  while (set.has(dayKey(d))) { streak++; d = addDays(d, -1); }
  return streak;
}

export function bestStreak(days) {
  const sorted = [...new Set(days)].sort();
  let best = 0, run = 0, prev = null;
  for (const k of sorted) {
    const d = parseDay(k);
    run = prev && Math.round((d - prev) / DAY_MS) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

// ---------- goals & envelopes ----------

export function goalSaved(goal) {
  return round2(goal.deposits.reduce((a, d) => a + d.amount, 0));
}

export function goalProgress(goal, now = new Date()) {
  const saved = goalSaved(goal);
  const remaining = Math.max(0, round2(goal.target - saved));
  let perMonth = null, monthsLeft = null;
  if (goal.deadline && remaining > 0) {
    const end = parseDay(goal.deadline);
    monthsLeft = Math.max(0, (end.getFullYear() - now.getFullYear()) * 12 + end.getMonth() - now.getMonth() + (end.getDate() >= now.getDate() ? 0 : -1));
    perMonth = remaining / Math.max(1, monthsLeft);
  }
  return { saved, remaining, pct: goal.target > 0 ? clamp(saved / goal.target, 0, 1) : 0, done: goal.target > 0 && saved >= goal.target, perMonth, monthsLeft };
}

export const ENVELOPE_COUNT = 100;
export const envelopeValue = (n, multiplier) => round2(n * multiplier);
export const envelopeTotal = (filled, multiplier) => round2(filled.reduce((a, n) => a + n * multiplier, 0));
export const envelopeGoal = (multiplier) => envelopeTotal(Array.from({ length: ENVELOPE_COUNT }, (_, i) => i + 1), multiplier);

export function randomEmptyEnvelope(filled, rand = Math.random) {
  const set = new Set(filled);
  const empty = [];
  for (let n = 1; n <= ENVELOPE_COUNT; n++) if (!set.has(n)) empty.push(n);
  return empty.length ? empty[Math.floor(rand() * empty.length)] : null;
}
