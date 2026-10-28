// First-run setup: pay, birthday, currency, budget, goals, then a quick try.
import { getState, commit } from '../store.js';
import { hourlyRate, num, clamp, dayKey, investedInstead } from '../calc.js';
import { saveGoal, award } from '../actions.js';
import { CURRENCIES, guessCurrency, money, currencySymbol } from '../format.js';
import { GOAL_TEMPLATES } from '../data.js';
import { esc, onAct, onForm, onInput, $, formValues, toast, confetti } from '../ui.js';
import { pigBadge } from '../pig.js';
import { fx, parseMoney } from './common.js';

let step = 0;
let draft = null;
const STEPS = 6;

function freshDraft() {
  const s = getState().settings;
  return {
    incomeType: s.incomeType,
    hourlyRate: s.hourlyRate,
    salary: s.salary,
    hoursPerWeek: s.hoursPerWeek,
    daysPerWeek: s.daysPerWeek,
    birthday: s.birthday,
    currency: getState().onboarded || s.currency !== 'USD' ? s.currency : guessCurrency(),
    monthlyBudget: s.monthlyBudget,
    goals: [],
  };
}

export function show() {
  draft = freshDraft();
  step = 0;
  paint();
}

export function hide() {
  const el = $('#onboarding');
  el.hidden = true;
  el.innerHTML = '';
  document.body.classList.remove('onboarding-open');
}

function dots() {
  return `<div class="ob-dots" aria-hidden="true">${Array.from({ length: STEPS }, (_, i) => `<i class="${i === step ? 'on' : i < step ? 'past' : ''}"></i>`).join('')}</div>`;
}

function paint() {
  const el = $('#onboarding');
  el.hidden = false;
  document.body.classList.add('onboarding-open');
  const sym = esc(currencySymbol(draft.currency));
  const back = step > 0 ? '<button type="button" class="btn ghost" data-act="ob-back">Back</button>' : '';
  let body = '';

  if (step === 0) {
    body = `<div class="ob-hero">${pigBadge('happy', 120)}</div>
      <h1>Every price costs time.</h1>
      <p class="lead">Hourwise turns prices into the hours you’d work to pay for them, so you can tell what’s really worth it.</p>
      <p class="muted">Takes about a minute to set up. Your data never leaves this device.</p>
      <div class="ob-actions"><button class="btn primary lg block">Let’s go</button></div>`;
  } else if (step === 1) {
    body = `<h2>How are you paid?</h2>
      <p class="muted">We use this to turn prices into work time. Allowance or gig money works too.</p>
      <div class="seg" role="radiogroup">
        <label><input type="radio" name="incomeType" value="hourly" ${draft.incomeType === 'hourly' ? 'checked' : ''} data-input="ob-type"><span>By the hour</span></label>
        <label><input type="radio" name="incomeType" value="salary" ${draft.incomeType === 'salary' ? 'checked' : ''} data-input="ob-type"><span>Yearly salary</span></label>
      </div>
      <label class="money-field big"><span class="sym">${sym}</span>
        <input class="input" name="amount" inputmode="decimal" autocomplete="off" required autofocus
          value="${draft.incomeType === 'salary' ? draft.salary : draft.hourlyRate}" aria-label="${draft.incomeType === 'salary' ? 'Yearly salary' : 'Hourly rate'}"></label>
      <p class="muted center small" id="ob-unit">${draft.incomeType === 'salary' ? 'per year' : 'per hour'}</p>
      <div class="row gap two">
        <label class="field"><span class="label">Hours a week</span><input class="input" type="number" name="hoursPerWeek" min="1" max="168" step="0.5" value="${draft.hoursPerWeek}"></label>
        <label class="field"><span class="label">Days a week</span><input class="input" type="number" name="daysPerWeek" min="1" max="7" value="${draft.daysPerWeek}"></label>
      </div>
      <div class="ob-actions">${back}<button class="btn primary lg">Next</button></div>`;
  } else if (step === 2) {
    body = `<h2>A couple of details</h2>
      <label class="field"><span class="label">Currency</span><select class="input" name="currency">${CURRENCIES.map(([c, n]) => `<option value="${c}" ${c === draft.currency ? 'selected' : ''}>${c} · ${esc(n)}</option>`).join('')}</select></label>
      <label class="field"><span class="label">Birthday <span class="muted">(optional)</span></span><input class="input" type="date" name="birthday" value="${draft.birthday}" max="${dayKey()}">
        <span class="hint">Used to show what skipped money could grow to by retirement.</span></label>
      <div class="ob-actions">${back}<button class="btn primary lg">Next</button></div>`;
  } else if (step === 3) {
    const rate = hourlyRate(draft);
    body = `<h2>Monthly spending budget</h2>
      <p class="muted">Everything you plan to spend in a month, bills included. You can change it anytime.</p>
      <label class="money-field big"><span class="sym">${sym}</span>
        <input class="input" name="budget" inputmode="decimal" autocomplete="off" autofocus value="${draft.monthlyBudget || ''}" placeholder="0" data-input="ob-budget" aria-label="Monthly budget"></label>
      <p class="muted center" id="ob-budget-out">${rate && draft.monthlyBudget ? `That’s ${fx({ ...getState().settings, ...draft }).t(draft.monthlyBudget)} of work` : '&nbsp;'}</p>
      <div class="ob-actions">${back}<button class="btn primary lg">Next</button></div>
      <button type="button" class="link center" data-act="ob-skip-budget">I’ll skip the budget</button>`;
  } else if (step === 4) {
    body = `<h2>What are you saving for?</h2>
      <p class="muted">Pick any. We’ll set them up with starter targets you can edit.</p>
      <div class="chips big">${GOAL_TEMPLATES.map((t, i) => `<label class="chip toggle"><input type="checkbox" name="goal" value="${i}" ${draft.goals.includes(i) ? 'checked' : ''}><span>${t.emoji} ${esc(t.name)}</span></label>`).join('')}</div>
      <div class="ob-actions">${back}<button class="btn primary lg">Next</button></div>`;
  } else {
    body = `<h2>Try it</h2>
      <p class="muted">Think of something you’ve wanted lately. What does it cost?</p>
      <label class="money-field big"><span class="sym">${sym}</span>
        <input class="input" name="try" inputmode="decimal" autocomplete="off" autofocus placeholder="0" data-input="ob-try" aria-label="Price"></label>
      <div class="ob-try" id="ob-try" aria-live="polite"></div>
      <div class="ob-actions">${back}<button class="btn primary lg">Start using Hourwise</button></div>`;
  }

  el.innerHTML = `<div class="ob-card">${dots()}<form data-form="ob" class="stack" novalidate>${body}</form></div>`;
  const focus = el.querySelector('[autofocus]');
  if (focus) requestAnimationFrame(() => focus.focus());
}

