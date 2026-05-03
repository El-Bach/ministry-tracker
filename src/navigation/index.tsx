// src/navigation/index.tsx
// React Navigation v6: Root Stack → Auth or Main Tabs → Dashboard Stack

import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, Image, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../hooks/useAuth';
import { theme } from '../theme';
import { useTranslation } from '../lib/i18n';
import { useFontSize } from '../contexts/FontSizeContext';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import DashboardScreen from '../screens/DashboardScreen';
import NewTaskScreen from '../screens/NewTaskScreen';
import TaskDetailScreen from '../screens/TaskDetailScreen';
import CalendarScreen from '../screens/CalendarScreen';
import TeamScreen from '../screens/TeamScreen';
import CreateScreen from '../screens/CreateScreen';
import GlobalSearchScreen from '../screens/GlobalSearchScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ClientFieldsSettingsScreen from '../screens/ClientFieldsSettingsScreen';
import TeamMemberFieldsScreen from '../screens/TeamMemberFieldsScreen';
import ClientProfileScreen from '../screens/ClientProfileScreen';
import EditClientScreen from '../screens/EditClientScreen';
import ServiceStagesScreen from '../screens/ServiceStagesScreen';
import StageRequirementsScreen from '../screens/StageRequirementsScreen';
import MinistryRequirementsScreen from '../screens/MinistryRequirementsScreen';
import FinancialReportScreen from '../screens/FinancialReportScreen';
import AccountScreen from '../screens/AccountScreen';
import ActivityScreen from '../screens/ActivityScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import TeamMembersScreen from '../screens/TeamMembersScreen';
import VisibilitySettingsScreen from '../screens/VisibilitySettingsScreen';
import MemberFileVisibilityScreen from '../screens/MemberFileVisibilityScreen';

import {
  RootStackParamList,
  MainTabParamList,
  DashboardStackParamList,
  SettingsStackParamList,
} from '../types';

const Root = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const DashStack = createNativeStackNavigator<DashboardStackParamList>();
const SettStack = createNativeStackNavigator<SettingsStackParamList>();

// ─── GovPilot logo header title ─────────────────────────────
// Layout: [icon] [text-block]   — vertically centered together.
// text-block (aligned center):
//   "GovPilot"          20pt 800
//   "Powered by KTS"    rendered naturally; font sizes are tuned so the
//                       sentence is roughly the same width as "GovPilot"
//                       and KTS is slightly larger than the rest.
// The icon's width/height = the measured text-block height × 0.85 so it
// reads as a unit but is a touch smaller than the full text block.
function GovPilotLogo() {
  const [blockHeight, setBlockHeight] = useState<number | null>(null);
  const iconSize = blockHeight ? Math.round(blockHeight * 0.85) : 28;

  return (
    <View style={styles.logoRow}>
      <Image
        source={require('../../assets/icon.png')}
        style={[styles.logoIcon, { width: iconSize, height: iconSize }]}
        resizeMode="contain"
      />
      <View
        style={styles.logoTextBlock}
        onLayout={(e) => setBlockHeight(e.nativeEvent.layout.height)}
      >
        <Text style={styles.logoText}>
          <Text style={styles.logoGov}>Gov</Text>
          <Text style={styles.logoPilot}>Pilot</Text>
        </Text>
        <Text style={styles.poweredBy} numberOfLines={1}>
          <Text style={styles.poweredByPrefix}>Powered by </Text>
          <Text style={styles.poweredByKts}>KTS</Text>
        </Text>
      </View>
    </View>
  );
}

// ─── Font size toggle (header right on Dashboard) ────────────
function FontSizeToggle() {
  const { fontScale, setFontScale } = useFontSize();
  return (
    <View style={styles.fsPair}>
      <TouchableOpacity
        style={[styles.fsBtn, fontScale === 1.0 && styles.fsBtnActive]}
        onPress={() => setFontScale(1.0)}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      >
        <Text style={[styles.fsBtnTextSm, fontScale === 1.0 && styles.fsBtnTextActive]}>A</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.fsBtn, fontScale === 1.25 && styles.fsBtnActive]}
        onPress={() => setFontScale(1.25)}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      >
        <Text style={[styles.fsBtnTextLg, fontScale === 1.25 && styles.fsBtnTextActive]}>A</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Tab bar icon component ─────────────────────────────────
function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Dashboard: '⊞',
    Calendar: '▦',
    Create: '✚',
    Settings: '⚙',
  };
  return (
    <View style={styles.tabIcon}>
      <Text style={[styles.tabIconText, focused && styles.tabIconFocused]}>
        {icons[label] ?? '●'}
      </Text>
      {focused && <View style={styles.tabActiveBar} />}
    </View>
  );
}

