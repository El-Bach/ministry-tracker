-- Add is_pinned flag to tasks (dashboard pin/unpin feature)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
