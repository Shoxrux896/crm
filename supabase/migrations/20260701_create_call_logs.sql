-- ============================================================
-- Migration: create call_logs table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.call_logs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL
                               REFERENCES auth.users (id) ON DELETE CASCADE,
  deal_id          uuid        NOT NULL
                               REFERENCES public.deals (id) ON DELETE CASCADE,
  direction        text        NOT NULL
                               CHECK (direction IN ('incoming', 'outgoing')),
  duration_seconds integer     NOT NULL DEFAULT 0,
  status           text        NOT NULL,
  recording_url    text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------

ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- Operators can read their own call logs
CREATE POLICY "call_logs_select_own"
  ON public.call_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Operators can insert their own call logs
CREATE POLICY "call_logs_insert_own"
  ON public.call_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Operators can update their own call logs
-- (e.g. to attach a recording_url after the call ends)
CREATE POLICY "call_logs_update_own"
  ON public.call_logs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_call_logs_user_id  ON public.call_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_deal_id  ON public.call_logs (deal_id);
