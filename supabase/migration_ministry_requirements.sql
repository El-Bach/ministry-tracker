-- Migration: ministry_requirements
-- Default requirement templates per stage (ministry).
-- These define what is needed to complete a stage type, independently of any task.

CREATE TABLE IF NOT EXISTS ministry_requirements (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  ministry_id  UUID        NOT NULL REFERENCES ministries(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  req_type     TEXT        NOT NULL DEFAULT 'document',
  notes        TEXT,
  sort_order   INTEGER     DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ministry_requirements DISABLE ROW LEVEL SECURITY;
