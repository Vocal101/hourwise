// Tests for the money math, actions and data sanitizer. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hourlyRate, workHours, splitWorkTime, futureValue, investYears, investedInstead, withSalesTax, budgetSummary,
  envelopeGoal, envelopeTotal, randomEmptyEnvelope, noBuyStreak, bestStreak, goalProgress, ageOn, savingsStats, shiftMonth,
} from '../js/calc.js';
import { defaultState, sanitize } from '../js/schema.js';
import * as A from '../js/actions.js';
import { workTime } from '../js/format.js';
import { parseMoney } from '../js/views/common.js';

const settings = (o = {}) => ({ ...defaultState().settings, ...o });
const NOW = new Date(2026, 9, 15, 12, 0); // Oct 15 2026, local time

test('hourly rate from hourly pay, salary and take-home', () => {
  assert.equal(hourlyRate(settings({ incomeType: 'hourly', hourlyRate: 30 })), 30);
  assert.equal(hourlyRate(settings({ incomeType: 'salary', salary: 52000, hoursPerWeek: 40 })), 25);
  assert.equal(hourlyRate(settings({ incomeType: 'hourly', hourlyRate: 20, takeHome: true, taxRate: 25 })), 15);
  assert.equal(hourlyRate(settings({ incomeType: 'hourly', hourlyRate: 0 })), 0);
  assert.equal(hourlyRate(settings({ incomeType: 'hourly', hourlyRate: 'abc' })), 0);
});

test('work time splits into work days, hours and minutes', () => {
  const s = settings({ hourlyRate: 25, hoursPerWeek: 40, daysPerWeek: 5 });
  assert.equal(workHours(100, s), 4);
  assert.deepEqual(splitWorkTime(20, s), { days: 2, hours: 4, minutes: 0, totalHours: 20 });
  assert.equal(workTime(20, s), '2 days 4 hrs');
  assert.equal(workTime(1.25, s), '1 hr 15 min');
  assert.equal(workTime(0.2, s), '12 min');
  assert.equal(workTime(0.001, s), '< 1 min');
  assert.equal(workTime(0, s), '0 min');
  assert.equal(workTime(20, s, { long: true }), '2 work days, 4 hours');
  // A 4-day, 32-hour week means 8-hour days.
  assert.equal(splitWorkTime(17, settings({ hoursPerWeek: 32, daysPerWeek: 4 })).days, 2);
});

test('investment projection matches the reference app’s 45.26× at 10% over 40 years', () => {
  assert.ok(Math.abs(futureValue(250, 10, 40) - 11314) < 1);
  assert.ok(Math.abs(futureValue(600, 10, 40) - 27155) < 1);
  const s = settings({ birthday: '2001-03-01', retirementAge: 65, returnRate: 10 });
  assert.equal(ageOn('2001-03-01', NOW), 25);
  assert.equal(ageOn('2001-11-01', NOW), 24, 'birthday later this year not reached yet');
  assert.equal(investYears(s, NOW), 40);
  assert.equal(investYears(settings({ birthday: '' }), NOW), 30);
  assert.equal(investYears(settings({ birthday: '1950-01-01' }), NOW), 1, 'past retirement still compounds a year');
  assert.equal(investedInstead(100, s, NOW).age, 25);
});

test('sales tax applies only when on', () => {
  assert.equal(withSalesTax(100, settings({ salesTaxOn: false, salesTaxRate: 8 })), 100);
  assert.equal(withSalesTax(100, settings({ salesTaxOn: true, salesTaxRate: 8.25 })), 108.25);
});

test('envelope challenge totals', () => {
  assert.equal(envelopeGoal(1), 5050);
  assert.equal(envelopeGoal(0.5), 2525);
  assert.equal(envelopeTotal([1, 2, 100], 2), 206);
  const all = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(randomEmptyEnvelope(all), null);
  assert.equal(randomEmptyEnvelope(all.filter((n) => n !== 42)), 42);
});