// ─── Dashboard stack (Dashboard → NewTask → TaskDetail) ─────
function DashboardStack() {
  const { t } = useTranslation();
  return (
    <DashStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.color.bgBase },
        headerShadowVisible: false,
        headerTintColor: theme.color.textPrimary,
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        contentStyle: { backgroundColor: theme.color.bgBase },
      }}
    >
      <DashStack.Screen
        name="DashboardHome"
        component={DashboardScreen}
        options={{ headerTitle: () => <GovPilotLogo />, headerRight: () => <FontSizeToggle />, headerShown: true }}
      />
      <DashStack.Screen
        name="NewTask"
        component={NewTaskScreen}
        options={{ title: t('screenNewFile'), headerBackTitle: t('screenBack') }}
      />
      <DashStack.Screen
        name="TaskDetail"
        component={TaskDetailScreen}
        options={{ title: t('screenFileDetail'), headerBackTitle: t('screenBack') }}
      />
      <DashStack.Screen
        name="ClientFieldsSettings"
        component={ClientFieldsSettingsScreen}
        options={{ title: t('screenClientFields'), headerBackTitle: t('screenBack') }}
      />
      <DashStack.Screen
        name="TeamMemberFields"
        component={TeamMemberFieldsScreen}
        options={{ title: t('screenTeamMemberFields'), headerBackTitle: t('screenBack') }}
      />
      <DashStack.Screen
        name="ClientProfile"
        component={ClientProfileScreen}
        options={{ title: t('screenClientProfile'), headerBackTitle: t('screenBack') }}
      />
      <DashStack.Screen
        name="EditClient"
        component={EditClientScreen}
        options={{ title: t('screenEditClient'), headerBackTitle: t('screenBack') }}
      />
      <DashStack.Screen
        name="ServiceStages"
        component={ServiceStagesScreen}
        options={({ route }) => ({ title: route.params.serviceName, headerBackTitle: t('screenBack') })}
      />
      <DashStack.Screen
        name="StageRequirements"
        component={StageRequirementsScreen}
        options={({ route }) => ({ title: route.params.stageName, headerBackTitle: t('screenBack') })}
      />
      <DashStack.Screen
        name="MinistryRequirements"
        component={MinistryRequirementsScreen}
        options={({ route }) => ({ title: route.params.ministryName + ' — Requirements', headerBackTitle: t('screenBack') })}
      />
      <DashStack.Screen
        name="FinancialReport"
        component={FinancialReportScreen}
        options={{ title: t('screenFinancialReport'), headerBackTitle: t('screenBack') }}
      />
      <DashStack.Screen
        name="GlobalSearch"
        component={GlobalSearchScreen}
        options={{ title: t('screenSearch'), headerBackTitle: t('screenBack') }}
      />
      <DashStack.Screen
        name="Account"
        component={AccountScreen}
        options={{ title: t('screenMyAccount'), headerBackTitle: t('screenBack') }}
      />
      <DashStack.Screen
        name="Activity"
        component={ActivityScreen}
        options={{ title: t('screenActivity'), headerBackTitle: t('screenBack') }}
      />
      <DashStack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ title: t('screenNotifications'), headerBackTitle: t('screenBack') }}
      />
    </DashStack.Navigator>
  );
}

// ─── Settings stack (Settings → sub-screens) ────────────────
function SettingsStack() {
  const { t } = useTranslation();
  return (
    <SettStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.color.bgBase },
        headerShadowVisible: false,
        headerTintColor: theme.color.textPrimary,
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        contentStyle: { backgroundColor: theme.color.bgBase },
      }}
    >
      <SettStack.Screen
        name="SettingsHome"
        component={SettingsScreen}
        options={{ headerShown: false }}
      />
      <SettStack.Screen
        name="Account"
        component={AccountScreen}
        options={{ title: t('screenMyAccount'), headerBackTitle: t('screenBack') }}
      />
      <SettStack.Screen
        name="ClientFieldsSettings"
        component={ClientFieldsSettingsScreen}
        options={{ title: t('screenClientFields'), headerBackTitle: t('screenBack') }}
      />
      <SettStack.Screen
        name="TeamMemberFields"
        component={TeamMemberFieldsScreen}
        options={{ title: t('screenTeamMemberFields'), headerBackTitle: t('screenBack') }}
      />
      <SettStack.Screen
        name="TeamMembers"
        component={TeamMembersScreen}
        options={{ title: t('teamMembers'), headerBackTitle: t('screenBack') }}
      />
      <SettStack.Screen
        name="VisibilitySettings"
        component={VisibilitySettingsScreen}
        options={{ title: t('visibilityPerms'), headerBackTitle: t('screenBack') }}
      />
      <SettStack.Screen
        name="MemberFileVisibility"
        component={MemberFileVisibilityScreen}
        options={({ route }) => ({ title: route.params.memberName, headerBackTitle: 'Back' })}
      />
      <SettStack.Screen
        name="FinancialReport"
        component={FinancialReportScreen}
        options={{ title: t('screenFinancialReport'), headerBackTitle: t('screenBack') }}
      />
      <SettStack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ title: t('screenNotifications'), headerBackTitle: t('screenBack') }}
      />
    </SettStack.Navigator>
  );
}

