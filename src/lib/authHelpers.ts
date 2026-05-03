// src/lib/authHelpers.ts
// Helpers for phone-as-username auth (Option A)
// Session 26 — Phone numbers converted to internal Supabase emails
//
// How it works:
//   User enters phone:  +961 70 123 456  →  p96170123456@cleartrack.internal
//   User enters email:  john@company.com →  john@company.com  (unchanged)
//
// The 'p' prefix replaces '+' so Supabase auth accepts the email ('+' is invalid
// at the start of an email local part).
// The internal domain (@cleartrack.internal) is never shown to the user.
// Users always identify themselves by phone OR real email — never the derived address.

const INTERNAL_DOMAIN = '@cleartrack.internal';

/**
 * Returns true if the input looks like a phone number (no @ symbol).
 * Lebanese numbers, international format, with/without spaces all qualify.
 */
export function isPhoneInput(input: string): boolean {
  return !input.trim().includes('@');
}

/**
 * Normalize a phone number to a consistent format for storage / lookup.
 * Strips spaces, dashes, parentheses. Keeps leading +.
 * "+961 70 123 456" → "+96170123456"
 * "03 123 456"      → "+3123456"  (no country code — kept as-is with +)
 * "70123456"        → "+70123456"
 */
export function normalizePhone(phone: string): string {
  const stripped = phone.trim().replace(/[\s\-().]/g, '');
  if (stripped.startsWith('+')) return stripped;
  return `+${stripped}`;
}

/**
 * Convert any login identifier to a Supabase-compatible email.
 * - Real email  → returned as-is (lowercased)
 * - Phone number → "p96170123456@cleartrack.internal"
 *   ('+' stripped and replaced with 'p' — Supabase rejects '+' at start of local part)
 */
export function normalizeToEmail(input: string): string {
  const trimmed = input.trim();
  if (!isPhoneInput(trimmed)) return trimmed.toLowerCase();
  const digits = normalizePhone(trimmed).replace(/^\+/, '');
  return `p${digits}${INTERNAL_DOMAIN}`;
}

/**
 * Lebanon-aware phone normalizer for the LOGIN flow.
 *
 * Users typing their own phone number rarely type the canonical international
 * form. This helper auto-prepends `+961` when the input looks Lebanese
 * (no country code), and converts `00`-prefixed forms to `+`-prefixed.
 *
 * Examples (all map to the standard `+961…` form a user would have registered with):
 *   "03653342"          → "+96103653342"
 *   "+961 03 653 342"   → "+96103653342"
 *   "00961 03 653 342"  → "+96103653342"
 *   "961 03 653 342"    → "+96103653342"
 *   "+1 555 123 4567"   → "+15551234567"   (international stays as-is)
 *
 * The function preserves whatever digits the user typed — including a leading
 * zero — because users typically log in using the same digits they registered
 * with (and the registered phone is stored in `team_members.phone`).
 */
export function normalizePhoneForLogin(phone: string): string {
  const stripped = phone.trim().replace(/[\s\-().]/g, '');
  if (!stripped) return stripped;

  // Already canonical international format
  if (stripped.startsWith('+')) return stripped;

  // "00xxx" → "+xxx" (international dialing prefix used in some regions)
  if (stripped.startsWith('00')) return '+' + stripped.slice(2);

  // "961xxx" → "+961xxx" (country code without +)
  if (stripped.startsWith('961')) return '+' + stripped;

  // Pure-digit input without country code → assume Lebanon (+961)
  if (/^\d+$/.test(stripped)) return '+961' + stripped;

  // Anything else — best-effort, just add +
  return '+' + stripped;
}

/**
 * One-stop helper for the LOGIN flow: takes whatever the user typed and
 * returns the Supabase-auth-compatible email to use for sign-in.
 *
 * - If input contains `@` → treated as email, trimmed + lowercased.
 * - Otherwise → treated as a phone, normalized to international format
 *   (Lebanon defaults), then converted to the internal `p<digits>@cleartrack.internal`
 *   address that Supabase Auth was registered with.
 */
export function normalizeIdentifier(input: string): string {
  const trimmed = input.trim();
  if (trimmed.includes('@')) return trimmed.toLowerCase();
  const intl = normalizePhoneForLogin(trimmed);
  const digits = intl.replace(/^\+/, '');
  return `p${digits}${INTERNAL_DOMAIN}`;
}

/**
 * Given a Supabase auth email, return the display identifier for the user.
 * "p96170123456@cleartrack.internal"  → "+96170123456"  (p-prefix → + prefix)
 * "+96170123456@cleartrack.internal"  → "+96170123456"  (legacy format, still handled)
 * "john@company.com"                  → "john@company.com"
 */
export function emailToDisplay(email: string): string {
  if (email.endsWith(INTERNAL_DOMAIN)) {
    const local = email.replace(INTERNAL_DOMAIN, '');
    // New format: p96170123456 → +96170123456
    if (local.startsWith('p') && /^p\d+$/.test(local)) {
      return `+${local.slice(1)}`;
    }
    // Legacy format: +96170123456 (stored as-is before the fix)
    return local;
  }
  return email;
}

/**
 * Extract the real phone number from a team_member row.
 * Priority: phone field (explicit) → parsed from email if internal domain.
 */
export function getPhoneFromMember(member: { phone?: string | null; email: string }): string | null {
  if (member.phone) return member.phone;
  if (member.email.endsWith(INTERNAL_DOMAIN)) {
    return emailToDisplay(member.email);
  }
  return null;
}

/**
 * Label for the login/register identifier field.
 */
export const IDENTIFIER_LABEL = 'EMAIL OR PHONE NUMBER';
export const IDENTIFIER_PLACEHOLDER = 'your@email.com  or  +961 70 123 456';
