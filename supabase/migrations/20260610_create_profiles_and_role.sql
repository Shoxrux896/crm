-- ============================================================
-- Migration: profiles table + user_role enum + signup trigger
-- ============================================================
-- Backfilled migration: this schema was originally applied by hand against
-- the live project (predates this migrations folder). Everything here is
-- guarded to no-op against that existing table/type/trigger while still
-- being correct for a fresh environment (staging, CI, a new dev's local
-- Supabase project).
--
-- Role naming: the app and all later migrations use 'operator' (not
-- 'manager') for the non-admin role — kept consistent with the rest of the
-- codebase (see app/api/admin/create-operator, lib/type.ts UserRole).

-- ----------------------------------------------------------
-- user_role enum
-- ----------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin', 'operator');
  end if;
end $$;

-- ----------------------------------------------------------
-- profiles table
-- ----------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role public.user_role not null default 'operator',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Columns added defensively in case the live table predates one of them.
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- ----------------------------------------------------------
-- RLS: users read their own profile, admins read every profile
-- ----------------------------------------------------------
-- Note: supabase/migrations/20260716_secure_profiles_and_leads.sql adds a
-- broader "profiles_select_authenticated" (USING (true)) policy on top of
-- these, because the leads dashboard needs every signed-in user to resolve
-- "assigned to" names for the whole roster, not just their own row. RLS
-- policies are OR'd together, so that later policy is what actually governs
-- read access today; these two stay in place as the documented baseline
-- (own row / admin-sees-all) and as a safety net if that broader policy is
-- ever removed.

alter table public.profiles enable row level security;

-- is_admin() runs as SECURITY DEFINER so the admin-check query bypasses RLS
-- instead of recursing into the policy that calls it.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "profiles_select_admin_all" on public.profiles;
create policy "profiles_select_admin_all"
  on public.profiles
  for select
  to authenticated
  using (public.is_admin());

-- No insert/update/delete policy here on purpose — profiles are written by
-- the signup trigger below and by /api/admin/create-operator, which uses
-- the service role key and bypasses RLS entirely. See the comment in
-- 20260716_secure_profiles_and_leads.sql for why that's deliberate.

-- ----------------------------------------------------------
-- signup trigger: auth.users insert -> public.profiles row
-- ----------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    'operator'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
