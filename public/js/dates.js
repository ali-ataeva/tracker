// Every date in this app is a plain calendar date written as "YYYY-MM-DD".
// There are no times or time zones anywhere, so a date can never shift by a day.
// For arithmetic we turn a date into a whole "day number" (days since 1970-01-01)
// and back again.

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isISODate(value) {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  if (y < 1900 || y > 2200) return false;
  const check = new Date(Date.UTC(y, m - 1, d));
  return check.getUTCMonth() === m - 1 && check.getUTCDate() === d;
}

export function toDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

export function fromDay(dayNumber) {
  return new Date(dayNumber * MS_PER_DAY).toISOString().slice(0, 10);
}

export function addDays(iso, days) {
  return fromDay(toDay(iso) + days);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a, b) {
  return toDay(b) - toDay(a);
}

/** Adds calendar months, keeping the day where possible (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(iso, months) {
  const { y, m, d } = parts(iso);
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = index - year * 12 + 1;
  const lastDay = daysInMonth(year, month);
  return isoFrom(year, month, Math.min(d, lastDay));
}

export function parts(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

export function isoFrom(y, m, d) {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(iso) {
  return new Date(toDay(iso) * MS_PER_DAY).getUTCDay();
}

/** Today's date on this device's own calendar. */
export function todayISO(now = new Date()) {
  return isoFrom(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** A Date object for display only, pinned to UTC so formatting never shifts the day. */
export function displayDate(iso) {
  return new Date(toDay(iso) * MS_PER_DAY);
}

export function formatDate(iso, options = { month: 'short', day: 'numeric' }) {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: 'UTC' }).format(displayDate(iso));
}

export function formatRange(startIso, endIso, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  const format = new Intl.DateTimeFormat(undefined, { ...options, timeZone: 'UTC' });
  if (startIso === endIso) return format.format(displayDate(startIso));
  return format.formatRange(displayDate(startIso), displayDate(endIso));
}

export function ordinal(n) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'}`;
}
