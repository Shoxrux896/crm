-- ============================================================
-- Migration: create instagram_messages table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.instagram_messages (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id           uuid        NOT NULL
                                REFERENCES public.deals (id) ON DELETE CASCADE,
  instagram_user_id text        NOT NULL,
  username          text        NOT NULL,
  message_type      text        NOT NULL
                                CHECK (message_type IN ('direct', 'comment')),
  text              text        NOT NULL,
  is_from_customer  boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------

ALTER TABLE public.instagram_messages ENABLE ROW LEVEL SECURITY;

-- Any authenticated operator can read Instagram messages
CREATE POLICY "instagram_messages_select_authenticated"
  ON public.instagram_messages
  FOR SELECT
  TO authenticated
  USING (true);

-- Any authenticated operator can insert Instagram messages
-- (customer messages ingested via webhook, or operator replies from the CRM)
CREATE POLICY "instagram_messages_insert_authenticated"
  ON public.instagram_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Any authenticated operator can update Instagram messages
CREATE POLICY "instagram_messages_update_authenticated"
  ON public.instagram_messages
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_instagram_messages_deal_id           ON public.instagram_messages (deal_id);
CREATE INDEX IF NOT EXISTS idx_instagram_messages_instagram_user_id ON public.instagram_messages (instagram_user_id);