// ─── Main bottom tabs ────────────────────────────────────────
function MainTabs() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { ...styles.tabBar, paddingBottom: insets.bottom + 4, height: 56 + insets.bottom },
        tabBarActiveTintColor: theme.color.primary,
        tabBarInactiveTintColor: theme.color.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardStack} options={{ tabBarLabel: t('tabDashboard') }} />
      <Tab.Screen name="Create" component={CreateScreen} options={{ tabBarLabel: t('tabCreate') }} />
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ tabBarLabel: t('tabCalendar') }} />
      <Tab.Screen name="Settings" component={SettingsStack} options={{ tabBarLabel: t('tabSettings') }} />
    </Tab.Navigator>
  );
}

// ─── App loader (shown while auth resolves) ──────────────────
// "GovPilot" text auto-scales to exactly match the icon's width above it:
// we render the text once at a starting fontSize, measure its natural width
// via onLayout, then scale the fontSize by (icon-width / measured-width) so
// the text ends up the same width as the icon. Single-pass measurement (the
// `measured` flag prevents loops). Cross-platform — no `adjustsFontSizeToFit`
// needed, which is iOS-only.
const LOADER_ICON_SIZE = 72;

function AppLoader() {
  const [textFontSize, setTextFontSize] = useState(26);
  const [measured, setMeasured] = useState(false);

  return (
    <View style={styles.loader}>
      <Image
        source={require('../../assets/icon.png')}
        style={styles.loaderIcon}
        resizeMode="contain"
      />
      <Text
        style={[styles.loaderText, { fontSize: textFontSize }]}
        numberOfLines={1}
        onLayout={(e) => {
          if (measured) return;
          const w = e.nativeEvent.layout.width;
          if (w > 0) {
            setTextFontSize(textFontSize * (LOADER_ICON_SIZE / w));
            setMeasured(true);
          }
        }}
      >
        <Text style={{ color: theme.color.primary }}>Gov</Text>
        <Text style={{ color: theme.color.textPrimary }}>Pilot</Text>
      </Text>
      <ActivityIndicator size="small" color={theme.color.primary} style={{ marginTop: 8 }} />
    </View>
  );
}

// ─── Root navigator ──────────────────────────────────────────
export default function AppNavigator() {
  const { session, loading, teamMember, needsOnboarding } = useAuth();

  if (loading) return <AppLoader />;

  // Determine which screen to show:
  // 1. Not logged in → Login / Register
  // 2. Logged in but no team_member row yet → Onboarding (just registered)
  // 3. Logged in and has team_member → Main app
  const getInitialScreen = () => {
    if (!session) return 'auth';
    if (needsOnboarding || !teamMember) return 'onboarding';
    return 'main';
  };
  const screen = getInitialScreen();

  return (
    <NavigationContainer>
      <Root.Navigator screenOptions={{ headerShown: false }}>
        {screen === 'main' ? (
          <Root.Screen name="Main" component={MainTabs} />
        ) : screen === 'onboarding' ? (
          <Root.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            <Root.Screen name="Login"    component={LoginScreen}    />
            <Root.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Root.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: theme.color.bgBase,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.space4,
  },
  loaderIcon: {
    width: 72,
    height: 72,
    borderRadius: 16,
    marginBottom: 4,
  },
  loaderText: {
    fontSize: 26,
    fontWeight: '800',
  },
  tabBar: {
    backgroundColor: theme.color.bgBase,
    borderTopColor: theme.color.bgSurface,
    borderTopWidth: 1,
    paddingTop: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  tabIcon: {
    alignItems: 'center',
    marginTop: 2,
  },
  tabIconText: {
    fontSize: 20,
    color: theme.color.border,
  },
  tabIconFocused: {
    color: theme.color.primary,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',  // icon + text block vertically centered together
    gap: 8,
  },
  logoTextBlock: {
    flexDirection: 'column',
    alignItems: 'center',  // center "Powered by KTS" under "GovPilot"
  },
  logoIcon: {
    // width/height overridden inline to match the measured text-block height
    width: 30,
    height: 30,
    borderRadius: 8,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
  },
  logoGov: {
    color: theme.color.primary,
  },
  logoPilot: {
    color: theme.color.textPrimary,
  },
  // "Powered by KTS" — rendered naturally (no fixed width) so nothing clips
  poweredBy: {
    textAlign: 'center',
    marginTop: 0,
  },
  poweredByPrefix: {
    fontSize: 9,
    color: theme.color.textMuted,
    fontWeight: '500',
  },
  // KTS — slightly bigger than the prefix as requested
  poweredByKts: {
    fontSize: 11,
    color: theme.color.primary,
    fontWeight: '800',
  },
  tabActiveBar: {
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.color.primary,
    marginTop: 4,
  },

  // Font size toggle (header right)
  fsPair: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: theme.spacing.space3,
    backgroundColor: theme.color.bgSurface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    overflow: 'hidden',
  },
  fsBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsBtnActive: {
    backgroundColor: theme.color.primaryDim,
  },
  fsBtnTextSm: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.color.textMuted,
  },
  fsBtnTextLg: {
    fontSize: 19,
    fontWeight: '800',
    color: theme.color.textMuted,
  },
  fsBtnTextActive: {
    color: theme.color.primary,
  },
});
