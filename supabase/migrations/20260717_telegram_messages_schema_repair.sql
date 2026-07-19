-- ============================================================
-- Migration: reconcile telegram_messages schema (idempotent repair)
-- ============================================================
-- Paste this whole file into the Supabase SQL Editor and run it once.
-- It's safe to re-run any number of times — every step either
-- creates-if-missing or replaces itself instead of erroring on
-- "already exists". This supersedes any ad-hoc columns added by hand
-- while debugging PGRST204 errors; after running it, the table matches
-- exactly what app/api/webhooks/telegram/route.ts and
-- app/dashboard/deals/page.tsx send/read — no more, no less.
--
-- It intentionally does NOT drop any extra/renamed columns that may be
-- left over from manual edits — only ADDs/fixes the ones the code needs.
-- If you know of leftover columns from earlier attempts, drop them
-- yourself once you've confirmed nothing else depends on them.

-- 1. Base table, only if it doesn't exist at all
CREATE TABLE IF NOT EXISTS public.telegram_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

-- 2. Every column the app code touches, added if missing
ALTER TABLE public.telegram_messages ADD COLUMN IF NOT EXISTS update_id bigint;
ALTER TABLE public.telegram_messages ADD COLUMN IF NOT EXISTS chat_id bigint;
ALTER TABLE public.telegram_messages ADD COLUMN IF NOT EXISTS telegram_message_id bigint;
ALTER TABLE public.telegram_messages ADD COLUMN IF NOT EXISTS sender_name text;
ALTER TABLE public.telegram_messages ADD COLUMN IF NOT EXISTS sender_username text;
ALTER TABLE public.telegram_messages ADD COLUMN IF NOT EXISTS message_text text;
ALTER TABLE public.telegram_messages ADD COLUMN IF NOT EXISTS platform text;
ALTER TABLE public.telegram_messages ADD COLUMN IF NOT EXISTS deal_id uuid;
ALTER TABLE public.telegram_messages ADD COLUMN IF NOT EXISTS created_at timestamptz;

-- 3. Force the correct type on every column, regardless of what type it may
--    have been manually created with. Telegram chat/message/update ids for
--    supergroups and channels routinely exceed 32-bit range (e.g. chat ids
--    like -1001234567890), so if any of these were created as `integer`
--    instead of `bigint`, they'd silently fail on real traffic. USING casts
--    any existing data across; safe here since these columns only ever hold
--    numeric-looking values (or NULL).
ALTER TABLE public.telegram_messages ALTER COLUMN update_id TYPE bigint USING update_id::bigint;
ALTER TABLE public.telegram_messages ALTER COLUMN chat_id TYPE bigint USING chat_id::bigint;
ALTER TABLE public.telegram_messages ALTER COLUMN telegram_message_id TYPE bigint USING telegram_message_id::bigint;
ALTER TABLE public.telegram_messages ALTER COLUMN sender_name TYPE text;
ALTER TABLE public.telegram_messages ALTER COLUMN sender_username TYPE text;
ALTER TABLE public.telegram_messages ALTER COLUMN message_text TYPE text;
ALTER TABLE public.telegram_messages ALTER COLUMN platform TYPE text;
ALTER TABLE public.telegram_messages ALTER COLUMN deal_id TYPE uuid USING deal_id::uuid;
ALTER TABLE public.telegram_messages ALTER COLUMN created_at TYPE timestamptz USING created_at::timestamptz;

-- 4. Defaults, matching what the code relies on (id/created_at/platform are
--    never sent explicitly by the webhook — it depends on these defaults)
ALTER TABLE public.telegram_messages ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.telegram_messages ALTER COLUMN platform SET DEFAULT 'telegram';
ALTER TABLE public.telegram_messages ALTER COLUMN created_at SET DEFAULT now();

UPDATE public.telegram_messages SET platform = 'telegram' WHERE platform IS NULL;
UPDATE public.telegram_messages SET created_at = now() WHERE created_at IS NULL;

-- 5. NOT NULL where the app assumes it — guarded so a leftover bad row
--    (e.g. from manual testing in the table editor) doesn't hard-fail the
--    whole script. If either guard skips, clean up NULL rows and re-run:
--      delete from public.telegram_messages where update_id is null or chat_id is null;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.telegram_messages WHERE update_id IS NULL) THEN
    ALTER TABLE public.telegram_messages ALTER COLUMN update_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.telegram_messages WHERE chat_id IS NULL) THEN
    ALTER TABLE public.telegram_messages ALTER COLUMN chat_id SET NOT NULL;
  END IF;
END $$;

ALTER TABLE public.telegram_messages ALTER COLUMN platform SET NOT NULL;
ALTER TABLE public.telegram_messages ALTER COLUMN created_at SET NOT NULL;

-- 6. Constraints — guarded so re-running this script doesn't error on
--    "constraint already exists"
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'telegram_messages_update_id_key'
  ) THEN
    ALTER TABLE public.telegram_messages ADD CONSTRAINT telegram_messages_update_id_key UNIQUE (update_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'telegram_messages_deal_id_fkey'
  ) THEN
    ALTER TABLE public.telegram_messages
      ADD CONSTRAINT telegram_messages_deal_id_fkey
      FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_telegram_messages_chat_id ON public.telegram_messages (chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_created_at ON public.telegram_messages (created_at);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_deal_id ON public.telegram_messages (deal_id);

-- 8. RLS — drop + recreate so this block is safe to re-run too
ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "telegram_messages_select_authenticated" ON public.telegram_messages;
CREATE POLICY "telegram_messages_select_authenticated"
  ON public.telegram_messages
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "telegram_messages_update_authenticated" ON public.telegram_messages;
CREATE POLICY "telegram_messages_update_authenticated"
  ON public.telegram_messages
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Operators may only ever move the deal_id link (see /dashboard/deals'
-- "Привязать Telegram-чат" picker) — every other column stays write-only
-- via the service role, which the webhook uses and which bypasses RLS and
-- these column grants entirely.
REVOKE UPDATE ON public.telegram_messages FROM authenticated;
GRANT UPDATE (deal_id) ON public.telegram_messages TO authenticated;
