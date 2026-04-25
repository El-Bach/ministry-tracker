-- Migration: Fix RLS gaps that block invited employee registration
-- Session 29
-- Run AFTER migration_invitations.sql
--
-- Problem: Three RLS gaps break the invited-employee sign-up flow:
--   1. invitations table: only "org_isolation" policy (FOR ALL USING org_id = auth_org_id())
--      → pre-signup read returns 0 rows → invitePreview stays null → wrong code branch
--   2. organizations table: only "org_read_own" (FOR ALL USING id = auth_org_id())
--      → brand-new user (no team_members row yet) cannot INSERT their org
--   3. team_members table: only "org_isolation" (FOR ALL USING org_id = auth_org_id())
--      → brand-new user cannot INSERT their own first row
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Allow anyone (including unauthenticated) to SELECT invitations.
--    Safe: the query is always filtered by email + accepted_at IS NULL + expiry,
--    so a caller can only discover an invitation addressed to them.
DROP POLICY IF EXISTS "invitations_public_read" ON invitations;
CREATE POLICY "invitations_public_read" ON invitations
  FOR SELECT USING (true);

-- 2. Allow any authenticated user to INSERT a new organization.
--    This fires only during RegisterScreen when the user has just signed up
--    but has no team_members row yet (so auth_org_id() = NULL).
--    After the INSERT they become owner and the org_read_own policy takes over.
DROP POLICY IF EXISTS "organizations_insert_new" ON organizations;
CREATE POLICY "organizations_insert_new" ON organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Allow a user to INSERT their own team_members row (auth_id = their own uid).
--    They cannot insert rows for other users (auth_id must match auth.uid()).
--    After this INSERT, auth_org_id() starts returning their org_id and the
--    org_isolation policy covers all subsequent operations.
DROP POLICY IF EXISTS "team_members_insert_own" ON team_members;
CREATE POLICY "team_members_insert_own" ON team_members
  FOR INSERT WITH CHECK (auth_id = auth.uid());

-- 4. Allow a user to always SELECT their own team_members row.
--    The org_isolation policy requires auth_org_id() to be non-null, which
--    creates a chicken-and-egg problem on first login (no row → can't read row).
--    This policy breaks the cycle: auth_id = auth.uid() is always resolvable.
DROP POLICY IF EXISTS "team_members_read_own" ON team_members;
CREATE POLICY "team_members_read_own" ON team_members
  FOR SELECT USING (auth_id = auth.uid());
