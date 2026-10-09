// The shared passcode lives only on the server (the APP_PASSCODE setting).
// Entering it correctly gives the browser a long-lived, HttpOnly cookie, so
// each browser only has to enter it once. Changing APP_PASSCODE changes the
// cookie value too, which logs every browser out.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError } from './http.js';

const COOKIE_NAME = 'pt_session';
// 400 days is the longest a browser will keep a cookie. It's renewed on every
// visit, so in practice you stay logged in for as long as you keep using it.
const COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

function configuredPasscode() {
  const code = (process.env.APP_PASSCODE || '').trim();
  if (code) return code;
  if (process.env.VERCEL) throw new HttpError(500, 'The APP_PASSCODE setting is missing in Vercel.');
  return 'practice'; // local practice mode only
}

function signingKey() {
  const key = process.env.SESSION_SECRET || process.env.SUPABASE_SECRET_KEY;
  if (key) return key;
  if (process.env.VERCEL) throw new HttpError(500, 'The SUPABASE_SECRET_KEY setting is missing in Vercel.');
  return 'local-practice-mode';
}

function sign(value) {
  return createHmac('sha256', signingKey()).update(value).digest('base64url');
}

function safeEqual(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function sessionToken() {
  return sign(`period-tracker-session:v1:${configuredPasscode()}`);
}

export function passcodeMatches(attempt) {
  if (typeof attempt !== 'string') return false;
  // Compare signatures rather than the raw text so the check takes the same
  // time no matter how much of the guess was right.
  return safeEqual(sign(`passcode:${attempt.trim()}`), sign(`passcode:${configuredPasscode()}`));
}

function readCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

export function isLoggedIn(request) {
  const token = readCookie(request, COOKIE_NAME);
  return Boolean(token) && safeEqual(token, sessionToken());
}

export function requireLogin(request) {
  if (!isLoggedIn(request)) throw new HttpError(401, 'Please enter the passcode.');
}

function isHttps(request) {
  return request.headers.get('x-forwarded-proto') === 'https' || new URL(request.url).protocol === 'https:';
}

export function sessionCookie(request) {
  const secure = isHttps(request) ? '; Secure' : '';
  return `${COOKIE_NAME}=${sessionToken()}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax${secure}`;
}

export function clearedSessionCookie(request) {
  const secure = isHttps(request) ? '; Secure' : '';
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
}
