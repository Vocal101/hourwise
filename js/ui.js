// Shared UI plumbing: escaping, event delegation, sheets, confirms, toasts, confetti.

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------- event delegation ----------
// <button data-act="name" data-id="..."> calls acts.name(el, event)
// <form data-form="name"> calls forms.name(values, form, event) on submit

const acts = {};
const forms = {};
const inputs = {};
export const onAct = (map) => Object.assign(acts, map);
export const onForm = (map) => Object.assign(forms, map);
export const onInput = (map) => Object.assign(inputs, map);

export function formValues(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
    else out[el.name] = el.value;
  }
  return out;
}

function report(err) {
  console.error(err);
  toast(err?.message || 'Something went wrong.', { tone: 'error' });
}

export function installDelegation() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = acts[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    try {
      const r = fn(el, e);
      if (r && typeof r.catch === 'function') r.catch(report);
    } catch (err) { report(err); }
  });
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const fn = forms[form.dataset.form];
    if (!fn) return;
    try {
      const r = fn(formValues(form), form, e);
      if (r && typeof r.catch === 'function') r.catch(report);
    } catch (err) { report(err); }
  });
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-input]');
    if (el && inputs[el.dataset.input]) inputs[el.dataset.input](el, e);
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (!el || !acts[el.dataset.change]) return;
    try { acts[el.dataset.change](el, e); } catch (err) { report(err); }
  });
}

export const run = (fn) => { try { return fn(); } catch (err) { report(err); return undefined; } };

// ---------- bottom sheet ----------

let sheetClose = null;

export function openSheet(html, { onClose, wide = false } = {}) {
  const dlg = $('#sheet');
  dlg.classList.toggle('wide', wide);
  $('#sheet-body').innerHTML = html;
  sheetClose = onClose || null;
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = 0;
  const first = $('#sheet-body [autofocus]');
  if (first) requestAnimationFrame(() => first.focus());
}

export function closeSheet() {
  const dlg = $('#sheet');
  if (dlg.open) dlg.close();
}

export const sheetOpen = () => $('#sheet').open;

export function installSheet() {
  const dlg = $('#sheet');
  dlg.addEventListener('close', () => {
    $('#sheet-body').innerHTML = '';
    const fn = sheetClose;
    sheetClose = null;
    if (fn) fn();
  });
  // Clicking the dimmed backdrop closes the sheet.
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  onAct({ 'close-sheet': () => closeSheet() });
}

export function sheetHeader(title, sub = '') {
  return `<header class="sheet-head"><div><h2>${esc(title)}</h2>${sub ? `<p class="muted">${sub}</p>` : ''}</div>
    <button class="icon-btn" data-act="close-sheet" aria-label="Close">${icon('x')}</button></header>`;
}

// ---------- confirm ----------

export function confirmBox(message, { ok = 'OK', cancel = 'Cancel', danger = false, title = '' } = {}) {
  return new Promise((resolve) => {
    const dlg = $('#confirm');
    dlg.innerHTML = `<form method="dialog" class="confirm-card">
      ${title ? `<h3>${esc(title)}</h3>` : ''}
      <p>${esc(message)}</p>
      <div class="row gap end">
        <button value="no" class="btn ghost">${esc(cancel)}</button>
        <button value="yes" class="btn ${danger ? 'danger' : 'primary'}" autofocus>${esc(ok)}</button>
      </div></form>`;
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'yes'), { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}

// ---------- toasts ----------

export function toast(message, { tone = '', action = null, actionLabel = 'Undo', ms = 3200 } = {}) {
  const wrap = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast ${tone}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button class="toast-btn">${esc(actionLabel)}</button>` : ''}`;
  wrap.append(el);
  const done = () => { el.classList.add('out'); setTimeout(() => el.remove(), 250); };
  const t = setTimeout(done, action ? Math.max(ms, 5000) : ms);
  if (action) el.querySelector('button').addEventListener('click', () => { clearTimeout(t); done(); run(action); });
  while (wrap.children.length > 3) wrap.firstElementChild.remove();
}

// ---------- celebration ----------

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function confetti(count = 36) {
  if (reduceMotion()) return;
  const colors = ['#ffc93c', '#2bb673', '#ff6b8b', '#4dabf7', '#9775fa'];
  const layer = document.createElement('div');
  layer.className = 'confetti';
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    p.style.left = `${50 + (Math.random() - 0.5) * 30}%`;
    p.style.background = colors[i % colors.length];
    p.style.setProperty('--dx', `${(Math.random() - 0.5) * 520}px`);
    p.style.setProperty('--dy', `${-180 - Math.random() * 320}px`);
    p.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
    p.style.animationDelay = `${Math.random() * 80}ms`;
    layer.append(p);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 1600);
}

export function buzz(pattern = 12) {
  if (document.documentElement.dataset.haptics === 'off') return;
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}

// ---------- files ----------

export function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickFile(accept) {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept });
    input.addEventListener('change', () => resolve(input.files?.[0] || null), { once: true });
    input.click();
  });
}

// ---------- icons (inline, stroke-based) ----------

const PATHS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-6h4v6"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18"/><circle cx="16.5" cy="15" r="1.2" fill="currentColor"/><path d="M6 6V5a2 2 0 0 1 2-2h9"/>',
  piggy: '<path d="M5 11a7 6 0 0 1 12-3l3-1-.5 3.5A6 6 0 0 1 19 15l-1 1v3h-3v-2H10v2H7v-3.5A6 6 0 0 1 5 11Z"/><circle cx="15" cy="10.5" r=".8" fill="currentColor"/><path d="M5 11H3"/>',
  chart: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
  pig: '<circle cx="12" cy="13" r="7"/><path d="M7 8 6 4l4 2.5M17 8l1-4-4 2.5"/><ellipse cx="12" cy="15" rx="3" ry="2"/><path d="M11 15h.01M13 15h.01"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  hourglass: '<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z"/>',
  snow: '<path d="M12 2v20M4.9 4.9l14.2 14.2M2 12h20M4.9 19.1 19.1 4.9"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.2" fill="currentColor"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  upload: '<path d="M12 21V9M7 14l5-5 5 5M4 3h16"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  bag: '<path d="M5 8h14l-1 13H6Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
};

export function icon(name, size = 22) {
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || ''}</svg>`;
}
