// POST /api/login  { passcode }  → sets the "stay logged in" cookie

import { passcodeMatches, sessionCookie } from '../lib/auth.js';
import { assertSameOrigin, HttpError, json, readJson, route } from '../lib/http.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const POST = route(async (request) => {
  assertSameOrigin(request);
  const { passcode } = await readJson(request);
  if (!passcodeMatches(passcode)) {
    // Slow down anyone trying to guess.
    await sleep(1000);
    throw new HttpError(401, "That passcode didn't match. Try again?");
  }
  return json({ ok: true }, { headers: { 'set-cookie': sessionCookie(request) } });
});
