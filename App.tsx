import React, { useEffect, useState } from 'react';
import { I18nManager } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppNavigator from './src/navigation/index';
import { useOfflineQueue } from './src/store/offlineQueue';
import { loadLanguage, isFirstLaunchKey } from './src/lib/i18n';
import LanguageSelectScreen from './src/screens/auth/LanguageSelectScreen';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function App() {
  const { loadQueue, setOnline } = useOfflineQueue();
  const [ready, setReady] = useState(false);
  const [needsLanguageSelect, setNeedsLanguageSelect] = useState(false);

  useEffect(() => {
    const init = async () => {
      // Load saved language (also applies RTL)
      await loadLanguage();

      // Check if user has ever selected a language
      const langSelected = await AsyncStorage.getItem(isFirstLaunchKey());
      if (!langSelected) {
        setNeedsLanguageSelect(true);
      }

      setReady(true);
    };

    init();
    loadQueue();
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected && !!state.isInternetReachable);
    });
    return () => unsubscribe();
  }, []);

  if (!ready) return null;

  if (needsLanguageSelect) {
    return (
      <SafeAreaProvider>
        <LanguageSelectScreen onDone={() => setNeedsLanguageSelect(false)} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
}
