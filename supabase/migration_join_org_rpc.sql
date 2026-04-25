-- Migration: join_org_by_code RPC (bypass RLS when changing org_id)
-- Problem: team_members has FOR ALL USING (org_id = auth_org_id()).
-- When a user tries to UPDATE their own row to change org_id (joining a new company
-- via a join code), the implicit WITH CHECK on the new org_id fails because
-- new org_id ≠ current auth_org_id() — the update is silently blocked.
-- Solution: SECURITY DEFINER function that runs as DB owner, bypasses RLS.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.join_org_by_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code_row  org_join_codes%ROWTYPE;
  v_org_name  text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Look up the code
  SELECT * INTO v_code_row
  FROM org_join_codes
  WHERE code = upper(trim(p_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Code not found';
  END IF;

  IF NOT v_code_row.is_active THEN
    RAISE EXCEPTION 'Code has been deactivated';
  END IF;

  -- Get org name for confirmation message
  SELECT name INTO v_org_name FROM organizations WHERE id = v_code_row.org_id;

  -- Update the caller's team_members row (bypassing RLS)
  UPDATE team_members
  SET org_id = v_code_row.org_id,
      role   = COALESCE(v_code_row.role, 'member')
  WHERE auth_id = auth.uid();

  -- Increment use count
  UPDATE org_join_codes
  SET use_count = use_count + 1
  WHERE id = v_code_row.id;

  RETURN jsonb_build_object(
    'org_id',   v_code_row.org_id,
    'role',     COALESCE(v_code_row.role, 'member'),
    'org_name', v_org_name
  );
END;
$$;
