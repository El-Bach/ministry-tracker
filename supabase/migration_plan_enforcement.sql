-- migration_plan_enforcement.sql
-- Adds plan_limit_exceeded_at to organizations so the app can track when a
-- free-plan org first exceeded its limits and enforce the 3-day grace period.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS plan_limit_exceeded_at TIMESTAMPTZ DEFAULT NULL;

-- The app writes this column (never KTS manually):
--   • Set to NOW() the first time an org's active count >= plan limit
--   • Cleared back to NULL when counts drop back under limit or plan is upgraded
