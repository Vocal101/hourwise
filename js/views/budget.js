// Budget: monthly limit, spending and income, bills, no-buy days.
import { getState, commit } from '../store.js';
import {
  budgetSummary, monthKey, monthTransactions, dayKey, shiftMonth, daysInMonth, noBuyStreak, bestStreak,
} from '../calc.js';
import {
  addTransaction, updateTransaction, deleteTransaction, saveBill, deleteBill, toggleBillPaid, toggleNoBuy, billDueDate,
} from '../actions.js';
import { category } from '../data.js';
import { monthLabel, relativeDay, shortDate } from '../format.js';
import { esc, icon, onAct, onForm, onInput, $, openSheet, closeSheet, sheetHeader, confirmBox, toast, buzz } from '../ui.js';
import { ring } from '../charts.js';
import { fx, categorySelect, moneyInput, field, catChip, empty, requireMoney, hasIncome, parseMoney } from './common.js';

let viewMonth = monthKey();

export function render(state) {
  const s = state.settings;
  const f = fx(s);
  const now = new Date();
  if (viewMonth > monthKey(now)) viewMonth = monthKey(now);
  const sum = budgetSummary(state, viewMonth, now);
  const over = sum.left < 0;
  const txs = monthTransactions(state, viewMonth).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const isCurrent = viewMonth === monthKey(now);

  const ringLabel = s.monthlyBudget > 0
    ? `<span class="ring-k">${over ? 'Over by' : 'Left'}</span><b class="ring-v">${f.v(Math.abs(sum.left))}</b><span class="ring-sub">of ${f.v(sum.budget)}</span>`
    : `<span class="ring-k">Spent</span><b class="ring-v">${f.v(sum.spent)}</b><button class="link" data-act="edit-budget">Set a budget</button>`;

  return `
  <div class="month-nav">
    <button class="icon-btn" data-act="month-prev" aria-label="Previous month">${icon('chevL')}</button>
    <h1>${monthLabel(viewMonth)}</h1>
    <button class="icon-btn" data-act="month-next" aria-label="Next month" ${isCurrent ? 'disabled' : ''}>${icon('chevR')}</button>
  </div>

  <section class="card budget-card">
    <div class="unit-toggle" role="group" aria-label="Show amounts as">
      <button class="${!s.showHours ? 'on' : ''}" data-act="unit" data-v="money" aria-pressed="${!s.showHours}">${esc(f.sym)}</button>
      <button class="${s.showHours ? 'on' : ''}" data-act="unit" data-v="hours" aria-pressed="${s.showHours}" ${hasIncome(s) ? '' : 'disabled title="Add your pay first"'}>Hours</button>
    </div>
    ${ring(s.monthlyBudget > 0 ? sum.pct : 0, { over, children: ringLabel })}
    <div class="trio">
      <div><span class="label">Spent</span><b class="red">${f.v(sum.spent)}</b></div>
      <div><span class="label">Income</span><b class="green">${f.v(sum.income)}</b></div>
      <div><span class="label">Bills due</span><b>${f.v(sum.unpaidBills)}</b></div>
    </div>
    ${isCurrent && s.monthlyBudget > 0 ? `<p class="safe ${sum.safe < 0 ? 'neg' : ''}">${sum.safe >= 0
      ? `Safe to spend <b>${f.v(sum.safe)}</b>${sum.unpaidBills ? ' after bills' : ''} · about <b>${f.v(sum.perDay)}</b> a day for ${sum.daysLeft} day${sum.daysLeft === 1 ? '' : 's'}`
      : `Bills and spending are <b>${f.v(-sum.safe)}</b> over budget.`}</p>` : ''}
    ${!isCurrent && s.monthlyBudget > 0 ? `<p class="safe">${over ? `Went over by <b>${f.v(-sum.left)}</b>` : `Finished <b>${f.v(sum.left)}</b> under budget 🎉`}</p>` : ''}
    <button class="link" data-act="edit-budget">${icon('edit', 14)} Edit monthly budget</button>
  </section>

  <div class="row gap two">
    <button class="btn primary" data-act="add-tx" data-type="expense">${icon('plus', 18)} Expense</button>
    <button class="btn ghost" data-act="add-tx" data-type="income">${icon('plus', 18)} Income</button>
  </div>

  <section class="section">
    <div class="section-head"><h2>Bills</h2><button class="link" data-act="add-bill">${icon('plus', 16)} Add bill</button></div>
    ${billsList(state, f, now)}
  </section>

  <section class="section">
    <div class="section-head"><h2>No-buy days</h2><span class="muted small">🔥 ${noBuyStreak(state.noBuyDays, now)} day streak · best ${bestStreak(state.noBuyDays)}</span></div>
    ${calendar(state, now)}
    <p class="muted small">Tap a day you spent nothing optional. Each one is +15 points.</p>
  </section>

  <section class="section">
    <div class="section-head"><h2>Transactions</h2><span class="muted small">${txs.length}</span></div>
    ${txs.length ? txList(txs, f) : empty('🧾', 'Nothing logged this month', 'Add expenses and income here. Purchases you approve in Worth it? land here too.')}
  </section>`;
}

