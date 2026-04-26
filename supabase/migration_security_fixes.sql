-- Migration: Security Fixes (Launch Blockers B-2, B-3, B-4)
-- Run AFTER all previous migrations.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── B-2: Replace open public_code_lookup RLS with a SECURITY DEFINER RPC ─────
-- The original policy USING (true) exposed every invite code (including
-- invitee names and phones) to any unauthenticated caller.

DROP POLICY IF EXISTS "public_code_lookup" ON org_join_codes;

-- Re-confirm only the authenticated org_isolation policy remains
DROP POLICY IF EXISTS "org_isolation" ON org_join_codes;
CREATE POLICY "org_isolation" ON org_join_codes
  FOR ALL
  USING (org_id = auth_org_id());

-- RPC: validate an invite code without an RLS SELECT policy
-- Returns only the fields the RegisterScreen needs; never returns invitee_phone.
CREATE OR REPLACE FUNCTION public.lookup_invite_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row      org_join_codes%ROWTYPE;
  v_org_name text;
BEGIN
  SELECT * INTO v_row
  FROM org_join_codes
  WHERE code = upper(trim(p_code))
    AND deleted_at IS NULL
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT name INTO v_org_name FROM organizations WHERE id = v_row.org_id;

  -- Return only what the registration screen needs.
  -- has_phone_lock lets the UI show a "phone required" hint without leaking the number.
  RETURN jsonb_build_object(
    'org_id',         v_row.org_id,
    'org_name',       COALESCE(v_org_name, ''),
    'role',           COALESCE(v_row.role, 'member'),
    'invitee_name',   v_row.invitee_name,
    'has_phone_lock', (v_row.invitee_phone IS NOT NULL)
  );
END;
$$;

-- ── B-3: Scope organizations policy — SELECT for all members, UPDATE for owner only ──
-- The original FOR ALL USING (id = auth_org_id()) let any member UPDATE or DELETE
-- their org row (change name, plan, etc.) with no ownership check.

DROP POLICY IF EXISTS "org_read_own" ON organizations;

CREATE POLICY "org_select" ON organizations
  FOR SELECT
  USING (id = auth_org_id());

CREATE POLICY "org_update_owner" ON organizations
  FOR UPDATE
  USING (id = auth_org_id())
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE auth_id = auth.uid()
        AND org_id = organizations.id
        AND role = 'owner'
    )
  );

-- No DELETE policy — organisations cannot be deleted via the client SDK.

-- ── B-4: Fix join_org_by_code phone lock bypass ───────────────────────────────
-- The original condition (invitee_phone IS NOT NULL AND p_phone IS NOT NULL AND ...)
-- could be bypassed by passing NULL as p_phone.
-- The new logic: if a phone is locked, the caller MUST supply a matching phone.

CREATE OR REPLACE FUNCTION public.join_org_by_code(
  p_code  text,
  p_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row  org_join_codes%ROWTYPE;
  v_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Look up active, non-deleted code
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

  -- Phone lock: if code has a phone restriction, caller MUST supply the matching phone
  IF v_row.invitee_phone IS NOT NULL THEN
    IF p_phone IS NULL OR v_row.invitee_phone <> p_phone THEN
      RAISE EXCEPTION 'This code is reserved for a different phone number';
    END IF;
  END IF;

  -- Get org name
  SELECT name INTO v_name FROM organizations WHERE id = v_row.org_id;

  -- Update caller's team_members row (bypasses RLS — SECURITY DEFINER)
  UPDATE team_members
  SET org_id          = v_row.org_id,
      role            = COALESCE(v_row.role, 'member'),
      joined_via_code = v_row.id,
      deleted_at      = NULL,
      deleted_by      = NULL
  WHERE auth_id = auth.uid();

  -- Increment use count
  UPDATE org_join_codes
  SET use_count = use_count + 1
  WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'org_id',       v_row.org_id,
    'role',         COALESCE(v_row.role, 'member'),
    'org_name',     v_name,
    'invitee_name', v_row.invitee_name
  );
END;
$$;
