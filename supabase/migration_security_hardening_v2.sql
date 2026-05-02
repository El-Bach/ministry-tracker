-- migration_security_hardening_v2.sql
-- Fixes 8 vulnerabilities identified in the security audit (post-Session 35).
--
-- Run AFTER all previous migrations (especially migration_rls_fix.sql,
-- migration_security_fixes.sql, migration_register_join_by_code.sql,
-- migration_visibility_settings.sql, migration_notification_prefs.sql,
-- migration_invitations_rls_fix.sql, migration_registration_rpc.sql,
-- migration_auto_confirm_email.sql).
--
-- Vulns fixed (severity / confidence):
--   V1  HIGH   register_join_org RPC accepted arbitrary org_id+role
--   V2  HIGH   "Allow all authenticated" policies bypassed all org isolation
--   V3  HIGH   org_visibility_settings had no RLS — anyone could escalate perms
--   V4  MED    notification_prefs had no RLS — cross-tenant leak
--   V5  HIGH   Anyone could INSERT an admin invite code into their own org
--   V6  MED    invitations table publicly readable — token leakage
--   V7  MED    register_join_org_by_code phone-lock bypass via NULL p_phone
--   V8  MED    auto_confirm_email trigger let users squat real email addresses
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- VULN 2: Drop permissive "Allow all authenticated" policies
-- and ensure tight org_isolation policies are in place
-- ═════════════════════════════════════════════════════════════════════════════

-- Drop the dangerous permissive policies on every table touched by
-- migration_rls_fix.sql. RLS combines policies with OR, so as long as these
-- existed alongside org_isolation, every authenticated user could read
-- and modify every other tenant's rows.
DROP POLICY IF EXISTS "Allow all authenticated" ON tasks;
DROP POLICY IF EXISTS "Allow all authenticated" ON clients;
DROP POLICY IF EXISTS "Allow all authenticated" ON ministries;
DROP POLICY IF EXISTS "Allow all authenticated" ON services;
DROP POLICY IF EXISTS "Allow all authenticated" ON team_members;
DROP POLICY IF EXISTS "Allow all authenticated" ON status_labels;
DROP POLICY IF EXISTS "Allow all authenticated" ON cities;
DROP POLICY IF EXISTS "Allow all authenticated" ON client_field_definitions;
DROP POLICY IF EXISTS "Allow all authenticated" ON task_documents;
DROP POLICY IF EXISTS "Allow all authenticated" ON task_route_stops;
DROP POLICY IF EXISTS "Allow all authenticated" ON task_comments;
DROP POLICY IF EXISTS "Allow all authenticated" ON file_transactions;
DROP POLICY IF EXISTS "Allow all authenticated" ON status_updates;
DROP POLICY IF EXISTS "Allow all authenticated" ON task_price_history;
DROP POLICY IF EXISTS "Allow all authenticated" ON stop_requirements;
DROP POLICY IF EXISTS "Allow all authenticated" ON ministry_requirements;
DROP POLICY IF EXISTS "Allow all authenticated" ON client_field_values;
DROP POLICY IF EXISTS "Allow all authenticated" ON service_default_stages;

-- ── Re-assert org_isolation on tables WITH a direct org_id column ───────────
-- (these were already created by migration_organizations.sql; we re-create
-- them here for idempotency and to add WITH CHECK)
DROP POLICY IF EXISTS "org_isolation" ON tasks;
CREATE POLICY "org_isolation" ON tasks
  FOR ALL TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

DROP POLICY IF EXISTS "org_isolation" ON clients;
CREATE POLICY "org_isolation" ON clients
  FOR ALL TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

DROP POLICY IF EXISTS "org_isolation" ON ministries;
CREATE POLICY "org_isolation" ON ministries
  FOR ALL TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

DROP POLICY IF EXISTS "org_isolation" ON services;
CREATE POLICY "org_isolation" ON services
  FOR ALL TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- team_members: keep org_isolation BUT preserve own-row read access
-- (migration_invitations_rls_fix.sql adds team_members_read_own + team_members_insert_own)
DROP POLICY IF EXISTS "org_isolation" ON team_members;
CREATE POLICY "org_isolation" ON team_members
  FOR ALL TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

DROP POLICY IF EXISTS "org_isolation" ON status_labels;
CREATE POLICY "org_isolation" ON status_labels
  FOR ALL TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

DROP POLICY IF EXISTS "org_isolation" ON cities;
CREATE POLICY "org_isolation" ON cities
  FOR ALL TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

