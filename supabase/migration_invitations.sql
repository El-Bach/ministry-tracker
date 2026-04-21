-- Migration: Team Invitations + Role-Based Access
-- Session 26 — Phase 2 commercialization
-- Run AFTER migration_organizations.sql

-- ─────────────────────────────────────────────────
-- 1. Invitations table
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invitations (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        text NOT NULL DEFAULT 'member',   -- 'admin' | 'member' | 'viewer'
  token       text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  invited_by  uuid REFERENCES team_members(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  expires_at  timestamptz DEFAULT (now() + interval '7 days'),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invitations_email_idx ON invitations(email);
CREATE INDEX IF NOT EXISTS invitations_token_idx ON invitations(token);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Org members can read/create invitations for their org
DROP POLICY IF EXISTS "org_isolation" ON invitations;
CREATE POLICY "org_isolation" ON invitations
  FOR ALL USING (org_id = auth_org_id());

-- ─────────────────────────────────────────────────
-- 2. Ensure team_members.role has a default
-- ─────────────────────────────────────────────────
ALTER TABLE team_members
  ALTER COLUMN role SET DEFAULT 'member';

-- Make sure existing rows have a role
UPDATE team_members SET role = 'member' WHERE role IS NULL OR role = '';

-- Set the first/only user as owner if no owner exists yet
UPDATE team_members
SET role = 'owner'
WHERE id = (SELECT id FROM team_members ORDER BY created_at ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM team_members WHERE role = 'owner');
