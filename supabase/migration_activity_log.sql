-- migration_activity_log.sql
-- Generic activity log for events that outlive the task (e.g. file deletions)
-- Run after migration_organizations.sql

CREATE TABLE IF NOT EXISTS activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id    uuid REFERENCES team_members(id) ON DELETE SET NULL,
  actor_name  text,
  event_type  text NOT NULL,  -- 'file_deleted', 'file_created', 'file_archived', etc.
  client_name text,
  service_name text,
  description text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON activity_log
  USING (org_id = (SELECT org_id FROM team_members WHERE auth_id = auth.uid() LIMIT 1));

CREATE INDEX activity_log_org_id_idx ON activity_log(org_id, created_at DESC);
