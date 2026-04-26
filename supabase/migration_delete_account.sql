-- Migration: Account Deletion RPC (B-6)
-- Provides in-app account deletion to satisfy Apple App Store Review Guideline 5.1.1
-- and Google Play Policy (mandatory for apps with account creation as of 2024).
--
-- What this RPC does:
--   1. Blocks owners (must transfer ownership first)
--   2. Marks the team_member row as deleted (deleted_at = NOW())
--   3. Removes the push token so no more notifications are sent
--   4. Returns 'ok' — the client then signs out via supabase.auth.signOut()
--
-- ⚠️  Auth user hard-deletion (removing the row from auth.users) requires the
--    Supabase service-role key, which cannot be used on the client. That step
--    is handled by the Edge Function at supabase/functions/delete-account/index.ts.
--    The Edge Function calls supabase.auth.admin.deleteUser(uid) using the service key.
--    Until the Edge Function is deployed, the auth.users row remains but the user
--    cannot log in (no matching team_members row → auto-sign-out in AuthContext).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member team_members%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_member
  FROM team_members
  WHERE auth_id = auth.uid()
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  -- Owners must transfer ownership before they can delete their account
  IF v_member.role = 'owner' THEN
    RAISE EXCEPTION 'Transfer ownership to another admin before deleting your account';
  END IF;

  -- Soft-delete: mark the team_members row
  UPDATE team_members
  SET deleted_at  = NOW(),
      push_token  = NULL   -- stop push notifications immediately
  WHERE id = v_member.id;

  RETURN 'ok';
END;
$$;
