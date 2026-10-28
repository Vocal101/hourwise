// Entry point: routing, theme, timers, reminders, shake-for-challenge, service worker.
import { load, getState, commit, subscribe, isStorageOk } from './store.js';
import { rollChallenge, billDueDate } from './actions.js';
import { dayKey, monthKey } from './calc.js';
import { installDelegation, installSheet, onAct, toast, confetti, sheetOpen, $, $$, icon } from './ui.js';
import { parseMoney } from './views/common.js';
import { monthLabel } from './format.js';
import * as home from './views/home.js';
import * as budget from './views/budget.js';
import * as save from './views/save.js';
import * as insights from './views/insights.js';
import * as room from './views/room.js';
import * as settings from './views/settings.js';
import * as onboarding from './views/onboarding.js';

const DEV = new URLSearchParams(location.search).has('dev');

const ROUTES = {
  home: { view: home, title: 'Hourwise' },
  budget: { view: budget, title: 'Budget' },
  save: { view: save, title: 'Save' },
  insights: { view: insights, title: 'Insights' },
  pig: { view: room, title: 'Piggy' },
  settings: { view: settings, title: 'Settings' },
};

function route() {
  const [name, sub] = location.hash.replace(/^#\/?/, '').split('/');
  return { name: ROUTES[name] ? name : 'home', sub };
}

let lastRoute = '';

function render(state = getState()) {
  if (!state.onboarded) {
    if ($('#onboarding').hidden) onboarding.show();
    return;
  }
  if (!$('#onboarding').hidden) onboarding.hide();
  const { name, sub } = route();
  const main = $('#main');
  const key = `${name}/${sub || ''}`;

  // Don't wipe a field the user is typing in on a background re-render.
  const active = document.activeElement;
  if (key === lastRoute && active && main.contains(active) && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return;

  main.innerHTML = ROUTES[name].view.render(state, sub);
  document.title = name === 'home' ? 'Hourwise' : `${ROUTES[name].title} · Hourwise`;
  for (const a of $$('.tabbar a')) {
    const on = a.dataset.route === name;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  $('.tabbar').hidden = name === 'settings';
  $('#app-header').hidden = name === 'settings';
  $('#header-points').textContent = `🪙 ${state.pig.points}`;
  if (key !== lastRoute) { window.scrollTo(0, 0); main.focus({ preventScroll: true }); }
  lastRoute = key;
  if (!isStorageOk()) toast('Couldn’t save. Your browser storage may be full or blocked.', { tone: 'error' });
}

function applyTheme(state = getState()) {
  const root = document.documentElement;
  const t = state.settings.theme;
  if (t === 'system') root.removeAttribute('data-theme'); else root.dataset.theme = t;
  root.dataset.haptics = state.settings.haptics ? 'on' : 'off';
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('meta[name="theme-color"]').setAttribute('content', dark ? '#17151c' : '#fff8e7');
}

function announce(events) {
  if (!events) return;
  // Badges show just after the action's own toast.
  (events.badges || []).forEach((b, i) => setTimeout(() => {
    confetti(40);
    toast(`Badge unlocked: ${b.emoji} ${b.name} (+${b.points})`, { tone: 'good', ms: 4500 });
  }, 500 + i * 400));
  const under = (events.months || []).filter((m) => m.verdict === 'under');
  if (under.length === 1) toast(`You finished ${monthLabel(under[0].key)} under budget! +50 points`, { tone: 'good', ms: 4500 });
  else if (under.length > 1) toast(`${under.length} months finished under budget! +${under.length * 50} points`, { tone: 'good', ms: 4500 });
  if (events.blockPoints) toast(`Shop Block finished! +${events.blockPoints} points`, { tone: 'good', ms: 4500 });
}

// ---------- reminders ----------

const NOTIFIED_KEY = 'hourwise:notified';
function notifiedSet() {
  try { return new Set(JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '[]')); } catch { return new Set(); }
}
function markNotified(set) {
  try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...set].slice(-300))); } catch { /* ignore */ }
}

async function notify(title, body, tag) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' });
    else new Notification(title, { body, tag, icon: 'icons/icon-192.png' });
  } catch (err) { console.warn('Notification failed', err); }
}

