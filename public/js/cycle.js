// All the prediction and stats maths lives here. It only works with plain
// "YYYY-MM-DD" dates and is recalculated from scratch every time the list of
// periods changes, so adding, editing or deleting anything updates everything.

import { addDays, addMonths, daysBetween } from './dates.js';

export const DEFAULT_CYCLE_LENGTH = 28;
export const DEFAULT_PERIOD_LENGTH = 5;
/** Cycles longer than this probably mean a period wasn't logged, so they're ignored. */
export const MAX_CYCLE_LENGTH = 60;
export const PREDICTION_MONTHS = 12;

function summarize(values) {
  if (values.length === 0) return null;
  const total = values.reduce((sum, v) => sum + v, 0);
  return {
    average: total / values.length,
    shortest: Math.min(...values),
    longest: Math.max(...values),
    count: values.length,
  };
}

export function periodLength(period) {
  return daysBetween(period.start_date, period.end_date) + 1;
}

export function sortByStart(periods) {
  return [...periods].sort((a, b) => a.start_date.localeCompare(b.start_date));
}

/**
 * Cycle = from one period's start to the next period's start.
 * Returns one entry per pair of neighbouring periods, flagged when it's too
 * long to count.
 */
export function cyclesOf(sortedPeriods) {
  const cycles = [];
  for (let i = 1; i < sortedPeriods.length; i++) {
    const from = sortedPeriods[i - 1];
    const to = sortedPeriods[i];
    const length = daysBetween(from.start_date, to.start_date);
    cycles.push({ from, to, length, counted: length <= MAX_CYCLE_LENGTH });
  }
  return cycles;
}

/**
 * Everything the page needs, worked out from the list of logged periods and
 * today's date.
 */
export function analyze(periods, today) {
  const sorted = sortByStart(periods);
  const cycles = cyclesOf(sorted);

  const cycleStats = summarize(cycles.filter((c) => c.counted).map((c) => c.length));
  const periodStats = summarize(sorted.filter((p) => p.end_confirmed).map(periodLength));

  const cycleLength =
    sorted.length >= 2 && cycleStats ? Math.round(cycleStats.average) : DEFAULT_CYCLE_LENGTH;
  const periodLengthPrediction = periodStats ? Math.round(periodStats.average) : DEFAULT_PERIOD_LENGTH;

  const started = sorted.filter((p) => p.start_date <= today);
  const last = started[started.length - 1] || null;
  const current = started.find((p) => p.start_date <= today && today <= p.end_date) || null;

  let status = { kind: 'empty' };
  let nextStart = null;
  if (last) {
    const expected = addDays(last.start_date, cycleLength);
    if (current) {
      status = { kind: 'period', day: daysBetween(current.start_date, today) + 1, period: current };
      nextStart = expected;
    } else if (expected < today) {
      // Overdue: it could start any day now, so predictions start from today.
      status = { kind: 'late', daysLate: daysBetween(expected, today), expected };
      nextStart = today;
    } else {
      status = { kind: 'upcoming', daysUntil: daysBetween(today, expected), expected };
      nextStart = expected;
    }
  }

  const predictions = [];
  if (nextStart) {
    const until = addMonths(today, PREDICTION_MONTHS);
    for (let start = nextStart; start <= until; start = addDays(start, cycleLength)) {
      predictions.push({ start_date: start, end_date: addDays(start, periodLengthPrediction - 1) });
    }
  }

  const needsEndConfirmation = sorted.filter((p) => !p.end_confirmed && p.end_date < today);

  return {
    periods: sorted,
    cycles,
    cycleStats,
    periodStats,
    cycleLength,
    periodLength: periodLengthPrediction,
    status,
    predictions,
    needsEndConfirmation,
  };
}

/**
 * The end date to fill in automatically for a period starting on `start`:
 * the predicted period length, but never running into the next logged period.
 */
export function autoEndDate(start, periods, predictedLength, ignoreId = null) {
  let end = addDays(start, predictedLength - 1);
  for (const p of periods) {
    if (p.id === ignoreId) continue;
    if (p.start_date > start && p.start_date <= end) end = addDays(p.start_date, -1);
  }
  return end;
}

/** The logged period (if any) that covers a given date. */
export function periodOn(date, periods) {
  return periods.find((p) => p.start_date <= date && date <= p.end_date) || null;
}
