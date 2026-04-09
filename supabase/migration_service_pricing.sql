-- Migration: service pricing + task contract price + price history
-- Run after migration_stop_requirements.sql

-- Add base price to services (the default price for a service)
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS base_price_usd NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_price_lbp NUMERIC(16,0) DEFAULT 0;

-- Add contract price to tasks (pre-filled from service base price, editable per file)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS price_usd NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_lbp NUMERIC(16,0) DEFAULT 0;

-- Price modification history per task
CREATE TABLE IF NOT EXISTS task_price_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  old_price_usd NUMERIC(12,2) DEFAULT 0,
  old_price_lbp NUMERIC(16,0) DEFAULT 0,
  new_price_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  new_price_lbp NUMERIC(16,0) NOT NULL DEFAULT 0,
  note TEXT,
  changed_by UUID REFERENCES team_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tph_task ON task_price_history(task_id);

ALTER TABLE task_price_history DISABLE ROW LEVEL SECURITY;
