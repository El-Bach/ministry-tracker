// src/lib/__tests__/i18n.test.ts
// Tests pure i18n utilities (no React).

import { formatNumber, arabicizeDigits } from '../i18n';

describe('formatNumber', () => {
  test('formats English with commas', () => {
    expect(formatNumber(1234567, 'en')).toBe('1,234,567');
  });
  test('formats French with non-breaking spaces', () => {
    // fr-FR uses narrow no-break space U+202F as thousands separator
    const out = formatNumber(1234567, 'fr');
    expect(out).toMatch(/1.?234.?567/);
  });
  test('Arabic returns Arabic-Indic digits', () => {
    const out = formatNumber(123, 'ar');
    expect(out).toMatch(/[٠-٩]/);
    expect(out).toContain('١');
  });
  test('handles zero', () => {
    expect(formatNumber(0, 'en')).toBe('0');
  });
  test('handles negatives', () => {
    expect(formatNumber(-100, 'en')).toBe('-100');
  });
  test('respects fractionDigits option', () => {
    expect(formatNumber(3.14159, 'en', { maximumFractionDigits: 2 })).toBe('3.14');
  });
  test('NaN returns the original value as string', () => {
    expect(formatNumber('not a number', 'en')).toBe('not a number');
  });
});

describe('arabicizeDigits', () => {
  test('converts Western digits to Arabic-Indic in ar mode', () => {
    expect(arabicizeDigits('Active: 10', 'ar')).toBe('Active: ١٠');
  });
  test('English mode is a no-op', () => {
    expect(arabicizeDigits('Active: 10', 'en')).toBe('Active: 10');
  });
  test('preserves non-digit characters', () => {
    expect(arabicizeDigits('$1,234.56', 'ar')).toBe('$١,٢٣٤.٥٦');
  });
  test('empty string is safe', () => {
    expect(arabicizeDigits('', 'ar')).toBe('');
  });
});
