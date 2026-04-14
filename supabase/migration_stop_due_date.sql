-- migration_stop_due_date.sql
-- Adds a per-stage due date to task_route_stops

ALTER TABLE task_route_stops
  ADD COLUMN IF NOT EXISTS due_date DATE;
