-- ============================================================
-- Migration: give admins full visibility into operator-owned data
-- ============================================================
-- deals, tasks, contacts, deal_logs and call_logs predate the
-- migrations folder (hand-created back when this was a single-user
-- CRM) and are RLS-gated to `auth.uid() = user_id` — the same
-- "own rows only" pattern documented for call_logs in
-- 20260701_create_call_logs.sql. That means an admin querying any
-- of these tables only ever sees their own rows, same bug that
-- 20260716_secure_profiles_and_leads.sql already fixed for
-- profiles/leads.
--
-- RLS policies are OR'd together, so adding an is_admin() bypass
-- here is additive: operators keep working only their own rows via
-- the existing policies, admins gain full read/write across every
-- operator's data.
--
-- pipeline_statuses is deliberately NOT included here: it's each
-- operator's personal Kanban column layout, and merging every
-- operator's columns into one admin board would produce duplicate
-- columns rather than useful visibility. Admin visibility into
-- deals that live under another operator's columns is instead
-- handled in the UI (deals whose status_id isn't one of the
-- viewer's own columns are grouped into "no status").

do $$
begin
  if to_regclass('public.deals') is not null then
    drop policy if exists "deals_admin_all" on public.deals;
    create policy "deals_admin_all"
      on public.deals
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;

  if to_regclass('public.tasks') is not null then
    drop policy if exists "tasks_admin_all" on public.tasks;
    create policy "tasks_admin_all"
      on public.tasks
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;

  if to_regclass('public.contacts') is not null then
    drop policy if exists "contacts_admin_all" on public.contacts;
    create policy "contacts_admin_all"
      on public.contacts
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;

  if to_regclass('public.deal_logs') is not null then
    drop policy if exists "deal_logs_admin_all" on public.deal_logs;
    create policy "deal_logs_admin_all"
      on public.deal_logs
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;

  if to_regclass('public.call_logs') is not null then
    drop policy if exists "call_logs_admin_all" on public.call_logs;
    create policy "call_logs_admin_all"
      on public.call_logs
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;
