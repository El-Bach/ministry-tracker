// src/navigation/index.tsx
// React Navigation v6: Root Stack → Auth or Main Tabs → Dashboard Stack

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../hooks/useAuth';
import { theme } from '../theme';
import { useTranslation } from '../lib/i18n';
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
function GovPilotLogo() {
  return (
    <View style={styles.logoCol}>
      <View style={styles.logoRow}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logoIcon}
          resizeMode="contain"
        />
        <Text style={styles.logoText}>
          <Text style={styles.logoGov}>Gov</Text>
          <Text style={styles.logoPilot}>Pilot</Text>
        </Text>
      </View>
      <Text style={styles.poweredBy}>Powered by KTS</Text>
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
        options={{ headerTitle: () => <GovPilotLogo />, headerShown: true }}
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
        options={{ title: 'Team Members', headerBackTitle: t('screenBack') }}
      />
      <SettStack.Screen
        name="VisibilitySettings"
        component={VisibilitySettingsScreen}
        options={{ title: 'Visibility & Permissions', headerBackTitle: t('screenBack') }}
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

// ─── Root navigator ──────────────────────────────────────────
export default function AppNavigator() {
  const { session, loading, teamMember, needsOnboarding } = useAuth();

  if (loading) {
    return (
      <View style={styles.loader}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.loaderIcon}
          resizeMode="contain"
        />
        <Text style={styles.loaderText}>
          <Text style={{ color: theme.color.primary }}>Gov</Text>
          <Text style={{ color: theme.color.textPrimary }}>Pilot</Text>
        </Text>
        <ActivityIndicator size="small" color={theme.color.primary} style={{ marginTop: 8 }} />
      </View>
    );
  }

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
  logoCol: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  poweredBy: {
    fontSize: 9,
    color: theme.color.textMuted,
    fontWeight: '500',
    marginLeft: 38,
    marginTop: -2,
  },
  logoIcon: {
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
  tabActiveBar: {
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.color.primary,
    marginTop: 4,
  },
});
