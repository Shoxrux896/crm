-- ============================================================
-- Migration: operator_sessions table + RLS
-- ============================================================
-- This table already exists on the live project (referenced by
-- app/api/cron/daily-report and predates the migrations folder,
-- like deals/tasks/contacts) but nothing has ever written to it —
-- the daily report reads real columns from an always-empty table.
-- This migration is guarded with IF NOT EXISTS so it's a no-op
-- against the live table, and gives a fresh environment (CI,
-- staging, a new dev's local Supabase project) the same schema.
--
-- Written to by app/dashboard/components/SessionTracker.tsx, which
-- opens a row on dashboard mount and heartbeats working/idle
-- minutes into it; read by app/dashboard/users/OperatorStats.tsx
-- for the admin-facing shift/activity view and by the daily Telegram
-- report cron.

create table if not exists public.operator_sessions (
  id                     uuid        primary key default gen_random_uuid(),
  operator_id            uuid        not null references auth.users (id) on delete cascade,
  login_time             timestamptz not null default now(),
  logout_time            timestamptz,
  total_working_minutes  integer     not null default 0,
  total_idle_minutes     integer     not null default 0
);

-- ----------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------

alter table public.operator_sessions enable row level security;

-- Operators manage their own shift sessions (SessionTracker opens
-- the row on login and heartbeats totals via update).
drop policy if exists "operator_sessions_select_own" on public.operator_sessions;
create policy "operator_sessions_select_own"
  on public.operator_sessions
  for select
  to authenticated
  using (auth.uid() = operator_id);

drop policy if exists "operator_sessions_insert_own" on public.operator_sessions;
create policy "operator_sessions_insert_own"
  on public.operator_sessions
  for insert
  to authenticated
  with check (auth.uid() = operator_id);

drop policy if exists "operator_sessions_update_own" on public.operator_sessions;
create policy "operator_sessions_update_own"
  on public.operator_sessions
  for update
  to authenticated
  using (auth.uid() = operator_id)
  with check (auth.uid() = operator_id);

-- Admins read every operator's sessions for the stats dashboard.
drop policy if exists "operator_sessions_select_admin_all" on public.operator_sessions;
create policy "operator_sessions_select_admin_all"
  on public.operator_sessions
  for select
  to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------

create index if not exists idx_operator_sessions_operator_id on public.operator_sessions (operator_id);
create index if not exists idx_operator_sessions_login_time  on public.operator_sessions (login_time);
