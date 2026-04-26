-- Migration: add created_by to tasks
-- Tracks which team member created each file.
-- Used so members always see files they created, even when can_see_all_files is OFF.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES team_members(id) ON DELETE SET NULL;
