-- migration_file_financials_permission.sql
-- Adds can_see_file_financials column to org_visibility_settings.
-- Controls whether the entire Financials section is visible inside a file (TaskDetailScreen).
-- Default: false for all rows. Then we set admin rows to true.

ALTER TABLE org_visibility_settings
  ADD COLUMN IF NOT EXISTS can_see_file_financials BOOLEAN NOT NULL DEFAULT false;

-- Admin should see financials by default
UPDATE org_visibility_settings
  SET can_see_file_financials = true
  WHERE role = 'admin';