function billsList(state, f, now) {
  const bills = [...state.bills].sort((a, b) => a.dueDay - b.dueDay);
  if (!bills.length) return `<p class="muted small">Add rent, phone, streaming and other regular bills to see what’s really left to spend.</p>`;
  const today = dayKey(now);
  return `<ul class="list">${bills.map((b) => {
    const paid = !!b.paid[viewMonth];
    const due = billDueDate(b, viewMonth);
    const late = !paid && due < today;
    const soon = !paid && !late && (new Date(due) - now) / 86400000 < 3;
    return `<li class="row-item ${paid ? 'paid' : ''}">
      <button class="check ${paid ? 'on' : ''}" data-act="bill-paid" data-id="${b.id}" aria-pressed="${paid}" aria-label="${paid ? 'Mark unpaid' : 'Mark paid'}">${paid ? icon('check', 16) : ''}</button>
      <button class="grow plain" data-act="edit-bill" data-id="${b.id}"><b>${esc(b.name)}</b>
        <small class="${late ? 'red' : soon ? 'amber' : 'muted'}">${paid ? 'Paid' : late ? `Overdue · was due ${shortDate(due)}` : `Due ${shortDate(due)}`}</small></button>
      <div class="end-col"><span class="amt">${f.m(b.amount)}</span><small class="muted">${f.t(b.amount)}</small></div>
    </li>`;
  }).join('')}</ul>`;
}

function calendar(state, now) {
  const [y, m] = viewMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1).getDay();
  const ws = state.settings.weekStart;
  const lead = (first - ws + 7) % 7;
  const total = daysInMonth(y, m - 1);
  const today = dayKey(now);
  const set = new Set(state.noBuyDays);
  const spentDays = new Set(state.transactions.filter((t) => t.type === 'expense' && t.date.startsWith(viewMonth) && t.source !== 'bill').map((t) => t.date));
  const names = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const heads = Array.from({ length: 7 }, (_, i) => `<span class="dow">${names[(i + ws) % 7]}</span>`).join('');
  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<span></span>';
  for (let d = 1; d <= total; d++) {
    const key = `${viewMonth}-${String(d).padStart(2, '0')}`;
    const future = key > today;
    const on = set.has(key);
    cells += `<button class="day ${on ? 'on' : ''} ${key === today ? 'today' : ''} ${spentDays.has(key) ? 'spent' : ''}" data-act="nobuy" data-day="${key}"
      ${future ? 'disabled' : ''} aria-pressed="${on}" aria-label="${shortDate(key)}${on ? ', no-buy day' : ''}${spentDays.has(key) ? ', has spending' : ''}">${d}</button>`;
  }
  return `<div class="cal">${heads}${cells}</div>`;
}

