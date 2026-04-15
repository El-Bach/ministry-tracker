// src/screens/DashboardScreen.tsx
// Main dashboard: filterable task list with realtime updates

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
  PanResponder,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import supabase from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useRealtime } from '../hooks/useRealtime';
import { useOfflineQueue } from '../store/offlineQueue';
import { Task, StatusLabel, TeamMember, Ministry, Client, Service, City, DashboardStackParamList } from '../types';
import TaskCard from '../components/TaskCard';
import OfflineBanner from '../components/OfflineBanner';
import { theme } from '../theme';

// Estimated TaskCard row height for getItemLayout (card + spacing)
const TASK_ROW_HEIGHT = 130;

type Nav = NativeStackNavigationProp<DashboardStackParamList>;

const SWIPE_ACTION_WIDTH = 130; // left-swipe: Edit + Delete
const FINANCE_ACTION_WIDTH = 80;  // right-swipe: Add Financial

function SwipeableTaskRow({
  task,
  statusColor,
  allStatusColors,
  onPress,
  onClientPress,
  onCityPress,
  onServicePress,
  onEdit,
  onDelete,
  onUnarchive,
  onFinance,
  isArchived,
}: {
  task: Task;
  statusColor: string;
  allStatusColors: Record<string, string>;
  onPress: () => void;
  onClientPress: () => void;
  onCityPress: (cityId: string) => void;
  onServicePress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUnarchive: () => void;
  onFinance: () => void;
  isArchived: boolean;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef<'left' | 'right' | false>(false);

  // Animate button visibility from translateX so buttons are
  // completely invisible at rest — no ghost buttons while scrolling
  const financeOpacity = translateX.interpolate({
    inputRange: [0, FINANCE_ACTION_WIDTH],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const actionsOpacity = translateX.interpolate({
    inputRange: [-SWIPE_ACTION_WIDTH, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        let base = 0;
        if (isOpen.current === 'left') base = -SWIPE_ACTION_WIDTH;
        if (isOpen.current === 'right') base = FINANCE_ACTION_WIDTH;
        const raw = g.dx + base;
        const x = Math.max(-SWIPE_ACTION_WIDTH, Math.min(FINANCE_ACTION_WIDTH, raw));
        translateX.setValue(x);
      },
      onPanResponderRelease: (_, g) => {
        let base = 0;
        if (isOpen.current === 'left') base = -SWIPE_ACTION_WIDTH;
        if (isOpen.current === 'right') base = FINANCE_ACTION_WIDTH;
        const net = g.dx + base;

        if (net < -SWIPE_ACTION_WIDTH / 2) {
          isOpen.current = 'left';
          Animated.spring(translateX, { toValue: -SWIPE_ACTION_WIDTH, useNativeDriver: true }).start();
        } else if (net > FINANCE_ACTION_WIDTH / 2) {
          isOpen.current = 'right';
          Animated.spring(translateX, { toValue: FINANCE_ACTION_WIDTH, useNativeDriver: true }).start();
        } else {
          isOpen.current = false;
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const close = () => {
    isOpen.current = false;
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
  };

  return (
    <View style={swipeStyles.container}>
      {/* Right-swipe: Finance action (left side) — hidden at rest */}
      <Animated.View style={[swipeStyles.financeAction, { opacity: financeOpacity }]}>
        <TouchableOpacity
          style={swipeStyles.financeBtn}
          onPress={() => { close(); onFinance(); }}
        >
          <Text style={swipeStyles.financeIcon}>💰</Text>
          <Text style={swipeStyles.financeBtnText}>Add</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Left-swipe: Edit + Delete/Unarchive actions (right side) — hidden at rest */}
      <Animated.View style={[swipeStyles.actions, { opacity: actionsOpacity }]}>
        <TouchableOpacity
          style={swipeStyles.editBtn}
          onPress={() => { close(); onEdit(); }}
        >
          <Text style={swipeStyles.editBtnText}>✎{'\n'}Edit</Text>
        </TouchableOpacity>
        {isArchived ? (
          <TouchableOpacity
            style={swipeStyles.unarchiveBtn}
            onPress={() => { close(); onUnarchive(); }}
          >
            <Text style={swipeStyles.unarchivedBtnText}>📋{'\n'}Restore</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={swipeStyles.deleteBtn}
            onPress={() => { close(); onDelete(); }}
          >
            <Text style={swipeStyles.deleteBtnText}>✕{'\n'}Delete</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Swipeable card */}
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <TaskCard
          task={task}
          statusColor={statusColor}
          allStatusColors={allStatusColors}
          onPress={() => { if (isOpen.current) { close(); } else { onPress(); } }}
          onClientPress={onClientPress}
          onCityPress={onCityPress}
          onServicePress={onServicePress}
          cardStyle={{ marginBottom: 0 }}
        />
      </Animated.View>
    </View>
  );
}

const swipeStyles = StyleSheet.create({
  container: {
    position:     'relative',
    marginBottom: theme.spacing.space2,
    borderRadius: theme.radius.lg,
    overflow:     'hidden',
  },
  // Right-swipe finance button (left side)
  financeAction: {
    position: 'absolute',
    left:     0,
    top:      0,
    bottom:   0,
    width:    FINANCE_ACTION_WIDTH,
  },
  financeBtn: {
    flex:            1,
    backgroundColor: theme.color.success,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             theme.spacing.space1,
  },
  financeIcon:    { fontSize: theme.icon.md },
  financeBtnText: { ...theme.typography.caption, color: theme.color.white, fontWeight: '700' },
  // Left-swipe edit/delete (right side)
  actions: {
    position:      'absolute',
    right:         0,
    top:           0,
    bottom:        0,
    width:         SWIPE_ACTION_WIDTH,
    flexDirection: 'row',
  },
  editBtn: {
    flex:            1,
    backgroundColor: theme.color.primary,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             theme.spacing.space1,
  },
  editBtnText:   { ...theme.typography.caption, color: theme.color.white, fontWeight: '700', textAlign: 'center' },
  deleteBtn: {
    flex:            1,
    backgroundColor: theme.color.danger,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             theme.spacing.space1,
  },
  deleteBtnText: { ...theme.typography.caption, color: theme.color.white, fontWeight: '700', textAlign: 'center' },
  unarchiveBtn: {
    flex:            1,
    backgroundColor: theme.color.success,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             theme.spacing.space1,
  },
  unarchivedBtnText: { ...theme.typography.caption, color: theme.color.white, fontWeight: '700', textAlign: 'center' },
});

interface Filters {
  search: string;
  serviceId: string;
  ministryId: string;
  cityId: string;
}

type ListItem = Task | { _type: 'section-header'; label: string; id: string };

// A task is archived when all its stops are Done or Rejected (or DB flag)
function isTaskArchived(task: Task): boolean {
  const stopsTotal = task.route_stops?.length ?? 0;
  return (
    task.is_archived === true ||
    (stopsTotal > 0 && task.route_stops!.every((s) => s.status === 'Done' || s.status === 'Rejected'))
  );
}

function openPhone(phone: string, name?: string) {
  const clean = phone.replace(/[^0-9+]/g, '');
  Alert.alert(name ?? phone, phone, [
    { text: '📞 Phone Call', onPress: () => Linking.openURL(`tel:${clean}`) },
    { text: '💬 WhatsApp', onPress: () => Linking.openURL(`https://wa.me/${clean.replace(/^\+/, '')}`) },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

export default function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { teamMember } = useAuth();
  const { setOnline } = useOfflineQueue();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [statusLabels, setStatusLabels] = useState<StatusLabel[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    search: '',
    serviceId: '',
    ministryId: '',
    cityId: '',
  });

  // Service stages sheet (Task 3)
  const [svcSheetId, setSvcSheetId] = useState<string | null>(null);
  const [svcSheetName, setSvcSheetName] = useState('');
  interface SvcStage { id: string; stop_order: number; ministry_id: string; ministry: { id: string; name: string } | null }
  const [svcSheetStages, setSvcSheetStages] = useState<SvcStage[]>([]);
  const [svcSheetLoading, setSvcSheetLoading] = useState(false);
  const [svcSheetMinistries, setSvcSheetMinistries] = useState<Ministry[]>([]);
  const [svcSheetAddSearch, setSvcSheetAddSearch] = useState('');
  const [svcSheetShowAdd, setSvcSheetShowAdd] = useState(false);
  const [svcSheetSaving, setSvcSheetSaving] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [services, setServices] = useState<Service[]>([]);

  // Quick-add financial transaction (swipe right)
  const [showQuickFinance, setShowQuickFinance] = useState(false);
  const [quickFinanceTask, setQuickFinanceTask] = useState<Task | null>(null);
  const [quickTxType, setQuickTxType] = useState<'expense' | 'revenue'>('expense');
  const [quickTxDesc, setQuickTxDesc] = useState('');
  const [quickTxUSD, setQuickTxUSD] = useState('');
  const [quickTxLBP, setQuickTxLBP] = useState('');
  const [savingQuickTx, setSavingQuickTx] = useState(false);

  // Network listener
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected);
    });
    return unsub;
  }, []);

  const fetchData = useCallback(async () => {
    const [tasksRes, labelsRes, membersRes, ministriesRes, clientsRes, svcRes, citiesRes] = await Promise.all([
      supabase
        .from('tasks')
        .select(
          `*, client:clients(*), service:services(*), assignee:team_members!assigned_to(*), route_stops:task_route_stops(*, ministry:ministries(*), city:cities(id,name)), transactions:file_transactions(type,amount_usd,amount_lbp)`
        )
        .order('created_at', { ascending: false }),
      supabase.from('status_labels').select('*').order('sort_order'),
      supabase.from('team_members').select('*').order('name'),
      supabase.from('ministries').select('*').eq('type', 'parent').order('name'),
      supabase.from('clients').select('*').order('name'),
      supabase.from('services').select('*').order('name'),
      supabase.from('cities').select('*').order('name'),
    ]);

    if (tasksRes.data) setTasks(tasksRes.data as Task[]);
    if (labelsRes.data) setStatusLabels(labelsRes.data as StatusLabel[]);
    if (membersRes.data) setTeamMembers(membersRes.data as TeamMember[]);
    if (ministriesRes.data) setMinistries(ministriesRes.data as Ministry[]);
    if (clientsRes.data) setClients(clientsRes.data as Client[]);
    if (svcRes.data) setServices(svcRes.data as Service[]);
    if (citiesRes.data) setCities(citiesRes.data as City[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refresh tasks when navigating back (picks up client profile edits)
  useFocusEffect(useCallback(() => {
    fetchData();
  }, [fetchData]));

  // Realtime refresh
  useRealtime(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Matching clients for search
  const matchingClients = filters.search.trim().length > 0
    ? clients.filter((c) =>
        c.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        (c.phone ?? '').includes(filters.search)
      )
    : [];

  // Apply search/service/city filters (no archive filter — both sections shown)
  const filteredTasks = tasks.filter((task) => {
    if (
      filters.search &&
      !task.client?.name.toLowerCase().includes(filters.search.toLowerCase()) &&
      !task.service?.name.toLowerCase().includes(filters.search.toLowerCase())
    ) {
      return false;
    }
    if (filters.serviceId && task.service_id !== filters.serviceId) return false;
    if (filters.cityId) {
      const hasCity = task.route_stops?.some((s) => s.city_id === filters.cityId);
      if (!hasCity) return false;
    }
    if (filters.ministryId) {
      const hasMinistry = task.route_stops?.some((s) => s.ministry_id === filters.ministryId);
      if (!hasMinistry) return false;
    }
    return true;
  });

  // Split into active and archived sections
  const activeTasks = filteredTasks.filter((t) => !isTaskArchived(t));
  const archivedTasks = filteredTasks.filter((t) => isTaskArchived(t));

  // Combined list: active tasks + divider + archived tasks
  const listData: ListItem[] = [
    ...activeTasks,
    ...(archivedTasks.length > 0
      ? [
          { _type: 'section-header' as const, label: `📦 Archive (${archivedTasks.length})`, id: '__archive_header__' } as ListItem,
          ...archivedTasks,
        ]
      : []),
  ];

  const getStatusColor = (label: string) =>
    statusLabels.find((s) => s.label === label)?.color ?? theme.color.primary;

  const clientFileCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tasks) {
      counts[t.client_id] = (counts[t.client_id] ?? 0) + 1;
    }
    return counts;
  }, [tasks]);

  const openQuickFinance = (task: Task) => {
    setQuickFinanceTask(task);
    setQuickTxType('expense');
    setQuickTxDesc('');
    setQuickTxUSD('');
    setQuickTxLBP('');
    setShowQuickFinance(true);
  };

  const handleQuickAddTransaction = async () => {
    if (!quickFinanceTask) return;
    if (!quickTxDesc.trim()) {
      Alert.alert('Required', 'Please enter a description.');
      return;
    }
    const usd = parseFloat(quickTxUSD) || 0;
    const lbp = parseFloat(quickTxLBP.replace(/,/g, '')) || 0;
    if (usd === 0 && lbp === 0) {
      Alert.alert('Required', 'Enter at least one amount (USD or LBP).');
      return;
    }
    setSavingQuickTx(true);
    const { error } = await supabase.from('file_transactions').insert({
      task_id: quickFinanceTask.id,
      type: quickTxType,
      description: quickTxDesc.trim(),
      amount_usd: usd,
      amount_lbp: lbp,
      created_by: teamMember?.id ?? null,
    });
    setSavingQuickTx(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setShowQuickFinance(false);
    setQuickFinanceTask(null);
  };

  const handleDeleteTask = (task: Task) => {
    const label = task.client?.name ?? 'this file';
    const doDelete = async () => {
      await supabase.from('tasks').delete().eq('id', task.id);
      fetchData();
    };
    if (Platform.OS === 'web') {
      if ((window as any).confirm(`Delete "${label}"? This cannot be undone.`)) {
        doDelete();
      }
      return;
    }
    Alert.alert('Delete File', `Delete "${label}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  };

  const handleUnarchiveTask = async (task: Task) => {
    await supabase
      .from('tasks')
      .update({ is_archived: false, updated_at: new Date().toISOString() })
      .eq('id', task.id);
    fetchData();
  };

  // Service stages sheet helpers (Task 3)
  const openServiceSheet = useCallback(async (serviceId: string, serviceName: string) => {
    setSvcSheetId(serviceId);
    setSvcSheetName(serviceName);
    setSvcSheetShowAdd(false);
    setSvcSheetAddSearch('');
    setSvcSheetLoading(true);
    const [stagesRes, miniRes] = await Promise.all([
      supabase
        .from('service_default_stages')
        .select('id, stop_order, ministry_id, ministry:ministries(id, name)')
        .eq('service_id', serviceId)
        .order('stop_order'),
      supabase.from('ministries').select('*').eq('type', 'parent').order('name'),
    ]);
    if (stagesRes.data) setSvcSheetStages(stagesRes.data as any);
    if (miniRes.data) setSvcSheetMinistries(miniRes.data as Ministry[]);
    setSvcSheetLoading(false);
  }, []);

  const handleSvcSheetAddExisting = async (ministry: Ministry) => {
    if (!svcSheetId) return;
    setSvcSheetSaving(true);
    const nextOrder = (svcSheetStages[svcSheetStages.length - 1]?.stop_order ?? 0) + 1;
    await supabase.from('service_default_stages').insert({
      service_id: svcSheetId,
      ministry_id: ministry.id,
      stop_order: nextOrder,
    });
    const { data } = await supabase
      .from('service_default_stages')
      .select('id, stop_order, ministry_id, ministry:ministries(id, name)')
      .eq('service_id', svcSheetId)
      .order('stop_order');
    if (data) setSvcSheetStages(data as any);
    setSvcSheetShowAdd(false);
    setSvcSheetSaving(false);
  };

  const handleSvcSheetAddNew = async () => {
    const name = svcSheetAddSearch.trim();
    if (!svcSheetId || !name) return;
    setSvcSheetSaving(true);
    const { data: miniData } = await supabase
      .from('ministries')
      .insert({ name, type: 'parent' })
      .select()
      .single();
    if (miniData) {
      await handleSvcSheetAddExisting(miniData as Ministry);
    }
    setSvcSheetAddSearch('');
    setSvcSheetSaving(false);
  };

  const handleSvcSheetRemove = async (stageId: string) => {
    await supabase.from('service_default_stages').delete().eq('id', stageId);
    setSvcSheetStages((prev) => prev.filter((s) => s.id !== stageId));
  };

  const handleSvcSheetMove = async (idx: number, dir: -1 | 1) => {
    const stages = [...svcSheetStages];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= stages.length) return;
    const a = stages[idx];
    const b = stages[swapIdx];
    stages[idx] = { ...b, stop_order: a.stop_order };
    stages[swapIdx] = { ...a, stop_order: b.stop_order };
    setSvcSheetStages(stages);
    await Promise.all([
      supabase.from('service_default_stages').update({ stop_order: a.stop_order }).eq('id', b.id),
      supabase.from('service_default_stages').update({ stop_order: b.stop_order }).eq('id', a.id),
    ]);
  };

  // Compute which cities and services appear in the active set (for filter chips)
  const tasksInCurrentSet = useMemo(() => tasks.filter((t) => !isTaskArchived(t)), [tasks]);

  const availableCities = useMemo(() => {
    const seen = new Set<string>();
    const result: City[] = [];
    for (const task of tasksInCurrentSet) {
      for (const stop of task.route_stops ?? []) {
        if (stop.city_id && stop.city && !seen.has(stop.city_id)) {
          seen.add(stop.city_id);
          result.push(stop.city as City);
        }
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [tasksInCurrentSet]);

  const availableServices = useMemo(() => {
    const seen = new Set<string>();
    const result: Service[] = [];
    for (const task of tasksInCurrentSet) {
      if (task.service_id && task.service && !seen.has(task.service_id)) {
        seen.add(task.service_id);
        result.push(task.service as Service);
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [tasksInCurrentSet]);

  const activeFilterCount = [
    filters.serviceId,
    filters.ministryId,
    filters.cityId,
  ].filter(Boolean).length;

  // Summary bar stats (active tasks only)
  const summaryStats = useMemo(() => {
    const active = tasks.filter((t) => !isTaskArchived(t));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = active.filter(
      (t) => t.due_date && new Date(t.due_date + 'T00:00:00') < today
    ).length;
    const dueUSD = active.reduce((sum, t) => {
      const paid = (t.transactions ?? [])
        .filter((x) => x.type === 'revenue')
        .reduce((s, x) => s + x.amount_usd, 0);
      return sum + Math.max(0, (t.price_usd ?? 0) - paid);
    }, 0);
    return { active: active.length, overdue, dueUSD };
  }, [tasks]);

  // Stable named renderItem — avoids FlatList re-renders on every state change
  const allStatusColorsMap = useMemo(
    () => Object.fromEntries(statusLabels.map((sl) => [sl.label, sl.color])),
    [statusLabels]
  );

  const renderTaskRow = useCallback(
    ({ item }: { item: ListItem }) => {
      // Section divider row
      if ('_type' in item && item._type === 'section-header') {
        return (
          <View style={styles.sectionDivider}>
            <Text style={styles.sectionDividerText}>{item.label}</Text>
          </View>
        );
      }
      const task = item as Task;
      return (
        <SwipeableTaskRow
          task={task}
          statusColor={getStatusColor(task.current_status)}
          allStatusColors={allStatusColorsMap}
          onPress={() => navigation.navigate('TaskDetail', { taskId: task.id })}
          onClientPress={() => navigation.navigate('ClientProfile', { clientId: task.client_id })}
          onCityPress={(cityId) => setFilters((f) => ({ ...f, cityId: f.cityId === cityId ? '' : cityId }))}
          onServicePress={() => openServiceSheet(task.service_id, task.service?.name ?? '')}
          onEdit={() => navigation.navigate('TaskDetail', { taskId: task.id })}
          onDelete={() => handleDeleteTask(task)}
          onUnarchive={() => handleUnarchiveTask(task)}
          onFinance={() => openQuickFinance(task)}
          isArchived={isTaskArchived(task)}
        />
      );
    },
    [allStatusColorsMap, statusLabels, navigation, handleDeleteTask, handleUnarchiveTask, openQuickFinance, openServiceSheet]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.color.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <OfflineBanner />

      {/* Search + filter bar */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={filters.search}
          onChangeText={(v) => setFilters((f) => ({ ...f, search: v }))}
          placeholder="Search client or service..."
          placeholderTextColor={theme.color.textMuted}
        />
        <TouchableOpacity
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
          onPress={() => setShowFilters((v) => !v)}
        >
          <Text style={styles.filterBtnText}>
            ⊟ Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.globalSearchBtn}
          onPress={() => navigation.navigate('GlobalSearch')}
        >
          <Text style={styles.globalSearchBtnText}>🔍</Text>
        </TouchableOpacity>
      </View>

      {/* Expanded filter panel */}
      {showFilters && (
        <View style={styles.filterPanel}>
          {/* Service filter — only services present in current task set */}
          <Text style={styles.filterSectionLabel}>SERVICE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, !filters.serviceId && styles.chipActive]}
              onPress={() => setFilters((f) => ({ ...f, serviceId: '' }))}
            >
              <Text style={[styles.chipText, !filters.serviceId && styles.chipTextActive]}>All</Text>
            </TouchableOpacity>
            {availableServices.map((sv) => (
              <TouchableOpacity
                key={sv.id}
                style={[styles.chip, filters.serviceId === sv.id && styles.chipActive]}
                onPress={() => setFilters((f) => ({ ...f, serviceId: f.serviceId === sv.id ? '' : sv.id }))}
              >
                <Text style={[styles.chipText, filters.serviceId === sv.id && styles.chipTextActive]}>
                  {sv.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* City filter — only cities present in current task set */}
          {availableCities.length > 0 && (
            <>
              <Text style={styles.filterSectionLabel}>CITY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, !filters.cityId && styles.chipActive]}
                  onPress={() => setFilters((f) => ({ ...f, cityId: '' }))}
                >
                  <Text style={[styles.chipText, !filters.cityId && styles.chipTextActive]}>All</Text>
                </TouchableOpacity>
                {availableCities.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.chip, filters.cityId === c.id && styles.chipActive]}
                    onPress={() => setFilters((f) => ({ ...f, cityId: f.cityId === c.id ? '' : c.id }))}
                  >
                    <Text style={[styles.chipText, filters.cityId === c.id && styles.chipTextActive]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}
        </View>
      )}

      {/* Result count */}
      <View style={styles.resultRow}>
        <Text style={styles.resultCount}>
          {activeTasks.length} active · {archivedTasks.length} archived
        </Text>
      </View>

      {/* Summary bar */}
      {summaryStats.active > 0 && (
        <View style={styles.summaryBar}>
          <Text style={styles.summaryItem}>Active: {summaryStats.active}</Text>
          <Text style={styles.summaryDot}> · </Text>
          <Text style={[styles.summaryItem, summaryStats.overdue > 0 && styles.summaryDanger]}>
            Overdue: {summaryStats.overdue}
          </Text>
          <Text style={styles.summaryDot}> · </Text>
          <Text style={[styles.summaryItem, summaryStats.dueUSD > 0 && styles.summaryPrimary]}>
            Due ${summaryStats.dueUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </Text>
        </View>
      )}

      {/* Task list — active tasks first, then archive divider, then archived tasks */}
      <FlatList
        data={listData}
        keyExtractor={(item) => ('_type' in item ? item.id : (item as Task).id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          matchingClients.length > 0 ? (
            <View style={styles.clientSection}>
              <Text style={styles.clientSectionLabel}>CLIENTS</Text>
              {matchingClients.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.clientRow}
                  onPress={() => navigation.navigate('ClientProfile', { clientId: c.id })}
                  activeOpacity={0.7}
                >
                  <View style={styles.clientAvatar}>
                    <Text style={styles.clientAvatarText}>{c.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.clientRowName}>{c.name}</Text>
                    {c.phone ? (
                      <TouchableOpacity onPress={() => openPhone(c.phone!, c.name)} activeOpacity={0.7}>
                        <Text style={[styles.clientRowPhone, { color: theme.color.primary }]}>📞 {c.phone}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <Text style={styles.clientRowArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null
        }
        renderItem={renderTaskRow}
        getItemLayout={(_data, index) => ({
          length: TASK_ROW_HEIGHT,
          offset: TASK_ROW_HEIGHT * index,
          index,
        })}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>⊞</Text>
            <Text style={styles.emptyText}>No files found</Text>
            <Text style={styles.emptySubtext}>Adjust filters or create a new file</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.color.primary}
          />
        }
      />


      {/* ── SERVICE STAGES SHEET (tap orange service name) ── */}
      <Modal
        visible={!!svcSheetId}
        animationType="slide"
        transparent
        onRequestClose={() => setSvcSheetId(null)}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior="padding">
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setSvcSheetId(null)} />
          <View style={[styles.modalSheet, { maxHeight: '75%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{svcSheetName}</Text>
              <TouchableOpacity onPress={() => setSvcSheetId(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {svcSheetLoading ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <ActivityIndicator color={theme.color.primary} />
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ padding: theme.spacing.space4, gap: theme.spacing.space2 }}>
                {svcSheetStages.length === 0 && !svcSheetShowAdd && (
                  <Text style={{ ...theme.typography.body, color: theme.color.textMuted, textAlign: 'center', paddingVertical: 16 }}>
                    No stages defined for this service.
                  </Text>
                )}
                {svcSheetStages.map((stage, idx) => (
                  <View key={stage.id} style={styles.svcStageRow}>
                    <Text style={styles.svcStageOrder}>{stage.stop_order}.</Text>
                    <Text style={[styles.svcStageName, { flex: 1 }]}>{stage.ministry?.name ?? '—'}</Text>
                    <TouchableOpacity onPress={() => handleSvcSheetMove(idx, -1)} disabled={idx === 0} style={styles.svcStageBtn}>
                      <Text style={[styles.svcStageBtnText, idx === 0 && { opacity: 0.3 }]}>↑</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleSvcSheetMove(idx, 1)} disabled={idx === svcSheetStages.length - 1} style={styles.svcStageBtn}>
                      <Text style={[styles.svcStageBtnText, idx === svcSheetStages.length - 1 && { opacity: 0.3 }]}>↓</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleSvcSheetRemove(stage.id)} style={[styles.svcStageBtn, { backgroundColor: theme.color.danger + '22' }]}>
                      <Text style={[styles.svcStageBtnText, { color: theme.color.danger }]}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Add stage section */}
                {svcSheetShowAdd ? (
                  <View style={{ gap: theme.spacing.space2, marginTop: theme.spacing.space2 }}>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Search or create stage..."
                      placeholderTextColor={theme.color.textMuted}
                      value={svcSheetAddSearch}
                      onChangeText={setSvcSheetAddSearch}
                      autoFocus
                    />
                    {svcSheetMinistries
                      .filter((m) =>
                        !svcSheetAddSearch.trim() || m.name.toLowerCase().includes(svcSheetAddSearch.toLowerCase())
                      )
                      .filter((m) => !svcSheetStages.some((s) => s.ministry_id === m.id))
                      .slice(0, 8)
                      .map((m) => (
                        <TouchableOpacity
                          key={m.id}
                          style={styles.svcStagePickerRow}
                          onPress={() => handleSvcSheetAddExisting(m)}
                          disabled={svcSheetSaving}
                        >
                          <Text style={styles.svcStagePickerText}>{m.name}</Text>
                        </TouchableOpacity>
                      ))}
                    {svcSheetAddSearch.trim().length > 0 &&
                      !svcSheetMinistries.some((m) => m.name.toLowerCase() === svcSheetAddSearch.toLowerCase()) && (
                        <TouchableOpacity
                          style={[styles.svcStagePickerRow, { borderColor: theme.color.primary }]}
                          onPress={handleSvcSheetAddNew}
                          disabled={svcSheetSaving}
                        >
                          <Text style={[styles.svcStagePickerText, { color: theme.color.primary }]}>
                            ＋ Create "{svcSheetAddSearch.trim()}"
                          </Text>
                        </TouchableOpacity>
                      )}
                    <TouchableOpacity onPress={() => setSvcSheetShowAdd(false)}>
                      <Text style={{ ...theme.typography.label, color: theme.color.textMuted, textAlign: 'center', paddingVertical: 8 }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.modalSaveBtn, { marginTop: theme.spacing.space3 }]}
                    onPress={() => { setSvcSheetShowAdd(true); setSvcSheetAddSearch(''); }}
                  >
                    <Text style={styles.modalSaveBtnText}>＋ Add Stage</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── QUICK FINANCE MODAL (swipe-right) ── */}
      <Modal
        visible={showQuickFinance}
        animationType="slide"
        transparent
        onRequestClose={() => setShowQuickFinance(false)}
      >
        <KeyboardAvoidingView
          style={styles.qfOverlay}
          behavior="padding"
        >
          <View style={styles.qfSheet}>
            {/* Header */}
            <View style={styles.qfHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.qfTitle}>Add Financial Entry</Text>
                {quickFinanceTask && (
                  <Text style={styles.qfSubtitle} numberOfLines={1}>
                    {quickFinanceTask.client?.name} — {quickFinanceTask.service?.name}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setShowQuickFinance(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.qfClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Type toggle */}
            <View style={styles.qfTypeRow}>
              <TouchableOpacity
                style={[styles.qfTypeBtn, quickTxType === 'expense' && styles.qfTypeBtnExpense]}
                onPress={() => setQuickTxType('expense')}
              >
                <Text style={[styles.qfTypeBtnText, quickTxType === 'expense' && styles.qfTypeBtnTextExpense]}>
                  ↑ Expense
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.qfTypeBtn, quickTxType === 'revenue' && styles.qfTypeBtnRevenue]}
                onPress={() => setQuickTxType('revenue')}
              >
                <Text style={[styles.qfTypeBtnText, quickTxType === 'revenue' && styles.qfTypeBtnTextRevenue]}>
                  ↓ Revenue
                </Text>
              </TouchableOpacity>
            </View>

            {/* Description */}
            <TextInput
              style={styles.qfInput}
              value={quickTxDesc}
              onChangeText={setQuickTxDesc}
              placeholder="Description *"
              placeholderTextColor={theme.color.textMuted}
              autoFocus
            />

            {/* Amounts */}
            <View style={styles.qfAmountsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.qfAmountLabel}>USD ($)</Text>
                <TextInput
                  style={styles.qfInput}
                  value={quickTxUSD}
                  onChangeText={setQuickTxUSD}
                  placeholder="0.00"
                  placeholderTextColor={theme.color.textMuted}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.qfAmountLabel}>LBP (ل.ل)</Text>
                <TextInput
                  style={styles.qfInput}
                  value={quickTxLBP}
                  onChangeText={(v) => {
                    const digits = v.replace(/,/g, '');
                    if (digits === '' || /^\d*$/.test(digits)) {
                      setQuickTxLBP(digits === '' ? '' : parseInt(digits, 10).toLocaleString('en-US'));
                    }
                  }}
                  placeholder="0"
                  placeholderTextColor={theme.color.textMuted}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            {/* Save */}
            <TouchableOpacity
              style={[
                styles.qfSaveBtn,
                quickTxType === 'expense' ? styles.qfSaveBtnExpense : styles.qfSaveBtnRevenue,
                savingQuickTx && styles.qfSaveBtnDisabled,
              ]}
              onPress={handleQuickAddTransaction}
              disabled={savingQuickTx}
            >
              {savingQuickTx ? (
                <ActivityIndicator color={theme.color.white} size="small" />
              ) : (
                <Text style={styles.qfSaveBtnText}>
                  Save {quickTxType === 'expense' ? 'Expense' : 'Revenue'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Link to full financials */}
            <TouchableOpacity
              style={styles.qfViewAllBtn}
              onPress={() => {
                setShowQuickFinance(false);
                if (quickFinanceTask) {
                  navigation.navigate('TaskDetail', { taskId: quickFinanceTask.id });
                }
              }}
            >
              <Text style={styles.qfViewAllText}>View full financials in file →</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: theme.color.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.color.bgBase },
  searchRow: {
    flexDirection:     'row',
    gap:               theme.spacing.space2 + 2,
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   theme.spacing.space2 + 2,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgSurface,
  },
  searchInput: {
    flex:              1,
    backgroundColor:   theme.color.bgSurface,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3 + 2,
    paddingVertical:   theme.spacing.space2 + 3,
    color:             theme.color.textPrimary,
    ...theme.typography.body,
    borderWidth:       1,
    borderColor:       theme.color.border,
  },
  filterBtn: {
    backgroundColor:   theme.color.bgSurface,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3 + 2,
    justifyContent:    'center',
    borderWidth:       1,
    borderColor:       theme.color.border,
    minHeight:         theme.touchTarget.min,
  },
  filterBtnActive: {
    borderColor:     theme.color.primary,
    backgroundColor: theme.color.primaryDim,
  },
  filterBtnText: {
    ...theme.typography.label,
    color: theme.color.textSecondary,
  },
  filterPanel: {
    backgroundColor:  theme.color.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    paddingTop:        theme.spacing.space3,
    paddingBottom:     theme.spacing.space2,
    gap:               theme.spacing.space1 + 2,
  },
  filterSectionLabel: {
    ...theme.typography.sectionDivider,
    paddingHorizontal: theme.spacing.space4,
    marginTop:         theme.spacing.space2,
  },
  chipRow: {
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space1,
  },
  chip: {
    backgroundColor:   theme.color.bgBase,
    borderRadius:      theme.radius.full,
    paddingHorizontal: theme.spacing.space3 + 2,
    paddingVertical:   theme.spacing.space1 + 2,
    marginEnd:         theme.spacing.space2,
    borderWidth:       1,
    borderColor:       theme.color.border,
  },
  chipActive: {
    backgroundColor: theme.color.primaryDim,
    borderColor:     theme.color.primary,
  },
  chipText: {
    ...theme.typography.label,
    color: theme.color.textMuted,
  },
  chipTextActive: {
    color: theme.color.primaryText,
  },
  resultRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   theme.spacing.space2 + 2,
  },
  resultCount: {
    ...theme.typography.label,
    color: theme.color.textMuted,
  },
  sectionDivider: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: theme.spacing.space3,
    paddingTop:      theme.spacing.space4,
  },
  sectionDividerText: {
    ...theme.typography.sectionDivider,
    color:      theme.color.textMuted,
    fontWeight: '700',
  },
  // Service stages sheet rows
  svcStageRow: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  theme.color.bgBase,
    borderRadius:     theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:  theme.spacing.space2 + 2,
    gap:              theme.spacing.space2,
    borderWidth:      1,
    borderColor:      theme.color.border,
  },
  svcStageOrder: { ...theme.typography.label, color: theme.color.textMuted, minWidth: 20 },
  svcStageName:  { ...theme.typography.body, color: theme.color.textPrimary },
  svcStageBtn: {
    backgroundColor:  theme.color.bgSurface,
    borderRadius:     theme.radius.sm,
    width:            30,
    height:           30,
    alignItems:       'center',
    justifyContent:   'center',
    borderWidth:      1,
    borderColor:      theme.color.border,
  },
  svcStageBtnText:      { ...theme.typography.label, color: theme.color.textSecondary },
  svcStagePickerRow: {
    backgroundColor:   theme.color.bgBase,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space2 + 4,
    borderWidth:       1,
    borderColor:       theme.color.border,
  },
  svcStagePickerText: { ...theme.typography.body, color: theme.color.textPrimary },
  // Modals
  modalOverlay: {
    flex:            1,
    backgroundColor: theme.color.overlayDark,
  },
  modalSheet: {
    backgroundColor:      theme.color.bgSurface,
    borderTopLeftRadius:  theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    borderWidth:          1,
    borderColor:          theme.color.border,
  },
  modalHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: theme.spacing.space4,
    paddingTop:        theme.spacing.space5,
    paddingBottom:     theme.spacing.space4,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  modalTitle: {
    ...theme.typography.heading,
  },
  modalClose: {
    ...theme.typography.heading,
    color:             theme.color.textMuted,
    paddingHorizontal: theme.spacing.space1,
    minWidth:          theme.touchTarget.min,
    minHeight:         theme.touchTarget.min,
    textAlign:         'center',
    textAlignVertical: 'center',
  },
  modalBody: {
    padding: theme.spacing.space4,
    gap:     theme.spacing.space3,
  },
  modalInput: {
    backgroundColor:   theme.color.bgBase,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3 + 2,
    paddingVertical:   theme.spacing.space3,
    color:             theme.color.textPrimary,
    ...theme.typography.body,
    borderWidth:       1,
    borderColor:       theme.color.border,
  },
  modalSaveBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.md,
    paddingVertical: theme.spacing.space3 + 1,
    alignItems:      'center',
    marginTop:       theme.spacing.space1,
  },
  modalSaveBtnDisabled: { opacity: 0.5 },
  modalSaveBtnText: {
    ...theme.typography.body,
    color:      theme.color.white,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: theme.spacing.space4,
    paddingTop:        theme.spacing.space1 + 2,
    paddingBottom:     theme.spacing.space6,
    gap:               theme.spacing.space2,
  },
  empty: {
    alignItems: 'center',
    marginTop:  theme.spacing.space10,
    gap:        theme.spacing.space2,
  },
  emptyIcon: {
    fontSize: theme.icon.lg + 16,
    color:    theme.color.border,
  },
  emptyText: {
    ...theme.typography.heading,
    color: theme.color.textMuted,
  },
  emptySubtext: {
    ...theme.typography.body,
    color: theme.color.border,
  },
  clientSection: {
    marginHorizontal: theme.spacing.space4,
    marginBottom:     theme.spacing.space2,
    backgroundColor:  theme.color.bgSurface,
    borderRadius:     theme.radius.lg,
    borderWidth:      1,
    borderColor:      theme.color.border,
    overflow:         'hidden',
  },
  clientSectionLabel: {
    ...theme.typography.sectionDivider,
    paddingHorizontal: theme.spacing.space3 + 2,
    paddingTop:        theme.spacing.space3,
    paddingBottom:     theme.spacing.space1 + 2,
  },
  clientRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: theme.spacing.space3 + 2,
    paddingVertical:   theme.spacing.space2 + 3,
    borderTopWidth:    1,
    borderTopColor:    theme.color.border,
    minHeight:         theme.touchTarget.min,
  },
  clientAvatar: {
    width:           36,
    height:          36,
    borderRadius:    theme.radius.full,
    backgroundColor: theme.color.primaryDim,
    borderWidth:     1,
    borderColor:     theme.color.primary + '55',
    justifyContent:  'center',
    alignItems:      'center',
    marginEnd:       theme.spacing.space3,
  },
  clientAvatarText: { ...theme.typography.body, color: theme.color.primaryText, fontWeight: '800' },
  clientRowName:    { ...theme.typography.body, fontWeight: '700' },
  clientRowPhone:   { ...theme.typography.caption, marginTop: theme.spacing.space1 - 3 },
  clientRowArrow:   { ...theme.typography.heading, color: theme.color.textMuted },

  // Quick finance modal
  qfOverlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent:  'flex-end',
    zIndex:          theme.zIndex.modal,
  },
  qfSheet: {
    backgroundColor:      theme.color.bgSurface,
    borderTopLeftRadius:  theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding:              theme.spacing.space5,
    paddingBottom:        Platform.OS === 'ios' ? theme.spacing.space10 - 4 : theme.spacing.space6,
    gap:                  theme.spacing.space3 + 2,
  },
  qfHeader: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           theme.spacing.space3,
  },
  qfTitle:    { ...theme.typography.heading },
  qfSubtitle: { ...theme.typography.caption, marginTop: theme.spacing.space1 - 1 },
  qfClose: {
    ...theme.typography.heading,
    color:     theme.color.textMuted,
    padding:   theme.spacing.space1 - 2,
    minWidth:  theme.touchTarget.min,
    minHeight: theme.touchTarget.min,
    textAlign: 'center',
  },
  qfTypeRow: { flexDirection: 'row', gap: theme.spacing.space2 + 2 },
  qfTypeBtn: {
    flex:            1,
    paddingVertical: theme.spacing.space2 + 3,
    borderRadius:    theme.radius.md,
    alignItems:      'center',
    backgroundColor: theme.color.bgBase,
    borderWidth:     1,
    borderColor:     theme.color.border,
    minHeight:       theme.touchTarget.min,
  },
  qfTypeBtnExpense:     { backgroundColor: theme.color.danger + '22', borderColor: theme.color.danger + '66' },
  qfTypeBtnRevenue:     { backgroundColor: theme.color.success + '22', borderColor: theme.color.success + '66' },
  qfTypeBtnText:        { ...theme.typography.body, color: theme.color.textMuted, fontWeight: '700' },
  qfTypeBtnTextExpense: { color: theme.color.danger },
  qfTypeBtnTextRevenue: { color: theme.color.success },
  qfInput: {
    backgroundColor:   theme.color.bgBase,
    color:             theme.color.textPrimary,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3 + 2,
    paddingVertical:   theme.spacing.space3,
    ...theme.typography.body,
    borderWidth:       1,
    borderColor:       theme.color.border,
  },
  qfAmountsRow:  { flexDirection: 'row', gap: theme.spacing.space3 },
  qfAmountLabel: { ...theme.typography.caption, fontWeight: '700', marginBottom: theme.spacing.space1 + 2 },
  qfSaveBtn: {
    borderRadius:    theme.radius.md,
    paddingVertical: theme.spacing.space3 + 2,
    alignItems:      'center',
    minHeight:       theme.touchTarget.min,
    justifyContent:  'center',
  },
  qfSaveBtnExpense:  { backgroundColor: theme.color.danger },
  qfSaveBtnRevenue:  { backgroundColor: theme.color.success },
  qfSaveBtnDisabled: { opacity: 0.6 },
  qfSaveBtnText:     { ...theme.typography.body, color: theme.color.white, fontWeight: '700' },
  qfViewAllBtn:      { alignItems: 'center', paddingVertical: theme.spacing.space1 },
  qfViewAllText:     { ...theme.typography.label, color: theme.color.primary, fontWeight: '600' },
  // Summary bar
  summaryBar: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   theme.spacing.space2,
    backgroundColor:   theme.color.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  summaryItem:    { ...theme.typography.caption, color: theme.color.textSecondary, fontWeight: '600' },
  summaryDot:     { ...theme.typography.caption, color: theme.color.textMuted },
  summaryDanger:  { color: theme.color.danger },
  summaryPrimary: { color: theme.color.primary },
  // Global search button
  globalSearchBtn: {
    backgroundColor:   theme.color.bgSurface,
    borderRadius:      theme.radius.md,
    paddingHorizontal: 10,
    justifyContent:    'center',
    borderWidth:       1,
    borderColor:       theme.color.border,
    minHeight:         theme.touchTarget.min,
  },
  globalSearchBtnText: { fontSize: 16 },

});
