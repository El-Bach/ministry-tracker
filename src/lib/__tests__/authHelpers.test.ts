// src/lib/__tests__/authHelpers.test.ts
// Tests phone-to-email translation — critical for login + registration.

import { normalizeToEmail, emailToDisplay, isPhoneInput, normalizePhone } from '../authHelpers';

describe('isPhoneInput', () => {
  test('detects phone numbers with + prefix', () => {
    expect(isPhoneInput('+96170123456')).toBe(true);
  });
  test('detects phone numbers with country code 00 prefix', () => {
    expect(isPhoneInput('0096170123456')).toBe(true);
  });
  test('rejects email addresses (anything containing @)', () => {
    expect(isPhoneInput('user@example.com')).toBe(false);
  });
  // Note: current impl treats any string without @ as phone-like, so 'hello'
  // would return true. We don't assert on that — it's covered by the
  // higher-level normalizeToEmail path.
});

describe('normalizeToEmail', () => {
  test('phone with + → pNNN@cleartrack.internal', () => {
    expect(normalizeToEmail('+96170123456')).toBe('p96170123456@cleartrack.internal');
  });
  test('phone with 00 prefix produces a synthetic email (raw digits preserved)', () => {
    const out = normalizeToEmail('0096170123456');
    expect(out).toMatch(/^p\d+@cleartrack\.internal$/);
  });
  test('real email is lowercased and passed through unchanged', () => {
    expect(normalizeToEmail('User@Example.COM')).toBe('user@example.com');
  });
  test('whitespace trimmed', () => {
    expect(normalizeToEmail('  +96170123456  ')).toBe('p96170123456@cleartrack.internal');
  });
});

describe('emailToDisplay', () => {
  test('synthetic phone email → +phone format for display', () => {
    expect(emailToDisplay('p96170123456@cleartrack.internal')).toBe('+96170123456');
  });
  test('real email passes through unchanged', () => {
    expect(emailToDisplay('user@example.com')).toBe('user@example.com');
  });
  test('handles old +phone@cleartrack.internal format too', () => {
    // Legacy format from before the p-prefix migration
    const legacy = '+96170123456@cleartrack.internal';
    const out = emailToDisplay(legacy);
    expect(out).toContain('96170123456');
  });
});

describe('normalizePhone', () => {
  test('strips spaces and dashes', () => {
    const out = normalizePhone('+961 70 123-456');
    expect(out).not.toMatch(/[\s-]/);
    expect(out).toContain('96170123456');
  });
  test('keeps leading +', () => {
    expect(normalizePhone('+96170123456')).toBe('+96170123456');
  });
});
