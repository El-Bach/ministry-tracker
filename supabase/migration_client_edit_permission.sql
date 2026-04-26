-- Migration: add can_edit_delete_clients permission column
-- Separates "add new clients" (can_manage_clients) from "edit/delete clients" (this column).
-- Default: admin = true, member = false, viewer = false

ALTER TABLE org_visibility_settings
  ADD COLUMN IF NOT EXISTS can_edit_delete_clients BOOLEAN NOT NULL DEFAULT false;

-- Set admin rows to true (if any admin rows already exist)
UPDATE org_visibility_settings
  SET can_edit_delete_clients = true
  WHERE role = 'admin';
