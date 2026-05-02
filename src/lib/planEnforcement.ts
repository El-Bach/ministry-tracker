// src/lib/planEnforcement.ts
// Central plan-limit enforcement logic.
// Called once on every app launch (after auth resolves).

import { SupabaseClient } from '@supabase/supabase-js';
import { PLAN_LIMITS, GRACE_PERIOD_DAYS } from './config';

export interface PlanStatus {
  exceeded: boolean;      // org is at or over its plan limit
  isLocked: boolean;      // grace period has expired — app should be fully blocked
  daysRemaining: number;  // days left in grace period (0 if locked)
  fileCount: number;
  memberCount: number;
  limitFiles: number | null;
  limitMembers: number | null;
  exceededAt: string | null; // ISO timestamp when limit was first hit
}

/**
 * Check whether the organisation has exceeded its plan limits.
 *
 * Side effects (via Supabase):
 *  • If newly exceeded → writes plan_limit_exceeded_at = now() to organizations
 *  • If no longer exceeded → clears plan_limit_exceeded_at = null
 */
export async function checkPlanLimits(
  supabase: SupabaseClient,
  orgId: string,
  plan: string,
  currentExceededAt: string | null | undefined,
): Promise<PlanStatus> {
  const limits = PLAN_LIMITS[plan] ?? { members: null, files: null };

  // Fetch live counts in parallel
  const [membersRes, filesRes] = await Promise.all([
    supabase
      .from('team_members')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .is('deleted_at', null),
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('is_archived', false),
  ]);

  const memberCount = membersRes.count ?? 0;
  const fileCount   = filesRes.count   ?? 0;

  const filesOver   = limits.files   !== null && fileCount   >= limits.files;
  const membersOver = limits.members !== null && memberCount >= limits.members;
  const exceeded    = filesOver || membersOver;

  let exceededAt = currentExceededAt ?? null;

  // Record the moment the org first exceeded the limit
  if (exceeded && !exceededAt) {
    const now = new Date().toISOString();
    await supabase
      .from('organizations')
      .update({ plan_limit_exceeded_at: now })
      .eq('id', orgId);
    exceededAt = now;
  }

  // Clear the timestamp if counts dropped back under the limit (archiving, plan upgrade)
  if (!exceeded && exceededAt) {
    await supabase
      .from('organizations')
      .update({ plan_limit_exceeded_at: null })
      .eq('id', orgId);
    exceededAt = null;
  }

  // Grace period arithmetic
  const MS_PER_DAY = 86_400_000;
  const elapsed    = exceededAt ? Date.now() - new Date(exceededAt).getTime() : 0;
  const isLocked   = exceeded && elapsed >= GRACE_PERIOD_DAYS * MS_PER_DAY;
  const daysRemaining = exceeded
    ? Math.max(0, GRACE_PERIOD_DAYS - Math.floor(elapsed / MS_PER_DAY))
    : 0;

  return {
    exceeded,
    isLocked,
    daysRemaining,
    fileCount,
    memberCount,
    limitFiles:   limits.files,
    limitMembers: limits.members,
    exceededAt,
  };
}
