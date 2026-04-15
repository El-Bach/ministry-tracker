// src/navigation/index.tsx
// React Navigation v6: Root Stack → Auth or Main Tabs → Dashboard Stack

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../hooks/useAuth';
import { theme } from '../theme';
import LoginScreen from '../screens/auth/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import NewTaskScreen from '../screens/NewTaskScreen';
import TaskDetailScreen from '../screens/TaskDetailScreen';
import CalendarScreen from '../screens/CalendarScreen';
import TeamScreen from '../screens/TeamScreen';
import CreateScreen from '../screens/CreateScreen';
import GlobalSearchScreen from '../screens/GlobalSearchScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ClientFieldsSettingsScreen from '../screens/ClientFieldsSettingsScreen';
import ClientProfileScreen from '../screens/ClientProfileScreen';
import EditClientScreen from '../screens/EditClientScreen';
import ServiceStagesScreen from '../screens/ServiceStagesScreen';
import StageRequirementsScreen from '../screens/StageRequirementsScreen';
import MinistryRequirementsScreen from '../screens/MinistryRequirementsScreen';
import FinancialReportScreen from '../screens/FinancialReportScreen';

import {
  RootStackParamList,
  MainTabParamList,
  DashboardStackParamList,
} from '../types';

const Root = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const DashStack = createNativeStackNavigator<DashboardStackParamList>();

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
        options={{ title: 'Ministry Tracker', headerShown: true }}
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
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={theme.color.primary} />
        <Text style={styles.loaderText}>Ministry Tracker</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Root.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <Root.Screen name="Main" component={MainTabs} />
        ) : (
          <Root.Screen name="Login" component={LoginScreen} />
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
  loaderText: {
    color: theme.color.primary,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
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
  tabActiveBar: {
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.color.primary,
    marginTop: 4,
  },
});
