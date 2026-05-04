// src/components/SignedImage.tsx
//
// <Image> wrapper that converts a stored task-attachments URL/path into a
// signed URL before rendering. The bucket is private (see
// migration_storage_private.sql) so raw public URLs return 404. Using this
// component instead of <Image> handles that automatically.
//
// Usage:
//   <SignedImage source={attachment_url} style={s.thumb} resizeMode="cover" />
//
// Pass the stored value directly (full legacy public URL or just the storage
// path — extractStoragePath() inside the helper handles both shapes).

import React, { useEffect, useState } from 'react';
import { Image, ImageProps, View, StyleSheet, ActivityIndicator } from 'react-native';
import { theme } from '../theme';
import { refreshSignedUrl } from '../lib/storage';

interface Props extends Omit<ImageProps, 'source'> {
  /** The stored URL or path. Pass `null`/`undefined`/`''` to render nothing. */
  source: string | null | undefined;
  /** Spinner color while the signed URL is being fetched. */
  loadingColor?: string;
}

export default function SignedImage({ source, loadingColor, style, ...rest }: Props) {
  const [signed, setSigned] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSigned(null);
    setError(false);
    if (!source) return;
    refreshSignedUrl(source)
      .then((url) => {
        if (cancelled) return;
        if (!url) setError(true);
        else setSigned(url);
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [source]);

  if (!source) return null;
  if (error) return <View style={[style, s.placeholder]} />;
  if (!signed) {
    return (
      <View style={[style, s.placeholder]}>
        <ActivityIndicator size="small" color={loadingColor ?? theme.color.primary} />
      </View>
    );
  }
  return <Image {...rest} source={{ uri: signed }} style={style} />;
}

const s = StyleSheet.create({
  placeholder: {
    backgroundColor: theme.color.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
