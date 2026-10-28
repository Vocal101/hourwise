// Insights: where money (and work time) goes, month trend, bye vs buy.
import { commit } from '../store.js';
import { monthKey, shiftMonth, categoryTotals, workHours, shareOfMonth, round2, savingsStats } from '../calc.js';
import { category } from '../data.js';
import { pct, shortDate } from '../format.js';
import { esc, onAct } from '../ui.js';
import { donut, bars, progressBar } from '../charts.js';
import { fx, catChip, empty, hasIncome } from './common.js';

const RANGES = [
  { id: '1', label: 'This month', months: 1 },
  { id: '3', label: '3 months', months: 3 },
  { id: '12', label: '12 months', months: 12 },
];
let range = '1';

export function render(state) {
  const s = state.settings;
  const f = fx(s);
  const months = RANGES.find((r) => r.id === range).months;
  const end = monthKey();
  const start = shiftMonth(end, -(months - 1));
  const inRange = (d) => d.slice(0, 7) >= start && d.slice(0, 7) <= end;
  const txs = state.transactions.filter((t) => inRange(t.date));
  const spent = round2(txs.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0));
  const income = round2(txs.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0));
  const hours = workHours(spent, s);
  const workShare = shareOfMonth(hours, s) / months;
  const cats = categoryTotals(txs);
  const decisions = state.decisions.filter((d) => inRange(d.date));
  const byes = decisions.filter((d) => d.verdict === 'skip');
  const buys = decisions.filter((d) => d.verdict === 'buy');
  const byeAmt = round2(byes.reduce((a, d) => a + d.total, 0));
  const buyAmt = round2(buys.reduce((a, d) => a + d.total, 0));
  const biggest = txs.filter((t) => t.type === 'expense').sort((a, b) => b.amount - a.amount).slice(0, 5);
  const all = savingsStats(state);

  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const k = shiftMonth(end, -i);
    const total = state.transactions.filter((t) => t.type === 'expense' && t.date.startsWith(k)).reduce((a, t) => a + t.amount, 0);
    const [y, m] = k.split('-').map(Number);
    trend.push({
      label: new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short' }),
      value: total,
      color: s.monthlyBudget > 0 && total > s.monthlyBudget ? 'var(--red)' : 'var(--accent-strong)',
      title: `${k}: ${f.m(total)}`,
    });
  }

  const slices = cats.slice(0, 7).map((c) => ({ value: c.amount, color: category(c.category).color, label: category(c.category).label }));
  const rest = cats.slice(7).reduce((a, c) => a + c.amount, 0);
  if (rest > 0) slices.push({ value: rest, color: '#adb5bd', label: 'Everything else' });

  return `
  <nav class="seg" aria-label="Time range">${RANGES.map((r) => `<button class="${r.id === range ? 'on' : ''}" data-act="range" data-v="${r.id}" aria-pressed="${r.id === range}">${r.label}</button>`).join('')}</nav>

  <section class="stat-grid">
    <div class="stat red"><span class="stat-label">Spent</span><b>${f.mc(spent)}</b><span class="stat-sub">${hasIncome(s) ? f.h(hours) : '—'} of work</span></div>
    <div class="stat green"><span class="stat-label">Income</span><b>${f.mc(income)}</b><span class="stat-sub">net ${income - spent >= 0 ? '+' : '−'}${f.mc(Math.abs(income - spent))}</span></div>
    <div class="stat yellow"><span class="stat-label">Kept by bye</span><b>${f.mc(byeAmt)}</b><span class="stat-sub">${byes.length} skipped</span></div>
  </section>

  ${hasIncome(s) && spent > 0 ? `<section class="card">
    <h3>Your working time</h3>
    <p>About <b>${pct(Math.min(workShare, 9.99))}</b> of your working hours ${months === 1 ? 'this month' : 'each month'} went to paying for spending.</p>
    ${progressBar(workShare, workShare > 1 ? 'var(--red)' : 'var(--accent-strong)')}
  </section>` : ''}

  <section class="card">
    <h3>Where it went</h3>
    ${cats.length ? `<div class="donut-wrap">${donut(slices, { center: `<span class="ring-k">Total</span><b class="ring-v sm">${f.mc(spent)}</b>` })}
      <ul class="legend">${cats.map((c) => {
        const cat = category(c.category);
        return `<li><span class="sw" style="background:${cat.color}"></span><span class="grow">${cat.emoji} ${esc(cat.label)}</span>
          <span class="end-col"><b>${f.m(c.amount)}</b><small class="muted">${hasIncome(s) ? f.t(c.amount) : pct(c.amount / spent)}</small></span></li>`;
      }).join('')}</ul></div>`
      : empty('📊', 'No spending yet', 'Log expenses in Budget to see the breakdown.')}
  </section>

  <section class="card">
    <h3>Last 6 months</h3>
    ${bars(trend, { line: s.monthlyBudget || null, format: f.mc })}
  </section>

  <section class="card">
    <h3>Bye vs buy</h3>
    ${decisions.length ? `<div class="vs">
      <div><span class="label">Bye 👋</span><b class="green">${byes.length}</b><small class="muted">${f.m(byeAmt)}</small></div>
      <div><span class="label">Bought</span><b>${buys.length}</b><small class="muted">${f.m(buyAmt)}</small></div>
    </div>
    ${progressBar(byes.length / decisions.length)}
    <p class="muted small">You said bye to ${pct(byes.length / decisions.length)} of what you weighed. All time: ${f.m(all.saved)} kept, worth ${f.mc(all.invested)} invested.</p>`
      : '<p class="muted">Use Worth it? on the Home tab to start tracking your choices.</p>'}
  </section>

  ${biggest.length ? `<section class="card">
    <h3>Biggest purchases</h3>
    <ul class="list">${biggest.map((t) => `<li class="row-item">${catChip(t.category)}<div class="grow"><b>${esc(t.name || category(t.category).label)}</b><small class="muted">${shortDate(t.date)}</small></div>
      <div class="end-col"><span class="amt">${f.m(t.amount)}</span><small class="muted">${f.t(t.amount)}</small></div></li>`).join('')}</ul>
  </section>` : ''}`;
}

onAct({
  range: (el) => { range = el.dataset.v; commit(() => {}); },
});
