// GET /api/keepalive
// Vercel calls this once a day (see "crons" in vercel.json). Free Supabase
// projects pause after a week without any activity, so this small daily read
// keeps the database awake. It never returns any of your data.

import { json } from '../lib/http.js';
import { getStore } from '../lib/store.js';

export async function GET(request) {
  // Optional: if a CRON_SECRET setting exists, Vercel sends it and only Vercel may call this.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return json({ ok: false }, { status: 401 });
  }
  try {
    await getStore().ping();
    return json({ ok: true });
  } catch (err) {
    console.error('Keep-awake check failed:', err);
    return json({ ok: false }, { status: 500 });
  }
}
