-- Migration: Registration RPC functions (bypass RLS for new user setup)
-- Session 29
-- Run AFTER migration_organizations.sql and migration_invitations.sql
--
-- Problem: new users have no team_members row yet, so auth_org_id() = NULL,
-- which causes all RLS policies to block the INSERT into organizations and
-- team_members during registration — even with extra permissive policies.
--
-- Solution: two SECURITY DEFINER functions that run as the DB owner,
-- bypassing RLS entirely. They validate the caller is authenticated and
-- do everything atomically in a single transaction.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. New owner registration: creates org + owner profile + default status labels
CREATE OR REPLACE FUNCTION public.register_new_org(
  p_org_name   text,
  p_org_slug   text,
  p_name       text,
  p_email      text,
  p_phone      text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id    uuid;
  v_member_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Create the organization
  INSERT INTO organizations (name, slug, plan)
  VALUES (p_org_name, p_org_slug, 'free')
  RETURNING id INTO v_org_id;

  -- Create the owner's team_members row
  INSERT INTO team_members (name, email, phone, role, org_id, auth_id)
  VALUES (p_name, p_email, p_phone, 'owner', v_org_id, auth.uid())
  RETURNING id INTO v_member_id;

  -- Seed default status labels for this org
  INSERT INTO status_labels (label, color, sort_order, org_id) VALUES
    ('Submitted',         '#6366f1', 1, v_org_id),
    ('In Review',         '#f59e0b', 2, v_org_id),
    ('Pending Signature', '#8b5cf6', 3, v_org_id),
    ('Done',              '#10b981', 4, v_org_id),
    ('Rejected',          '#ef4444', 5, v_org_id),
    ('Closed',            '#64748b', 6, v_org_id);

  RETURN jsonb_build_object('org_id', v_org_id, 'member_id', v_member_id);
END;
$$;

-- 2. Invited user registration: joins existing org + marks invite accepted
CREATE OR REPLACE FUNCTION public.register_join_org(
  p_org_id    uuid,
  p_role      text,
  p_invite_id uuid,
  p_name      text,
  p_email     text,
  p_phone     text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Create the team_members row (auth_id unique — update on conflict)
  INSERT INTO team_members (name, email, phone, role, org_id, auth_id)
  VALUES (p_name, p_email, p_phone, p_role, p_org_id, auth.uid())
  ON CONFLICT (auth_id) DO UPDATE
    SET name   = EXCLUDED.name,
        role   = EXCLUDED.role,
        org_id = EXCLUDED.org_id
  RETURNING id INTO v_member_id;

  -- Mark invitation as accepted
  UPDATE invitations
  SET accepted_at = NOW()
  WHERE id = p_invite_id;

  RETURN v_member_id;
END;
$$;
