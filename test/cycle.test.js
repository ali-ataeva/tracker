import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, addMonths, daysBetween, isISODate, ordinal } from '../public/js/dates.js';
import { analyze, autoEndDate } from '../public/js/cycle.js';

let nextId = 1;
const period = (start_date, end_date, end_confirmed = true) => ({ id: `p${nextId++}`, start_date, end_date, end_confirmed });

test('date maths never shifts across DST, month ends or leap years', () => {
  assert.equal(addDays('2026-03-07', 2), '2026-03-09'); // US DST change
  assert.equal(addDays('2026-10-24', 3), '2026-10-27'); // EU DST change
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(daysBetween('2026-01-01', '2027-01-01'), 365);
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2026-10-09', 12), '2027-10-09');
});

test('isISODate only accepts real calendar dates', () => {
  assert.ok(isISODate('2026-02-28'));
  assert.ok(!isISODate('2026-02-30'));
  assert.ok(!isISODate('2026-2-3'));
  assert.ok(!isISODate('2026-10-09T00:00:00Z'));
  assert.ok(!isISODate(20261009));
});

test('ordinals', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 14, 21, 22, 23, 31].map(ordinal),
    ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '14th', '21st', '22nd', '23rd', '31st']);
});

test('defaults with no data', () => {
  const a = analyze([], '2026-10-09');
  assert.equal(a.cycleLength, 28);
  assert.equal(a.periodLength, 5);
  assert.equal(a.status.kind, 'empty');
  assert.equal(a.predictions.length, 0);
});

test('one period: default 28-day cycle, countdown and 12 months of predictions', () => {
  const a = analyze([period('2026-10-01', '2026-10-05')], '2026-10-09');
  assert.equal(a.cycleLength, 28);
  assert.deepEqual(a.status, { kind: 'upcoming', daysUntil: 20, expected: '2026-10-29' });
  assert.equal(a.predictions[0].start_date, '2026-10-29');
  assert.equal(a.predictions[0].end_date, '2026-11-02'); // confirmed 5-day period
  assert.ok(a.predictions.at(-1).start_date <= '2027-10-09');
  assert.ok(addDays(a.predictions.at(-1).start_date, 28) > '2027-10-09');
});

test('averages use cycles start-to-start, skip cycles over 60 days', () => {
  const periods = [
    period('2026-01-01', '2026-01-05'), // 30-day cycle
    period('2026-01-31', '2026-02-03'), // 26-day cycle
    period('2026-02-26', '2026-03-01'), // 90-day gap → ignored
    period('2026-05-27', '2026-05-31'),
  ];
  const a = analyze(periods, '2026-06-10');
  assert.equal(a.cycleStats.count, 2);
  assert.equal(a.cycleStats.average, 28);
  assert.equal(a.cycleStats.shortest, 26);
  assert.equal(a.cycleStats.longest, 30);
  assert.equal(a.cycles.find((c) => c.length === 90).counted, false);
  assert.equal(a.periodStats.count, 4);
  assert.equal(a.periodStats.shortest, 4);
  assert.equal(a.periodStats.longest, 5);
});

test('only confirmed periods count towards period length', () => {
  const a = analyze([period('2026-08-01', '2026-08-07'), period('2026-08-29', '2026-09-02', false)], '2026-09-20');
  assert.equal(a.periodStats.count, 1);
  assert.equal(a.periodLength, 7);
  assert.equal(a.cycleLength, 28);
});

test('day N of period, late, and needs-confirmation', () => {
  const during = analyze([period('2026-10-07', '2026-10-11', false)], '2026-10-09');
  assert.equal(during.status.kind, 'period');
  assert.equal(during.status.day, 3);
  assert.equal(during.needsEndConfirmation.length, 0);

  const late = analyze([period('2026-09-01', '2026-09-05', false)], '2026-10-02');
  assert.deepEqual(late.status, { kind: 'late', daysLate: 3, expected: '2026-09-29' });
  assert.equal(late.predictions[0].start_date, '2026-10-02');
  assert.equal(late.needsEndConfirmation.length, 1);

  const dueToday = analyze([period('2026-09-11', '2026-09-15')], '2026-10-09');
  assert.deepEqual(dueToday.status, { kind: 'upcoming', daysUntil: 0, expected: '2026-10-09' });
});

test('auto end date stops before the next logged period', () => {
  const periods = [period('2026-09-10', '2026-09-14')];
  assert.equal(autoEndDate('2026-08-01', periods, 5), '2026-08-05');
  assert.equal(autoEndDate('2026-09-07', periods, 5), '2026-09-09');
});

test('falls back to 28 days when every cycle is too long to count', () => {
  const a = analyze([period('2026-01-01', '2026-01-05'), period('2026-04-01', '2026-04-05')], '2026-04-10');
  assert.equal(a.cycleStats, null);
  assert.equal(a.cycleLength, 28);
  assert.equal(a.cycles[0].counted, false);
  assert.deepEqual(a.status, { kind: 'upcoming', daysUntil: 19, expected: '2026-04-29' });
});
