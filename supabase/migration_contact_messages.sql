-- migration_contact_messages.sql
-- Stores contact us + bug report submissions

CREATE TABLE IF NOT EXISTS contact_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid REFERENCES organizations(id) ON DELETE SET NULL,
  sender_name  text,
  sender_email text,
  subject      text NOT NULL,
  message      text NOT NULL,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users from any org to insert
CREATE POLICY "insert_own" ON contact_messages
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Only allow reading your own org's messages
CREATE POLICY "read_own" ON contact_messages
  FOR SELECT USING (
    org_id = (SELECT org_id FROM team_members WHERE auth_id = auth.uid() LIMIT 1)
  );
