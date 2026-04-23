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

import {
  RootStackParamList,
  MainTabParamList,
  DashboardStackParamList,
} from '../types';

const Root = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const DashStack = createNativeStackNavigator<DashboardStackParamList>();

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
        options={{ title: 'New File', headerBackTitle: 'Back' }}
      />
      <DashStack.Screen
        name="TaskDetail"
        component={TaskDetailScreen}
        options={{ title: 'File Detail', headerBackTitle: 'Back' }}
      />
      <DashStack.Screen
        name="ClientFieldsSettings"
        component={ClientFieldsSettingsScreen}
        options={{ title: 'Client Fields', headerBackTitle: 'Back' }}
      />
      <DashStack.Screen
        name="TeamMemberFields"
        component={TeamMemberFieldsScreen}
        options={{ title: 'Team Member Fields', headerBackTitle: 'Back' }}
      />
      <DashStack.Screen
        name="ClientProfile"
        component={ClientProfileScreen}
        options={{ title: 'Client Profile', headerBackTitle: 'Back' }}
      />
      <DashStack.Screen
        name="EditClient"
        component={EditClientScreen}
        options={{ title: 'Edit Client', headerBackTitle: 'Back' }}
      />
      <DashStack.Screen
        name="ServiceStages"
        component={ServiceStagesScreen}
        options={({ route }) => ({ title: route.params.serviceName, headerBackTitle: 'Back' })}
      />
      <DashStack.Screen
        name="StageRequirements"
        component={StageRequirementsScreen}
        options={({ route }) => ({ title: route.params.stageName, headerBackTitle: 'Back' })}
      />
      <DashStack.Screen
        name="MinistryRequirements"
        component={MinistryRequirementsScreen}
        options={({ route }) => ({ title: route.params.ministryName + ' — Requirements', headerBackTitle: 'Back' })}
      />
      <DashStack.Screen
        name="FinancialReport"
        component={FinancialReportScreen}
        options={{ title: 'Financial Report', headerBackTitle: 'Back' }}
      />
      <DashStack.Screen
        name="GlobalSearch"
        component={GlobalSearchScreen}
        options={{ title: 'Search', headerBackTitle: 'Back' }}
      />
      <DashStack.Screen
        name="Account"
        component={AccountScreen}
        options={{ title: 'My Account', headerBackTitle: 'Back' }}
      />
      <DashStack.Screen
        name="Activity"
        component={ActivityScreen}
        options={{ title: 'Activity', headerBackTitle: 'Back' }}
      />
      <DashStack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ title: 'Notifications', headerBackTitle: 'Back' }}
      />
    </DashStack.Navigator>
  );
}

// ─── Main bottom tabs ────────────────────────────────────────
function MainTabs() {
  const insets = useSafeAreaInsets();
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
      <Tab.Screen name="Dashboard" component={DashboardStack} />
      <Tab.Screen name="Create" component={CreateScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
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
