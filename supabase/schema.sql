-- Period Tracker database setup.
-- Paste all of this into Supabase → SQL Editor → New query, then click "Run".
-- It's safe to run more than once.

create table if not exists public.periods (
  id            uuid primary key default gen_random_uuid(),
  -- Plain calendar dates: no times or time zones, so they never shift by a day.
  start_date    date not null,
  end_date      date not null,
  -- false = the end date was filled in automatically and nobody has confirmed it yet.
  end_confirmed boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- The end date can't be before the start date.
  constraint periods_end_not_before_start check (end_date >= start_date),
  -- Two periods can never overlap.
  constraint periods_no_overlap exclude using gist (daterange(start_date, end_date, '[]') with &&)
);

-- Lock the table down: with row level security on and no policies, nobody can
-- read or change anything using the public key. Only the website's server,
-- which holds the secret key, can.
alter table public.periods enable row level security;
revoke all on table public.periods from anon, authenticated;
grant select, insert, update, delete on table public.periods to service_role;
