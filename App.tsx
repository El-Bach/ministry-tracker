import React, { useEffect, useState } from 'react';
import { I18nManager } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppNavigator from './src/navigation/index';
import { useOfflineQueue } from './src/store/offlineQueue';

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

  useEffect(() => {
    // Apply RTL preference before first render
    AsyncStorage.getItem('@rtl_enabled').then((val) => {
      I18nManager.forceRTL(val === 'true');
      setReady(true);
    });

    loadQueue();
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected && !!state.isInternetReachable);
    });
    return () => unsubscribe();
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
}