// Runs the real /api handlers against practice-mode storage in a temp folder.

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.LOCAL_DATA_FILE = path.join(mkdtempSync(path.join(tmpdir(), 'pt-')), 'periods.json');
process.env.APP_PASSCODE = 'sunflower seeds';
delete process.env.SUPABASE_URL;
delete process.env.VERCEL;

const periods = await import('../api/periods.js');
const login = await import('../api/login.js');

const BASE = 'https://tracker.example';
let cookie = '';

function call(handler, { method = 'GET', query = '', body, headers = {} } = {}) {
  return handler(
    new Request(`${BASE}/api/x${query}`, {
      method,
      headers: { host: 'tracker.example', cookie, ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    })
  );
}

before(async () => {
  const wrong = await call(login.POST, { method: 'POST', body: { passcode: 'nope' } });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.headers.get('set-cookie'), null);

  const right = await call(login.POST, { method: 'POST', body: { passcode: '  sunflower seeds ' } });
  assert.equal(right.status, 200);
  const setCookie = right.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Lax/);
  cookie = setCookie.split(';')[0];
});

test('nothing is readable or writable without the passcode cookie', async () => {
  const saved = cookie;
  cookie = '';
  assert.equal((await call(periods.GET)).status, 401);
  assert.equal((await call(periods.POST, { method: 'POST', body: { start_date: '2026-01-01', end_date: '2026-01-05', end_confirmed: true } })).status, 401);
  cookie = 'pt_session=forged';
  assert.equal((await call(periods.GET)).status, 401);
  cookie = saved;
  assert.equal((await call(periods.GET)).status, 200);
});

test('create, list, edit and delete', async () => {
  const created = await call(periods.POST, { method: 'POST', body: { start_date: '2026-09-01', end_date: '2026-09-05', end_confirmed: false } });
  assert.equal(created.status, 201);
  const { period } = await created.json();
  assert.equal(period.start_date, '2026-09-01');
  assert.equal(period.end_confirmed, false);

  const edited = await call(periods.PATCH, { method: 'PATCH', query: `?id=${period.id}`, body: { end_date: '2026-09-04', end_confirmed: true } });
  assert.equal(edited.status, 200);
  assert.deepEqual((await edited.json()).period, { ...period, end_date: '2026-09-04', end_confirmed: true });

  const list = await (await call(periods.GET)).json();
  assert.equal(list.periods.length, 1);

  assert.equal((await call(periods.DELETE, { method: 'DELETE', query: `?id=${period.id}` })).status, 200);
  assert.equal((await call(periods.DELETE, { method: 'DELETE', query: `?id=${period.id}` })).status, 404);
  assert.equal((await (await call(periods.GET)).json()).periods.length, 0);
});

test('rejects overlaps, backwards dates, future starts and junk', async () => {
  const ok = await call(periods.POST, { method: 'POST', body: { start_date: '2026-08-01', end_date: '2026-08-05', end_confirmed: true } });
  assert.equal(ok.status, 201);
  const { period } = await ok.json();

  const overlap = await call(periods.POST, { method: 'POST', body: { start_date: '2026-08-05', end_date: '2026-08-08', end_confirmed: false } });
  assert.equal(overlap.status, 409);
  assert.match((await overlap.json()).error, /overlaps/);

  const backwards = await call(periods.POST, { method: 'POST', body: { start_date: '2026-07-10', end_date: '2026-07-09', end_confirmed: true } });
  assert.equal(backwards.status, 400);

  const future = await call(periods.POST, { method: 'POST', body: { start_date: '2099-01-01', end_date: '2099-01-05', end_confirmed: false } });
  assert.equal(future.status, 400);

  const junk = await call(periods.POST, { method: 'POST', body: { start_date: '2026-02-30', end_date: '2026-03-02', end_confirmed: true } });
  assert.equal(junk.status, 400);

  const adjacent = await call(periods.POST, { method: 'POST', body: { start_date: '2026-08-06', end_date: '2026-08-07', end_confirmed: true } });
  assert.equal(adjacent.status, 201);

  // Editing a period into its neighbour is blocked too.
  const stretch = await call(periods.PATCH, { method: 'PATCH', query: `?id=${period.id}`, body: { end_date: '2026-08-06' } });
  assert.equal(stretch.status, 409);
});

test('blocks requests sent from other websites', async () => {
  const res = await call(periods.POST, {
    method: 'POST',
    headers: { origin: 'https://evil.example' },
    body: { start_date: '2026-06-01', end_date: '2026-06-05', end_confirmed: true },
  });
  assert.equal(res.status, 403);
});

test('changing the passcode logs everyone out', async () => {
  process.env.APP_PASSCODE = 'a brand new passcode';
  assert.equal((await call(periods.GET)).status, 401);
  process.env.APP_PASSCODE = 'sunflower seeds';
  assert.equal((await call(periods.GET)).status, 200);
});
