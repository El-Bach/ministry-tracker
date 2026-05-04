// src/lib/storage.ts
// Helpers for Supabase Storage buckets.
//
// The `task-attachments` bucket is private (see migration_storage_private.sql)
// — every read or view of a document must use a signed URL, NOT a public URL.
// A signed URL expires after `expiresInSeconds` (default 1 hour) and is keyed
// to the caller's auth, so a leaked URL cannot be replayed forever from
// another account.
//
// `client-images` is currently public but the same helpers work either way
// (signed URLs are valid against public buckets too). Pass the bucket name as
// the third argument when working with anything other than `task-attachments`.
//
// Usage:
//   const url = await getSignedUrl('documents/abc/file.jpg');                       // 1 hour, task-attachments
//   const url = await getSignedUrl('client-1.jpg', 3600, 'client-images');          // explicit bucket
//   const url = await refreshSignedUrl(storedUrl, 3600, 'client-images');           // strip URL → sign

import supabase from './supabase';

const DEFAULT_BUCKET = 'task-attachments';
const DEFAULT_EXPIRES = 3600; // 1 hour

/**
 * Generate a signed URL for a file in a Supabase Storage bucket.
 * Returns null if the path is empty or signing fails.
 */
export async function getSignedUrl(
  path: string,
  expiresInSeconds: number = DEFAULT_EXPIRES,
  bucket: string = DEFAULT_BUCKET,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) {
    if (__DEV__) console.warn('[storage] createSignedUrl failed:', error?.message);
    return null;
  }
  return data.signedUrl;
}

/**
 * Extract the storage path from a stored URL. Older rows store the full
 * public URL ("https://.../<bucket>/path/to.jpg"); newer rows may store just
 * the path. Either way, this returns the path portion that `createSignedUrl`
 * expects.
 */
export function extractStoragePath(urlOrPath: string, bucket: string = DEFAULT_BUCKET): string {
  if (!urlOrPath) return '';
  const marker = `/${bucket}/`;
  const idx = urlOrPath.indexOf(marker);
  if (idx >= 0) return urlOrPath.slice(idx + marker.length);
  return urlOrPath;
}

/**
 * Convenience: take a stored value (full URL or path) and return a fresh
 * signed URL valid for `expiresInSeconds`.
 */
export async function refreshSignedUrl(
  storedUrlOrPath: string,
  expiresInSeconds: number = DEFAULT_EXPIRES,
  bucket: string = DEFAULT_BUCKET,
): Promise<string | null> {
  const path = extractStoragePath(storedUrlOrPath, bucket);
  return getSignedUrl(path, expiresInSeconds, bucket);
}
