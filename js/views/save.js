// Save: goals, the 100 Envelope Challenge, cooldown list, Shop Block.
import { getState, commit } from '../store.js';
import {
  goalProgress, goalSaved, envelopeTotal, envelopeGoal, envelopeValue, randomEmptyEnvelope, ENVELOPE_COUNT, dayKey, round2, workHours,
} from '../calc.js';
import {
  saveGoal, deleteGoal, deposit, toggleEnvelope, addCooldown, resolveCooldown, deleteCooldown, startBlock, endBlockEarly, isBlocked,
} from '../actions.js';
import { GOAL_TEMPLATES, GOAL_EMOJIS, COOLDOWN_OPTIONS, BLOCK_OPTIONS } from '../data.js';
import { countdown, shortDate, pct } from '../format.js';
import { esc, icon, onAct, onForm, openSheet, closeSheet, sheetHeader, confirmBox, toast, confetti, buzz } from '../ui.js';
import { progressBar } from '../charts.js';
import { fx, moneyInput, field, categorySelect, empty, requireMoney, catChip } from './common.js';

const TABS = [
  { id: 'goals', label: 'Goals' },
  { id: 'envelopes', label: 'Envelopes' },
  { id: 'cooldown', label: 'Cooldown' },
  { id: 'block', label: 'Shop Block' },
];

export function render(state, sub = 'goals') {
  if (!TABS.some((t) => t.id === sub)) sub = 'goals';
  const waitingReady = state.cooldown.filter((c) => c.status === 'waiting' && Date.parse(c.until) <= Date.now()).length;
  const tabs = `<nav class="seg" role="tablist" aria-label="Savings tools">${TABS.map((t) => `<a role="tab" href="#save/${t.id}" class="${t.id === sub ? 'on' : ''}" aria-selected="${t.id === sub}">${t.label}${t.id === 'cooldown' && waitingReady ? ' <i class="dot"></i>' : ''}${t.id === 'block' && isBlocked(state) ? ' <i class="dot"></i>' : ''}</a>`).join('')}</nav>`;
  const body = { goals, envelopes, cooldown, block }[sub](state);
  return `${tabs}${body}`;
}

// ---------- goals ----------

function goals(state) {
  const f = fx(state.settings);
  const total = round2(state.goals.reduce((a, g) => a + goalSaved(g), 0));
  const target = round2(state.goals.reduce((a, g) => a + g.target, 0));
  return `
  ${state.goals.length ? `<section class="card summary">
    <span class="label">Saved across goals</span>
    <b class="big-num">${f.m(total)}</b>
    ${progressBar(target ? total / target : 0)}
    <span class="muted small">${f.m(target)} total target · ${f.t(total)} of work set aside</span>
  </section>` : ''}
  <section class="section">
    <div class="section-head"><h2>Savings goals</h2><button class="link" data-act="new-goal">${icon('plus', 16)} New goal</button></div>
    ${state.goals.length ? `<div class="goal-grid">${state.goals.map((g) => goalCard(g, f)).join('')}</div>`
      : empty('🎯', 'No goals yet', 'Name something you’re saving for. Skipped purchases feel better when they go somewhere.', '<button class="btn primary" data-act="new-goal">Create a goal</button>')}
  </section>`;
}

function goalCard(g, f) {
  const p = goalProgress(g);
  return `<button class="goal-card ${p.done ? 'done' : ''}" data-act="open-goal" data-id="${g.id}">
    <span class="goal-emoji" aria-hidden="true">${esc(g.emoji)}</span>
    <b>${esc(g.name)}</b>
    <span class="muted small">${f.m(p.saved)} of ${f.m(g.target)}</span>
    ${progressBar(p.pct, p.done ? 'var(--accent-strong)' : 'var(--green)')}
    <span class="small">${p.done ? '🎉 Reached!' : `${f.t(p.remaining)} of work to go`}</span>
    ${p.perMonth != null ? `<span class="muted small">${f.m(Math.ceil(p.perMonth))}/mo until ${shortDate(g.deadline)}</span>` : ''}
  </button>`;
}

