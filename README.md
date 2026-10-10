# Period Tracker 🌸

A soft, cute, shared period tracker for two people. One shared passcode, one
shared database, and it works in any browser.

---

## Quick guide

### Change the passcode

1. In **Vercel**, open the project and go to **Settings → Environment Variables**
   (or **Settings → Environments → Production**, where you added the settings).
2. Find **`APP_PASSCODE`**, open its **⋯** menu, choose **Edit**, type the new
   passcode and **Save**.
3. Go to **Deployments**, click **⋯** on the top row and choose **Redeploy**.
4. After about a minute every browser is logged out. Each of you enters the new
   passcode once and stays logged in again.

Spaces at the start or end of the passcode are ignored; capital letters matter.

### Back up your data

- **Easiest:** in the tracker, click **Download backup** at the top right (on a
  phone it's the ⬇ icon). You get a file like
  `period-tracker-backup-2026-10-10.csv` with every period in it. It opens in
  Excel, Numbers or Google Sheets. Do this every few months and keep the files
  somewhere safe. It's health information, so don't leave copies lying around.
- **From Supabase:** open your project → **Table Editor** → **periods**, then use
  **Export → Export as CSV**.

### Restore a backup

In Supabase open **Table Editor** → **periods** → **Insert** → **Import data from
CSV**, and choose your backup file. Restore into an empty table. If the
periods are still there, the database refuses the copies because they would
overlap, which keeps you from getting duplicates.

### Keeping the database awake

Free Supabase projects pause after 7 days without any activity. Vercel visits
`/api/keepalive` once a day (you can see it under **Settings → Cron Jobs**),
which keeps it awake without reading any of your data. If the database ever
does get paused anyway, go to supabase.com, open the project and click
**Restore project**. Nothing is lost.

### Where the site lives

- Your link is the short address under **Domains** in Vercel (e.g.
  `something.vercel.app`). The long addresses with random letters are private
  snapshots that only work while you're logged in to Vercel.
- Vercel publishes the site from the GitHub branch
  `claude/period-tracker-website-hl1a5t` (the repository's default branch).
  Anything pushed there goes live automatically in about a minute.

---

## Settings (environment variables in Vercel)

| Name | What to put |
| --- | --- |
| `APP_PASSCODE` | The shared passcode you both type in. A short phrase is best. |
| `SUPABASE_URL` | Supabase → Project Settings → Data API → Project URL |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys → a **secret** key (`sb_secret_…`), or the legacy `service_role` key. Never put this anywhere else. |
| `CRON_SECRET` *(optional)* | Any long random text. If set, only Vercel's daily job can call `/api/keepalive`. |

## How it's built

| Part | What | Why |
| --- | --- | --- |
| Page | Plain HTML, CSS and JavaScript in `public/` | No framework or build step, so every file is readable as-is. |
| Server | Small files in `api/` that Vercel runs | Checks the passcode, and is the only thing that can reach the database. |
| Database | Supabase (free Postgres) | Shared between your devices. The database itself refuses overlapping or backwards periods. |
| Hosting | Vercel (free) | Gives you the link and redeploys automatically when the code changes. |

```
public/              what the browser loads
  index.html         the page
  styles.css         colours, fonts, layout, animations
  js/app.js          everything you click on
  js/cycle.js        predictions and stats (all the maths)
  js/dates.js        calendar-date helpers (no times or time zones, ever)
api/                 the server
  login.js           checks the passcode, remembers the browser
  logout.js
  periods.js         list / add / edit / delete periods
  export.js          the "Download backup" file
  keepalive.js       the daily keep-awake visit
lib/                 shared server helpers (passcode, database, validation)
supabase/schema.sql  run once in Supabase to create the table
test/                automated checks: npm test
```

How predictions work:

- **Cycle length** is the average from one period's start to the next. Cycles
  longer than 60 days are ignored (probably a missed log). Until there are 2
  logged periods it uses 28 days.
- **Period length** is the average of periods whose end date is confirmed.
  Until then it uses 5 days. New entries get their end date filled in from it
  and stay "unconfirmed" until one of you confirms or edits them.
- Predictions cover the next 12 months and are recalculated whenever anything
  changes.

## Trying it on your own computer (optional)

1. Install Node.js 20 or newer from https://nodejs.org
2. In this folder run `npm install` and then `npm run dev`
3. Open http://localhost:3000. The passcode is `practice` and data is saved in
   `.data/periods.json` (a practice copy, separate from your real data).

Run the automated checks with `npm test`.
