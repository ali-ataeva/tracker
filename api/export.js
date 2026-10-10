// GET /api/export → downloads every period as a CSV file, a spreadsheet you
// can keep as a backup. It opens in Excel, Numbers or Google Sheets, and
// Supabase can import it straight back into the periods table.

import { requireLogin } from '../lib/auth.js';
import { route } from '../lib/http.js';
import { getStore } from '../lib/store.js';

export const GET = route(async (request) => {
  requireLogin(request);
  const periods = await getStore().list();
  const rows = [
    ['start_date', 'end_date', 'end_confirmed'],
    ...periods.map((p) => [p.start_date, p.end_date, p.end_confirmed]),
  ];
  const csv = rows.map((row) => row.join(',')).join('\r\n') + '\r\n';
  const today = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="period-tracker-backup-${today}.csv"`,
      'cache-control': 'no-store',
    },
  });
});