DROP POLICY IF EXISTS "org_isolation" ON client_field_definitions;
CREATE POLICY "org_isolation" ON client_field_definitions
  FOR ALL TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- ── Tables WITHOUT direct org_id: enforce isolation via parent FK ───────────

-- task_route_stops → tasks
DROP POLICY IF EXISTS "org_isolation" ON task_route_stops;
CREATE POLICY "org_isolation" ON task_route_stops
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_route_stops.task_id AND tasks.org_id = auth_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_route_stops.task_id AND tasks.org_id = auth_org_id()));

-- task_comments → tasks
DROP POLICY IF EXISTS "org_isolation" ON task_comments;
CREATE POLICY "org_isolation" ON task_comments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_comments.task_id AND tasks.org_id = auth_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_comments.task_id AND tasks.org_id = auth_org_id()));

-- task_documents → tasks
DROP POLICY IF EXISTS "org_isolation" ON task_documents;
CREATE POLICY "org_isolation" ON task_documents
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_documents.task_id AND tasks.org_id = auth_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_documents.task_id AND tasks.org_id = auth_org_id()));

-- file_transactions → tasks
DROP POLICY IF EXISTS "org_isolation" ON file_transactions;
CREATE POLICY "org_isolation" ON file_transactions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = file_transactions.task_id AND tasks.org_id = auth_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = file_transactions.task_id AND tasks.org_id = auth_org_id()));

-- status_updates → tasks
DROP POLICY IF EXISTS "org_isolation" ON status_updates;
CREATE POLICY "org_isolation" ON status_updates
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = status_updates.task_id AND tasks.org_id = auth_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = status_updates.task_id AND tasks.org_id = auth_org_id()));

-- task_price_history → tasks
DROP POLICY IF EXISTS "org_isolation" ON task_price_history;
CREATE POLICY "org_isolation" ON task_price_history
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_price_history.task_id AND tasks.org_id = auth_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_price_history.task_id AND tasks.org_id = auth_org_id()));

-- stop_requirements → task_route_stops → tasks
DROP POLICY IF EXISTS "org_isolation" ON stop_requirements;
CREATE POLICY "org_isolation" ON stop_requirements
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM task_route_stops trs
    JOIN tasks t ON t.id = trs.task_id
    WHERE trs.id = stop_requirements.stop_id AND t.org_id = auth_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM task_route_stops trs
    JOIN tasks t ON t.id = trs.task_id
    WHERE trs.id = stop_requirements.stop_id AND t.org_id = auth_org_id()
  ));

-- ministry_requirements → ministries
DROP POLICY IF EXISTS "org_isolation" ON ministry_requirements;
CREATE POLICY "org_isolation" ON ministry_requirements
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM ministries WHERE ministries.id = ministry_requirements.ministry_id AND ministries.org_id = auth_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM ministries WHERE ministries.id = ministry_requirements.ministry_id AND ministries.org_id = auth_org_id()));

-- client_field_values → clients
DROP POLICY IF EXISTS "org_isolation" ON client_field_values;
CREATE POLICY "org_isolation" ON client_field_values
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM clients WHERE clients.id = client_field_values.client_id AND clients.org_id = auth_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM clients WHERE clients.id = client_field_values.client_id AND clients.org_id = auth_org_id()));

-- service_default_stages → services
DROP POLICY IF EXISTS "org_isolation" ON service_default_stages;
CREATE POLICY "org_isolation" ON service_default_stages
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM services WHERE services.id = service_default_stages.service_id AND services.org_id = auth_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM services WHERE services.id = service_default_stages.service_id AND services.org_id = auth_org_id()));


-- ═════════════════════════════════════════════════════════════════════════════
-- VULN 1: Drop the unsafe register_join_org RPC entirely
-- ═════════════════════════════════════════════════════════════════════════════
-- RegisterScreen uses register_join_org_by_code (code-first flow). The
-- legacy register_join_org accepted arbitrary org_id+role and never
-- validated the invite. Remove it to eliminate the privilege-escalation path.

DROP FUNCTION IF EXISTS public.register_join_org(uuid, text, uuid, text, text, text);


-- ═════════════════════════════════════════════════════════════════════════════
-- VULN 6: Lock down public read on invitations table
-- ═════════════════════════════════════════════════════════════════════════════
-- The previous policy "invitations_public_read" exposed every invitation's
-- email, org_id, role, and bearer token to anyone (including anonymous).

DROP POLICY IF EXISTS "invitations_public_read" ON invitations;

