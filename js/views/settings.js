// Settings: pay, investing assumptions, taxes, preferences, backup and reset.
import { getState, commit, exportJSON, exportCSV, parseBackup, replaceState, resetAll } from '../store.js';
import { hourlyRate, investYears, ageOn, num, clamp, dayKey } from '../calc.js';
import { CURRENCIES } from '../format.js';
import { COOLDOWN_OPTIONS } from '../data.js';
import { esc, icon, onAct, onForm, onInput, toast, confirmBox, download, pickFile, $ } from '../ui.js';
import { fx, field, parseMoney } from './common.js';

export const APP_VERSION = '1.0.0';

export function render(state) {
  const s = state.settings;
  const f = fx(s);
  const rate = hourlyRate(s);
  const notifSupported = 'Notification' in window;
  const notifDenied = notifSupported && Notification.permission === 'denied';
  return `
  <div class="page-head"><a class="icon-btn" href="#home" aria-label="Back">${icon('chevL')}</a><h1>Settings</h1></div>

  <form data-form="settings" class="stack settings" novalidate>
    <section class="card stack">
      <h3>Your pay</h3>
      <div class="seg" role="radiogroup" aria-label="How you're paid">
        <label><input type="radio" name="incomeType" value="hourly" ${s.incomeType === 'hourly' ? 'checked' : ''} data-input="settings-live"><span>Hourly</span></label>
        <label><input type="radio" name="incomeType" value="salary" ${s.incomeType === 'salary' ? 'checked' : ''} data-input="settings-live"><span>Salary</span></label>
      </div>
      <div class="pay-hourly" ${s.incomeType === 'salary' ? 'hidden' : ''}>${field('Hourly rate', `<input class="input" name="hourlyRate" inputmode="decimal" value="${s.hourlyRate}" data-input="settings-live">`)}</div>
      <div class="pay-salary" ${s.incomeType === 'hourly' ? 'hidden' : ''}>${field('Yearly salary', `<input class="input" name="salary" inputmode="decimal" value="${s.salary}" data-input="settings-live">`)}</div>
      <div class="row gap two">
        ${field('Hours a week', `<input class="input" type="number" name="hoursPerWeek" min="1" max="168" step="0.5" value="${s.hoursPerWeek}" data-input="settings-live">`)}
        ${field('Days a week', `<input class="input" type="number" name="daysPerWeek" min="1" max="7" value="${s.daysPerWeek}" data-input="settings-live">`)}
      </div>
      <label class="row between toggle-row"><span><b>Use take-home pay</b><small class="muted">Subtract income tax so time reflects what you actually keep.</small></span>
        <span class="switch"><input type="checkbox" name="takeHome" ${s.takeHome ? 'checked' : ''} data-input="settings-live"><span></span></span></label>
      <div class="tax-rate" ${s.takeHome ? '' : 'hidden'}>${field('Income tax rate (%)', `<input class="input" type="number" name="taxRate" min="0" max="95" step="0.5" value="${s.taxRate}" data-input="settings-live">`)}</div>
      <p class="rate-out" id="rate-out">${rate ? `One hour of your work = <b>${f.m(rate)}</b>` : 'Add your pay to see prices as work time.'}</p>
    </section>

    <section class="card stack">
      <h3>Money</h3>
      ${field('Currency', `<select class="input" name="currency">${CURRENCIES.map(([code, name]) => `<option value="${code}" ${code === s.currency ? 'selected' : ''}>${code} · ${esc(name)}</option>`).join('')}</select>`)}
      ${field('Monthly budget', `<input class="input" name="monthlyBudget" inputmode="decimal" value="${s.monthlyBudget || ''}" placeholder="No budget">`)}
      <label class="row between toggle-row"><span><b>Add sales tax to prices</b><small class="muted">For places where tax isn’t in the sticker price.</small></span>
        <span class="switch"><input type="checkbox" name="salesTaxOn" ${s.salesTaxOn ? 'checked' : ''} data-input="settings-live"><span></span></span></label>
      <div class="sales-rate" ${s.salesTaxOn ? '' : 'hidden'}>${field('Sales tax (%)', `<input class="input" type="number" name="salesTaxRate" min="0" max="100" step="0.01" value="${s.salesTaxRate}">`)}</div>
    </section>

    <section class="card stack">
      <h3>Investing projection</h3>
      <div class="row gap two">
        ${field('Birthday', `<input class="input" type="date" name="birthday" value="${s.birthday}" max="${dayKey()}">`)}
        ${field('Retire at', `<input class="input" type="number" name="retirementAge" min="18" max="100" value="${s.retirementAge}">`)}
      </div>
      ${field('Yearly return (%)', `<input class="input" type="number" name="returnRate" min="0" max="30" step="0.1" value="${s.returnRate}">`, '10% is the long-run US stock average before inflation; 7% after.')}
      <p class="muted small">${s.birthday ? `You’re ${ageOn(s.birthday)}, so money compounds for ${investYears(s)} years.` : 'Without a birthday we assume 30 years.'}</p>
    </section>

    <section class="card stack">
      <h3>Preferences</h3>
      ${field('Your name', `<input class="input" name="name" maxlength="40" value="${esc(s.name)}" placeholder="Optional">`)}
      ${field('Theme', `<select class="input" name="theme">${[['system', 'Match device'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<option value="${v}" ${s.theme === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
      ${field('Week starts on', `<select class="input" name="weekStart"><option value="0" ${s.weekStart === 0 ? 'selected' : ''}>Sunday</option><option value="1" ${s.weekStart === 1 ? 'selected' : ''}>Monday</option></select>`)}
      ${field('Default cooldown', `<select class="input" name="cooldownHours">${COOLDOWN_OPTIONS.map((o) => `<option value="${o.hours}" ${o.hours === s.cooldownHours ? 'selected' : ''}>${o.label}</option>`).join('')}</select>`)}
      <label class="row between toggle-row"><span><b>Cooldown mode</b><small class="muted">“Buy” waits for the cooldown first.</small></span>
        <span class="switch"><input type="checkbox" name="cooldownMode" ${s.cooldownMode ? 'checked' : ''}><span></span></span></label>
      <label class="row between toggle-row"><span><b>Vibration</b><small class="muted">Little buzzes on phones that support it.</small></span>
        <span class="switch"><input type="checkbox" name="haptics" ${s.haptics ? 'checked' : ''}><span></span></span></label>
      <label class="row between toggle-row"><span><b>Reminders</b><small class="muted">${!notifSupported ? 'This browser doesn’t support notifications.' : notifDenied ? 'Blocked in your browser settings.' : 'Cooldowns ending and bills due soon, while Hourwise is open or installed.'}</small></span>
        <span class="switch"><input type="checkbox" name="notifications" ${s.notifications && !notifDenied ? 'checked' : ''} ${!notifSupported || notifDenied ? 'disabled' : ''}><span></span></span></label>
    </section>

    <button class="btn primary block lg sticky-save">Save settings</button>
  </form>

  <section class="card stack">
    <h3>Your data</h3>
    <p class="muted small">Everything stays on this device. Nothing is sent anywhere. Back up now and then, especially before clearing your browser.</p>
    <button class="btn ghost block" data-act="export-json">${icon('download', 18)} Download backup (.json)</button>
    <button class="btn ghost block" data-act="import-json">${icon('upload', 18)} Restore from backup</button>
    <button class="btn ghost block" data-act="export-csv">${icon('download', 18)} Export spending (.csv)</button>
    <button class="btn danger-ghost block" data-act="reset-all">${icon('trash', 18)} Erase everything</button>
  </section>

  <p class="muted small center">Hourwise ${APP_VERSION} · works offline · <a href="#" data-act="replay-onboarding">Replay intro</a></p>`;
}

function liveUpdate() {
  const form = $('form[data-form="settings"]');
  if (!form) return;
  const v = Object.fromEntries(new FormData(form));
  const draft = {
    ...getState().settings,
    incomeType: v.incomeType,
    hourlyRate: parseMoney(v.hourlyRate) || 0,
    salary: parseMoney(v.salary) || 0,
    hoursPerWeek: num(v.hoursPerWeek, 40),
    daysPerWeek: num(v.daysPerWeek, 5),
    takeHome: form.elements.takeHome.checked,
    taxRate: num(v.taxRate, 0),
  };
  form.querySelector('.pay-hourly').hidden = draft.incomeType !== 'hourly';
  form.querySelector('.pay-salary').hidden = draft.incomeType !== 'salary';
  form.querySelector('.tax-rate').hidden = !draft.takeHome;
  form.querySelector('.sales-rate').hidden = !form.elements.salesTaxOn.checked;
  const rate = hourlyRate(draft);
  $('#rate-out').innerHTML = rate ? `One hour of your work = <b>${fx(draft).m(rate)}</b>` : 'Add your pay to see prices as work time.';
}

onInput({ 'settings-live': liveUpdate });

onForm({
  settings: async (v) => {
    const hourly = parseMoney(v.hourlyRate);
    const salary = parseMoney(v.salary);
    if (v.incomeType === 'hourly' && !(hourly >= 0)) throw new Error('Check your hourly rate.');
    if (v.incomeType === 'salary' && !(salary >= 0)) throw new Error('Check your salary.');
    const budgetRaw = String(v.monthlyBudget || '').trim();
    const budget = budgetRaw ? parseMoney(budgetRaw) : 0;
    if (Number.isNaN(budget)) throw new Error('Check your monthly budget.');

    let notifications = !!v.notifications;
    if (notifications && 'Notification' in window && Notification.permission !== 'granted') {
      notifications = (await Notification.requestPermission()) === 'granted';
      if (!notifications) toast('Notifications weren’t allowed, so reminders stay off.');
    }

    commit((st) => {
      Object.assign(st.settings, {
        incomeType: v.incomeType === 'salary' ? 'salary' : 'hourly',
        hourlyRate: Number.isNaN(hourly) ? st.settings.hourlyRate : hourly,
        salary: Number.isNaN(salary) ? st.settings.salary : salary,
        hoursPerWeek: clamp(num(v.hoursPerWeek, 40), 1, 168),
        daysPerWeek: clamp(Math.round(num(v.daysPerWeek, 5)), 1, 7),
        takeHome: !!v.takeHome,
        taxRate: clamp(num(v.taxRate, 0), 0, 95),
        currency: v.currency,
        monthlyBudget: budget,
        salesTaxOn: !!v.salesTaxOn,
        salesTaxRate: clamp(num(v.salesTaxRate, 0), 0, 100),
        birthday: v.birthday && v.birthday <= dayKey() ? v.birthday : '',
        retirementAge: clamp(Math.round(num(v.retirementAge, 65)), 18, 100),
        returnRate: clamp(num(v.returnRate, 10), 0, 30),
        name: String(v.name || '').trim().slice(0, 40),
        theme: ['light', 'dark'].includes(v.theme) ? v.theme : 'system',
        weekStart: v.weekStart === '1' ? 1 : 0,
        cooldownHours: Number(v.cooldownHours) || 48,
        cooldownMode: !!v.cooldownMode,
        haptics: !!v.haptics,
        notifications,
      });
    });
    toast('Settings saved.', { tone: 'good' });
  },
});

onAct({
  'export-json': () => {
    download(`hourwise-backup-${dayKey()}.json`, exportJSON());
    toast('Backup downloaded.');
  },
  'export-csv': () => download(`hourwise-spending-${dayKey()}.csv`, `﻿${exportCSV()}`, 'text/csv;charset=utf-8'),
  'import-json': async () => {
    const file = await pickFile('application/json,.json');
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) throw new Error('That file is too big to be a backup.');
    const data = parseBackup(await file.text());
    const ok = await confirmBox(`Replace everything on this device with this backup? It has ${data.transactions.length} transactions, ${data.goals.length} goals and ${data.decisions.length} decisions.`, { ok: 'Restore', danger: true, title: 'Restore backup' });
    if (!ok) return;
    replaceState(data);
    toast('Backup restored.', { tone: 'good' });
  },
  'reset-all': async () => {
    if (!(await confirmBox('This deletes all your data on this device: budget, goals, decisions, points. Download a backup first if you might want it.', { ok: 'Erase everything', danger: true, title: 'Erase everything?' }))) return;
    if (!(await confirmBox('Really erase? This can’t be undone.', { ok: 'Yes, erase', danger: true }))) return;
    resetAll();
    location.hash = '#home';
  },
  'replay-onboarding': () => commit((st) => { st.onboarded = false; }),
});
