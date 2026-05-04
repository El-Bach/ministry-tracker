-- migration_ministry_contacts.sql
-- Replaces the earlier migration_ministry_assignees.sql.
--
-- WHY THE CHANGE: assignees (Network) are MY staff (Ghassan, etc.) — internal
-- employees who work the case. Ministry contacts are THE OTHER SIDE
-- (Mona Abu Ghosh at the ministry) — people we call to push files through.
-- Different pools entirely. Linking through `assignees` accidentally registered
-- ministry employees as our own staff. This migration moves to a dedicated
-- `ministry_contacts` table for ministry-side people only.

-- 1. Drop the old (wrong) link table
DROP TABLE IF EXISTS ministry_assignees CASCADE;

-- 2. Create the new ministry_contacts table
CREATE TABLE IF NOT EXISTS ministry_contacts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id  UUID        NOT NULL REFERENCES ministries(id)    ON DELETE CASCADE,
  org_id       UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  phone        TEXT,
  position     TEXT,
  presence     TEXT,
  notes        TEXT,
  sort_order   INTEGER     DEFAULT 0,
  created_by   UUID        REFERENCES team_members(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_ministry_contacts_ministry ON ministry_contacts(ministry_id);
CREATE INDEX IF NOT EXISTS ix_ministry_contacts_org      ON ministry_contacts(org_id);

ALTER TABLE ministry_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_isolation" ON ministry_contacts;
CREATE POLICY "org_isolation" ON ministry_contacts
  FOR ALL TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

ALTER PUBLICATION supabase_realtime ADD TABLE ministry_contacts;
