// Dev harness, loaded only with ?dev. window.T lets you poke the app from the console.
import { getState, commit, replaceState, resetAll, exportJSON } from './store.js';
import { decide, addTransaction, saveBill, toggleBillPaid, saveGoal, deposit, toggleEnvelope, addCooldown, toggleNoBuy, award } from './actions.js';
import { dayKey, monthKey, addDays, shiftMonth } from './calc.js';
import { defaultState } from './schema.js';

function seed() {
  const s = defaultState();
  replaceState({ ...s, onboarded: true, settings: { ...s.settings, hourlyRate: 25, birthday: '1999-04-12', monthlyBudget: 1800 } });
  const now = new Date();
  commit((st) => {
    const rnd = (a, b) => Math.round((a + Math.random() * (b - a)) * 100) / 100;
    const cats = ['food', 'groceries', 'shopping', 'transport', 'fun', 'subscriptions', 'tech', 'clothes'];
    for (let m = 5; m >= 0; m--) {
      const key = shiftMonth(monthKey(now), -m);
      const [y, mo] = key.split('-').map(Number);
      const last = m === 0 ? now.getDate() : new Date(y, mo, 0).getDate();
      for (let i = 0; i < 22; i++) {
        const d = 1 + Math.floor(Math.random() * last);
        addTransaction(st, { type: 'expense', amount: rnd(4, 90), name: '', category: cats[i % cats.length], date: `${key}-${String(d).padStart(2, '0')}` });
      }
      addTransaction(st, { type: 'income', amount: 1600, name: 'Paycheck', category: 'paycheck', date: `${key}-01` });
      if (`${key}-15` <= dayKey(now)) addTransaction(st, { type: 'income', amount: 1600, name: 'Paycheck', category: 'paycheck', date: `${key}-15` });
    }
    const rent = saveBill(st, { name: 'Rent', amount: 950, dueDay: 1, category: 'home' });
    saveBill(st, { name: 'Phone', amount: 45, dueDay: 18, category: 'bills' });
    saveBill(st, { name: 'Streaming', amount: 15.99, dueDay: 25, category: 'subscriptions' });
    toggleBillPaid(st, rent.id, monthKey(now), now);
    const items = [['AirPods Pro', 249, 'skip'], ['Sneakers', 120, 'skip'], ['Coffee', 6.5, 'buy'], ['Video game', 69.99, 'skip'], ['Lamp', 39, 'buy'], ['Jacket', 180, 'skip']];
    items.forEach(([name, price, v], i) => decide(st, { price, name, category: 'shopping' }, v, addDays(now, -i * 3)));
    const trip = saveGoal(st, { name: 'Trip to Japan', emoji: '✈️', target: 3000, deadline: dayKey(addDays(now, 240)) });
    deposit(st, trip.id, 640, 'Start', now);
    const ef = saveGoal(st, { name: 'Emergency fund', emoji: '🛟', target: 5000 });
    deposit(st, ef.id, 1200, '', now);
    [3, 17, 24, 41, 58, 66, 80, 99].forEach((n) => toggleEnvelope(st, n, now));
    addCooldown(st, { name: 'Standing desk', price: 329, hours: 30 }, addDays(now, -1));
    addCooldown(st, { name: 'Mechanical keyboard', price: 149, hours: 48 }, now);
    for (let i = 1; i <= 4; i++) toggleNoBuy(st, dayKey(addDays(now, -i)), now);
    award(st, 300, 'Dev seed', now);
  });
  return getState();
}

export function install() {
  window.T = {
    state: getState,
    commit,
    seed,
    reset: resetAll,
    export: exportJSON,
    skipOnboarding: () => commit((st) => { st.onboarded = true; }),
    points: (n = 500) => commit((st) => award(st, n, 'Dev points')),
  };
  console.info('Hourwise dev harness ready: T.seed(), T.reset(), T.points(), T.state()');
}
