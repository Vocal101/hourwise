// Display formatting for money and work time.
import { splitWorkTime, workHours } from './calc.js';

export const CURRENCIES = [
  ['USD', 'US Dollar'], ['EUR', 'Euro'], ['GBP', 'British Pound'], ['CAD', 'Canadian Dollar'],
  ['AUD', 'Australian Dollar'], ['NZD', 'New Zealand Dollar'], ['JPY', 'Japanese Yen'], ['CNY', 'Chinese Yuan'],
  ['INR', 'Indian Rupee'], ['KRW', 'South Korean Won'], ['SGD', 'Singapore Dollar'], ['HKD', 'Hong Kong Dollar'],
  ['CHF', 'Swiss Franc'], ['SEK', 'Swedish Krona'], ['NOK', 'Norwegian Krone'], ['DKK', 'Danish Krone'],
  ['ISK', 'Icelandic Króna'], ['PLN', 'Polish Złoty'], ['CZK', 'Czech Koruna'], ['HUF', 'Hungarian Forint'],
  ['RON', 'Romanian Leu'], ['TRY', 'Turkish Lira'], ['RUB', 'Russian Ruble'], ['UAH', 'Ukrainian Hryvnia'],
  ['ILS', 'Israeli Shekel'], ['AED', 'UAE Dirham'], ['SAR', 'Saudi Riyal'], ['EGP', 'Egyptian Pound'],
  ['ZAR', 'South African Rand'], ['NGN', 'Nigerian Naira'], ['KES', 'Kenyan Shilling'], ['MXN', 'Mexican Peso'],
  ['BRL', 'Brazilian Real'], ['ARS', 'Argentine Peso'], ['CLP', 'Chilean Peso'], ['COP', 'Colombian Peso'],
  ['PEN', 'Peruvian Sol'], ['IDR', 'Indonesian Rupiah'], ['MYR', 'Malaysian Ringgit'], ['THB', 'Thai Baht'],
  ['PHP', 'Philippine Peso'], ['VND', 'Vietnamese Dong'], ['PKR', 'Pakistani Rupee'], ['BDT', 'Bangladeshi Taka'],
  ['MNT', 'Mongolian Tögrög'], ['TWD', 'New Taiwan Dollar'],
];

// Best guess at the user's currency from their browser region.
const REGION_CURRENCY = {
  US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', NZ: 'NZD', JP: 'JPY', CN: 'CNY', IN: 'INR', KR: 'KRW', SG: 'SGD',
  HK: 'HKD', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', IS: 'ISK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON',
  TR: 'TRY', RU: 'RUB', UA: 'UAH', IL: 'ILS', AE: 'AED', SA: 'SAR', EG: 'EGP', ZA: 'ZAR', NG: 'NGN', KE: 'KES',
  MX: 'MXN', BR: 'BRL', AR: 'ARS', CL: 'CLP', CO: 'COP', PE: 'PEN', ID: 'IDR', MY: 'MYR', TH: 'THB', PH: 'PHP',
  VN: 'VND', PK: 'PKR', BD: 'BDT', MN: 'MNT', TW: 'TWD',
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR', IE: 'EUR', PT: 'EUR', FI: 'EUR',
  GR: 'EUR', SK: 'EUR', SI: 'EUR', LT: 'EUR', LV: 'EUR', EE: 'EUR', LU: 'EUR', MT: 'EUR', CY: 'EUR', HR: 'EUR',
};

export function guessCurrency(langs = typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : []) {
  for (const lang of langs) {
    const region = String(lang).split('-')[1]?.toUpperCase();
    if (region && REGION_CURRENCY[region]) return REGION_CURRENCY[region];
  }
  return 'USD';
}

const cache = new Map();
function formatter(currency, digits) {
  const key = currency + digits;
  if (!cache.has(key)) {
    let f;
    try {
      f = new Intl.NumberFormat(undefined, { style: 'currency', currency, ...(digits != null ? { maximumFractionDigits: digits, minimumFractionDigits: 0 } : {}) });
    } catch {
      f = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });
    }
    cache.set(key, f);
  }
  return cache.get(key);
}

// Whole numbers drop their decimals ($250, not $250.00); others keep cents.
export function money(amount, currency, { whole = false } = {}) {
  const n = Number(amount) || 0;
  const isWhole = whole || Math.abs(n - Math.round(n)) < 0.005;
  return formatter(currency, isWhole ? 0 : null).format(isWhole ? Math.round(n) : n);
}

export function moneyCompact(amount, currency) {
  const n = Number(amount) || 0;
  if (Math.abs(n) < 10000) return money(n, currency, { whole: true });
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(n);
  } catch {
    return money(n, currency, { whole: true });
  }
}

export const currencySymbol = (currency) => {
  try {
    return formatter(currency, 0).formatToParts(0).find((p) => p.type === 'currency')?.value || currency;
  } catch {
    return currency;
  }
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// "2 days 4 hrs", "3 hrs 15 min", "12 min". Days are work days, not 24-hour days.
export function workTime(hours, s, { long = false } = {}) {
  if (!(hours > 0)) return long ? '0 minutes' : '0 min';
  if (hours * 60 < 1) return long ? 'less than a minute' : '< 1 min';
  const t = splitWorkTime(hours, s);
  const parts = [];
  if (t.days) parts.push(long ? plural(t.days, 'work day') : plural(t.days, 'day'));
  if (t.hours) parts.push(long ? plural(t.hours, 'hour') : `${t.hours} hr${t.hours === 1 ? '' : 's'}`);
  if (t.minutes && t.days < 10) parts.push(long ? plural(t.minutes, 'minute') : `${t.minutes} min`);
  return parts.slice(0, long ? 3 : 2).join(long ? ', ' : ' ');
}

export const moneyAsTime = (amount, s, opts) => workTime(workHours(amount, s), s, opts);

export function shortDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const sameYear = y === new Date().getFullYear();
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

export function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function relativeDay(key, now = new Date()) {
  const [y, m, d] = key.split('-').map(Number);
  const diff = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(y, m - 1, d)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long' });
  return shortDate(key);
}

export function countdown(ms) {
  if (ms <= 0) return 'Ready';
  const mins = Math.ceil(ms / 60000);
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

export const pct = (x) => `${Math.round(x * 100)}%`;
