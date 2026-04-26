-- Migration: add can_manage_catalog permission column
-- Controls access to Services, Stages (templates), and Network contacts in CreateScreen.
-- Default: admin = true, member = false, viewer = false

ALTER TABLE org_visibility_settings
  ADD COLUMN IF NOT EXISTS can_manage_catalog BOOLEAN NOT NULL DEFAULT false;

-- Set admin rows to true (if any admin rows already exist in the table)
UPDATE org_visibility_settings
  SET can_manage_catalog = true
  WHERE role = 'admin';
