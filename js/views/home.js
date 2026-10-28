// Home: the "Worth it?" analyzer, savings totals, today's challenge, quick status.
import { getState, commit } from '../store.js';
import {
  withSalesTax, workHours, investedInstead, savingsStats, shareOfMonth, budgetSummary, monthKey, decisionPoints,
} from '../calc.js';
import { decide, deleteDecision, addCooldown, isBlocked, rollChallenge, setChallengeStatus } from '../actions.js';
import { category, COOLDOWN_OPTIONS } from '../data.js';
import { relativeDay, countdown, pct } from '../format.js';
import { esc, icon, onAct, onForm, onInput, openSheet, closeSheet, sheetHeader, confirmBox, toast, confetti, buzz, $ } from '../ui.js';
import { fx, hasIncome, categorySelect, moneyInput, catChip, empty, parseMoney, requireMoney } from './common.js';

let pending = null; // the purchase being weighed in the result sheet

export function render(state) {
  const s = state.settings;
  const f = fx(s);
  const stats = savingsStats(state);
  const sum = budgetSummary(state, monthKey());
  const waiting = state.cooldown.filter((c) => c.status === 'waiting');
  const ready = waiting.filter((c) => Date.parse(c.until) <= Date.now());
  const recent = [...state.decisions].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);
  const block = state.shopBlock.active && isBlocked(state) ? state.shopBlock.active : null;

  return `
  ${!hasIncome(s) ? `<div class="banner warn">${icon('info', 18)}<span>Add your pay in Settings so prices can turn into work time.</span><a class="btn small" href="#settings">Set pay</a></div>` : ''}
  ${block ? `<a class="banner block" href="#save/block">${icon('shield', 18)}<span><b>Shop Block on</b> · ${countdown(Date.parse(block.end) - Date.now())} left</span></a>` : ''}

  <section class="card worth">
    <h1 class="worth-title">Worth it?</h1>
    <p class="muted">Type a price to see how long you'd work for it.</p>
    <form data-form="worth" class="worth-form" novalidate>
      ${moneyInput('price', s, '', { big: true, live: 'worth-live', placeholder: '0' })}
      <p class="worth-live" id="worth-live" aria-live="polite">&nbsp;</p>
      <details class="worth-more">
        <summary>Name it &amp; pick a category</summary>
        <div class="stack">
          <input class="input" name="name" placeholder="What is it? (optional)" maxlength="80" autocomplete="off">
          ${categorySelect('category', 'shopping')}
        </div>
      </details>
      <button class="btn primary block lg">Check it</button>
    </form>
  </section>

  <section class="stat-grid" aria-label="Your savings">
    <div class="stat green"><span class="stat-label">Money saved</span><b>${f.mc(stats.saved)}</b><span class="stat-sub">${stats.skipCount} bye${stats.skipCount === 1 ? '' : 's'}</span></div>
    <div class="stat yellow"><span class="stat-label">Work time saved</span><b>${stats.hours ? f.h(stats.hours) : '0 hrs'}</b><span class="stat-sub">hours you keep</span></div>
    <button class="stat blue" data-act="invest-info"><span class="stat-label">If invested ${icon('info', 14)}</span><b>${f.mc(stats.invested)}</b><span class="stat-sub">in ${stats.years} yrs at ${s.returnRate}%</span></button>
  </section>

  ${challengeCard(state)}

  <section class="quick-grid">
    <a class="quick" href="#save/cooldown">
      <span class="quick-icon">${icon('snow')}</span>
      <span><b>Cooldown</b><small>${ready.length ? `<span class="pill green">${ready.length} ready to decide</span>` : waiting.length ? `${waiting.length} waiting` : 'Nothing waiting'}</small></span>
    </a>
    <a class="quick" href="#budget">
      <span class="quick-icon">${icon('wallet')}</span>
      <span><b>${s.monthlyBudget > 0 ? (sum.left >= 0 ? `${f.mc(sum.left)} left` : `${f.mc(-sum.left)} over`) : 'Budget'}</b>
      <small>${s.monthlyBudget > 0 ? `this month · ${f.mc(sum.perDay)}/day` : 'Set a monthly budget'}</small></span>
    </a>
  </section>

  <section class="section">
    <div class="section-head"><h2>Recent decisions</h2>${state.decisions.length > 5 ? '<button class="link" data-act="all-decisions">See all</button>' : ''}</div>
    ${recent.length ? `<ul class="list">${recent.map((d) => decisionRow(d, f)).join('')}</ul>`
      : empty('🛍️', 'Nothing weighed yet', 'Check a price above. Every bye you choose adds to your savings.')}
  </section>`;
}