function txList(txs, f) {
  const groups = new Map();
  for (const t of txs) {
    if (!groups.has(t.date)) groups.set(t.date, []);
    groups.get(t.date).push(t);
  }
  return [...groups.entries()].map(([date, list]) => `
    <h3 class="group-label">${relativeDay(date)}</h3>
    <ul class="list">${list.map((t) => `<li><button class="row-item plain" data-act="edit-tx" data-id="${t.id}">
      ${catChip(t.category)}
      <div class="grow"><b>${esc(t.name || category(t.category).label)}</b><small class="muted">${esc(category(t.category).label)}${t.source === 'bill' ? ' · bill' : t.source ? ' · Worth it?' : ''}</small></div>
      <div class="end-col"><span class="amt ${t.type === 'income' ? 'green' : ''}">${t.type === 'income' ? '+' : '−'}${f.m(t.amount)}</span><small class="muted">${f.t(t.amount)}</small></div>
    </button></li>`).join('')}</ul>`).join('');
}

// ---------- sheets ----------

function txSheet(type, tx = null) {
  const s = getState().settings;
  const income = (tx?.type || type) === 'income';
  const defaultDate = viewMonth === monthKey() ? dayKey() : `${viewMonth}-01`;
  openSheet(`${sheetHeader(tx ? 'Edit entry' : income ? 'Add income' : 'Add expense')}
    <form data-form="tx" class="stack" novalidate>
      <input type="hidden" name="id" value="${tx?.id || ''}">
      <input type="hidden" name="type" value="${income ? 'income' : 'expense'}">
      ${moneyInput('amount', s, tx?.amount ?? '', { big: true, autofocus: !tx, live: 'tx-live' })}
      <p class="muted small center" id="tx-live">${tx ? fx(s).t(tx.amount) : '&nbsp;'}</p>
      ${field('Name', `<input class="input" name="name" maxlength="80" value="${esc(tx?.name || '')}" placeholder="${income ? 'e.g. Paycheck' : 'e.g. Groceries at Aldi'}">`)}
      ${field('Category', categorySelect('category', tx?.category || (income ? 'paycheck' : 'food'), { income }))}
      ${field('Date', `<input class="input" type="date" name="date" value="${tx?.date || defaultDate}" max="${dayKey()}" required>`)}
      ${field('Note', `<input class="input" name="note" maxlength="300" value="${esc(tx?.note || '')}" placeholder="Optional">`)}
      <button class="btn primary block lg">${tx ? 'Save' : 'Add'}</button>
      ${tx ? `<button type="button" class="btn danger-ghost block" data-act="delete-tx" data-id="${tx.id}">${icon('trash', 16)} Delete</button>` : ''}
    </form>`);
}

function billSheet(bill = null) {
  const s = getState().settings;
  openSheet(`${sheetHeader(bill ? 'Edit bill' : 'Add a bill', 'Bills repeat every month. Check them off as you pay.')}
    <form data-form="bill" class="stack" novalidate>
      <input type="hidden" name="id" value="${bill?.id || ''}">
      ${field('Name', `<input class="input" name="name" maxlength="60" required value="${esc(bill?.name || '')}" placeholder="e.g. Rent, Phone, Netflix" ${bill ? '' : 'autofocus'}>`)}
      ${field('Amount', moneyInput('amount', s, bill?.amount ?? ''))}
      ${field('Due on day', `<input class="input" type="number" name="dueDay" min="1" max="31" value="${bill?.dueDay || 1}" required>`, 'Days past the end of a short month fall on its last day.')}
      ${field('Category', categorySelect('category', bill?.category || 'bills'))}
      <button class="btn primary block lg">${bill ? 'Save' : 'Add bill'}</button>
      ${bill ? `<button type="button" class="btn danger-ghost block" data-act="delete-bill" data-id="${bill.id}">${icon('trash', 16)} Delete bill</button>` : ''}
    </form>`);
}