test('no-buy streaks', () => {
  const days = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-01', '2026-10-02'];
  assert.equal(noBuyStreak(days, NOW), 3, 'counts back from yesterday when today is unmarked');
  assert.equal(noBuyStreak([...days, '2026-10-15'], NOW), 4);
  assert.equal(noBuyStreak(['2026-10-10'], NOW), 0);
  assert.equal(bestStreak(days), 3);
  assert.equal(bestStreak(['2026-02-28', '2026-03-01', '2026-03-02']), 3, 'spans month ends');
});

test('goal progress and monthly need', () => {
  const g = { target: 1200, deadline: '2027-04-15', deposits: [{ amount: 300 }, { amount: -100 }] };
  const p = goalProgress(g, NOW);
  assert.equal(p.saved, 200);
  assert.equal(p.remaining, 1000);
  assert.equal(p.monthsLeft, 6);
  assert.ok(Math.abs(p.perMonth - 1000 / 6) < 1e-9);
  assert.equal(goalProgress({ target: 100, deposits: [{ amount: 150 }] }, NOW).done, true);
});

test('decide: bye earns points, buy logs an expense, delete undoes both', () => {
  const st = sanitize({ settings: { hourlyRate: 20 } });
  const bye = A.decide(st, { price: 100, name: 'Shoes' }, 'skip', NOW);
  assert.equal(bye.verdict, 'skip');
  assert.ok(bye.pts >= 10);
  assert.equal(st.pig.points, bye.pts);
  const buy = A.decide(st, { price: 40, name: 'Book', category: 'education' }, 'buy', NOW);
  assert.equal(st.transactions.length, 1);
  assert.equal(st.transactions[0].amount, 40);
  assert.equal(savingsStats(st, NOW).saved, 100);
  A.deleteDecision(st, buy.id, NOW);
  assert.equal(st.transactions.length, 0);
  A.deleteDecision(st, bye.id, NOW);
  assert.equal(st.pig.points, 0);
  assert.throws(() => A.decide(st, { price: 0 }, 'skip', NOW));
});

test('budget summary with bills and safe-to-spend', () => {
  const st = sanitize({ settings: { monthlyBudget: 1000, hourlyRate: 20 } });
  A.addTransaction(st, { type: 'expense', amount: 200, category: 'food', date: '2026-10-03' });
  A.addTransaction(st, { type: 'income', amount: 1500, category: 'paycheck', date: '2026-10-01' });
  A.addTransaction(st, { type: 'expense', amount: 999, category: 'food', date: '2026-09-03' });
  const rent = A.saveBill(st, { name: 'Rent', amount: 500, dueDay: 31 });
  let s = budgetSummary(st, '2026-10', NOW);
  assert.equal(s.spent, 200);
  assert.equal(s.income, 1500);
  assert.equal(s.left, 800);
  assert.equal(s.unpaidBills, 500);
  assert.equal(s.safe, 300);
  assert.equal(s.daysLeft, 17);
  A.toggleBillPaid(st, rent.id, '2026-10', NOW);
  s = budgetSummary(st, '2026-10', NOW);
  assert.equal(s.spent, 700);
  assert.equal(s.unpaidBills, 0);
  assert.equal(s.safe, 300, 'paying a bill moves it from due to spent');
  A.toggleBillPaid(st, rent.id, '2026-10', NOW);
  assert.equal(budgetSummary(st, '2026-10', NOW).spent, 200);
  assert.equal(A.billDueDate({ dueDay: 31 }, '2026-02'), '2026-02-28');
});

test('month review awards under-budget bonus once', () => {
  const st = sanitize({ settings: { monthlyBudget: 500 } });
  A.addTransaction(st, { type: 'expense', amount: 100, date: '2026-09-10' });
  A.addTransaction(st, { type: 'expense', amount: 900, date: '2026-08-10' });
  const r = A.reviewMonths(st, NOW);
  assert.deepEqual(r.map((x) => x.verdict), ['over', 'under']);
  assert.equal(st.pig.points, 50);
  assert.equal(A.reviewMonths(st, NOW).length, 0);
});

