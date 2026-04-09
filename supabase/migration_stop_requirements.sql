-- Migration: stop_requirements
-- Run after migration_financials.sql

CREATE TABLE IF NOT EXISTS stop_requirements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stop_id UUID REFERENCES task_route_stops(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  req_type TEXT NOT NULL DEFAULT 'document',
  -- req_type: document | form | signature | approval | payment | certificate | other
  notes TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  attachment_url TEXT,
  attachment_name TEXT,
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES team_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sr_stop ON stop_requirements(stop_id);
CREATE INDEX IF NOT EXISTS idx_sr_stop_order ON stop_requirements(stop_id, sort_order);

ALTER TABLE stop_requirements DISABLE ROW LEVEL SECURITY;
