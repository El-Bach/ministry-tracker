// src/lib/sentry.ts
//
// Sentry shim — `@sentry/react-native@7.2.0` has a broken internal import
// (`../utils/xhr` missing from the published tarball) that crashes Metro on
// startup. Until we upgrade to a working version, every Sentry call site uses
// this no-op shim instead of importing from `@sentry/react-native` directly.
//
// To re-enable real Sentry: bump the package, swap these re-exports back to
// `export * from '@sentry/react-native'`, and you're done.

type CaptureOptions = { extra?: Record<string, unknown>; tags?: Record<string, string> };

export const init = (_opts: unknown) => {
  // no-op
};

export const captureException = (_err: unknown, _opts?: CaptureOptions) => {
  // no-op — in dev, log to console so we still see crashes
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn('[sentry-shim] captureException', _err);
  }
};

export const captureMessage = (_msg: string, _opts?: CaptureOptions) => {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn('[sentry-shim] captureMessage', _msg);
  }
};

export default { init, captureException, captureMessage };
