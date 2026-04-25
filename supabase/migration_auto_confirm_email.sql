-- Migration: Auto-confirm email on signup
-- Session 29
-- Run this if you cannot find the "Confirm email" toggle in the Supabase dashboard.
--
-- Problem: Supabase requires email confirmation by default. New accounts are
-- stuck in "unconfirmed" state and cannot sign in. Phone users
-- (p96170…@cleartrack.internal fake emails) can never confirm at all.
--
-- Fix part 1: Confirm all existing unconfirmed accounts immediately.
-- Fix part 2: Install a BEFORE INSERT trigger on auth.users so every
--             future signup is auto-confirmed the moment it is created.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Unblock all existing accounts that haven't been confirmed yet
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email_confirmed_at IS NULL;

-- 2. Auto-confirm function
CREATE OR REPLACE FUNCTION auth.auto_confirm_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.email_confirmed_at = NOW();
  RETURN NEW;
END;
$$;

-- 3. Trigger: fires before every new auth.users INSERT
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION auth.auto_confirm_email();
