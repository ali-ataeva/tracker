# Period Tracker 🌸

A soft, cute, shared period tracker for two people. One shared passcode, one
shared database, and it works on any browser.

## How it's built (and why)

| Part | What | Why |
| --- | --- | --- |
| Page | Plain HTML, CSS and JavaScript in `public/` | No framework or build step, so every file is readable as-is. |
| Server | A few small files in `api/` that Vercel runs for us | Checks the passcode and is the only thing that can talk to the database. |
| Database | Supabase (free Postgres) | Shared between both of your devices. The database itself refuses overlapping or backwards periods. |
| Hosting | Vercel (free) | Gives you a link and redeploys automatically whenever the code changes on GitHub. |

```
public/            what the browser loads
  index.html       the page
  styles.css       colours, fonts, layout, animations
  js/app.js        everything you click on
  js/cycle.js      predictions and stats (all the maths)
  js/dates.js      calendar-date helpers (no times or time zones, ever)
api/               the server
  login.js         checks the passcode, remembers this browser
  logout.js
  periods.js       list / add / edit / delete periods
lib/               shared server helpers (passcode, database, validation)
supabase/schema.sql  run once in Supabase to create the table
test/              automated checks: `npm test`
```

## Settings (environment variables in Vercel)

| Name | What to put |
| --- | --- |
| `APP_PASSCODE` | The shared passcode you'll both type in. A short phrase is best, e.g. `pink fluffy otter`. |
| `SUPABASE_URL` | Supabase → Project Settings → Data API → Project URL |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys → a **secret** key (`sb_secret_…`). Never put this anywhere else. |

## Trying it on your own computer (optional)

You don't need this to use the site, but if you'd like to:

1. Install Node.js 20 or newer from https://nodejs.org
2. In this folder run `npm install` and then `npm run dev`
3. Open http://localhost:3000. The passcode is `practice` and data is saved
   in `.data/periods.json` (a practice copy, separate from your real data).

Run the automated checks with `npm test`.
