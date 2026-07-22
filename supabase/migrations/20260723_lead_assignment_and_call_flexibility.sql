-- ============================================================
-- Migration: lead auto-assignment + calls before a lead is a deal
-- ============================================================
-- Supports:
--  - Round-robin/least-loaded auto-assignment (lib/leadAssignment.ts),
--    which needs to know *when* a lead was assigned to measure the
--    contact-timeout window.
--  - Logging a call_logs row for a lead that hasn't been converted to
--    a deal yet (the operator workspace quick-actions widget). Until
--    now call_logs.deal_id was NOT NULL, so a call could only ever be
--    attached to an existing deal — most calls in a call center happen
--    at the lead stage, before any deal exists.

alter table public.leads
  add column if not exists assigned_at timestamptz;

create index if not exists idx_leads_assigned_to on public.leads (assigned_to);
create index if not exists idx_leads_status      on public.leads (status);

-- ----------------------------------------------------------
-- call_logs: allow a lead-scoped call (no deal yet)
-- ----------------------------------------------------------

alter table public.call_logs
  alter column deal_id drop not null;

alter table public.call_logs
  add column if not exists lead_id uuid references public.leads (id) on delete cascade;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'call_logs_deal_or_lead_chk'
  ) then
    alter table public.call_logs
      add constraint call_logs_deal_or_lead_chk
      check (deal_id is not null or lead_id is not null);
  end if;
end $$;

create index if not exists idx_call_logs_lead_id on public.call_logs (lead_id);

-- ----------------------------------------------------------
-- deals: traceability back to the lead it was converted from
-- ----------------------------------------------------------

alter table public.deals
  add column if not exists lead_id uuid references public.leads (id) on delete set null;

create index if not exists idx_deals_lead_id on public.deals (lead_id);
