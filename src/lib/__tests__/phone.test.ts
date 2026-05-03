// src/lib/__tests__/phone.test.ts
import { formatPhoneDisplay } from '../phone';

describe('formatPhoneDisplay', () => {
  test('formats Lebanese 8-digit local number', () => {
    expect(formatPhoneDisplay('70123456')).toBe('70 123 456');
  });
  test('strips +961 country code and reformats', () => {
    expect(formatPhoneDisplay('+96170123456')).toBe('70 123 456');
  });
  test('strips 00961 international prefix', () => {
    expect(formatPhoneDisplay('0096170123456')).toBe('70 123 456');
  });
  test('returns empty string for null/undefined', () => {
    expect(formatPhoneDisplay(null)).toBe('');
    expect(formatPhoneDisplay(undefined)).toBe('');
    expect(formatPhoneDisplay('')).toBe('');
  });
  test('passes unrecognized format through unchanged', () => {
    expect(formatPhoneDisplay('+1234567890123')).toBe('+1234567890123');
  });
});
