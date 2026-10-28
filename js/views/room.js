// The mascot's room: points, decorations shop, badges, points history.
import { getState, commit } from '../store.js';
import { buyItem, togglePlaced } from '../actions.js';
import { ROOM_ITEMS, SLOT_LABELS, ACHIEVEMENTS } from '../data.js';
import { budgetSummary, monthKey, dayKey } from '../calc.js';
import { relativeDay } from '../format.js';
import { esc, icon, onAct, onForm, openSheet, closeSheet, sheetHeader, toast, confetti, buzz, $ } from '../ui.js';
import { pigSVG } from '../pig.js';

const LINES = {
  happy: ['You’re on a roll!', 'Every bye makes me rounder.', 'Oink! Look at us go.', 'I love it when you skip stuff.', 'Best roommate ever.'],
  neutral: ['Hi! Got anything to weigh today?', 'Skip one thing today and I’ll do a little dance.', 'I could use a new rug… just saying.', 'Check a price on the Home tab?'],
  sad: ['The budget’s looking tight…', 'Maybe a no-buy day tomorrow?', 'We can turn this month around.', 'I believe in you. Mostly.'],
};

export function mood(state, now = new Date()) {
  const sum = budgetSummary(state, monthKey(now), now);
  if (state.settings.monthlyBudget > 0 && sum.left < 0) return 'sad';
  const since = now.getTime() - 2 * 86400000;
  const recent = state.pig.log.some((l) => l.pts > 0 && Date.parse(l.at) > since);
  return recent || state.noBuyDays.includes(dayKey(now)) ? 'happy' : 'neutral';
}

export function render(state) {
  const pig = state.pig;
  const m = mood(state);
  const slots = Object.keys(SLOT_LABELS);
  const unlocked = ACHIEVEMENTS.filter((a) => state.achievements[a.id]).length;
  return `
  <section class="room-card">
    <div class="room-top">
      <button class="pig-name" data-act="rename-pig">${esc(pig.name)} ${icon('edit', 14)}</button>
      <span class="points-pill" aria-label="${pig.points} points">🪙 ${pig.points}</span>
    </div>
    <button class="room-btn" data-act="poke-pig" aria-label="Pet ${esc(pig.name)}">${pigSVG(pig.placed, m, { label: `${pig.name} in their room` })}</button>
    <p class="bubble" id="pig-bubble">${esc(LINES[m][0])}</p>
  </section>

  <section class="card">
    <h3>Earn points</h3>
    <ul class="earn">
      <li><span>👋</span>Say bye to a purchase <b>10–60</b></li>
      <li><span>🧊</span>Skip after a cooldown <b>+10 bonus</b></li>
      <li><span>📅</span>No-buy day <b>15</b></li>
      <li><span>🎲</span>Finish the daily challenge <b>20</b></li>
      <li><span>✉️</span>Fill an envelope <b>5</b></li>
      <li><span>🛡️</span>Finish a Shop Block <b>10–100</b></li>
      <li><span>📉</span>Finish a month under budget <b>50</b></li>
      <li><span>🏅</span>Unlock badges <b>20–500</b></li>
    </ul>
  </section>

  <section class="section">
    <div class="section-head"><h2>Decorate</h2><span class="muted small">${pig.owned.length}/${ROOM_ITEMS.length} owned</span></div>
    ${slots.map((slot) => {
      const items = ROOM_ITEMS.filter((i) => i.slot === slot);
      return `<h3 class="group-label">${SLOT_LABELS[slot]}</h3><div class="shop-grid">${items.map((item) => {
        const owned = pig.owned.includes(item.id);
        const placed = pig.placed[slot] === item.id;
        const afford = pig.points >= item.cost;
        const art = item.emoji ? `<span class="shop-emoji">${item.emoji}</span>` : `<span class="shop-swatch" style="background:${item.color}"></span>`;
        return `<button class="shop-item ${placed ? 'placed' : ''} ${owned ? 'owned' : ''}" data-act="${owned ? 'place-item' : 'buy-item'}" data-id="${item.id}" ${!owned && !afford ? 'aria-disabled="true"' : ''}>
          ${art}<span class="shop-name">${esc(item.name)}</span>
          <span class="shop-cost">${placed ? 'In room ✓' : owned ? 'Place' : `🪙 ${item.cost}`}</span></button>`;
      }).join('')}</div>`;
    }).join('')}
  </section>

  <section class="section">
    <div class="section-head"><h2>Badges</h2><span class="muted small">${unlocked}/${ACHIEVEMENTS.length}</span></div>
    <div class="badge-grid">${ACHIEVEMENTS.map((a) => {
      const got = state.achievements[a.id];
      return `<div class="badge ${got ? 'got' : ''}" title="${esc(a.desc)}"><span class="badge-emoji">${got ? a.emoji : '🔒'}</span><b>${esc(a.name)}</b><small>${esc(a.desc)}</small><small class="muted">+${a.points}</small></div>`;
    }).join('')}</div>
  </section>

  ${pig.log.length ? `<section class="section">
    <div class="section-head"><h2>Points history</h2><span class="muted small">${pig.lifetime} earned all time</span></div>
    <ul class="list">${[...pig.log].reverse().slice(0, 15).map((l) => `<li class="row-item"><div class="grow"><b>${esc(l.reason)}</b><small class="muted">${relativeDay(dayKey(new Date(l.at)))}</small></div><span class="amt ${l.pts > 0 ? 'green' : 'red'}">${l.pts > 0 ? '+' : ''}${l.pts}</span></li>`).join('')}</ul>
  </section>` : ''}`;
}

onAct({
  'poke-pig': (el) => {
    const state = getState();
    const lines = LINES[mood(state)];
    const bubble = $('#pig-bubble');
    if (bubble) bubble.textContent = lines[Math.floor(Math.random() * lines.length)];
    const body = el.querySelector('.pig-body');
    if (body) { body.classList.remove('boing'); void body.getBBox(); body.classList.add('boing'); }
    buzz(8);
  },
  'buy-item': (el) => {
    const { result } = commit((st) => buyItem(st, el.dataset.id));
    confetti(24);
    buzz([10, 30, 10]);
    toast(`${result.name} is in the room!`, { tone: 'good' });
  },
  'place-item': (el) => {
    commit((st) => togglePlaced(st, el.dataset.id));
  },
  'rename-pig': () => {
    const pig = getState().pig;
    openSheet(`${sheetHeader('Rename your pig')}
      <form data-form="rename" class="stack" novalidate>
        <input class="input" name="name" maxlength="24" value="${esc(pig.name)}" required autofocus>
        <button class="btn primary block lg">Save</button>
      </form>`);
  },
});

onForm({
  rename: (v) => {
    const name = String(v.name || '').trim().slice(0, 24);
    if (!name) throw new Error('Pick a name.');
    commit((st) => { st.pig.name = name; });
    closeSheet();
  },
});