test('cooldown, shop block, challenge, room purchase', () => {
  const st = sanitize({ settings: { hourlyRate: 20 } });
  const item = A.addCooldown(st, { name: 'Desk', price: 300, hours: 24 }, NOW);
  assert.equal(item.status, 'waiting');
  const r = A.resolveCooldown(st, item.id, 'skipped', NOW);
  assert.ok(r.points > 10);
  assert.equal(savingsStats(st, NOW).saved, 300);
  assert.equal(A.resolveCooldown(st, item.id, 'bought', NOW), null, 'can’t decide twice');

  A.startBlock(st, 1, ['Amazon'], NOW);
  assert.ok(A.isBlocked(st, NOW));
  assert.throws(() => A.startBlock(st, 1, [], NOW));
  assert.equal(A.checkBlock(st, NOW), 0);
  const later = new Date(NOW.getTime() + 2 * 3600000);
  assert.ok(A.checkBlock(st, later) >= 10);
  assert.equal(st.shopBlock.history[0].result, 'done');

  A.rollChallenge(st, NOW, () => 0);
  assert.equal(st.challenge.today.status, 'offered');
  A.setChallengeStatus(st, 'accepted', NOW);
  const pts = A.setChallengeStatus(st, 'done', NOW);
  assert.equal(pts, 20);
  A.rolloverChallenge(st, new Date(2026, 9, 16));
  assert.equal(st.challenge.history.length, 1);
  assert.equal(st.challenge.today, null);

  st.pig.points = 10;
  assert.throws(() => A.buyItem(st, 'crown', NOW), /more points/);
  st.pig.points = 600;
  A.buyItem(st, 'crown', NOW);
  assert.equal(st.pig.placed.hat, 'crown');
  assert.equal(st.pig.points, 100);
  A.togglePlaced(st, 'crown');
  assert.equal(st.pig.placed.hat, undefined);
});

test('achievements unlock once and pay out', () => {
  const st = sanitize({ settings: { hourlyRate: 20 } });
  A.decide(st, { price: 150 }, 'skip', NOW);
  const got = A.checkAchievements(st, NOW).map((a) => a.id);
  assert.ok(got.includes('first-bye'));
  assert.ok(got.includes('saved-100'));
  assert.equal(A.checkAchievements(st, NOW).length, 0);
});

test('sanitize repairs junk and keeps good data', () => {
  assert.deepEqual(sanitize(null).decisions, []);
  const st = sanitize({
    onboarded: true,
    settings: { currency: 'eur!', hoursPerWeek: 500, theme: 'neon', returnRate: -3 },
    transactions: [{ amount: 12.345, date: '2026-10-01', category: 'nope' }, { amount: -5 }, 'junk'],
    goals: [{ name: 'Trip', target: '1000', deposits: [{ amount: 50, date: 'x' }] }],
    pig: { points: -20, owned: ['crown', 'fake'], placed: { hat: 'crown', rug: 'fake' } },
    noBuyDays: ['2026-10-01', '2026-10-01', 'bad'],
  });
  assert.equal(st.settings.currency, 'USD');
  assert.equal(st.settings.hoursPerWeek, 168);
  assert.equal(st.settings.theme, 'system');
  assert.equal(st.settings.returnRate, 0);
  assert.equal(st.transactions.length, 1, 'non-positive amounts and non-objects are dropped');
  assert.equal(st.transactions[0].amount, 12.35);
  assert.equal(st.transactions[0].category, 'other');
  assert.equal(st.goals[0].target, 1000);
  assert.equal(st.pig.points, 0);
  assert.deepEqual(st.pig.owned, ['crown']);
  assert.deepEqual(st.pig.placed, { hat: 'crown' });
  assert.deepEqual(st.noBuyDays, ['2026-10-01']);
  // Round-trips cleanly.
  assert.deepEqual(sanitize(JSON.parse(JSON.stringify(st))), st);
});

test('money parsing handles common formats', () => {
  assert.equal(parseMoney('1,299.99'), 1299.99);
  assert.equal(parseMoney('1.299,99'), 1299.99);
  assert.equal(parseMoney('12,5'), 12.5);
  assert.equal(parseMoney('$ 40'), 40);
  assert.ok(Number.isNaN(parseMoney('')));
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
});
