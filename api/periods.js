// /api/periods
//   GET            → every logged period
//   POST           → log a new period
//   PATCH  ?id=…   → change a period
//   DELETE ?id=…   → delete a period
// Every request must carry the passcode cookie.

import { requireLogin, sessionCookie } from '../lib/auth.js';
import { assertSameOrigin, HttpError, json, readJson, route } from '../lib/http.js';
import { getStore } from '../lib/store.js';
import { assertNoOverlap, cleanPeriod, isId } from '../lib/validate.js';

function idFrom(request) {
  const id = new URL(request.url).searchParams.get('id');
  if (!isId(id)) throw new HttpError(404, "That period doesn't exist any more. Try refreshing the page.");
  return id;
}

export const GET = route(async (request) => {
  requireLogin(request);
  const periods = await getStore().list();
  // Renew the cookie on every visit so you stay logged in.
  return json({ periods }, { headers: { 'set-cookie': sessionCookie(request) } });
});

export const POST = route(async (request) => {
  assertSameOrigin(request);
  requireLogin(request);
  const period = cleanPeriod(await readJson(request));
  const store = getStore();
  assertNoOverlap(period, await store.list());
  return json({ period: await store.create(period) }, { status: 201 });
});

export const PATCH = route(async (request) => {
  assertSameOrigin(request);
  requireLogin(request);
  const id = idFrom(request);
  const changes = await readJson(request);
  const store = getStore();
  const all = await store.list();
  const existing = all.find((p) => p.id === id);
  if (!existing) throw new HttpError(404, "That period doesn't exist any more. Try refreshing the page.");
  const period = cleanPeriod({ ...existing, ...changes });
  assertNoOverlap(period, all.filter((p) => p.id !== id));
  return json({ period: await store.update(id, period) });
});

export const DELETE = route(async (request) => {
  assertSameOrigin(request);
  requireLogin(request);
  const id = idFrom(request);
  if (!(await getStore().remove(id))) {
    throw new HttpError(404, "That period doesn't exist any more. Try refreshing the page.");
  }
  return json({ ok: true });
});
