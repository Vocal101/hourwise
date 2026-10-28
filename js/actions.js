// Every change to the data goes through one of these. They mutate the state object they're
// given and return what happened, so the UI can show points and badges. No DOM here.
import {
  dayKey, monthKey, round2, num, clamp, daysInMonth,
  withSalesTax, workHours, decisionPoints, savingsStats, bestStreak, goalProgress, budgetSummary,
} from './calc.js';
import { ACHIEVEMENTS, CHALLENGES, roomItem } from './data.js';

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---------- points & badges ----------

export function award(state, pts, reason, now = new Date()) {
  pts = Math.round(pts);
  if (!pts) return 0;
  const pig = state.pig;
  const applied = pts > 0 ? pts : -Math.min(pig.points, -pts);
  pig.points += applied;
  if (applied > 0) pig.lifetime += applied;
  pig.log.push({ pts: applied, reason, at: now.toISOString() });
  if (pig.log.length > 100) pig.log.splice(0, pig.log.length - 100);
  return applied;
}

export function achievementFacts(state, now = new Date()) {
  const stats = savingsStats(state, now);
  return {
    skipCount: stats.skipCount,
    saved: stats.saved,
    hoursSaved: stats.hours,
    bestStreak: bestStreak(state.noBuyDays),
    envelopes: state.envelopes.filled.length,
    goalsDone: state.goals.filter((g) => goalProgress(g, now).done).length,
    cooldownSkips: state.cooldown.filter((c) => c.status === 'skipped').length,
    challengesDone: state.challenge.history.filter((h) => h.status === 'done').length + (state.challenge.today?.status === 'done' ? 1 : 0),
    blocksDone: state.shopBlock.history.filter((h) => h.result === 'done').length,
    monthsUnder: Object.values(state.monthsReviewed).filter((v) => v === 'under').length,
  };
}

export function checkAchievements(state, now = new Date()) {
  const facts = achievementFacts(state, now);
  const unlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (state.achievements[a.id] || !a.test(facts)) continue;
    state.achievements[a.id] = now.toISOString();
    award(state, a.points, `Badge: ${a.name}`, now);
    unlocked.push(a);
  }
  return unlocked;
}

// Closes out finished months that had activity: under budget earns a bonus.
export function reviewMonths(state, now = new Date()) {
  const budget = num(state.settings.monthlyBudget);
  const results = [];
  if (budget <= 0) return results;
  const thisMonth = monthKey(now);
  const active = new Set(state.transactions.map((t) => t.date.slice(0, 7)));
  for (const key of [...active].sort()) {
    if (key >= thisMonth || state.monthsReviewed[key]) continue;
    const sum = budgetSummary(state, key, now);
    const verdict = sum.spent <= budget ? 'under' : 'over';
    state.monthsReviewed[key] = verdict;
    if (verdict === 'under') award(state, 50, `Under budget in ${key}`, now);
    results.push({ key, verdict });
  }
  return results;
}

// ---------- worth it? decisions ----------

export function decide(state, { price, name = '', category = 'shopping' }, verdict, now = new Date()) {
  const s = state.settings;
  price = round2(num(price));
  if (!(price > 0)) throw new Error('Enter a price above zero.');
  const total = withSalesTax(price, s);
  const decision = {
    id: uid(), name: String(name).trim().slice(0, 80), price, total, category,
    verdict: verdict === 'buy' ? 'buy' : 'skip', date: dayKey(now), at: now.toISOString(), txId: null, pts: 0,
  };
  if (decision.verdict === 'buy') {
    decision.txId = addTransaction(state, {
      type: 'expense', amount: total, name: decision.name || 'Purchase', category, date: decision.date, source: 'decision', sourceId: decision.id,
    }).id;
  } else {
    decision.pts = award(state, decisionPoints(workHours(total, s)), `Said bye to ${decision.name || 'a purchase'}`, now);
  }
  state.decisions.push(decision);
  return decision;
}

export function deleteDecision(state, id, now = new Date()) {
  const i = state.decisions.findIndex((d) => d.id === id);
  if (i < 0) return null;
  const [d] = state.decisions.splice(i, 1);
  if (d.txId) state.transactions = state.transactions.filter((t) => t.id !== d.txId);
  if (d.pts) award(state, -d.pts, 'Removed a bye', now);
  return d;
}

