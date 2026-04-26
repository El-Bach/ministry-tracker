-- Migration: Add has_completed_onboarding flag to team_members (P-6)
-- Replaces the fragile 60-second Date.now() heuristic in AuthContext.
-- When a user completes OnboardingScreen, this flag is set to true.
-- AuthContext then uses it instead of the time window to decide whether
-- to show onboarding or sign the user out.

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS has_completed_onboarding boolean NOT NULL DEFAULT false;

-- Backfill: all existing members have already completed onboarding
UPDATE team_members
  SET has_completed_onboarding = true
  WHERE deleted_at IS NULL;
