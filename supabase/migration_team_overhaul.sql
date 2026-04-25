-- Migration: Team Permissions & Invite Code Overhaul
-- Run AFTER all previous migrations.
--
-- Changes:
--   1. org_join_codes — add invitee_name, invitee_phone, soft-delete columns
--   2. team_members  — add soft-delete columns + joined_via_code FK
--   3. RLS on org_join_codes
--   4. org_visibility_settings — allow 'admin' role
--   5. Updated join_org_by_code RPC (phone validation + joined_via_code tracking)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Extend org_join_codes ─────────────────────────────────────────────────
ALTER TABLE org_join_codes
  ADD COLUMN IF NOT EXISTS invitee_name  TEXT,
  ADD COLUMN IF NOT EXISTS invitee_phone TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by    UUID REFERENCES team_members(id) ON DELETE SET NULL;

-- ── 2. Extend team_members ───────────────────────────────────────────────────
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS deleted_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by      UUID REFERENCES team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS joined_via_code UUID REFERENCES org_join_codes(id) ON DELETE SET NULL;

-- ── 3. RLS on org_join_codes ─────────────────────────────────────────────────
ALTER TABLE org_join_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_isolation" ON org_join_codes;
CREATE POLICY "org_isolation" ON org_join_codes
  USING (org_id = auth_org_id());

-- Allow anonymous/unauthenticated reads for code validation during registration
-- (user not yet in team_members when they enter a code)
DROP POLICY IF EXISTS "public_code_lookup" ON org_join_codes;
CREATE POLICY "public_code_lookup" ON org_join_codes
  FOR SELECT
  USING (true);

-- ── 4. Allow 'admin' role in org_visibility_settings ─────────────────────────
ALTER TABLE org_visibility_settings
  DROP CONSTRAINT IF EXISTS org_visibility_settings_role_check;
ALTER TABLE org_visibility_settings
  ADD CONSTRAINT org_visibility_settings_role_check
  CHECK (role IN ('admin', 'member', 'viewer'));

-- Seed default admin row for all existing orgs (same defaults as member)
INSERT INTO org_visibility_settings (org_id, role,
  can_see_all_files, can_create_files, can_edit_file_details, can_delete_files,
  can_update_stage_status, can_add_edit_stages,
  can_see_contract_price, can_see_financial_report,
  can_add_revenue, can_add_expenses, can_edit_contract_price, can_delete_transactions,
  can_upload_documents, can_delete_documents,
  can_manage_clients,
  can_add_comments, can_delete_comments)
SELECT id, 'admin',
  true, true, true, false,
  true, true,
  true, false,
  true, true, false, false,
  true, false,
  true,
  true, false
FROM organizations
ON CONFLICT (org_id, role) DO NOTHING;

-- ── 5. Updated join_org_by_code RPC ─────────────────────────────────────────
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

  -- Phone validation: if invitee_phone is set on code, registering phone must match
  IF v_row.invitee_phone IS NOT NULL
     AND p_phone IS NOT NULL
     AND v_row.invitee_phone <> p_phone THEN
    RAISE EXCEPTION 'This code is reserved for a different phone number';
  END IF;

  -- Get org name
  SELECT name INTO v_name FROM organizations WHERE id = v_row.org_id;

  -- Update the caller's team_members row (bypasses RLS — SECURITY DEFINER)
  UPDATE team_members
  SET org_id           = v_row.org_id,
      role             = COALESCE(v_row.role, 'member'),
      joined_via_code  = v_row.id,
      deleted_at       = NULL,   -- un-delete if previously soft-deleted
      deleted_by       = NULL
  WHERE auth_id = auth.uid();

  -- Increment use count
  UPDATE org_join_codes
  SET use_count = use_count + 1
  WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'org_id',        v_row.org_id,
    'role',          COALESCE(v_row.role, 'member'),
    'org_name',      v_name,
    'invitee_name',  v_row.invitee_name,
    'invitee_phone', v_row.invitee_phone
  );
END;
$$;