// ---------- transactions ----------

export function addTransaction(state, data) {
  const tx = {
    id: uid(),
    type: data.type === 'income' ? 'income' : 'expense',
    amount: round2(Math.abs(num(data.amount))),
    name: String(data.name || '').trim().slice(0, 80),
    category: data.category || (data.type === 'income' ? 'other-in' : 'other'),
    date: data.date || dayKey(),
    note: String(data.note || '').slice(0, 300),
    source: data.source || null,
    sourceId: data.sourceId || null,
  };
  if (!(tx.amount > 0)) throw new Error('Enter an amount above zero.');
  state.transactions.push(tx);
  return tx;
}

export function updateTransaction(state, id, patch) {
  const tx = state.transactions.find((t) => t.id === id);
  if (!tx) return null;
  if (patch.amount != null) {
    const amount = round2(Math.abs(num(patch.amount)));
    if (!(amount > 0)) throw new Error('Enter an amount above zero.');
    tx.amount = amount;
  }
  for (const k of ['name', 'category', 'date', 'note']) if (patch[k] != null) tx[k] = String(patch[k]).slice(0, k === 'note' ? 300 : 80);
  if (tx.source === 'decision') {
    const d = state.decisions.find((x) => x.id === tx.sourceId);
    if (d) Object.assign(d, { total: tx.amount, name: tx.name, category: tx.category, date: tx.date });
  }
  return tx;
}

export function deleteTransaction(state, id) {
  const i = state.transactions.findIndex((t) => t.id === id);
  if (i < 0) return null;
  const [tx] = state.transactions.splice(i, 1);
  if (tx.source === 'decision') state.decisions = state.decisions.filter((d) => d.id !== tx.sourceId);
  if (tx.source === 'bill') {
    const bill = state.bills.find((b) => b.id === tx.sourceId);
    if (bill) for (const [k, v] of Object.entries(bill.paid)) if (v === tx.id) delete bill.paid[k];
  }
  if (tx.source === 'cooldown') {
    const item = state.cooldown.find((c) => c.id === tx.sourceId);
    if (item) { item.status = 'waiting'; item.decidedAt = null; }
  }
  return tx;
}

// ---------- bills ----------

export function saveBill(state, data, id = null) {
  const amount = round2(Math.abs(num(data.amount)));
  if (!(amount > 0)) throw new Error('Enter an amount above zero.');
  const fields = {
    name: String(data.name || '').trim().slice(0, 60) || 'Bill',
    amount,
    dueDay: clamp(Math.round(num(data.dueDay, 1)), 1, 31),
    category: data.category || 'bills',
  };
  if (id) {
    const bill = state.bills.find((b) => b.id === id);
    if (bill) Object.assign(bill, fields);
    return bill;
  }
  const bill = { id: uid(), ...fields, paid: {}, archived: false };
  state.bills.push(bill);
  return bill;
}

export function deleteBill(state, id) {
  // Keeps the expenses already logged for it; they're real spending.
  for (const t of state.transactions) if (t.source === 'bill' && t.sourceId === id) { t.source = null; t.sourceId = null; }
  state.bills = state.bills.filter((b) => b.id !== id);
}

export function billDueDate(bill, key) {
  const [y, m] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, Math.min(bill.dueDay, daysInMonth(y, m - 1))));
}

export function toggleBillPaid(state, billId, key, now = new Date()) {
  const bill = state.bills.find((b) => b.id === billId);
  if (!bill) return null;
  if (bill.paid[key]) {
    const txId = bill.paid[key];
    delete bill.paid[key];
    state.transactions = state.transactions.filter((t) => t.id !== txId);
    return false;
  }
  const date = key === monthKey(now) ? dayKey(now) : billDueDate(bill, key);
  const tx = addTransaction(state, { type: 'expense', amount: bill.amount, name: bill.name, category: bill.category, date, source: 'bill', sourceId: bill.id });
  bill.paid[key] = tx.id;
  return true;
}

// ---------- no-buy days ----------

