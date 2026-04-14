-- migration_archive.sql
-- Adds is_archived flag to tasks
-- Tasks are auto-archived when all their stages are marked Done

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;

-- Index for fast dashboard filtering
CREATE INDEX IF NOT EXISTS tasks_is_archived_idx ON tasks(is_archived);
