// Where periods are saved.
//
// Online (on Vercel) this is your Supabase database. The secret key is only
// ever read here, on the server; the browser never sees it.
//
// On your own computer, if no Supabase settings are present, a "practice mode"
// saves to .data/periods.json instead so you can try things out safely.

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from './http.js';

const TABLE = 'periods';
const COLUMNS = 'id, start_date, end_date, end_confirmed';

let store = null;

export function getStore() {
  if (store) return store;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (url && key) {
    store = supabaseStore(supabaseBaseUrl(url), key.trim());
  } else if (process.env.VERCEL) {
    throw new HttpError(500, 'The database isn\'t connected yet: add SUPABASE_URL and SUPABASE_SECRET_KEY in Vercel.');
  } else {
    store = fileStore(process.env.LOCAL_DATA_FILE || path.join('.data', 'periods.json'));
  }
  return store;
}

const BAD_URL_HELP =
  'The SUPABASE_URL setting in Vercel doesn\'t look right. Copy the Project URL from Supabase → ' +
  'Project Settings → Data API. It looks like https://abcdefghijkl.supabase.co';

/**
 * Supabase pages show the project address in a few forms (sometimes ending in
 * /rest/v1/). The library adds that part itself, so keep only the start.
 */
export function supabaseBaseUrl(raw) {
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new HttpError(500, BAD_URL_HELP);
  }
  // A link to the Supabase dashboard rather than to the project itself.
  if (url.hostname === 'supabase.com' || url.hostname.endsWith('.supabase.com')) {
    throw new HttpError(500, BAD_URL_HELP);
  }
  return url.origin;
}

function databaseError(error) {
  if (error.code === '23P01') return new HttpError(409, 'That overlaps with another period.');
  if (error.code === '23514') return new HttpError(400, "The end date can't be before the start date.");
  if (error.code === '42P01' || error.code === 'PGRST205') {
    return new HttpError(500, "The periods table doesn't exist yet. Run supabase/schema.sql in the Supabase SQL Editor.");
  }
  if (/invalid path|no route matched/i.test(error.message || '')) return new HttpError(500, BAD_URL_HELP);
  console.error('Database error:', error);
  return new HttpError(500, `The database said: ${error.message}`);
}

function supabaseStore(url, key) {
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const unwrap = ({ data, error }) => {
    if (error) throw databaseError(error);
    return data;
  };
  return {
    async list() {
      return unwrap(await db.from(TABLE).select(COLUMNS).order('start_date'));
    },
    async create(period) {
      return unwrap(await db.from(TABLE).insert(period).select(COLUMNS).single());
    },
    async update(id, period) {
      const rows = unwrap(
        await db.from(TABLE).update({ ...period, updated_at: new Date().toISOString() }).eq('id', id).select(COLUMNS)
      );
      return rows[0] || null;
    },
    async remove(id) {
      const rows = unwrap(await db.from(TABLE).delete().eq('id', id).select('id'));
      return rows.length > 0;
    },
  };
}

function fileStore(file) {
  const load = async () => {
    try {
      return JSON.parse(await readFile(file, 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  };
  const save = async (rows) => {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(rows, null, 2));
  };
  const pick = ({ id, start_date, end_date, end_confirmed }) => ({ id, start_date, end_date, end_confirmed });
  return {
    async list() {
      return (await load()).map(pick).sort((a, b) => a.start_date.localeCompare(b.start_date));
    },
    async create(period) {
      const rows = await load();
      const row = { id: randomUUID(), ...period };
      rows.push(row);
      await save(rows);
      return pick(row);
    },
    async update(id, period) {
      const rows = await load();
      const row = rows.find((r) => r.id === id);
      if (!row) return null;
      Object.assign(row, period);
      await save(rows);
      return pick(row);
    },
    async remove(id) {
      const rows = await load();
      const remaining = rows.filter((r) => r.id !== id);
      await save(remaining);
      return remaining.length < rows.length;
    },
  };
}