function readStep(v, form) {
  if (step === 1) {
    const amount = parseMoney(v.amount);
    if (!(amount > 0)) throw new Error(draft.incomeType === 'salary' ? 'Enter your yearly salary.' : 'Enter your hourly rate.');
    draft.incomeType = v.incomeType === 'salary' ? 'salary' : 'hourly';
    if (draft.incomeType === 'salary') draft.salary = amount; else draft.hourlyRate = amount;
    draft.hoursPerWeek = clamp(num(v.hoursPerWeek, 40), 1, 168);
    draft.daysPerWeek = clamp(Math.round(num(v.daysPerWeek, 5)), 1, 7);
  } else if (step === 2) {
    draft.currency = v.currency;
    draft.birthday = v.birthday && v.birthday <= dayKey() ? v.birthday : '';
  } else if (step === 3) {
    const raw = String(v.budget || '').trim();
    const n = raw ? parseMoney(raw) : 0;
    if (Number.isNaN(n)) throw new Error('Check the budget amount.');
    draft.monthlyBudget = n;
  } else if (step === 4) {
    draft.goals = [...form.querySelectorAll('input[name="goal"]:checked')].map((i) => Number(i.value));
  }
}

function finish() {
  const d = draft;
  const firstRun = getState().pig.lifetime === 0;
  commit((st) => {
    Object.assign(st.settings, {
      incomeType: d.incomeType, hourlyRate: d.hourlyRate, salary: d.salary, hoursPerWeek: d.hoursPerWeek,
      daysPerWeek: d.daysPerWeek, currency: d.currency, birthday: d.birthday, monthlyBudget: d.monthlyBudget,
    });
    const existing = new Set(st.goals.map((g) => g.name));
    for (const i of d.goals) {
      const t = GOAL_TEMPLATES[i];
      if (!existing.has(t.name)) saveGoal(st, t);
    }
    st.onboarded = true;
    if (firstRun) award(st, 50, 'Welcome gift');
  });
  hide();
  location.hash = '#home';
  if (firstRun) {
    confetti(50);
    toast(`Meet ${getState().pig.name}, your savings pig. Here are 50 points to start.`, { tone: 'good', ms: 5000 });
  }
}

onForm({
  ob: (v, form) => {
    readStep(v, form);
    if (step === STEPS - 1) return finish();
    step++;
    paint();
  },
});

onAct({
  'ob-back': () => { if (step > 0) { step--; paint(); } },
  'ob-skip-budget': () => { draft.monthlyBudget = 0; step++; paint(); },
});

onInput({
  'ob-type': (el) => {
    const form = el.form;
    const v = formValues(form);
    const amountEl = form.elements.amount;
    // Keep what was typed for the other pay type, then swap in this one's value.
    const typed = parseMoney(amountEl.value);
    if (v.incomeType === 'salary') { if (typed > 0) draft.hourlyRate = typed; amountEl.value = draft.salary; }
    else { if (typed > 0) draft.salary = typed; amountEl.value = draft.hourlyRate; }
    draft.incomeType = v.incomeType;
    $('#ob-unit').textContent = v.incomeType === 'salary' ? 'per year' : 'per hour';
    amountEl.setAttribute('aria-label', v.incomeType === 'salary' ? 'Yearly salary' : 'Hourly rate');
  },
  'ob-budget': (el) => {
    const n = parseMoney(el.value);
    const s = { ...getState().settings, ...draft };
    $('#ob-budget-out').textContent = n > 0 && hourlyRate(s) ? `That’s ${fx(s).t(n)} of work` : ' ';
  },
  'ob-try': (el) => {
    const n = parseMoney(el.value);
    const out = $('#ob-try');
    const s = { ...getState().settings, ...draft };
    if (!(n > 0)) { out.innerHTML = ''; return; }
    const inv = investedInstead(n, s);
    out.innerHTML = `<div><span class="label">Time at work</span><b>${esc(fx(s).t(n))}</b></div>
      <div><span class="label">Invested instead</span><b>${esc(money(Math.round(inv.value), s.currency))}</b><small class="muted">in ${inv.years} years</small></div>`;
  },
});
