// src/lib/authHelpers.ts
// Helpers for phone-as-username auth (Option A)
// Session 26 — Phone numbers converted to internal Supabase emails
//
// How it works:
//   User enters phone:  +961 70 123 456  →  +96170123456@cleartrack.internal
//   User enters email:  john@company.com →  john@company.com  (unchanged)
//
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
 * - Phone number → "+96170123456@cleartrack.internal"
 */
export function normalizeToEmail(input: string): string {
  const trimmed = input.trim();
  if (!isPhoneInput(trimmed)) return trimmed.toLowerCase();
  return `${normalizePhone(trimmed)}${INTERNAL_DOMAIN}`;
}

/**
 * Given a Supabase auth email, return the display identifier for the user.
 * "+96170123456@cleartrack.internal" → "+961 70 123 456"  (kept as stored phone)
 * "john@company.com"                 → "john@company.com"
 */
export function emailToDisplay(email: string): string {
  if (email.endsWith(INTERNAL_DOMAIN)) {
    return email.replace(INTERNAL_DOMAIN, '');
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
    return member.email.replace(INTERNAL_DOMAIN, '');
  }
  return null;
}

/**
 * Label for the login/register identifier field.
 */
export const IDENTIFIER_LABEL = 'EMAIL OR PHONE NUMBER';
export const IDENTIFIER_PLACEHOLDER = 'your@email.com  or  +961 70 123 456';