-- Replace with a SECURITY DEFINER RPC that returns only invitations
-- matching the caller's email, and never returns the token field.
CREATE OR REPLACE FUNCTION public.lookup_invitation_for_email(p_email text)
RETURNS TABLE (
  id          uuid,
  org_id      uuid,
  org_name    text,
  role        text,
  expires_at  timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.org_id,
    o.name AS org_name,
    i.role,
    i.expires_at
  FROM invitations i
  LEFT JOIN organizations o ON o.id = i.org_id
  WHERE lower(trim(i.email)) = lower(trim(p_email))
    AND i.accepted_at IS NULL
    AND (i.expires_at IS NULL OR i.expires_at > now())
  ORDER BY i.created_at DESC
  LIMIT 5;
$$;

-- Ensure invitations RLS is enabled with strict org_isolation (admins read theirs)
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invitations_org_isolation" ON invitations;
CREATE POLICY "invitations_org_isolation" ON invitations
  FOR ALL TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());


-- ═════════════════════════════════════════════════════════════════════════════
-- VULN 3: Enable RLS on org_visibility_settings + restrict modify to owner/admin
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE org_visibility_settings ENABLE ROW LEVEL SECURITY;

-- All members of an org can SELECT (so AuthContext can load their permissions)
DROP POLICY IF EXISTS "org_visibility_select" ON org_visibility_settings;
CREATE POLICY "org_visibility_select" ON org_visibility_settings
  FOR SELECT TO authenticated
  USING (org_id = auth_org_id());

-- Only owner/admin may INSERT/UPDATE/DELETE permission rows
DROP POLICY IF EXISTS "org_visibility_modify" ON org_visibility_settings;
CREATE POLICY "org_visibility_modify" ON org_visibility_settings
  FOR ALL TO authenticated
  USING (
    org_id = auth_org_id()
    AND EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.auth_id = auth.uid()
        AND tm.org_id = org_visibility_settings.org_id
        AND tm.role IN ('owner', 'admin')
        AND tm.deleted_at IS NULL
    )
  )
  WITH CHECK (
    org_id = auth_org_id()
    AND EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.auth_id = auth.uid()
        AND tm.org_id = org_visibility_settings.org_id
        AND tm.role IN ('owner', 'admin')
        AND tm.deleted_at IS NULL
    )
  );


-- ═════════════════════════════════════════════════════════════════════════════
-- VULN 4: Enable RLS on notification_prefs (own-row only)
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE notification_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_prefs_own" ON notification_prefs;
CREATE POLICY "notification_prefs_own" ON notification_prefs
  FOR ALL TO authenticated
  USING (
    team_member_id IN (
      SELECT id FROM team_members WHERE auth_id = auth.uid()
    )
  )
  WITH CHECK (
    team_member_id IN (
      SELECT id FROM team_members WHERE auth_id = auth.uid()
    )
  );

-- Server-side push notification sender (notifications.ts) reads other users'
-- prefs via SECURITY DEFINER RPC instead of direct SELECT. Add it.
CREATE OR REPLACE FUNCTION public.get_notification_prefs_for_send(p_team_member_ids uuid[])
RETURNS TABLE (
  team_member_id        uuid,
  enabled               boolean,
  notify_comments       boolean,
  notify_status_changes boolean,
  notify_new_files      boolean,
  muted_actor_ids       uuid[]
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Caller must be authenticated and recipients must share the caller's org
  SELECT np.team_member_id, np.enabled, np.notify_comments,
         np.notify_status_changes, np.notify_new_files, np.muted_actor_ids
  FROM notification_prefs np
  JOIN team_members tm ON tm.id = np.team_member_id
  WHERE auth.uid() IS NOT NULL
    AND tm.org_id = auth_org_id()
    AND np.team_member_id = ANY(p_team_member_ids);
$$;


-- ═════════════════════════════════════════════════════════════════════════════
-- VULN 5: Restrict org_join_codes INSERT/UPDATE/DELETE to owner/admin
-- ═════════════════════════════════════════════════════════════════════════════
-- Previously any member/viewer could INSERT a code with role='admin' for
-- their own org and then call join_org_by_code to escalate themselves.

DROP POLICY IF EXISTS "org_isolation" ON org_join_codes;

-- SELECT: any authenticated user in the org may read codes (TeamMembersScreen)
DROP POLICY IF EXISTS "org_join_codes_select" ON org_join_codes;
CREATE POLICY "org_join_codes_select" ON org_join_codes
  FOR SELECT TO authenticated
  USING (org_id = auth_org_id());

-- INSERT/UPDATE/DELETE: owner and admin only
DROP POLICY IF EXISTS "org_join_codes_modify" ON org_join_codes;
CREATE POLICY "org_join_codes_modify" ON org_join_codes
  FOR ALL TO authenticated
  USING (
    org_id = auth_org_id()
    AND EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.auth_id = auth.uid()
        AND tm.org_id = org_join_codes.org_id
        AND tm.role IN ('owner', 'admin')
        AND tm.deleted_at IS NULL
    )
  )
  WITH CHECK (
    org_id = auth_org_id()
    AND EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.auth_id = auth.uid()
        AND tm.org_id = org_join_codes.org_id
        AND tm.role IN ('owner', 'admin')
        AND tm.deleted_at IS NULL
    )
  );