function decisionRow(d, f, { removable = false } = {}) {
  const skip = d.verdict === 'skip';
  return `<li class="row-item">
    ${catChip(d.category)}
    <div class="grow"><b>${esc(d.name || category(d.category).label)}</b><small class="muted">${relativeDay(d.date)} · ${f.t(d.total)}</small></div>
    <div class="end-col"><span class="amt ${skip ? 'green' : 'red'}">${skip ? '' : '−'}${f.m(d.total)}</span><span class="pill ${skip ? 'green' : 'gray'}">${skip ? 'Bye 👋' : 'Bought'}</span></div>
    ${removable ? `<button class="icon-btn" data-act="delete-decision" data-id="${d.id}" aria-label="Delete">${icon('trash', 18)}</button>` : ''}
  </li>`;
}

function challengeCard(state) {
  const t = state.challenge.today;
  const canShake = 'DeviceMotionEvent' in window && matchMedia('(pointer: coarse)').matches;
  const needsPerm = canShake && typeof DeviceMotionEvent.requestPermission === 'function' && !window.__shakeOn;
  const today = t;
  if (!today || today.status === 'offered') {
    return `<section class="card challenge">
      <div class="challenge-top"><span class="challenge-icon">${icon('dice')}</span>
        <div class="grow"><h3>Daily challenge</h3>
        <p class="muted">${today ? esc(today.text) : `${canShake && !needsPerm ? 'Shake your phone or tap' : 'Tap'} for a small money challenge. Finish it for 20 points.`}</p></div></div>
      <div class="row gap">
        ${today ? '<button class="btn primary" data-act="challenge-accept">I’m in</button>' : ''}
        <button class="btn ${today ? 'ghost' : 'primary'}" data-act="challenge-roll">${today ? 'Shuffle' : 'Give me one'}</button>
        ${needsPerm ? '<button class="btn ghost" data-act="enable-shake">Enable shake</button>' : ''}
      </div></section>`;
  }
  const done = today.status === 'done';
  const missed = today.status === 'missed';
  return `<section class="card challenge ${done ? 'done' : ''}">
    <div class="challenge-top"><span class="challenge-icon">${done ? icon('check') : icon('dice')}</span>
      <div class="grow"><h3>${done ? 'Challenge done' : missed ? 'Not today' : 'Today’s challenge'}</h3><p>${esc(today.text)}</p></div></div>
    ${today.status === 'accepted' ? `<div class="row gap"><button class="btn primary" data-act="challenge-done">I did it</button><button class="btn ghost" data-act="challenge-miss">Didn’t happen</button></div>`
      : `<p class="muted small">${done ? '+20 points. A new challenge unlocks tomorrow.' : 'A new challenge unlocks tomorrow.'}</p>`}
  </section>`;
}

// ---------- result sheet ----------

function resultSheet(p) {
  const state = getState();
  const s = state.settings;
  const f = fx(s);
  const hours = workHours(p.total, s);
  const inv = investedInstead(p.total, s);
  const share = shareOfMonth(hours, s);
  const blocked = isBlocked(state);
  const cool = s.cooldownMode;
  return `${sheetHeader(p.name || 'Worth it?')}
  <div class="result">
    <p class="result-price">${f.m(p.price)}${p.total !== p.price ? ` <span class="muted small">${f.m(p.total)} with tax</span>` : ''}</p>
    <div class="result-time">
      <span class="label">Time at work</span>
      <strong>${hasIncome(s) ? f.t(p.total) : '—'}</strong>
      ${hasIncome(s) ? `<span class="muted">${share >= 0.01 ? `${pct(share)} of a month’s work` : 'a small slice of your day'}</span>` : '<a href="#settings" data-act="close-sheet">Add your pay to see this</a>'}
    </div>
    <div class="result-invest">
      <span class="label">Invested instead ${icon('info', 14)}</span>
      <strong>${f.m(Math.round(inv.value))}</strong>
      <span class="muted">${inv.age != null ? `by age ${inv.age + inv.years}` : `in ${inv.years} years`} at ${s.returnRate}% a year</span>
    </div>
    ${blocked ? `<div class="banner block small">${icon('shield', 16)}<span>You’re in a Shop Block. Sure about this one?</span></div>` : ''}
    <div class="result-actions">
      <button class="btn green lg" data-act="decide-skip">Bye 👋 <span class="btn-sub">Don’t buy · +${decisionPoints(hours)} pts</span></button>
      ${cool
        ? `<button class="btn ghost lg" data-act="decide-cooldown">${icon('snow', 18)} Cool down first</button>
           <button class="link center" data-act="decide-buy">Buy it now anyway</button>`
        : `<button class="btn ghost lg" data-act="decide-buy">Buy</button>
           <button class="link center" data-act="decide-cooldown">${icon('snow', 16)} Sleep on it (${esc(COOLDOWN_OPTIONS.find((o) => o.hours === s.cooldownHours)?.label || `${s.cooldownHours} hours`)})</button>`}
    </div>
  </div>`;
}

