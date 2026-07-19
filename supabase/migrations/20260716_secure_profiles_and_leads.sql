-- ============================================================
-- Migration: RLS for profiles + leads (admin/operator role split)
-- ============================================================
-- Assumes `profiles` (id, full_name, role) and its signup trigger,
-- and `leads` (id, facebook_lead_id, full_name, phone_number, email,
-- ad_name, created_at, status, assigned_to, notes) already exist.

-- ----------------------------------------------------------
-- profiles
-- ----------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read the roster (needed to show who a lead
-- is assigned to, and to populate the admin's operator list).
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policy is granted here on purpose: profiles are
-- created by the signup trigger and managed afterwards only through the
-- /api/admin/create-operator route, which uses the service role key and
-- therefore bypasses RLS entirely. This prevents an operator from editing
-- their own row (e.g. promoting themselves to admin) via the client SDK.

-- ----------------------------------------------------------
-- leads
-- ----------------------------------------------------------

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Both admins and operators work the same shared lead queue.
DROP POLICY IF EXISTS "leads_select_authenticated" ON public.leads;
CREATE POLICY "leads_select_authenticated"
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "leads_update_authenticated" ON public.leads;
CREATE POLICY "leads_update_authenticated"
  ON public.leads
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Row-level policies can't restrict which columns an UPDATE touches, so the
-- allowed columns are capped at the grant level: operators can change status
-- and notes from the dashboard, but reassigning a lead (or editing the
-- fields populated by the Meta webhook) requires the service role key.
REVOKE UPDATE ON public.leads FROM authenticated;
GRANT UPDATE (status, notes) ON public.leads TO authenticated;

-- Inserts/deletes happen only via the webhook route using the service role
-- key, which bypasses RLS — no insert/delete policy is granted to other roles.
