import { test } from 'node:test';
import assert from 'node:assert/strict';
import { supabaseBaseUrl } from '../lib/store.js';

test('accepts the Supabase project URL in any of the forms Supabase shows it', () => {
  for (const raw of [
    'https://abcdefghijkl.supabase.co',
    'https://abcdefghijkl.supabase.co/',
    'https://abcdefghijkl.supabase.co/rest/v1',
    ' https://abcdefghijkl.supabase.co/rest/v1/ ',
  ]) {
    assert.equal(supabaseBaseUrl(raw), 'https://abcdefghijkl.supabase.co');
  }
});

test('explains clearly when the URL is something else', () => {
  for (const raw of ['https://supabase.com/dashboard/project/abcdefghijkl', 'abcdefghijkl.supabase.co', '']) {
    assert.throws(() => supabaseBaseUrl(raw), /SUPABASE_URL setting/);
  }
});