-- ═════════════════════════════════════════════════════════════════════════════
-- VULN 7: Fix phone-lock NULL bypass in register_join_org_by_code
-- ═════════════════════════════════════════════════════════════════════════════
-- The B-4 fix was applied to join_org_by_code but the registration variant
-- still allows passing p_phone => NULL to bypass the phone-lock check.

CREATE OR REPLACE FUNCTION public.register_join_org_by_code(
  p_code  text,
  p_name  text,
  p_email text,
  p_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row      org_join_codes%ROWTYPE;
  v_org_name text;
  v_role     text;
  v_tm_id    uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_row
  FROM org_join_codes
  WHERE code = upper(trim(p_code))
    AND deleted_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Code not found';
  END IF;

  IF NOT v_row.is_active THEN
    RAISE EXCEPTION 'Code has been deactivated';
  END IF;

  -- FIX V7: phone lock cannot be bypassed by passing NULL p_phone.
  -- If the code has a phone restriction, the caller MUST supply a matching phone.
  IF v_row.invitee_phone IS NOT NULL THEN
    IF p_phone IS NULL OR v_row.invitee_phone <> p_phone THEN
      RAISE EXCEPTION 'This code is reserved for a different phone number';
    END IF;
  END IF;

  v_role := COALESCE(v_row.role, 'member');

  SELECT name INTO v_org_name FROM organizations WHERE id = v_row.org_id;
  SELECT id INTO v_tm_id FROM team_members WHERE auth_id = auth.uid() LIMIT 1;

  IF v_tm_id IS NOT NULL THEN
    UPDATE team_members
    SET org_id          = v_row.org_id,
        role            = v_role,
        joined_via_code = v_row.id,
        deleted_at      = NULL,
        deleted_by      = NULL,
        name            = COALESCE(p_name, name),
        email           = COALESCE(p_email, email),
        phone           = COALESCE(p_phone, phone)
    WHERE id = v_tm_id;
  ELSE
    INSERT INTO team_members (org_id, auth_id, name, email, phone, role, joined_via_code)
    VALUES (v_row.org_id, auth.uid(), p_name, p_email, p_phone, v_role, v_row.id);
  END IF;

  UPDATE org_join_codes
  SET use_count = use_count + 1
  WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'org_id',   v_row.org_id,
    'role',     v_role,
    'org_name', v_org_name
  );
END;
$$;


-- ═════════════════════════════════════════════════════════════════════════════
-- VULN 8: See migration_security_hardening_v2_auth.sql
-- ═════════════════════════════════════════════════════════════════════════════
-- The fix for V8 (auto_confirm_email trigger) modifies a function in the
-- `auth` schema, which the standard SQL Editor cannot do (permission denied).
-- It is split out into migration_security_hardening_v2_auth.sql which must be
-- run with postgres-superuser privileges (Supabase Dashboard → Database →
-- "Run SQL" with the right role, or via direct psql connection).


-- ═════════════════════════════════════════════════════════════════════════════
-- Hardening: revoke EXECUTE on internal SECURITY DEFINER functions from anon
-- ═════════════════════════════════════════════════════════════════════════════
-- These functions should only be callable by authenticated users (or in the
-- case of lookup_invite_code / lookup_invitation_for_email, by anon only via
-- the explicit pre-auth registration flow).

REVOKE ALL ON FUNCTION public.register_new_org(text, text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.register_join_org_by_code(text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.join_org_by_code(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.get_notification_prefs_for_send(uuid[]) FROM anon;

GRANT EXECUTE ON FUNCTION public.register_new_org(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_join_org_by_code(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_org_by_code(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_notification_prefs_for_send(uuid[]) TO authenticated;

-- lookup_invite_code and lookup_invitation_for_email are intentionally
-- callable pre-auth (used by RegisterScreen before signUp completes).
GRANT EXECUTE ON FUNCTION public.lookup_invite_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_invitation_for_email(text) TO anon, authenticated;
