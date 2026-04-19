-- migration_expense_stage.sql
-- Adds optional stop_id to file_transactions so expenses can be linked to a stage

ALTER TABLE file_transactions
  ADD COLUMN IF NOT EXISTS stop_id UUID REFERENCES task_route_stops(id) ON DELETE SET NULL;