export function toggleNoBuy(state, key, now = new Date()) {
  if (key > dayKey(now)) throw new Error("You can't mark a future day yet.");
  const i = state.noBuyDays.indexOf(key);
  if (i >= 0) {
    state.noBuyDays.splice(i, 1);
    award(state, -15, 'Unmarked a no-buy day', now);
    return false;
  }
  state.noBuyDays.push(key);
  state.noBuyDays.sort();
  award(state, 15, 'No-buy day', now);
  return true;
}

// ---------- goals ----------

export function saveGoal(state, data, id = null) {
  const target = round2(Math.abs(num(data.target)));
  if (!(target > 0)) throw new Error('Enter a target above zero.');
  const fields = {
    name: String(data.name || '').trim().slice(0, 60) || 'Goal',
    emoji: String(data.emoji || '🎯').slice(0, 8),
    target,
    deadline: data.deadline || '',
  };
  if (id) {
    const goal = state.goals.find((g) => g.id === id);
    if (goal) Object.assign(goal, fields);
    return goal;
  }
  const goal = { id: uid(), ...fields, created: dayKey(), deposits: [] };
  state.goals.push(goal);
  return goal;
}

export function deleteGoal(state, id) {
  state.goals = state.goals.filter((g) => g.id !== id);
}

export function deposit(state, goalId, amount, note = '', now = new Date()) {
  const goal = state.goals.find((g) => g.id === goalId);
  if (!goal) return null;
  amount = round2(num(amount));
  if (!amount) throw new Error('Enter an amount.');
  const saved = goal.deposits.reduce((a, d) => a + d.amount, 0);
  if (amount < 0 && -amount > saved + 0.001) throw new Error("You can't take out more than the goal holds.");
  const today = dayKey(now);
  const firstToday = amount > 0 && !goal.deposits.some((d) => d.amount > 0 && d.date === today);
  goal.deposits.push({ id: uid(), amount, date: today, note: String(note).slice(0, 80) });
  if (firstToday) award(state, 5, `Saved toward ${goal.name}`, now);
  return goal;
}

// ---------- 100 envelopes ----------

export function toggleEnvelope(state, n, now = new Date()) {
  const env = state.envelopes;
  const i = env.filled.indexOf(n);
  if (i >= 0) {
    env.filled.splice(i, 1);
    delete env.dates[n];
    award(state, -5, `Emptied envelope ${n}`, now);
    return false;
  }
  env.filled.push(n);
  env.filled.sort((a, b) => a - b);
  env.dates[n] = dayKey(now);
  award(state, 5, `Filled envelope ${n}`, now);
  return true;
}

// ---------- cooldown ----------

export function addCooldown(state, data, now = new Date()) {
  const price = round2(num(data.price));
  if (!(price > 0)) throw new Error('Enter a price above zero.');
  const hours = clamp(num(data.hours, state.settings.cooldownHours), 1 / 60, 24 * 90);
  const item = {
    id: uid(),
    name: String(data.name || '').trim().slice(0, 80) || 'Something I want',
    price,
    total: withSalesTax(price, state.settings),
    category: data.category || 'shopping',
    url: /^https?:\/\//i.test(data.url || '') ? String(data.url).slice(0, 500) : '',
    note: String(data.note || '').slice(0, 300),
    created: now.toISOString(),
    until: new Date(now.getTime() + hours * 3600000).toISOString(),
    status: 'waiting',
    decidedAt: null,
    notified: false,
  };
  state.cooldown.push(item);
  return item;
}

export function resolveCooldown(state, id, outcome, now = new Date()) {
  const item = state.cooldown.find((c) => c.id === id);
  if (!item || item.status !== 'waiting') return null;
  item.status = outcome === 'bought' ? 'bought' : 'skipped';
  item.decidedAt = now.toISOString();
  if (item.status === 'bought') {
    addTransaction(state, { type: 'expense', amount: item.total, name: item.name, category: item.category, date: dayKey(now), source: 'cooldown', sourceId: item.id });
    return { item, points: 0 };
  }
  const points = award(state, decisionPoints(workHours(item.total, state.settings)) + 10, `Cooled off on ${item.name}`, now);
  return { item, points };
}

export function deleteCooldown(state, id) {
  state.transactions = state.transactions.filter((t) => !(t.source === 'cooldown' && t.sourceId === id));
  state.cooldown = state.cooldown.filter((c) => c.id !== id);
}

