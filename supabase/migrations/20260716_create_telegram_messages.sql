-- ============================================================
-- Migration: create telegram_messages table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.telegram_messages (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id             bigint      NOT NULL UNIQUE,
  chat_id               bigint      NOT NULL,
  telegram_message_id   bigint,
  sender_name           text,
  sender_username       text,
  message_text          text,
  platform              text        NOT NULL DEFAULT 'telegram',
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------

ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;

-- Any authenticated operator/admin can read incoming Telegram messages
CREATE POLICY "telegram_messages_select_authenticated"
  ON public.telegram_messages
  FOR SELECT
  TO authenticated
  USING (true);

-- Writes happen only via the webhook route using the service role key,
-- which bypasses RLS — no insert/update policy is granted to other roles.

-- ----------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_telegram_messages_chat_id ON public.telegram_messages (chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_created_at ON public.telegram_messages (created_at);