function goalSheet(id) {
  const state = getState();
  const g = state.goals.find((x) => x.id === id);
  if (!g) return closeSheet();
  const f = fx(state.settings);
  const p = goalProgress(g);
  const history = [...g.deposits].reverse().slice(0, 30);
  openSheet(`${sheetHeader(`${g.emoji} ${g.name}`, `${f.m(p.saved)} of ${f.m(g.target)} · ${pct(p.pct)}`)}
    ${progressBar(p.pct)}
    ${p.perMonth != null ? `<p class="muted small">Save about ${f.m(Math.ceil(p.perMonth))} a month to hit it by ${shortDate(g.deadline)}.</p>` : ''}
    <form data-form="deposit" class="stack" novalidate>
      <input type="hidden" name="id" value="${g.id}">
      <div class="seg small" role="radiogroup">
        <label><input type="radio" name="dir" value="in" checked><span>Add money</span></label>
        <label><input type="radio" name="dir" value="out"><span>Take out</span></label>
      </div>
      ${moneyInput('amount', state.settings, '', { big: true })}
      <input class="input" name="note" maxlength="80" placeholder="Note (optional)">
      <button class="btn primary block lg">Save</button>
    </form>
    ${history.length ? `<h3 class="group-label">History</h3><ul class="list">${history.map((d) => `<li class="row-item"><div class="grow"><b>${d.amount > 0 ? 'Added' : 'Took out'}</b><small class="muted">${shortDate(d.date)}${d.note ? ` · ${esc(d.note)}` : ''}</small></div><span class="amt ${d.amount > 0 ? 'green' : 'red'}">${d.amount > 0 ? '+' : '−'}${f.m(Math.abs(d.amount))}</span></li>`).join('')}</ul>` : ''}
    <div class="row gap two">
      <button class="btn ghost" data-act="edit-goal" data-id="${g.id}">${icon('edit', 16)} Edit</button>
      <button class="btn danger-ghost" data-act="delete-goal" data-id="${g.id}">${icon('trash', 16)} Delete</button>
    </div>`);
}

function goalForm(g = null) {
  const s = getState().settings;
  const emoji = g?.emoji || '🎯';
  openSheet(`${sheetHeader(g ? 'Edit goal' : 'New goal')}
    ${g ? '' : `<div class="chips">${GOAL_TEMPLATES.map((t, i) => `<button type="button" class="chip" data-act="goal-template" data-i="${i}">${t.emoji} ${esc(t.name)}</button>`).join('')}</div>`}
    <form data-form="goal" class="stack" novalidate>
      <input type="hidden" name="id" value="${g?.id || ''}">
      <fieldset class="emoji-pick"><legend class="label">Icon</legend>${GOAL_EMOJIS.map((e) => `<label><input type="radio" name="emoji" value="${e}" ${e === emoji ? 'checked' : ''}><span>${e}</span></label>`).join('')}</fieldset>
      ${field('Name', `<input class="input" name="name" maxlength="60" required value="${esc(g?.name || '')}" placeholder="e.g. Trip to Japan">`)}
      ${field('Target', moneyInput('target', s, g?.target ?? ''))}
      ${field('Target date', `<input class="input" type="date" name="deadline" value="${g?.deadline || ''}" min="${dayKey()}">`, 'Optional. We’ll work out how much to save each month.')}
      <button class="btn primary block lg">${g ? 'Save' : 'Create goal'}</button>
    </form>`);
}

// ---------- envelopes ----------

function envelopes(state) {
  const f = fx(state.settings);
  const env = state.envelopes;
  const filled = new Set(env.filled);
  const saved = envelopeTotal(env.filled, env.multiplier);
  const goal = envelopeGoal(env.multiplier);
  const mults = [0.25, 0.5, 1, 2, 5, 10];
  let grid = '';
  for (let n = 1; n <= ENVELOPE_COUNT; n++) {
    const on = filled.has(n);
    grid += `<button class="env ${on ? 'on' : ''}" data-act="envelope" data-n="${n}" aria-pressed="${on}" aria-label="Envelope ${n}, ${f.m(envelopeValue(n, env.multiplier))}${on ? ', filled' : ''}">${on ? '✓' : n}</button>`;
  }
  return `
  <section class="card summary">
    <span class="label">100 Envelope Challenge</span>
    <b class="big-num">${f.m(saved)} <span class="muted small">of ${f.m(goal)}</span></b>
    ${progressBar(saved / goal, 'var(--accent-strong)')}
    <span class="muted small">${env.filled.length} of 100 envelopes · envelope <i>n</i> holds ${env.multiplier === 1 ? '' : `${env.multiplier} × `}<i>n</i></span>
  </section>
  <div class="row gap two">
    <button class="btn primary" data-act="envelope-random" ${env.filled.length >= 100 ? 'disabled' : ''}>${icon('dice', 18)} Pick for me</button>
    <label class="select-wrap"><span class="sr-only">Envelope size</span>
      <select class="input" data-change="envelope-mult">${mults.map((m) => `<option value="${m}" ${m === env.multiplier ? 'selected' : ''}>${m === 1 ? 'Classic' : `${m}×`} · ${f.mw(envelopeGoal(m))}</option>`).join('')}</select>
    </label>
  </div>
  <div class="env-grid">${grid}</div>
  <p class="muted small">Each envelope is numbered 1 to 100. Fill one by setting aside that amount, in any order. All 100 adds up to ${f.m(goal)}.</p>`;
}

