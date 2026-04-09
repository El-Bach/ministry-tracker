-- Migration: task_documents v2
-- Add optional link from a scanned document to a stop requirement

ALTER TABLE task_documents
  ADD COLUMN IF NOT EXISTS requirement_id UUID REFERENCES stop_requirements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS display_name TEXT;
