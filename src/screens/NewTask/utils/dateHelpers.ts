// src/screens/NewTask/utils/dateHelpers.ts
//
// Display ↔ ISO date conversion used by NewTaskScreen and DatePickerField.
// Display format is DD/MM/YYYY; ISO/calendar format is YYYY-MM-DD.

/** Parse DD/MM/YYYY or DD/MM/YY → Date. Two-digit years map to 20YY. */
export function parseDisplayDate(input: string): Date | null {
  const clean = input.trim().replace(/[^0-9/]/g, '');
  const parts = clean.split('/');
  if (parts.length !== 3) return null;
  const day   = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  let year    = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (year < 100) year += 2000;
  const d = new Date(year, month - 1, day);
  if (isNaN(d.getTime())) return null;
  if (d.getDate() !== day || d.getMonth() !== month - 1) return null;
  return d;
}

/** YYYY-MM-DD → DD/MM/YYYY (no validation; assumes well-formed ISO). */
export function toDisplay(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** DD/MM/YYYY → YYYY-MM-DD, or null if input doesn't parse. */
export function toISO(display: string): string | null {
  const d = parseDisplayDate(display);
  if (!d) return null;
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** DD/MM/YYYY → YYYY-MM-DD or undefined (calendar `current` prop accepts undefined). */
export function displayToCalendar(display: string): string | undefined {
  const iso = toISO(display);
  return iso ?? undefined;
}
