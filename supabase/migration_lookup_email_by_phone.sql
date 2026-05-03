-- migration_lookup_email_by_phone.sql
--
-- Lets users log in by ANY phone number they've set on their profile, not just
-- the one tied to their original Supabase Auth identity.
--
-- Background:
--   GovPilot stores two related things for each user:
--     1. team_members.email   → the Supabase Auth login identifier
--                                (real email, OR internal `p<digits>@cleartrack.internal`
--                                 for users who originally registered by phone)
--     2. team_members.phone   → a display/contact phone, optional, set in
--                                Edit Profile. Not connected to Supabase Auth.
--
--   So a user who registered by email and later added a phone in their profile
--   COULD NOT log in with that phone — Supabase only knows about the email.
--
--   This RPC bridges the gap: given any phone format the user types at login,
--   it scans team_members.phone to find a matching row and returns the user's
--   real auth email. The login screen then signs in with that email.
--
-- Privacy / abuse note:
--   Like Supabase's built-in email login, this lets unauthenticated callers
--   probe whether a phone number exists by attempting a login. Supabase Auth's
--   built-in rate limit (5 attempts / hour / IP) keeps mass enumeration
--   impractical. We accept this trade-off — it's the same as email login.
--
-- Run in Supabase SQL Editor (any role; the function is SECURITY DEFINER).

CREATE OR REPLACE FUNCTION lookup_auth_email_by_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_input  TEXT;
  v_digits TEXT;
  v_email  TEXT;
BEGIN
  -- 1. Strip whitespace, dashes, parens, dots from caller input.
  v_input := regexp_replace(COALESCE(p_phone, ''), '[\s\-().]', '', 'g');
  IF v_input = '' THEN RETURN NULL; END IF;

  -- 2. Extract just the digits (no `+`, no `00`).
  --    "03653342"        → "03653342"
  --    "+96103653342"    → "96103653342"
  --    "0096103653342"   → "96103653342"
  --    "96103653342"     → "96103653342"
  v_digits := regexp_replace(v_input, '^(\+|00)', '', '');
  v_digits := regexp_replace(v_digits, '[^0-9]', '', 'g');

  -- 3. Try several candidate phone formats against team_members.phone.
  --    Order from most-likely-canonical to local-style fallbacks.
  --    Stops at the first row that matches an active (non-deleted) member.
  --
  --    Helper subquery: same active-member predicate every time.
  WITH candidates AS (
    SELECT unnest(ARRAY[
      v_input,                     -- as user typed (with leading + or 00 if present)
      '+' || v_digits,             -- digits with + prefix
      '00' || v_digits,            -- digits with 00 prefix
      v_digits,                    -- digits only
      '+961' || v_digits,          -- assume Lebanon, add country code
      '+961' || regexp_replace(v_digits, '^961', '', '')   -- already-prefixed Lebanese
    ]) AS phone_variant
  )
  SELECT tm.email INTO v_email
  FROM team_members tm
  JOIN candidates c ON tm.phone = c.phone_variant
  WHERE tm.deleted_at IS NULL
  LIMIT 1;

  -- 4. Last-ditch fallback: ignore stored format entirely and match by digits-only.
  --    Picks up cases where the stored phone has a weird format (e.g. extra
  --    spaces snuck in) but the digits are the same.
  IF v_email IS NULL THEN
    SELECT tm.email INTO v_email
    FROM team_members tm
    WHERE tm.deleted_at IS NULL
      AND regexp_replace(COALESCE(tm.phone, ''), '[^0-9]', '', 'g') = v_digits
    LIMIT 1;
  END IF;

  RETURN v_email;
END $$;

-- Grant execute to anon so the login screen (pre-auth) can call it.
-- The function only returns the auth email — it never exposes other PII.
GRANT EXECUTE ON FUNCTION lookup_auth_email_by_phone(TEXT) TO anon, authenticated;

-- Comment for future maintainers.
COMMENT ON FUNCTION lookup_auth_email_by_phone(TEXT) IS
  'Login helper: given any phone format a user types, returns the matching '
  'team_members.email (Supabase Auth identifier) or NULL. Used by LoginScreen '
  'before calling supabase.auth.signInWithPassword so that profile phone '
  'numbers work as login alternatives. Privacy: callable by anon; like email '
  'login, it lets attackers probe whether a phone is registered. Rate-limited '
  'by Supabase Auth.';
