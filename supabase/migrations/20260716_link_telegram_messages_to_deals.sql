-- ============================================================
-- Migration: link telegram_messages to deals
-- ============================================================
-- Telegram never tells us which CRM deal a chat belongs to, so the link is
-- established manually by an operator (see /dashboard/deals) the first time
-- a message from a new chat arrives, then carried forward automatically by
-- the webhook for later messages from that same chat_id.

ALTER TABLE public.telegram_messages
  ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_telegram_messages_deal_id ON public.telegram_messages (deal_id);

-- Operators link a chat to a deal from the dashboard (client SDK), so
-- authenticated users need UPDATE — but only on deal_id. Every other column
-- (sender info, message text, platform...) stays write-only via the service
-- role, matching how `leads` restricts operator writes to specific columns.
CREATE POLICY "telegram_messages_update_authenticated"
  ON public.telegram_messages
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

REVOKE UPDATE ON public.telegram_messages FROM authenticated;
GRANT UPDATE (deal_id) ON public.telegram_messages TO authenticated;
