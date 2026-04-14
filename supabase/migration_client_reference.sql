-- Migration: Add reference fields to clients table
-- Run after migration_task_documents_v2.sql

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS reference_name TEXT,
  ADD COLUMN IF NOT EXISTS reference_phone TEXT;