function budgetSheet() {
  const s = getState().settings;
  openSheet(`${sheetHeader('Monthly budget', 'How much you plan to spend each month, bills included.')}
    <form data-form="budget" class="stack" novalidate>
      ${moneyInput('budget', s, s.monthlyBudget || '', { big: true, autofocus: true, live: 'tx-live', required: false })}
      <p class="muted small center" id="tx-live">${s.monthlyBudget ? `${fx(s).t(s.monthlyBudget)} of work` : '&nbsp;'}</p>
      <button class="btn primary block lg">Save budget</button>
      <p class="muted small center">Leave it empty to just track spending.</p>
    </form>`);
}

// ---------- handlers ----------

onInput({
  'tx-live': (el) => {
    const out = $('#tx-live');
    const s = getState().settings;
    const n = parseMoney(el.value);
    if (out) out.textContent = n > 0 && hasIncome(s) ? `${fx(s).t(n)} of work` : ' ';
  },
});

onForm({
  tx: (v) => {
    const amount = requireMoney(v.amount);
    if (v.date) viewMonth = v.date.slice(0, 7);
    if (v.id) commit((st) => updateTransaction(st, v.id, { amount, name: v.name, category: v.category, date: v.date, note: v.note }));
    else commit((st) => addTransaction(st, { type: v.type, amount, name: v.name, category: v.category, date: v.date, note: v.note }));
    closeSheet();
    toast(v.id ? 'Saved.' : v.type === 'income' ? 'Income added.' : 'Expense added.');
  },
  bill: (v) => {
    const amount = requireMoney(v.amount);
    commit((st) => saveBill(st, { ...v, amount }, v.id || null));
    closeSheet();
    toast(v.id ? 'Bill saved.' : 'Bill added.');
  },
  budget: (v) => {
    const raw = String(v.budget || '').trim();
    const amount = raw ? requireMoney(raw) : 0;
    commit((st) => { st.settings.monthlyBudget = amount; });
    closeSheet();
    toast('Budget saved.');
  },
});

onAct({
  'month-prev': () => { viewMonth = shiftMonth(viewMonth, -1); commit(() => {}); },
  'month-next': () => { if (viewMonth < monthKey()) { viewMonth = shiftMonth(viewMonth, 1); commit(() => {}); } },
  unit: (el) => commit((st) => { st.settings.showHours = el.dataset.v === 'hours' && hasIncome(st.settings); }),
  'edit-budget': budgetSheet,
  'add-tx': (el) => txSheet(el.dataset.type),
  'edit-tx': (el) => {
    const tx = getState().transactions.find((t) => t.id === el.dataset.id);
    if (tx) txSheet(tx.type, tx);
  },
  'delete-tx': async (el) => {
    const tx = getState().transactions.find((t) => t.id === el.dataset.id);
    if (!tx) return;
    const extra = tx.source === 'decision' ? ' Its Worth it? decision goes too.' : tx.source === 'bill' ? ' The bill goes back to unpaid.' : tx.source === 'cooldown' ? ' The item goes back on cooldown.' : '';
    if (!(await confirmBox(`Delete this entry?${extra}`, { ok: 'Delete', danger: true }))) return;
    commit((st) => deleteTransaction(st, tx.id));
    closeSheet();
  },
  'add-bill': () => billSheet(),
  'edit-bill': (el) => billSheet(getState().bills.find((b) => b.id === el.dataset.id)),
  'delete-bill': async (el) => {
    if (!(await confirmBox('Delete this bill? Payments you already logged stay in your history.', { ok: 'Delete', danger: true }))) return;
    commit((st) => deleteBill(st, el.dataset.id));
    closeSheet();
  },
  'bill-paid': (el) => {
    const { result } = commit((st) => toggleBillPaid(st, el.dataset.id, viewMonth));
    buzz(10);
    if (result) toast('Marked paid and added to spending.');
  },
  nobuy: (el) => {
    const key = el.dataset.day;
    const state = getState();
    const hadSpending = state.transactions.some((t) => t.type === 'expense' && t.date === key && t.source !== 'bill');
    const { result } = commit((st) => toggleNoBuy(st, key));
    buzz(10);
    if (result) toast(hadSpending ? 'Marked. Heads up: there’s spending logged that day.' : 'No-buy day! +15 points', { tone: hadSpending ? '' : 'good' });
  },
});
