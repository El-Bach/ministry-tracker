-- migration_rejection_reason.sql
-- Adds rejection_reason column to task_route_stops
-- Stores the reason when a stage is marked as Rejected

ALTER TABLE task_route_stops
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
