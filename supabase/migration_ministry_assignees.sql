-- migration_ministry_assignees.sql
-- Per-stage contacts (template level): link existing Network contacts (assignees)
-- to a ministry with stage-specific role info (position, presence, notes).
--
-- Design: the PERSON (name, phone, reference, city) lives in `assignees`, the
-- ROLE AT THIS MINISTRY (position, presence, notes) lives in this link table.
-- Same person can be linked to multiple ministries with different roles, and
-- editing their phone in Network propagates everywhere.

CREATE TABLE IF NOT EXISTS ministry_assignees (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id  UUID        NOT NULL REFERENCES ministries(id)    ON DELETE CASCADE,
  assignee_id  UUID        NOT NULL REFERENCES assignees(id)     ON DELETE CASCADE,
  org_id       UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  position     TEXT,
  presence     TEXT,
  notes        TEXT,
  sort_order   INTEGER     DEFAULT 0,
  created_by   UUID        REFERENCES team_members(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ministry_id, assignee_id)
);

CREATE INDEX IF NOT EXISTS ix_ministry_assignees_ministry ON ministry_assignees(ministry_id);
CREATE INDEX IF NOT EXISTS ix_ministry_assignees_assignee ON ministry_assignees(assignee_id);
CREATE INDEX IF NOT EXISTS ix_ministry_assignees_org      ON ministry_assignees(org_id);

ALTER TABLE ministry_assignees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_isolation" ON ministry_assignees;
CREATE POLICY "org_isolation" ON ministry_assignees
  FOR ALL TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- Add to realtime publication so the sheet updates instantly across devices
ALTER PUBLICATION supabase_realtime ADD TABLE ministry_assignees;
