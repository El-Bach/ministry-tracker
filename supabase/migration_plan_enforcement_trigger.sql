-- migration_plan_enforcement_trigger.sql
-- Server-side plan limit enforcement.
--
-- The client-side check in `src/lib/planEnforcement.ts` is a UX preview only —
-- a malicious user could bypass it by calling the Supabase REST API directly
-- (e.g. via DevTools or a decompiled APK). This trigger is the trustworthy
-- enforcement boundary.
--
-- Behaviour:
--   - Counts active (non-archived) tasks for NEW.org_id
--   - Counts non-deleted team_members for NEW.org_id
--   - Looks up plan limits from a `plan_limits` table (source of truth in DB,
--     mirrored from src/lib/config.ts)
--   - If org has been over the limit longer than GRACE_PERIOD_DAYS → REJECT
--     the INSERT with a clear error message
--   - If org has just exceeded the limit → record `plan_limit_exceeded_at`
--     timestamp on the org row but allow the INSERT (grace period started)
--   - If plan is unlimited → no-op
--
-- Run AFTER migration_plan_enforcement.sql (which adds plan_limit_exceeded_at).

-- ─── plan_limits table (source of truth, queryable from triggers) ──────────
CREATE TABLE IF NOT EXISTS plan_limits (
  plan         TEXT PRIMARY KEY,
  max_members  INTEGER,   -- NULL = unlimited
  max_files    INTEGER,   -- NULL = unlimited
  grace_days   INTEGER NOT NULL DEFAULT 3
);

INSERT INTO plan_limits (plan, max_members, max_files, grace_days) VALUES
  ('free',     3,    25,   3),
  ('basic',    10,   NULL, 3),
  ('premium',  NULL, NULL, 3),
  ('starter',  NULL, NULL, 3),
  ('business', NULL, NULL, 3)
ON CONFLICT (plan) DO UPDATE SET
  max_members = EXCLUDED.max_members,
  max_files   = EXCLUDED.max_files,
  grace_days  = EXCLUDED.grace_days;

-- Read-only to authenticated; only admins can modify (via Supabase Studio).
ALTER TABLE plan_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plan_limits_read" ON plan_limits;
CREATE POLICY "plan_limits_read" ON plan_limits
  FOR SELECT TO authenticated USING (true);

-- ─── Trigger function: enforce_plan_limit_files ────────────────────────────
CREATE OR REPLACE FUNCTION enforce_plan_limit_files()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_plan          TEXT;
  v_max_files     INTEGER;
  v_grace_days    INTEGER;
  v_count         INTEGER;
  v_exceeded_at   TIMESTAMPTZ;
  v_grace_expired BOOLEAN;
BEGIN
  IF NEW.org_id IS NULL THEN RETURN NEW; END IF;

  SELECT plan, plan_limit_exceeded_at INTO v_plan, v_exceeded_at
    FROM organizations WHERE id = NEW.org_id;

  IF v_plan IS NULL THEN RETURN NEW; END IF;

  SELECT max_files, grace_days INTO v_max_files, v_grace_days
    FROM plan_limits WHERE plan = v_plan;

  -- Unlimited plan → no enforcement
  IF v_max_files IS NULL THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_count
    FROM tasks
   WHERE org_id = NEW.org_id
     AND COALESCE(is_archived, false) = false;

  -- Under the limit → allow + clear stale exceeded-at if any
  IF v_count < v_max_files THEN
    IF v_exceeded_at IS NOT NULL THEN
      UPDATE organizations SET plan_limit_exceeded_at = NULL WHERE id = NEW.org_id;
    END IF;
    RETURN NEW;
  END IF;

  -- At or over limit. If exceeded-at is unset, this is the first overage —
  -- record it and start the grace period.
  IF v_exceeded_at IS NULL THEN
    UPDATE organizations SET plan_limit_exceeded_at = NOW() WHERE id = NEW.org_id;
    -- Allow this INSERT — grace period just started.
    RETURN NEW;
  END IF;

  -- Already over, check grace.
  v_grace_expired := (NOW() - v_exceeded_at) > make_interval(days => v_grace_days);
  IF v_grace_expired THEN
    RAISE EXCEPTION 'Plan limit exceeded: % plan allows % active files. Grace period has expired. Please upgrade.',
      v_plan, v_max_files
      USING ERRCODE = 'P0001';
  END IF;

  -- Within grace window → allow.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_plan_limit_files ON tasks;
CREATE TRIGGER trg_enforce_plan_limit_files
  BEFORE INSERT ON tasks
  FOR EACH ROW EXECUTE FUNCTION enforce_plan_limit_files();

-- ─── Trigger function: enforce_plan_limit_members ──────────────────────────
CREATE OR REPLACE FUNCTION enforce_plan_limit_members()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_plan          TEXT;
  v_max_members   INTEGER;
  v_grace_days    INTEGER;
  v_count         INTEGER;
  v_exceeded_at   TIMESTAMPTZ;
  v_grace_expired BOOLEAN;
BEGIN
  IF NEW.org_id IS NULL THEN RETURN NEW; END IF;

  SELECT plan, plan_limit_exceeded_at INTO v_plan, v_exceeded_at
    FROM organizations WHERE id = NEW.org_id;

  IF v_plan IS NULL THEN RETURN NEW; END IF;

  SELECT max_members, grace_days INTO v_max_members, v_grace_days
    FROM plan_limits WHERE plan = v_plan;

  IF v_max_members IS NULL THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_count
    FROM team_members
   WHERE org_id = NEW.org_id
     AND deleted_at IS NULL;

  IF v_count < v_max_members THEN RETURN NEW; END IF;

  IF v_exceeded_at IS NULL THEN
    UPDATE organizations SET plan_limit_exceeded_at = NOW() WHERE id = NEW.org_id;
    RETURN NEW;
  END IF;

  v_grace_expired := (NOW() - v_exceeded_at) > make_interval(days => v_grace_days);
  IF v_grace_expired THEN
    RAISE EXCEPTION 'Plan limit exceeded: % plan allows % team members. Grace period has expired. Please upgrade.',
      v_plan, v_max_members
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_plan_limit_members ON team_members;
CREATE TRIGGER trg_enforce_plan_limit_members
  BEFORE INSERT ON team_members
  FOR EACH ROW EXECUTE FUNCTION enforce_plan_limit_members();
