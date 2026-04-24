-- migration_join_codes_v2.sql
-- Add role to org_join_codes so each invite code carries a pre-set role

ALTER TABLE org_join_codes
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('admin', 'member', 'viewer'));
