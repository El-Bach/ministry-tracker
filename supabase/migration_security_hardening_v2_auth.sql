-- migration_security_hardening_v2_auth.sql
-- VULN 8 fix — must be run with elevated privileges (postgres role).
--
-- Previously every signup was auto-confirmed, allowing an attacker to register
-- with a victim's real email and squat the address. Restrict auto-confirm to
-- synthetic phone-derived emails (which cannot receive real mail anyway).
--
-- The standard Supabase SQL Editor runs as a role that cannot modify
-- functions in the `auth` schema. To run this migration:
--
--   Option A (recommended): Supabase Dashboard
--     1. Open Supabase Dashboard → SQL Editor
--     2. Click the role dropdown (top-right of the editor) and select `postgres`
--     3. Paste this migration and run
--
--   Option B: psql with the database connection string
--     psql "<connection-string>" -f migration_security_hardening_v2_auth.sql
--
--   Option C (alternative): Don't run this SQL at all. Instead:
--     1. Drop the auth.auto_confirm_email trigger via the Database UI
--     2. In Supabase Dashboard → Authentication → Providers → Email,
--        enable "Confirm email" so real emails go through normal verification
--     3. Phone signups (synthetic @cleartrack.internal addresses) will then
--        require a code-side workaround: in RegisterScreen, after signUp(),
--        call an Edge Function that uses the service-role key to confirm
--        synthetic emails only.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION auth.auto_confirm_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Only auto-confirm synthetic phone-derived addresses on the internal domain.
  -- Real-email signups must complete the standard verification flow so that
  -- an attacker cannot register with a victim's real email and squat it.
  IF NEW.email LIKE '%@cleartrack.internal' THEN
    NEW.email_confirmed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;
