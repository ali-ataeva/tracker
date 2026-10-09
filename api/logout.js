// POST /api/logout → forgets the passcode on this browser only

import { clearedSessionCookie } from '../lib/auth.js';
import { assertSameOrigin, json, route } from '../lib/http.js';

export const POST = route(async (request) => {
  assertSameOrigin(request);
  return json({ ok: true }, { headers: { 'set-cookie': clearedSessionCookie(request) } });
});