// ---------- shop block ----------

export function startBlock(state, hours, shops = [], now = new Date()) {
  if (state.shopBlock.active) throw new Error('A Shop Block is already running.');
  hours = clamp(num(hours, 24), 1 / 60, 24 * 30);
  state.shopBlock.active = {
    start: now.toISOString(),
    end: new Date(now.getTime() + hours * 3600000).toISOString(),
    shops: shops.map((s) => String(s).trim().slice(0, 40)).filter(Boolean).slice(0, 20),
    overrides: 0,
  };
  return state.shopBlock.active;
}

// Finishes a block that has run its course. Returns points earned, or 0.
export function checkBlock(state, now = new Date()) {
  const a = state.shopBlock.active;
  if (!a || Date.parse(a.end) > now.getTime()) return 0;
  state.shopBlock.history.push({ start: a.start, end: a.end, result: 'done', overrides: a.overrides });
  state.shopBlock.active = null;
  const hours = (Date.parse(a.end) - Date.parse(a.start)) / 3600000;
  return award(state, clamp(Math.round(10 + hours / 2), 10, 100), 'Finished a Shop Block', now);
}

export function endBlockEarly(state, now = new Date()) {
  const a = state.shopBlock.active;
  if (!a) return;
  state.shopBlock.history.push({ start: a.start, end: now.toISOString(), result: 'broken', overrides: a.overrides });
  state.shopBlock.active = null;
}

export function isBlocked(state, now = new Date()) {
  const a = state.shopBlock.active;
  return !!a && Date.parse(a.end) > now.getTime();
}

// ---------- daily challenge ----------

// Moves yesterday's challenge into history.
export function rolloverChallenge(state, now = new Date()) {
  const t = state.challenge.today;
  if (!t || t.date === dayKey(now)) return;
  if (t.status === 'done' || t.status === 'accepted' || t.status === 'missed') {
    state.challenge.history.push({ date: t.date, text: t.text, status: t.status === 'done' ? 'done' : 'missed' });
  }
  state.challenge.today = null;
}

export function rollChallenge(state, now = new Date(), rand = Math.random) {
  rolloverChallenge(state, now);
  const t = state.challenge.today;
  if (t && t.status !== 'offered') return t;
  const options = CHALLENGES.filter((c) => c !== t?.text);
  state.challenge.today = { date: dayKey(now), text: options[Math.floor(rand() * options.length)], status: 'offered' };
  return state.challenge.today;
}

export function setChallengeStatus(state, status, now = new Date()) {
  const t = state.challenge.today;
  if (!t || t.date !== dayKey(now)) return 0;
  if (status === 'accepted' && t.status === 'offered') t.status = 'accepted';
  else if (status === 'done' && t.status === 'accepted') { t.status = 'done'; return award(state, 20, 'Daily challenge', now); }
  else if (status === 'missed' && t.status === 'accepted') t.status = 'missed';
  return 0;
}

// ---------- mascot room ----------

export function buyItem(state, itemId, now = new Date()) {
  const item = roomItem(itemId);
  if (!item) throw new Error('That item doesn’t exist.');
  if (state.pig.owned.includes(itemId)) return item;
  if (state.pig.points < item.cost) throw new Error(`You need ${item.cost - state.pig.points} more points.`);
  award(state, -item.cost, `Bought ${item.name}`, now);
  state.pig.owned.push(itemId);
  state.pig.placed[item.slot] = itemId;
  return item;
}

export function togglePlaced(state, itemId) {
  const item = roomItem(itemId);
  if (!item || !state.pig.owned.includes(itemId)) return false;
  if (state.pig.placed[item.slot] === itemId) { delete state.pig.placed[item.slot]; return false; }
  state.pig.placed[item.slot] = itemId;
  return true;
}

// ---------- recurring housekeeping ----------

// Run on launch and every minute: rolls challenges, closes blocks and months, awards badges.
export function tick(state, now = new Date()) {
  rolloverChallenge(state, now);
  const blockPoints = checkBlock(state, now);
  const months = reviewMonths(state, now);
  const badges = checkAchievements(state, now);
  return { blockPoints, months, badges };
}
