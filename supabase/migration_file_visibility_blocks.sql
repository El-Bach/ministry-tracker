-- Migration: file_visibility_blocks
-- Allows owner/admin to hide specific files from specific team members.
-- A blocked file does not appear in the member's dashboard.

CREATE TABLE IF NOT EXISTS file_visibility_blocks (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id         UUID        REFERENCES organizations(id)  ON DELETE CASCADE NOT NULL,
  team_member_id UUID        REFERENCES team_members(id)   ON DELETE CASCADE NOT NULL,
  task_id        UUID        REFERENCES tasks(id)           ON DELETE CASCADE NOT NULL,
  blocked_by     UUID        REFERENCES team_members(id)   ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_member_id, task_id)
);

ALTER TABLE file_visibility_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON file_visibility_blocks
  USING (org_id = auth_org_id());

CREATE POLICY "org_insert" ON file_visibility_blocks
  FOR INSERT WITH CHECK (org_id = auth_org_id());

CREATE POLICY "org_delete" ON file_visibility_blocks
  FOR DELETE USING (org_id = auth_org_id());

-- Add to realtime publication so dashboard updates instantly
ALTER PUBLICATION supabase_realtime ADD TABLE file_visibility_blocks;
