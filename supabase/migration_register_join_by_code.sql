-- Migration: register_join_org_by_code RPC
-- Called by RegisterScreen after signUp() when the user has an invite code.
-- The new user has no team_members row yet so SECURITY DEFINER is required
-- to bypass RLS and INSERT the new row.
-- ─────────────────────────────────────────────────────────────────────────────

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

  -- Phone validation: if invitee_phone is set on code, it must match
  IF v_row.invitee_phone IS NOT NULL
     AND p_phone IS NOT NULL
     AND v_row.invitee_phone <> p_phone THEN
    RAISE EXCEPTION 'This code is reserved for a different phone number';
  END IF;

  v_role := COALESCE(v_row.role, 'member');

  -- Get org name
  SELECT name INTO v_org_name FROM organizations WHERE id = v_row.org_id;

  -- Check if a team_members row already exists for this auth user (edge case: retry)
  SELECT id INTO v_tm_id FROM team_members WHERE auth_id = auth.uid() LIMIT 1;

  IF v_tm_id IS NOT NULL THEN
    -- Update existing row
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
    -- Insert new row (new user joining for the first time)
    INSERT INTO team_members (org_id, auth_id, name, email, phone, role, joined_via_code)
    VALUES (v_row.org_id, auth.uid(), p_name, p_email, p_phone, v_role, v_row.id);
  END IF;

  -- Increment use count
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
