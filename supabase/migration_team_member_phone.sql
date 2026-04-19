-- migration_team_member_phone.sql
-- Adds phone column to team_members

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS phone TEXT;
