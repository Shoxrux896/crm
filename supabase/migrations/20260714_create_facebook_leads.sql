-- ============================================================
-- Migration: create facebook_leads table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.facebook_leads (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             text        NOT NULL UNIQUE,
  form_id             text,
  full_name           text,
  phone_number        text,
  instagram_username  text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------

ALTER TABLE public.facebook_leads ENABLE ROW LEVEL SECURITY;

-- Any authenticated operator can read Facebook/Instagram leads
CREATE POLICY "facebook_leads_select_authenticated"
  ON public.facebook_leads
  FOR SELECT
  TO authenticated
  USING (true);

-- Writes happen only via the webhook route using the service role key,
-- which bypasses RLS — no insert/update policy is granted to other roles.

-- ----------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_facebook_leads_created_at ON public.facebook_leads (created_at);
