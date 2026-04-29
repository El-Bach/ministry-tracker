-- migration_team_member_email_constraint.sql
-- Fix: email uniqueness should be per-org, not global
-- Same email can be a member of multiple organizations

ALTER TABLE team_members
  DROP CONSTRAINT IF EXISTS team_members_email_key;

ALTER TABLE team_members
  ADD CONSTRAINT team_members_email_org_unique UNIQUE (email, org_id);
