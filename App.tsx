import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppNavigator from './src/navigation/index';
import { useOfflineQueue } from './src/store/offlineQueue';
import { loadLanguage, isFirstLaunchKey, LanguageProvider } from './src/lib/i18n';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import LanguageSelectScreen from './src/screens/auth/LanguageSelectScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { PlanWarningModal } from './src/components/PlanWarningModal';
import { PlanLockedScreen } from './src/components/PlanLockedScreen';
import { checkPlanLimits, PlanStatus } from './src/lib/planEnforcement';
import supabase from './src/lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── Plan enforcement wrapper ─────────────────────────────────────────────────
// Must live inside <AuthProvider> so it can call useAuth().

function PlanEnforcementWrapper({ children }: { children: React.ReactNode }) {
  const { session, loading, organization, teamMember, isOwner } = useAuth();
  const [planStatus, setPlanStatus]       = useState<PlanStatus | null>(null);
  const [warningVisible, setWarningVisible] = useState(false);

  useEffect(() => {
    // Only run once auth has fully resolved and the user is logged in
    if (loading || !session || !organization || !teamMember?.org_id) return;

    checkPlanLimits(
      supabase,
      teamMember.org_id,
      organization.plan,
      organization.plan_limit_exceeded_at,
    ).then((status) => {
      setPlanStatus(status);
      if (status.exceeded && !status.isLocked) {
        setWarningVisible(true);
      }
    });
  // Re-run only when auth finishes loading or the plan/org changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session, organization?.plan, organization?.plan_limit_exceeded_at, teamMember?.org_id]);

  // ── Full lock (grace period expired) ──
  if (planStatus?.isLocked) {
    return (
      <PlanLockedScreen
        planName={organization?.plan ?? 'free'}
        isOwner={isOwner}
        orgName={organization?.name ?? ''}
        ownerEmail={teamMember?.email ?? ''}
      />
    );
  }

  // ── Grace period warning modal (dismissible) + normal app ──
  const limitType = planStatus?.limitFiles !== null && planStatus?.fileCount !== undefined
    && planStatus.fileCount >= (planStatus.limitFiles ?? Infinity)
      ? 'files'
      : 'members';

  return (
    <>
      {children}
      {planStatus?.exceeded && !planStatus.isLocked && (
        <PlanWarningModal
          visible={warningVisible}
          daysRemaining={planStatus.daysRemaining}
          planName={organization?.plan ?? 'free'}
          limitType={limitType}
          limitValue={limitType === 'files' ? (planStatus.limitFiles ?? 0) : (planStatus.limitMembers ?? 0)}
          currentCount={limitType === 'files' ? planStatus.fileCount : planStatus.memberCount}
          isOwner={isOwner}
          orgName={organization?.name ?? ''}
          ownerEmail={teamMember?.email ?? ''}
          onDismiss={() => setWarningVisible(false)}
        />
      )}
    </>
  );
}

// ─── Root app ─────────────────────────────────────────────────────────────────

export default function App() {
  const { loadQueue, setOnline } = useOfflineQueue();
  const [ready, setReady] = useState(false);
  const [needsLanguageSelect, setNeedsLanguageSelect] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await loadLanguage();
        const langSelected = await AsyncStorage.getItem(isFirstLaunchKey());
        if (!langSelected) setNeedsLanguageSelect(true);
      } catch (e) {
        console.warn('[App] init error:', e);
      } finally {
        setReady(true);
      }
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
      <ErrorBoundary>
        <LanguageProvider>
          <SafeAreaProvider>
            <AuthProvider>
              <LanguageSelectScreen onDone={() => setNeedsLanguageSelect(false)} />
            </AuthProvider>
          </SafeAreaProvider>
        </LanguageProvider>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <LanguageProvider>
        <SafeAreaProvider>
          <AuthProvider>
            <PlanEnforcementWrapper>
              <AppNavigator />
            </PlanEnforcementWrapper>
          </AuthProvider>
        </SafeAreaProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
