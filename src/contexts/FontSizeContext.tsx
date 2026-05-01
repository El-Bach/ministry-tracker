// src/contexts/FontSizeContext.tsx
// Provides a global font scale (1.0 = normal, 1.15 = large).
// Persisted to AsyncStorage so the preference survives app restarts.

import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FONT_SCALE_KEY = '@font_scale';

type FontScale = 1.0 | 1.15;

interface FontSizeContextValue {
  fontScale: FontScale;
  setFontScale: (scale: FontScale) => void;
}

const FontSizeContext = createContext<FontSizeContextValue>({
  fontScale: 1.0,
  setFontScale: () => {},
});

export function FontSizeProvider({ children }: { children: React.ReactNode }) {
  const [fontScale, setFontScaleState] = useState<FontScale>(1.0);

  useEffect(() => {
    AsyncStorage.getItem(FONT_SCALE_KEY).then((val) => {
      if (val === '1.15') setFontScaleState(1.15);
    });
  }, []);

  const setFontScale = (scale: FontScale) => {
    setFontScaleState(scale);
    AsyncStorage.setItem(FONT_SCALE_KEY, String(scale));
  };

  return (
    <FontSizeContext.Provider value={{ fontScale, setFontScale }}>
      {children}
    </FontSizeContext.Provider>
  );
}

export function useFontSize() {
  return useContext(FontSizeContext);
}