// ---------- cooldown ----------

function cooldown(state) {
  const s = state.settings;
  const f = fx(s);
  const now = Date.now();
  const waiting = state.cooldown.filter((c) => c.status === 'waiting').sort((a, b) => a.until.localeCompare(b.until));
  const done = state.cooldown.filter((c) => c.status !== 'waiting').sort((a, b) => (b.decidedAt || '').localeCompare(a.decidedAt || ''));
  const skipped = done.filter((c) => c.status === 'skipped');
  const skippedTotal = round2(skipped.reduce((a, c) => a + c.total, 0));
  return `
  <section class="card">
    <div class="row between"><div><h3>Cooldown mode</h3><p class="muted small">When on, “Buy” in Worth it? waits first.</p></div>
      <label class="switch"><input type="checkbox" data-change="cooldown-mode" ${s.cooldownMode ? 'checked' : ''}><span></span><span class="sr-only">Cooldown mode</span></label></div>
    <label class="field inline"><span class="label">Wait time</span>
      <select class="input" data-change="cooldown-hours">${COOLDOWN_OPTIONS.map((o) => `<option value="${o.hours}" ${o.hours === s.cooldownHours ? 'selected' : ''}>${o.label}</option>`).join('')}</select></label>
  </section>

  <section class="section">
    <div class="section-head"><h2>Waiting</h2><button class="link" data-act="add-cooldown">${icon('plus', 16)} Add item</button></div>
    ${waiting.length ? `<ul class="list">${waiting.map((c) => {
      const left = Date.parse(c.until) - now;
      const span = Date.parse(c.until) - Date.parse(c.created);
      const ready = left <= 0;
      return `<li class="cool-item ${ready ? 'ready' : ''}">
        <div class="row gap">${catChip(c.category)}
          <div class="grow"><b>${esc(c.name)}</b><small class="muted">${f.m(c.total)} · ${f.t(c.total)}${c.url ? ` · <a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">link</a>` : ''}</small></div>
          <button class="icon-btn" data-act="delete-cooldown" data-id="${c.id}" aria-label="Remove">${icon('x', 18)}</button></div>
        ${ready ? `<p class="ready-text">Cooldown’s over. Still want it?</p>
          <div class="row gap two"><button class="btn green" data-act="cool-skip" data-id="${c.id}">Bye 👋</button><button class="btn ghost" data-act="cool-buy" data-id="${c.id}">Buy it</button></div>`
          : `${progressBar(1 - left / span, 'var(--blue)')}<div class="row between small muted"><span>${icon('clock', 14)} ${countdown(left)} left</span><button class="link small" data-act="cool-skip" data-id="${c.id}">Skip it now</button></div>`}
      </li>`;
    }).join('')}</ul>` : empty('🧊', 'Nothing cooling', 'Put something you want here and decide once the urge fades. Most of the time, it does.')}
  </section>

  ${done.length ? `<section class="section">
    <div class="section-head"><h2>Decided</h2><span class="muted small">${skipped.length} skipped · ${f.m(skippedTotal)} kept</span></div>
    <ul class="list">${done.slice(0, 20).map((c) => `<li class="row-item">${catChip(c.category)}<div class="grow"><b>${esc(c.name)}</b><small class="muted">${c.decidedAt ? shortDate(c.decidedAt.slice(0, 10)) : ''}</small></div>
      <span class="pill ${c.status === 'skipped' ? 'green' : 'gray'}">${c.status === 'skipped' ? 'Skipped' : 'Bought'} ${f.m(c.total)}</span></li>`).join('')}</ul>
  </section>` : ''}`;
}

function cooldownForm() {
  const s = getState().settings;
  openSheet(`${sheetHeader('Add to cooldown', 'Wait before you buy. We’ll remind you when time’s up.')}
    <form data-form="cooldown" class="stack" novalidate>
      ${field('What is it?', '<input class="input" name="name" maxlength="80" required placeholder="e.g. Wireless earbuds" autofocus>')}
      ${field('Price', moneyInput('price', s, ''))}
      ${field('Link', '<input class="input" type="url" name="url" placeholder="https://… (optional)">')}
      ${field('Category', categorySelect('category', 'shopping'))}
      ${field('Wait', `<select class="input" name="hours">${COOLDOWN_OPTIONS.map((o) => `<option value="${o.hours}" ${o.hours === s.cooldownHours ? 'selected' : ''}>${o.label}</option>`).join('')}</select>`)}
      <button class="btn primary block lg">Start cooldown</button>
    </form>`);
}

// ---------- shop block ----------

function block(state) {
  const a = state.shopBlock.active;
  const history = [...state.shopBlock.history].reverse().slice(0, 10);
  const done = state.shopBlock.history.filter((h) => h.result === 'done').length;
  const note = `<p class="muted small">A web app can’t lock other apps or sites. Shop Block is a promise with a timer: while it runs, Hourwise flags every purchase you try to log, and finishing earns points. For a hard lock, pair it with Screen Time on iPhone, Digital Wellbeing on Android, or a site-blocker extension on your computer.</p>`;
  if (a && isBlocked(state)) {
    const total = Date.parse(a.end) - Date.parse(a.start);
    const left = Date.parse(a.end) - Date.now();
    return `<section class="card block-live">
      <span class="block-shield">${icon('shield', 40)}</span>
      <h2>Shop Block is on</h2>
      <b class="big-num">${countdown(left)}</b>
      <span class="muted">until ${new Date(a.end).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</span>
      ${progressBar(1 - left / total, 'var(--blue)')}
      ${a.shops.length ? `<div class="chips">${a.shops.map((s) => `<span class="chip static">🚫 ${esc(s)}</span>`).join('')}</div>` : ''}
      ${a.overrides ? `<p class="small amber">${a.overrides} purchase${a.overrides === 1 ? '' : 's'} logged during this block.</p>` : ''}
      <button class="btn danger-ghost" data-act="block-end">End early</button>
    </section>${note}`;
  }
  return `<section class="card">
    <h2>Start a Shop Block</h2>
    <p class="muted">Pick how long you’ll stay out of stores and shopping apps.</p>
    <form data-form="block" class="stack" novalidate>
      <div class="seg wrap" role="radiogroup" aria-label="Length">${BLOCK_OPTIONS.map((o, i) => `<label><input type="radio" name="hours" value="${o.hours}" ${i === 2 ? 'checked' : ''}><span>${o.label}</span></label>`).join('')}</div>
      ${field('Stores to avoid', '<input class="input" name="shops" maxlength="400" placeholder="e.g. Amazon, Shein, Target">', 'Separate with commas. Optional.')}
      <button class="btn primary block lg">${icon('shield', 18)} Start block</button>
    </form>
  </section>
  ${note}
  ${history.length ? `<section class="section"><div class="section-head"><h2>Past blocks</h2><span class="muted small">${done} finished</span></div>
    <ul class="list">${history.map((h) => `<li class="row-item"><span class="cat-dot" style="--c:${h.result === 'done' ? 'var(--green)' : 'var(--red)'}">${h.result === 'done' ? '🛡️' : '💔'}</span>
      <div class="grow"><b>${h.result === 'done' ? 'Finished' : 'Ended early'}</b><small class="muted">${shortDate(h.start.slice(0, 10))} · ${countdown(Date.parse(h.end) - Date.parse(h.start))}</small></div></li>`).join('')}</ul></section>` : ''}`;
}

// ---------- handlers ----------

onForm({
  goal: (v) => {
    const target = requireMoney(v.target, 'a target');
    const { result } = commit((st) => saveGoal(st, { ...v, target }, v.id || null));
    if (v.id) goalSheet(v.id);
    else { closeSheet(); toast(`${result.emoji} ${result.name} created.`); }
  },
  deposit: (v) => {
    const amount = requireMoney(v.amount);
    const before = goalProgress(getState().goals.find((g) => g.id === v.id)).done;
    commit((st) => deposit(st, v.id, v.dir === 'out' ? -amount : amount, v.note));
    const g = getState().goals.find((x) => x.id === v.id);
    goalSheet(v.id);
    buzz(12);
    if (!before && goalProgress(g).done) { confetti(60); toast(`You reached ${g.name}! 🎉`, { tone: 'good' }); }
    else toast(v.dir === 'out' ? 'Taken out.' : `Added. ${fx(getState().settings).t(amount)} of work set aside.`);
  },
  cooldown: (v) => {
    const price = requireMoney(v.price, 'a price');
    commit((st) => addCooldown(st, { ...v, price, hours: Number(v.hours) }));
    closeSheet();
    toast('Cooling down. We’ll check back when time’s up.');
  },
  block: (v) => {
    const shops = String(v.shops || '').split(',').map((x) => x.trim()).filter(Boolean);
    commit((st) => startBlock(st, Number(v.hours), shops));
    buzz([10, 30, 10]);
    toast('Shop Block started. You’ve got this.', { tone: 'good' });
  },
});

onAct({
  'new-goal': () => goalForm(),
  'open-goal': (el) => goalSheet(el.dataset.id),
  'edit-goal': (el) => goalForm(getState().goals.find((g) => g.id === el.dataset.id)),
  'delete-goal': async (el) => {
    if (!(await confirmBox('Delete this goal and its history?', { ok: 'Delete', danger: true }))) return;
    commit((st) => deleteGoal(st, el.dataset.id));
    closeSheet();
  },
  'goal-template': (el) => {
    const t = GOAL_TEMPLATES[Number(el.dataset.i)];
    const form = document.querySelector('form[data-form="goal"]');
    if (!t || !form) return;
    form.elements.name.value = t.name;
    form.elements.target.value = t.target;
    const radio = [...form.elements.emoji].find((r) => r.value === t.emoji);
    if (radio) radio.checked = true;
    form.elements.target.focus();
  },
  envelope: async (el) => {
    const n = Number(el.dataset.n);
    const state = getState();
    const f = fx(state.settings);
    const value = envelopeValue(n, state.envelopes.multiplier);
    if (state.envelopes.filled.includes(n)) {
      if (!(await confirmBox(`Empty envelope ${n} (${f.m(value)})?`, { ok: 'Empty it' }))) return;
      commit((st) => toggleEnvelope(st, n));
      return;
    }
    commit((st) => toggleEnvelope(st, n));
    buzz(12);
    toast(`Envelope ${n}: ${f.m(value)} saved. +5 points`, { tone: 'good' });
    if (getState().envelopes.filled.length === 100) confetti(80);
  },
  'envelope-random': async () => {
    const state = getState();
    const n = randomEmptyEnvelope(state.envelopes.filled);
    if (!n) return;
    const f = fx(state.settings);
    const value = envelopeValue(n, state.envelopes.multiplier);
    if (!(await confirmBox(`Set aside ${f.m(value)} (about ${f.h(workHours(value, state.settings))} of work), then fill it.`, { title: `Envelope ${n}`, ok: 'Filled it' }))) return;
    commit((st) => toggleEnvelope(st, n));
    toast(`Envelope ${n} filled. +5 points`, { tone: 'good' });
  },
  'envelope-mult': (el) => commit((st) => { st.envelopes.multiplier = Number(el.value); }),
  'cooldown-mode': (el) => {
    commit((st) => { st.settings.cooldownMode = el.checked; });
    toast(el.checked ? 'Cooldown mode on. Buys wait first.' : 'Cooldown mode off.');
  },
  'cooldown-hours': (el) => commit((st) => { st.settings.cooldownHours = Number(el.value); }),
  'add-cooldown': cooldownForm,
  'delete-cooldown': async (el) => {
    if (!(await confirmBox('Remove this from cooldown without deciding?', { ok: 'Remove' }))) return;
    commit((st) => deleteCooldown(st, el.dataset.id));
  },
  'cool-skip': (el) => {
    const { result } = commit((st) => resolveCooldown(st, el.dataset.id, 'skipped'));
    if (!result) return;
    confetti();
    buzz([10, 40, 20]);
    toast(`Skipped ${result.item.name}. +${result.points} points`, { tone: 'good' });
  },
  'cool-buy': async (el) => {
    const state = getState();
    if (isBlocked(state)) {
      if (!(await confirmBox('Your Shop Block is still running. Buy anyway?', { ok: 'Buy anyway', danger: true }))) return;
      commit((st) => { st.shopBlock.active.overrides++; });
    }
    const { result } = commit((st) => resolveCooldown(st, el.dataset.id, 'bought'));
    if (result) toast(`Logged ${fx(getState().settings).m(result.item.total)} in your budget.`);
  },
  'block-end': async () => {
    if (!(await confirmBox('End your Shop Block early? It won’t count as finished.', { ok: 'End it', danger: true }))) return;
    commit((st) => endBlockEarly(st));
  },
});
