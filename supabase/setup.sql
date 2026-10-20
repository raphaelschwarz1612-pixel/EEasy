-- EEasy: run this once in Supabase → SQL Editor → New query → Run.
-- It creates one row of progress per user and makes sure people can only change their own row.

create table if not exists public.progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  username   text not null,
  xp         integer not null default 0,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

-- Signed-in users can see everyone's username and XP (for the leaderboard).
drop policy if exists "Signed-in users can read progress" on public.progress;
create policy "Signed-in users can read progress"
  on public.progress for select
  to authenticated
  using (true);

-- Each user can only create and change their own row.
drop policy if exists "Users create their own progress" on public.progress;
create policy "Users create their own progress"
  on public.progress for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update their own progress" on public.progress;
create policy "Users update their own progress"
  on public.progress for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
