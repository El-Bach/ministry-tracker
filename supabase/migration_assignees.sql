-- migration_assignees.sql
-- Creates external assignees table (separate from team_members)
-- Assignees are external people (lawyers, agents, etc.) assigned to tasks

CREATE TABLE IF NOT EXISTS assignees (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text,
  reference text,
  notes text,
  created_by uuid references team_members(id) on delete set null,
  created_at timestamptz default now()
);

-- Enable RLS
ALTER TABLE assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all authenticated" ON assignees
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add ext_assignee_id column to tasks (nullable — separate from assigned_to which is team member)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ext_assignee_id uuid references assignees(id) on delete set null;

-- Index for performance
CREATE INDEX IF NOT EXISTS assignees_created_by_idx ON assignees(created_by);
CREATE INDEX IF NOT EXISTS tasks_ext_assignee_id_idx ON tasks(ext_assignee_id);
