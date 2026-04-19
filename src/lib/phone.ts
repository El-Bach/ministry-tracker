/**
 * formatPhoneDisplay — display-only formatter for Lebanese phone numbers.
 *
 * Strips country code (+961 / 00961 / 961), restores leading 0 if missing,
 * then formats as "XX XXX XXX" (e.g. "70 123 456" or "03 123 456").
 *
 * The raw value is NEVER changed in the database or in tel: / wa.me links.
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return '';

  // Keep only digits for processing
  let digits = phone.replace(/\D/g, '');

  // Strip Lebanese country code
  if (digits.startsWith('00961')) digits = digits.slice(5);
  else if (digits.startsWith('961'))  digits = digits.slice(3);

  // Lebanese local numbers are 8 digits with a leading 0.
  // International format drops the leading 0, giving 7 digits — restore it.
  if (digits.length === 7) digits = '0' + digits;

  // Format: XX XXX XXX
  if (digits.length === 8) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)}`;
  }

  // Fallback — unexpected length, return original string unchanged
  return phone;
}
