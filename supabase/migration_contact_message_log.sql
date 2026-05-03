-- migration_contact_message_log.sql
-- Rate-limit table for the `send-contact-email` Edge Function.
-- Inserts one row per outbound email; the Edge Function checks count of
-- recent rows per user and rejects if over limit.

CREATE TABLE IF NOT EXISTS contact_message_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id     UUID NOT NULL,                          -- caller's auth.uid()
  email       TEXT,                                    -- caller's email at send time
  subject     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_log_auth_recent
  ON contact_message_log(auth_id, created_at DESC);

-- RLS: only Edge Function (service-role) writes; users can read their own rows
-- if we ever expose a "history" UI.
ALTER TABLE contact_message_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact_log_read_own" ON contact_message_log;
CREATE POLICY "contact_log_read_own" ON contact_message_log
  FOR SELECT TO authenticated
  USING (auth_id = auth.uid());
