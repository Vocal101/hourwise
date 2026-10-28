// Formatting shortcuts and form bits shared by the views.
import { money, moneyCompact, moneyAsTime, workTime, currencySymbol } from '../format.js';
import { hourlyRate } from '../calc.js';
import { CATEGORIES, INCOME_CATEGORIES, category } from '../data.js';
import { esc } from '../ui.js';

export function fx(s) {
  return {
    m: (n) => money(n, s.currency),
    mw: (n) => money(n, s.currency, { whole: true }),
    mc: (n) => moneyCompact(n, s.currency),
    t: (n, opts) => moneyAsTime(n, s, opts),
    h: (hours, opts) => workTime(hours, s, opts),
    sym: currencySymbol(s.currency),
    // Amount in the user's chosen unit for the budget view.
    v: (n) => (s.showHours ? moneyAsTime(n, s) : money(n, s.currency)),
  };
}

export const hasIncome = (s) => hourlyRate(s) > 0;

export function categorySelect(name, selected, { income = false } = {}) {
  const list = income ? INCOME_CATEGORIES : CATEGORIES;
  return `<select name="${name}" class="input">${list.map((c) => `<option value="${c.id}"${c.id === selected ? ' selected' : ''}>${c.emoji} ${esc(c.label)}</option>`).join('')}</select>`;
}

export function moneyInput(name, s, value = '', { big = false, autofocus = false, required = true, placeholder = '0.00', live = '' } = {}) {
  return `<label class="money-field${big ? ' big' : ''}">
    <span class="sym">${esc(currencySymbol(s.currency))}</span>
    <input name="${name}" class="input" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="done"
      placeholder="${placeholder}" value="${value === '' || value == null ? '' : esc(value)}" ${required ? 'required' : ''}
      ${autofocus ? 'autofocus' : ''} ${live ? `data-input="${live}"` : ''} pattern="[0-9.,\\s]*" aria-label="Amount">
  </label>`;
}

export function field(label, control, hint = '') {
  return `<label class="field"><span class="label">${label}</span>${control}${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
}

export const catChip = (id) => {
  const c = category(id);
  return `<span class="cat-dot" style="--c:${c.color}" aria-hidden="true">${c.emoji}</span>`;
};

export function empty(emoji, title, body = '', action = '') {
  return `<div class="empty"><div class="empty-emoji" aria-hidden="true">${emoji}</div><h3>${title}</h3>${body ? `<p class="muted">${body}</p>` : ''}${action}</div>`;
}

// Parses user-typed money like "1,299.99" or "1299,99".
export function parseMoney(v) {
  let s = String(v ?? '').trim().replace(/\s/g, '');
  if (!s) return NaN;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s) || /^\d+,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  s = s.replace(/[^0-9.]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

export function requireMoney(v, what = 'an amount') {
  const n = parseMoney(v);
  if (!(n > 0)) throw new Error(`Enter ${what} above zero.`);
  if (n > 1e9) throw new Error('That number is too big.');
  return n;
}