function checkReminders() {
  const state = getState();
  if (!state.settings.notifications || !('Notification' in window) || Notification.permission !== 'granted') return;
  const sent = notifiedSet();
  const now = Date.now();
  for (const c of state.cooldown) {
    const tag = `cool:${c.id}`;
    if (c.status === 'waiting' && Date.parse(c.until) <= now && !sent.has(tag)) {
      notify('Cooldown’s over', `Still want ${c.name}? Decide now.`, tag);
      sent.add(tag);
    }
  }
  const key = monthKey();
  const today = dayKey();
  const soon = dayKey(new Date(now + 2 * 86400000));
  for (const b of state.bills) {
    const due = billDueDate(b, key);
    const tag = `bill:${b.id}:${key}`;
    if (!b.paid[key] && due >= today && due <= soon && !sent.has(tag)) {
      notify(`${b.name} is due ${due === today ? 'today' : 'soon'}`, `Due ${due}.`, tag);
      sent.add(tag);
    }
  }
  markNotified(sent);
}

// ---------- shake ----------

let lastShake = 0;
function onMotion(e) {
  const a = e.accelerationIncludingGravity || e.acceleration;
  if (!a) return;
  const mag = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
  const now = Date.now();
  if (mag < 30 || now - lastShake < 1500) return;
  lastShake = now;
  const state = getState();
  if (!state.onboarded || sheetOpen()) return;
  const t = state.challenge.today;
  if (t && t.date === dayKey() && t.status !== 'offered') return;
  commit((st) => rollChallenge(st));
  try { navigator.vibrate?.([20, 40, 20]); } catch { /* unsupported */ }
  toast(`🎲 ${getState().challenge.today.text}`, { ms: 5000 });
  if (route().name !== 'home') location.hash = '#home';
}

function startShake() {
  if (window.__shakeOn) return;
  window.__shakeOn = true;
  window.addEventListener('devicemotion', onMotion);
}

onAct({
  'enable-shake': async () => {
    try {
      const res = await DeviceMotionEvent.requestPermission();
      if (res === 'granted') { startShake(); toast('Shake on! Give your phone a shake.'); commit(() => {}); }
      else toast('Motion access was denied.');
    } catch { toast('Shake isn’t available here.'); }
  },
});

// ---------- incoming prices (share target / links) ----------

function handleIncoming() {
  const params = new URLSearchParams(location.search);
  const text = [params.get('price'), params.get('title'), params.get('text'), params.get('url')].filter(Boolean).join(' ');
  if (!text) return;
  const match = text.match(/(?:[$€£¥₹₩]|USD|EUR|GBP)?\s?(\d{1,3}(?:[,.]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/);
  const price = params.get('price') ? parseMoney(params.get('price')) : match ? parseMoney(match[1]) : NaN;
  const name = (params.get('name') || params.get('title') || '').slice(0, 80);
  history.replaceState(null, '', location.pathname + (DEV ? '?dev' : '') + location.hash);
  if (price > 0 && getState().onboarded) home.openWorth(price, name);
  else if (getState().onboarded) toast('Couldn’t find a price in what was shared. Type it in above.');
}

// ---------- boot ----------

function boot() {
  load();
  installDelegation();
  installSheet();

  $('#tabbar').innerHTML = [
    ['home', 'home', 'Home'], ['budget', 'wallet', 'Budget'], ['save', 'target', 'Save'], ['insights', 'chart', 'Insights'], ['pig', 'pig', 'Piggy'],
  ].map(([r, ic, label]) => `<a href="#${r}" data-route="${r}">${icon(ic, 24)}<span>${label}</span></a>`).join('');
  $('#settings-link').innerHTML = icon('gear', 22);

  subscribe((state, events) => { applyTheme(state); render(state); announce(events); });
  window.addEventListener('hashchange', () => render());
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme());

  commit(() => {});
  applyTheme();
  handleIncoming();

  // Housekeeping once a minute, plus whenever the app comes back to the front.
  const refresh = () => { commit(() => {}); checkReminders(); };
  setInterval(refresh, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  checkReminders();

  if ('DeviceMotionEvent' in window && typeof DeviceMotionEvent.requestPermission !== 'function') startShake();

  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) && !sheetOpen()) {
      const price = $('form[data-form="worth"] input[name="price"]');
      if (price) { e.preventDefault(); price.focus(); }
    }
  });

  if ('serviceWorker' in navigator && !DEV && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker failed', err));
  }

  if (DEV) import('./dev.js').then((m) => m.install());
}

boot();