export function openWorth(price, name = '', cat = 'shopping', url = '') {
  const s = getState().settings;
  pending = { price, total: withSalesTax(price, s), name, category: cat, url };
  openSheet(resultSheet(pending));
}

function finishDecision() {
  closeSheet();
  pending = null;
  const form = $('form[data-form="worth"]');
  if (form) { form.reset(); $('#worth-live').innerHTML = '&nbsp;'; }
}

function investInfo() {
  const s = getState().settings;
  const f = fx(s);
  const inv = investedInstead(100, s);
  openSheet(`${sheetHeader('About “invested instead”')}
    <div class="prose">
      <p>This shows what money you don’t spend could grow into if you put it in a broad index fund and left it alone until you retire.</p>
      <p>We use compound growth: <b>amount × (1 + rate)<sup>years</sup></b>. With your settings, ${f.m(100)} becomes about <b>${f.m(Math.round(inv.value))}</b> after ${inv.years} years at ${s.returnRate}% a year.</p>
      <p>${s.birthday ? `Years run from your age now to your retirement age (${s.retirementAge}).` : 'Add your birthday in Settings to count years until your retirement age. Without it we use 30 years.'}</p>
      <p>The US stock market has averaged roughly 10% a year before inflation over the long run, or about 7% after it. Returns are never guaranteed, and some years lose money.</p>
      <p class="muted small">This is an illustration, not financial advice.</p>
      <a class="btn ghost block" href="#settings" data-act="close-sheet">Change rate or retirement age</a>
    </div>`);
}

function allDecisions() {
  const state = getState();
  const f = fx(state.settings);
  const list = [...state.decisions].sort((a, b) => b.at.localeCompare(a.at));
  const st = savingsStats(state);
  openSheet(`${sheetHeader('All decisions', `${st.skipCount} byes · ${st.buyCount} buys`)}
    ${list.length ? `<ul class="list">${list.map((d) => decisionRow(d, f, { removable: true })).join('')}</ul>` : empty('🛍️', 'No decisions yet')}`,
  );
}

function celebrate(points, msg) {
  confetti();
  buzz([10, 40, 20]);
  toast(points ? `${msg} +${points} points` : msg, { tone: 'good' });
}

// ---------- handlers ----------

onInput({
  'worth-live': (el) => {
    const out = $('#worth-live');
    if (!out) return;
    const s = getState().settings;
    const price = parseMoney(el.value);
    if (!(price > 0) || !hasIncome(s)) { out.innerHTML = '&nbsp;'; return; }
    out.textContent = `≈ ${fx(s).t(withSalesTax(price, s))} of work`;
  },
});

onForm({
  worth: (v) => {
    const price = requireMoney(v.price, 'a price');
    openWorth(price, (v.name || '').trim(), v.category || 'shopping');
  },
});

onAct({
  'invest-info': investInfo,
  'all-decisions': allDecisions,
  'decide-skip': () => {
    if (!pending) return;
    const p = pending;
    const { result } = commit((st) => decide(st, p, 'skip'));
    finishDecision();
    celebrate(result.pts, `Bye${p.name ? `, ${p.name}` : ''}! You kept ${fx(getState().settings).t(p.total)}.`);
  },
  'decide-buy': async () => {
    if (!pending) return;
    const p = pending;
    const state = getState();
    if (isBlocked(state)) {
      const ok = await confirmBox('Your Shop Block is still running. Buying now gets noted on this block.', { ok: 'Buy anyway', title: 'Shop Block is on', danger: true });
      if (!ok) return;
      commit((st) => { st.shopBlock.active.overrides++; });
    }
    commit((st) => decide(st, p, 'buy'));
    finishDecision();
    toast(`Logged ${fx(getState().settings).m(p.total)} in this month’s budget.`);
  },
  'decide-cooldown': () => {
    if (!pending) return;
    const p = pending;
    const { result } = commit((st) => addCooldown(st, { ...p, hours: st.settings.cooldownHours }));
    finishDecision();
    toast(`On ice until ${new Date(result.until).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}. We’ll ask again then.`);
  },
  'delete-decision': async (el) => {
    const ok = await confirmBox('Delete this decision? A purchase also comes off your budget.', { ok: 'Delete', danger: true });
    if (!ok) return;
    commit((st) => deleteDecision(st, el.dataset.id));
    allDecisions();
  },
  'challenge-roll': () => {
    commit((st) => rollChallenge(st));
    buzz(15);
  },
  'challenge-accept': () => { commit((st) => setChallengeStatus(st, 'accepted')); toast('You’re on. Come back and check it off.'); },
  'challenge-done': () => {
    const { result } = commit((st) => setChallengeStatus(st, 'done'));
    celebrate(result, 'Challenge complete!');
  },
  'challenge-miss': () => { commit((st) => setChallengeStatus(st, 'missed')); toast('No worries. New one tomorrow.'); },
});
