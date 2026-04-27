-- migration_cities_rls_fix.sql
-- Fix cities RLS so that shared default cities (org_id IS NULL)
-- are visible to all orgs, while org-specific created cities
-- are only visible to their own org.

DROP POLICY IF EXISTS "org_isolation" ON cities;

CREATE POLICY "org_isolation" ON cities
  FOR ALL USING (
    org_id IS NULL              -- shared default cities (Lebanese cities)
    OR org_id = auth_org_id()   -- cities created by this org
  )
  WITH CHECK (
    org_id = auth_org_id()      -- can only INSERT/UPDATE own org cities
  );
