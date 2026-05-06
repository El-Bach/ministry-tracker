// src/lib/config.ts
// App-wide configuration constants.
// Update these values here — they are used across all screens.

/** WhatsApp number for support and plan upgrades (E.164 without '+') */
export const SUPPORT_WHATSAPP = '96170123456'; // kept for upgrade CTA only

/** Support / management email address */
export const SUPPORT_EMAIL = 'management@kts-lb.com';

/** Legal pages (hosted on Netlify) */
export const PRIVACY_URL = 'https://ministry-papers.netlify.app/privacy.html';
export const TERMS_URL   = 'https://ministry-papers.netlify.app/terms.html';

// ─── Bypass accounts (testing / owner override) ──────────────────────────────
/**
 * Emails listed here are FULLY EXEMPT from all plan enforcement:
 *  • No plan-limit check runs on launch
 *  • PlanWarningModal never shown
 *  • PlanLockedScreen never shown
 *  • AccountScreen shows unlimited usage
 * Remove an email here when enforcement should resume for that account.
 */
export const PLAN_BYPASS_EMAILS: string[] = [
  'kamal01892100@gmail.com',
];

// ─── Plan limits ─────────────────────────────────────────────────────────────

/** Days the owner has to upgrade before the app is fully locked. */
export const GRACE_PERIOD_DAYS = 3;

/**
 * Per-plan hard limits. null = unlimited.
 * Source of truth — used by planEnforcement.ts and AccountScreen.
 */
export const PLAN_LIMITS: Record<string, { members: number | null; files: number | null }> = {
  free:     { members: 3,    files: 25   },
  basic:    { members: 10,   files: null },
  premium:  { members: null, files: null },
  starter:  { members: null, files: null },
  business: { members: null, files: null },
};
