// Server-side checks so a bad entry can never be saved, whatever the page sends.

import { HttpError } from './http.js';
import { isISODate } from '../public/js/dates.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isId(value) {
  return typeof value === 'string' && UUID.test(value);
}

function niceDate(iso) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${iso}T00:00:00Z`));
}

/** Turns request data into a clean period, or explains what's wrong with it. */
export function cleanPeriod(input) {
  const { start_date, end_date, end_confirmed } = input;
  if (!isISODate(start_date)) throw new HttpError(400, 'Please pick a valid start date.');
  if (!isISODate(end_date)) throw new HttpError(400, 'Please pick a valid end date.');
  if (end_date < start_date) throw new HttpError(400, "The end date can't be before the start date.");
  // The server doesn't know your time zone, so allow anything up to "today"
  // in the furthest-ahead time zone on Earth (UTC+14).
  const latestToday = new Date(Date.now() + 14 * 3600 * 1000).toISOString().slice(0, 10);
  if (start_date > latestToday) {
    throw new HttpError(400, "A period can't start in the future.");
  }
  if (typeof end_confirmed !== 'boolean') throw new HttpError(400, 'Missing whether the end date is confirmed.');
  return { start_date, end_date, end_confirmed };
}

export function assertNoOverlap(period, others) {
  const clash = others.find((p) => p.start_date <= period.end_date && period.start_date <= p.end_date);
  if (clash) {
    throw new HttpError(
      409,
      `That overlaps with the period from ${niceDate(clash.start_date)} to ${niceDate(clash.end_date)}.`
    );
  }
}
