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
import { checkAndNotifyOverdue } from '../lib/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from '../lib/i18n';

// Estimated TaskCard row height for getItemLayout (card + spacing)
const TASK_ROW_HEIGHT = 130;

type Nav = NativeStackNavigationProp<DashboardStackParamList>;

const SWIPE_ACTION_WIDTH = 130; // left-swipe: Archive + Delete
const FINANCE_ACTION_WIDTH = 80;  // right-swipe: Add Financial

function SwipeableTaskRow({
  task,
  statusColor,
  allStatusColors,
  onPress,
  onLongPress,
  onClientPress,
  onCityPress,
  onServicePress,
  onArchive,
  onDelete,
  onUnarchive,
  onFinance,
  onPin,
  isArchived,
  canDelete,
  canFinance,
  canArchive,
  exchangeRate,
}: {
  task: Task;
  statusColor: string;
  allStatusColors: Record<string, string>;
  onPress: () => void;
  onLongPress: () => void;
  onClientPress: () => void;
  onCityPress: (cityId: string) => void;
  onServicePress: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onUnarchive: () => void;
  onFinance: () => void;
  onPin: () => void;
  isArchived: boolean;
  canDelete: boolean;
  canFinance: boolean;
  canArchive: boolean;
  exchangeRate: number;
}) {
  const { t } = useTranslation();
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
      {/* Right-swipe: Finance action (left side) — hidden at rest, gated by canFinance */}
      {canFinance && (
        <Animated.View style={[swipeStyles.financeAction, { opacity: financeOpacity }]}>
          <TouchableOpacity
            style={swipeStyles.financeBtn}
            onPress={() => { close(); onFinance(); }}
          >
            <Text style={swipeStyles.financeIcon}>💰</Text>
            <Text style={swipeStyles.financeBtnText}>Add</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Left-swipe: Archive/Restore + Delete (right side) — hidden at rest */}
      <Animated.View style={[swipeStyles.actions, { opacity: actionsOpacity }]}>
        {isArchived ? (
          canArchive && (
            <TouchableOpacity
              style={swipeStyles.unarchiveBtn}
              onPress={() => { close(); onUnarchive(); }}
            >
              <Text style={swipeStyles.unarchivedBtnText}>📋{'\n'}{t('restoreFile')}</Text>
            </TouchableOpacity>
          )
        ) : (
          canArchive && (
            <TouchableOpacity
              style={swipeStyles.archiveBtn}
              onPress={() => { close(); onArchive(); }}
            >
              <Text style={swipeStyles.archiveBtnText}>📦{'\n'}{t('archiveFile')}</Text>
            </TouchableOpacity>
          )
        )}
        {canDelete && (
          <TouchableOpacity
            style={swipeStyles.deleteBtn}
            onPress={() => { close(); onDelete(); }}
          >
            <Text style={swipeStyles.deleteBtnText}>✕{'\n'}{t('deleteFile')}</Text>
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
          onLongPress={() => { if (isOpen.current) { close(); } else { onLongPress(); } }}
          onClientPress={onClientPress}
          onCityPress={onCityPress}
          onServicePress={onServicePress}
          onPin={onPin}
          cardStyle={{ marginBottom: 0 }}
          exchangeRate={exchangeRate}
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
  archiveBtn: {
    flex:            1,
    backgroundColor: '#f59e0b',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             theme.spacing.space1,
  },
  archiveBtnText: { ...theme.typography.caption, color: theme.color.white, fontWeight: '700', textAlign: 'center' },
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
  serviceIds: string[];   // multi-select
  ministryId: string;
  cityIds: string[];      // multi-select
  teamMemberId: string;
  overdueOnly: boolean;
}


const TERMINAL_STATUSES = new Set(['Done', 'Rejected', 'Received & Closed']);

// A task is archived when all its stops are terminal (Done/Rejected/Received & Closed) or DB flag
function isTaskArchived(task: Task): boolean {
  const stopsTotal = task.route_stops?.length ?? 0;
  return (
    task.is_archived === true ||
    (stopsTotal > 0 && task.route_stops!.every((s) => TERMINAL_STATUSES.has(s.status)))
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
  const { teamMember, permissions, organization, loading: authLoading } = useAuth();
  const { setOnline } = useOfflineQueue();
  const { t } = useTranslation();

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
    serviceIds: [],
    ministryId: '',
    cityIds: [],
    teamMemberId: '',
    overdueOnly: false,
  });

  const [showArchived, setShowArchived] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [services, setServices] = useState<Service[]>([]);

  // ── Welcome overlay ──────────────────────────────────────────
  const WELCOME_DISMISSED_KEY = '@welcome_dismissed';
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeNeverShow, setWelcomeNeverShow] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(WELCOME_DISMISSED_KEY).then((val) => {
      if (val !== 'true') setShowWelcome(true);
    });
  }, []);

  const closeWelcome = async () => {
    if (welcomeNeverShow) {
      await AsyncStorage.setItem(WELCOME_DISMISSED_KEY, 'true');
    }
    setShowWelcome(false);
  };

  const goToCreateSection = async (section?: 'clients' | 'services' | 'stages') => {
    await closeWelcome();
    // Navigate to the Create tab (sibling tab), optionally opening a section
    navigation.getParent()?.navigate('Create', section ? { openSection: section } : undefined);
  };

  // Bulk select mode — removed per user request

  // Activity unread badge
  const ACTIVITY_SEEN_KEY = '@activity_last_seen';
  const [unreadActivity, setUnreadActivity] = useState(0);

  const refreshUnreadActivity = useCallback(async () => {
    const lastSeen = await AsyncStorage.getItem(ACTIVITY_SEEN_KEY);
    const since = lastSeen ?? new Date(0).toISOString();
    const { count } = await supabase
      .from('status_updates')
      .select('id', { count: 'exact', head: true })
      .gt('created_at', since);
    setUnreadActivity(count ?? 0);
  }, []);

  const openActivity = useCallback(async () => {
    await AsyncStorage.setItem(ACTIVITY_SEEN_KEY, new Date().toISOString());
    setUnreadActivity(0);
    navigation.navigate('Activity');
  }, [navigation]);

  // Refresh unread badge when screen focuses
  useFocusEffect(useCallback(() => {
    refreshUnreadActivity();
  }, [refreshUnreadActivity]));

  // Quick status update (long-press card)
  const [quickStatusTask, setQuickStatusTask] = useState<Task | null>(null);
  const [savingQuickStatus, setSavingQuickStatus] = useState(false);

  const openQuickStatus = (task: Task) => setQuickStatusTask(task);

  const applyQuickStatus = async (newStatus: string) => {
    if (!quickStatusTask || !teamMember) return;
    setSavingQuickStatus(true);
    const { error } = await supabase
      .from('tasks')
      .update({ current_status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', quickStatusTask.id);
    if (!error) {
      await supabase.from('status_updates').insert({
        task_id: quickStatusTask.id,
        updated_by: teamMember.id,
        old_status: quickStatusTask.current_status,
        new_status: newStatus,
      });
    }
    setSavingQuickStatus(false);
    setQuickStatusTask(null);
    fetchData();
  };

  // Quick-add financial transaction (swipe right)
  const [showQuickFinance, setShowQuickFinance] = useState(false);
  const [quickFinanceTask, setQuickFinanceTask] = useState<Task | null>(null);
  const [quickTxType, setQuickTxType] = useState<'expense' | 'revenue'>('expense');
  const [quickTxDesc, setQuickTxDesc] = useState('');
  const [quickTxUSD, setQuickTxUSD] = useState('');
  const [quickTxLBP, setQuickTxLBP] = useState('');
  const [quickTxStopId, setQuickTxStopId] = useState<string | null>(null);
  const [showQuickStagePicker, setShowQuickStagePicker] = useState(false);
  const [savingQuickTx, setSavingQuickTx] = useState(false);

  // Default to "My Files" once the logged-in team member is known
  useEffect(() => {
    if (teamMember?.id) {
      setFilters((f) => ({ ...f, teamMemberId: teamMember.id }));
    }
  }, [teamMember?.id]);

  // Network listener
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected);
    });
    return unsub;
  }, []);

  const fetchData = useCallback(async () => {
    const [tasksRes, labelsRes, membersRes, ministriesRes, clientsRes, svcRes, citiesRes, blocksRes] = await Promise.all([
      supabase
        .from('tasks')
        .select(
          `*, client:clients(*), service:services(*), assignee:team_members!assigned_to(*), route_stops:task_route_stops(*, ministry:ministries(*), city:cities(id,name)), transactions:file_transactions(type,amount_usd,amount_lbp)`
        )
        .order('created_at', { ascending: false }),
      supabase.from('status_labels').select('*').eq('org_id', teamMember?.org_id ?? '').order('sort_order'),
      supabase.from('team_members').select('*').order('name'),
      supabase.from('ministries').select('*').eq('type', 'parent').order('name'),
      supabase.from('clients').select('*').order('name'),
      supabase.from('services').select('*').order('name'),
      supabase.from('cities').select('*').order('name'),
      // Fetch files that have been blocked for this specific member
      teamMember?.id
        ? supabase.from('file_visibility_blocks').select('task_id').eq('team_member_id', teamMember.id)
        : Promise.resolve({ data: [] }),
    ]);

    if (tasksRes.data) {
      let allTasks = tasksRes.data as Task[];
      // Permission: if member can only see their own files,
      // keep tasks where the member is assigned at task level OR at any stage level
      if (!permissions.can_see_all_files && teamMember?.id) {
        allTasks = allTasks.filter(t =>
          t.assigned_to === teamMember.id ||
          (t.route_stops ?? []).some((s: any) => s.assigned_to === teamMember.id)
        );
      }
      // File visibility blocks: remove files that an owner/admin has hidden from this member
      if (blocksRes.data && blocksRes.data.length > 0) {
        const blockedIds = new Set((blocksRes.data as any[]).map((b: any) => b.task_id));
        allTasks = allTasks.filter(t => !blockedIds.has(t.id));
      }
      setTasks(allTasks);
    }
    if (labelsRes.data) setStatusLabels(labelsRes.data as StatusLabel[]);
    if (membersRes.data) setTeamMembers(membersRes.data as TeamMember[]);
    if (ministriesRes.data) setMinistries(ministriesRes.data as Ministry[]);
    if (clientsRes.data) setClients(clientsRes.data as Client[]);
    if (svcRes.data) setServices(svcRes.data as Service[]);
    if (citiesRes.data) setCities(citiesRes.data as City[]);
    setLoading(false);
    setRefreshing(false);
  }, [permissions, teamMember?.id]);

  // Wait for auth to finish loading before fetching data.
  // This prevents fetchData from running with ALL_PERMISSIONS (the initial default)
  // before the viewer's actual permissions are loaded from org_visibility_settings.
  useEffect(() => {
    if (!authLoading) fetchData();
  }, [fetchData, authLoading]);

  // Refresh tasks when navigating back — clear search so full list is shown
  useFocusEffect(useCallback(() => {
    if (!authLoading) fetchData();
    setFilters((f) => ({ ...f, search: '' }));
  }, [fetchData, authLoading]));

  // Overdue check — once per day, fires a local notification for past-due files
  useEffect(() => {
    if (teamMember?.id) {
      checkAndNotifyOverdue(teamMember.id, supabase);
    }
  }, [teamMember?.id]);

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

  // Apply search/service/city/teamMember filters
  const filteredTasks = tasks.filter((task) => {
    if (
      filters.search &&
      !task.client?.name.toLowerCase().includes(filters.search.toLowerCase()) &&
      !task.service?.name.toLowerCase().includes(filters.search.toLowerCase())
    ) {
      return false;
    }
    if (filters.serviceIds.length > 0 && !filters.serviceIds.includes(task.service_id)) return false;
    if (filters.cityIds.length > 0) {
      const hasCity = task.route_stops?.some((s) => s.city_id && filters.cityIds.includes(s.city_id));
      if (!hasCity) return false;
    }
    if (filters.ministryId) {
      const hasMinistry = task.route_stops?.some((s) => s.ministry_id === filters.ministryId);
      if (!hasMinistry) return false;
    }
    if (filters.teamMemberId && task.assigned_to !== filters.teamMemberId) return false;
    if (filters.overdueOnly) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (!task.due_date || new Date(task.due_date + 'T00:00:00') >= today) return false;
    }
    return true;
  });

  // Split into active and archived sections
  const activeTasks = filteredTasks.filter((t) => !isTaskArchived(t));
  const archivedTasks = filteredTasks.filter((t) => isTaskArchived(t));

  // Pinned tasks float to the top of the active list
  const sortedActiveTasks = [
    ...activeTasks.filter((t) => t.is_pinned),
    ...activeTasks.filter((t) => !t.is_pinned),
  ];

  // Show only the selected section
  const listData: Task[] = showArchived ? archivedTasks : sortedActiveTasks;

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
      task_id:      quickFinanceTask.id,
      type:         quickTxType,
      description:  quickTxDesc.trim(),
      amount_usd:   usd,
      amount_lbp:   lbp,
      rate_usd_lbp: organization?.usd_to_lbp_rate ?? 89500,  // snapshot rate at entry time
      stop_id:      quickTxStopId ?? null,
      created_by:   teamMember?.id ?? null,
    });
    setSavingQuickTx(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setShowQuickFinance(false);
    setQuickFinanceTask(null);
    setQuickTxStopId(null);
    setShowQuickStagePicker(false);
  };

  const handleDeleteTask = (task: Task) => {
    const label = task.client?.name ?? 'this file';
    const doDelete = async () => {
      // Log deletion to activity_log before deleting (so it survives the cascade)
      await supabase.from('activity_log').insert({
        org_id: teamMember?.org_id ?? null,
        actor_id: teamMember?.id ?? null,
        actor_name: teamMember?.name ?? 'Someone',
        event_type: 'file_deleted',
        client_name: task.client?.name ?? null,
        service_name: task.service?.name ?? null,
        description: `Deleted file for ${task.client?.name ?? 'Unknown'} — ${task.service?.name ?? ''}`,
      }).select(); // ignore error if table doesn't exist yet
      await supabase.from('tasks').delete().eq('id', task.id);
      fetchData();
    };
    if (Platform.OS === 'web') {
      if ((window as any).confirm(`Delete "${label}"? This cannot be undone.`)) {
        doDelete();
      }
      return;
    }
    Alert.alert(t('deleteFile'), `Delete "${label}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: t('deleteFile'), style: 'destructive', onPress: doDelete },
    ]);
  };

  const handleArchiveTask = async (task: Task) => {
    Alert.alert(t('archiveFile'), `Move "${task.client?.name ?? 'this file'}" to archive?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: t('archiveFile'), style: 'destructive', onPress: async () => {
          await supabase
            .from('tasks')
            .update({ is_archived: true, updated_at: new Date().toISOString() })
            .eq('id', task.id);
          fetchData();
        }
      },
    ]);
  };

  const handleUnarchiveTask = async (task: Task) => {
    await supabase
      .from('tasks')
      .update({ is_archived: false, updated_at: new Date().toISOString() })
      .eq('id', task.id);
    fetchData();
  };

  const handlePinTask = async (task: Task) => {
    await supabase
      .from('tasks')
      .update({ is_pinned: true })
      .eq('id', task.id);
    fetchData();
  };

  const handleUnpinTask = async (task: Task) => {
    await supabase
      .from('tasks')
      .update({ is_pinned: false })
      .eq('id', task.id);
    fetchData();
  };


  // Helper: apply all filters except the one named, then split by active/archive.
  // This keeps chip options contextual (search + other chips applied) while
  // still allowing multi-select (a chip's own filter is excluded from its pool).
  const applyFiltersExcept = useCallback(
    (exclude: 'service' | 'city') => {
      return tasks.filter((task) => {
        // archive/active split
        if (showArchived ? !isTaskArchived(task) : isTaskArchived(task)) return false;
        // search
        if (
          filters.search &&
          !task.client?.name.toLowerCase().includes(filters.search.toLowerCase()) &&
          !task.service?.name.toLowerCase().includes(filters.search.toLowerCase())
        ) return false;
        // service filter — skip when building service chip list
        if (exclude !== 'service' && filters.serviceIds.length > 0 && !filters.serviceIds.includes(task.service_id)) return false;
        // city filter — skip when building city chip list
        if (exclude !== 'city' && filters.cityIds.length > 0) {
          const hasCity = task.route_stops?.some((s) => s.city_id && filters.cityIds.includes(s.city_id));
          if (!hasCity) return false;
        }
        if (filters.ministryId) {
          const hasMinistry = task.route_stops?.some((s) => s.ministry_id === filters.ministryId);
          if (!hasMinistry) return false;
        }
        if (filters.teamMemberId && task.assigned_to !== filters.teamMemberId) return false;
        if (filters.overdueOnly) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (!task.due_date || new Date(task.due_date + 'T00:00:00') >= today) return false;
        }
        return true;
      });
    },
    [tasks, filters, showArchived]
  );

  const availableServices = useMemo(() => {
    const pool = applyFiltersExcept('service');
    const seen = new Set<string>();
    const result: Service[] = [];
    for (const task of pool) {
      if (task.service_id && task.service && !seen.has(task.service_id)) {
        seen.add(task.service_id);
        result.push(task.service as Service);
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [applyFiltersExcept]);

  const availableCities = useMemo(() => {
    const pool = applyFiltersExcept('city');
    const seen = new Set<string>();
    const result: City[] = [];
    for (const task of pool) {
      for (const stop of task.route_stops ?? []) {
        if (stop.city_id && stop.city && !seen.has(stop.city_id)) {
          seen.add(stop.city_id);
          result.push(stop.city as City);
        }
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [applyFiltersExcept]);

  const activeFilterCount =
    (filters.serviceIds.length > 0 ? filters.serviceIds.length : 0) +
    (filters.cityIds.length > 0 ? filters.cityIds.length : 0) +
    (filters.ministryId ? 1 : 0) +
    (filters.overdueOnly ? 1 : 0);

  // Summary bar stats — mirrors the same filters as filteredTasks so counts
  // always match what the list actually shows (active, non-archived tasks only)
  const summaryStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const active = tasks.filter((t) => {
      if (isTaskArchived(t)) return false;
      // Mirror the teamMember filter so "My Files" mode is consistent
      if (filters.teamMemberId && t.assigned_to !== filters.teamMemberId) return false;
      // Mirror service / city / search filters
      if (filters.search &&
        !t.client?.name.toLowerCase().includes(filters.search.toLowerCase()) &&
        !t.service?.name.toLowerCase().includes(filters.search.toLowerCase())
      ) return false;
      if (filters.serviceIds.length > 0 && !filters.serviceIds.includes(t.service_id)) return false;
      if (filters.cityIds.length > 0) {
        const hasCity = t.route_stops?.some((s) => s.city_id && filters.cityIds.includes(s.city_id));
        if (!hasCity) return false;
      }
      return true;
    });
    const overdue = active.filter(
      (t) => t.due_date && new Date(t.due_date + 'T00:00:00') < today
    ).length;
    const dueUSD = active.reduce((sum, t) => {
      const paid = (t.transactions ?? [])
        .filter((x) => x.type === 'revenue')
        .reduce((s, x) => s + x.amount_usd, 0);
      return sum + Math.max(0, (t.price_usd ?? 0) - paid);
    }, 0);
    const dueLBP = active.reduce((sum, t) => {
      const paid = (t.transactions ?? [])
        .filter((x) => x.type === 'revenue')
        .reduce((s, x) => s + x.amount_lbp, 0);
      return sum + Math.max(0, (t.price_lbp ?? 0) - paid);
    }, 0);
    return { active: active.length, overdue, dueUSD, dueLBP };
  }, [tasks, filters]);

  // Stable named renderItem — avoids FlatList re-renders on every state change
  const allStatusColorsMap = useMemo(
    () => Object.fromEntries(statusLabels.map((sl) => [sl.label, sl.color])),
    [statusLabels]
  );

  const renderTaskRow = useCallback(
    ({ item }: { item: Task }) => {
      return (
        <SwipeableTaskRow
          task={item}
          statusColor={getStatusColor(item.current_status)}
          allStatusColors={allStatusColorsMap}
          onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })}
          onLongPress={() => {}}
          onClientPress={() => navigation.navigate('ClientProfile', { clientId: item.client_id })}
          onCityPress={(cityId) => setFilters((f) => ({
            ...f,
            cityIds: f.cityIds.includes(cityId)
              ? f.cityIds.filter((id) => id !== cityId)
              : [...f.cityIds, cityId],
          }))}
          onServicePress={() => navigation.navigate('TaskDetail', { taskId: item.id })}
          onArchive={() => handleArchiveTask(item)}
          onDelete={() => handleDeleteTask(item)}
          onUnarchive={() => handleUnarchiveTask(item)}
          onFinance={() => openQuickFinance(item)}
          onPin={() => (item.is_pinned ? handleUnpinTask(item) : handlePinTask(item))}
          isArchived={isTaskArchived(item)}
          canDelete={permissions.can_delete_files}
          canArchive={permissions.can_edit_file_details}
          canFinance={permissions.can_add_expenses || permissions.can_add_revenue}
          exchangeRate={organization?.usd_to_lbp_rate ?? 89500}
        />
      );
    },
    [allStatusColorsMap, statusLabels, navigation, handleArchiveTask, handleDeleteTask, handleUnarchiveTask, openQuickFinance, handlePinTask, handleUnpinTask, permissions]
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
          placeholder={t('searchPlaceholder')}
          placeholderTextColor={theme.color.textMuted}
        />
        <TouchableOpacity
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
          onPress={() => setShowFilters((v) => !v)}
        >
          <Text style={styles.filterBtnText}>
            {`⊟ ${t('filters')}${activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.globalSearchBtn}
          onPress={() => navigation.navigate('GlobalSearch')}
        >
          <Text style={styles.globalSearchBtnText}>🔍</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.globalSearchBtn}
          onPress={openActivity}
        >
          <View style={styles.bellWrap}>
            <Text style={styles.globalSearchBtnText}>🔔</Text>
            {unreadActivity > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadActivity > 99 ? '99+' : unreadActivity}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        {/* Help button */}
        <TouchableOpacity
          style={styles.helpBtn}
          onPress={() => { setWelcomeNeverShow(false); setShowWelcome(true); }}
        >
          <Text style={styles.helpBtnText}>?</Text>
        </TouchableOpacity>
      </View>

      {/* My Files / All Files toggle */}
      <View style={styles.myFilesToggle}>
        <TouchableOpacity
          style={[styles.myFilesBtn, filters.teamMemberId === (teamMember?.id ?? '') && teamMember?.id && styles.myFilesBtnActive]}
          onPress={() => setFilters((f) => ({ ...f, teamMemberId: teamMember?.id ?? '' }))}
        >
          <Text style={[styles.myFilesBtnText, filters.teamMemberId === (teamMember?.id ?? '') && teamMember?.id && styles.myFilesBtnTextActive]}>
            {t('myFiles')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.myFilesBtn, !filters.teamMemberId && styles.myFilesBtnActive]}
          onPress={() => setFilters((f) => ({ ...f, teamMemberId: '' }))}
        >
          <Text style={[styles.myFilesBtnText, !filters.teamMemberId && styles.myFilesBtnTextActive]}>
            {t('allFiles')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Expanded filter panel */}
      {showFilters && (
        <View style={styles.filterPanel}>
          {/* Overdue filter */}
          <Text style={styles.filterSectionLabel}>STATUS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, !filters.overdueOnly && styles.chipActive]}
              onPress={() => setFilters((f) => ({ ...f, overdueOnly: false }))}
            >
              <Text style={[styles.chipText, !filters.overdueOnly && styles.chipTextActive]}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, filters.overdueOnly && styles.chipOverdue]}
              onPress={() => setFilters((f) => ({ ...f, overdueOnly: !f.overdueOnly }))}
            >
              <Text style={[styles.chipText, filters.overdueOnly && styles.chipTextOverdue]}>⚠ Overdue</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Service filter — only services present in current task set */}
          <Text style={styles.filterSectionLabel}>
            SERVICE{filters.serviceIds.length > 0 ? ` (${filters.serviceIds.length})` : ''}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, filters.serviceIds.length === 0 && styles.chipActive]}
              onPress={() => setFilters((f) => ({ ...f, serviceIds: [] }))}
            >
              <Text style={[styles.chipText, filters.serviceIds.length === 0 && styles.chipTextActive]}>All</Text>
            </TouchableOpacity>
            {availableServices.map((sv) => {
              const selected = filters.serviceIds.includes(sv.id);
              return (
                <TouchableOpacity
                  key={sv.id}
                  style={[styles.chip, selected && styles.chipActive]}
                  onPress={() => setFilters((f) => ({
                    ...f,
                    serviceIds: selected
                      ? f.serviceIds.filter((id) => id !== sv.id)
                      : [...f.serviceIds, sv.id],
                  }))}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                    {sv.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* City filter — only cities present in current task set */}
          {availableCities.length > 0 && (
            <>
              <Text style={styles.filterSectionLabel}>
                CITY{filters.cityIds.length > 0 ? ` (${filters.cityIds.length})` : ''}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, filters.cityIds.length === 0 && styles.chipActive]}
                  onPress={() => setFilters((f) => ({ ...f, cityIds: [] }))}
                >
                  <Text style={[styles.chipText, filters.cityIds.length === 0 && styles.chipTextActive]}>All</Text>
                </TouchableOpacity>
                {availableCities.map((c) => {
                  const selected = filters.cityIds.includes(c.id);
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.chip, selected && styles.chipActive]}
                      onPress={() => setFilters((f) => ({
                        ...f,
                        cityIds: selected
                          ? f.cityIds.filter((id) => id !== c.id)
                          : [...f.cityIds, c.id],
                      }))}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}
        </View>
      )}

      {/* Active / Archive toggle */}
      <View style={styles.resultRow}>
        <TouchableOpacity
          style={[styles.archiveTab, !showArchived && styles.archiveTabActive]}
          onPress={() => setShowArchived(false)}
        >
          <Text style={[styles.archiveTabText, !showArchived && styles.archiveTabTextActive]}>
            {t('activeTab')} ({activeTasks.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.archiveTab, showArchived && styles.archiveTabActiveArchive]}
          onPress={() => setShowArchived(true)}
        >
          <Text style={[styles.archiveTabText, showArchived && styles.archiveTabTextActive]}>
            {t('archiveTab')} ({archivedTasks.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Summary bar */}
      {!showArchived && summaryStats.active > 0 && (
        <View style={styles.summaryBar}>
          <Text style={styles.summaryItem}>Active: {summaryStats.active}</Text>
          <Text style={styles.summaryDot}> · </Text>
          <Text style={[styles.summaryItem, summaryStats.overdue > 0 && styles.summaryDanger]}>
            Overdue: {summaryStats.overdue}
          </Text>
          {permissions.can_see_contract_price && (summaryStats.dueUSD > 0 || summaryStats.dueLBP > 0) && (
            <>
              <Text style={styles.summaryDot}> · </Text>
              <Text style={[styles.summaryItem, styles.summaryPrimary]}>
                Due{summaryStats.dueUSD > 0 ? ` $${summaryStats.dueUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : ''}{summaryStats.dueUSD > 0 && summaryStats.dueLBP > 0 ? ', ' : ''}{summaryStats.dueLBP > 0 ? `${summaryStats.dueLBP.toLocaleString('en-US', { maximumFractionDigits: 0 })} LBP` : ''}
              </Text>
            </>
          )}
        </View>
      )}

      {/* Task list — active tasks first, then archive divider, then archived tasks */}
      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
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
        windowSize={5}
        maxToRenderPerBatch={10}
        initialNumToRender={12}
        getItemLayout={(_data, index) => ({
          length: TASK_ROW_HEIGHT,
          offset: TASK_ROW_HEIGHT * index,
          index,
        })}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>⊞</Text>
            <Text style={styles.emptyText}>{t('noFilesFound')}</Text>
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
                <Text style={styles.qfTitle}>{t('quickFinance')}</Text>
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
                  ↑ {t('expense')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.qfTypeBtn, quickTxType === 'revenue' && styles.qfTypeBtnRevenue]}
                onPress={() => setQuickTxType('revenue')}
              >
                <Text style={[styles.qfTypeBtnText, quickTxType === 'revenue' && styles.qfTypeBtnTextRevenue]}>
                  ↓ {t('revenue')}
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

            {/* Stage link (expenses only) */}
            {quickTxType === 'expense' && quickFinanceTask?.route_stops && quickFinanceTask.route_stops.length > 0 && (
              <View style={{ marginBottom: 8 }}>
                <TouchableOpacity
                  style={styles.qfStageTrigger}
                  onPress={() => setShowQuickStagePicker(v => !v)}
                >
                  <Text style={styles.qfStageTriggerText}>
                    {quickTxStopId
                      ? `📌 ${quickFinanceTask.route_stops!.find(rs => rs.id === quickTxStopId)?.ministry?.name ?? 'Stage'}`
                      : '📌 Link to stage (optional)'}
                  </Text>
                  {quickTxStopId && (
                    <TouchableOpacity onPress={() => { setQuickTxStopId(null); setShowQuickStagePicker(false); }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <Text style={{ color: theme.color.danger, fontSize: 13, paddingStart: 8 }}>✕</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
                {showQuickStagePicker && (
                  <View style={styles.qfStageDropdown}>
                    {quickFinanceTask.route_stops!.map(rs => (
                      <TouchableOpacity key={rs.id}
                        style={[styles.qfStageItem, quickTxStopId === rs.id && styles.qfStageItemActive]}
                        onPress={() => { setQuickTxStopId(rs.id); setShowQuickStagePicker(false); }}>
                        <Text style={[styles.qfStageItemText, quickTxStopId === rs.id && { color: theme.color.primary, fontWeight: '700' }]}>
                          {rs.stop_order}. {rs.ministry?.name}
                        </Text>
                        {quickTxStopId === rs.id && <Text style={{ color: theme.color.primary }}>✓</Text>}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

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
                  Save {quickTxType === 'expense' ? t('expense') : t('revenue')}
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
              <Text style={styles.qfViewAllText}>{t('viewFinancials')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Quick Status Update Modal (long-press) ── */}
      <Modal
        visible={!!quickStatusTask}
        transparent
        animationType="slide"
        onRequestClose={() => setQuickStatusTask(null)}
      >
        <TouchableOpacity
          style={styles.qsOverlay}
          activeOpacity={1}
          onPress={() => setQuickStatusTask(null)}
        >
          <View style={styles.qsSheet}>
            <View style={styles.qsHandle} />
            <Text style={styles.qsTitle}>Update Status</Text>
            {quickStatusTask && (
              <Text style={styles.qsSubtitle} numberOfLines={1}>
                {quickStatusTask.client?.name} · {quickStatusTask.service?.name}
              </Text>
            )}
            <View style={styles.qsGrid}>
              {statusLabels.map((sl) => {
                const isCurrent = sl.label === quickStatusTask?.current_status;
                return (
                  <TouchableOpacity
                    key={sl.id}
                    style={[
                      styles.qsChip,
                      { borderColor: sl.color + '88', backgroundColor: sl.color + '18' },
                      isCurrent && { backgroundColor: sl.color, borderColor: sl.color },
                    ]}
                    onPress={() => applyQuickStatus(sl.label)}
                    disabled={savingQuickStatus || isCurrent}
                    activeOpacity={0.75}
                  >
                    {savingQuickStatus && isCurrent ? (
                      <ActivityIndicator size="small" color={theme.color.white} />
                    ) : (
                      <Text style={[styles.qsChipText, { color: isCurrent ? theme.color.white : sl.color }]}>
                        {isCurrent ? '✓ ' : ''}{sl.label}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={styles.qsCancelBtn} onPress={() => setQuickStatusTask(null)}>
              <Text style={styles.qsCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Welcome / Help overlay ── */}
      <Modal visible={showWelcome} transparent animationType="fade" onRequestClose={closeWelcome}>
        <View style={styles.welcomeOverlay}>
          <View style={styles.welcomeCard}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: theme.spacing.space4 }}>
              {/* Title */}
              <Text style={styles.welcomeTitle}>👋 Welcome to GovPilot</Text>
              <Text style={styles.welcomeSubtitle}>
                Before you can work on cases in the dashboard, you'll need to set up your workspace. Follow the steps below to get started.
              </Text>

              {/* Steps */}
              {([
                { n: '1', icon: '➕', title: 'Open the Create window',        body: 'Click the Create button at the bottom of the page to open the setup panel.',             action: () => goToCreateSection() },
                { n: '2', icon: '👤', title: 'Add your clients',               body: 'Insert the clients that will be associated with your files and cases.',                  action: () => goToCreateSection('clients') },
                { n: '3', icon: '⚙️', title: 'Define services',                body: 'Add the services offered. These will be available when filling out files on the dashboard.', action: () => goToCreateSection('services') },
                { n: '4', icon: '🗂️', title: 'Configure stages & other entries', body: 'Set up workflow stages and any additional required entries for your organization.',    action: () => goToCreateSection('stages') },
                { n: '5', icon: '🏠', title: 'Return to the dashboard',        body: 'Once setup is complete, head back to the dashboard to begin creating and filling your files.', action: null },
              ] as const).map((step) => (
                <View key={step.n} style={styles.welcomeStep}>
                  <View style={styles.welcomeStepNum}>
                    <Text style={styles.welcomeStepNumText}>{step.n}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    {step.action ? (
                      <TouchableOpacity onPress={step.action} activeOpacity={0.7}>
                        <Text style={[styles.welcomeStepTitle, styles.welcomeStepLink]}>
                          {step.icon}  {step.title}  ›
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.welcomeStepTitle}>{step.icon}  {step.title}</Text>
                    )}
                    <Text style={styles.welcomeStepBody}>{step.body}</Text>
                  </View>
                </View>
              ))}

              {/* Ready banner */}
              <View style={styles.welcomeReady}>
                <Text style={styles.welcomeReadyText}>✅  You're ready to go!</Text>
              </View>

              {/* Never show again */}
              <TouchableOpacity
                style={styles.welcomeCheckRow}
                onPress={() => setWelcomeNeverShow((v) => !v)}
                activeOpacity={0.7}
              >
                <View style={[styles.welcomeCheckBox, welcomeNeverShow && styles.welcomeCheckBoxTicked]}>
                  {welcomeNeverShow && <Text style={styles.welcomeCheckMark}>✓</Text>}
                </View>
                <Text style={styles.welcomeCheckLabel}>
                  Don't show this welcome screen again
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Close button */}
            <TouchableOpacity style={styles.welcomeCloseBtn} onPress={closeWelcome}>
              <Text style={styles.welcomeCloseBtnText}>Got it  →</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  archiveTab: {
    flex:            1,
    paddingVertical: theme.spacing.space2,
    alignItems:      'center',
    borderRadius:    theme.radius.md,
    backgroundColor: theme.color.bgSurface,
    marginHorizontal: 4,
  },
  archiveTabActive: {
    backgroundColor: theme.color.primary,
  },
  archiveTabActiveArchive: {
    backgroundColor: '#78350f',
  },
  archiveTabText: {
    ...theme.typography.label,
    color:      theme.color.textMuted,
    fontWeight: '700',
  },
  archiveTabTextActive: {
    color: theme.color.white,
  },
  resultRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   theme.spacing.space2 + 2,
  },
  // (service sheet removed — service name now navigates to TaskDetail)
  _placeholder: {
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
  qfStageTrigger: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.sm,
    borderWidth:     1,
    borderColor:     theme.color.border,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   8,
  },
  qfStageTriggerText: { ...theme.typography.caption, color: theme.color.textSecondary, flex: 1 },
  qfStageDropdown: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.sm,
    borderWidth:     1,
    borderColor:     theme.color.border,
    marginTop:       4,
    overflow:        'hidden',
  },
  qfStageItem: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   10,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  qfStageItemActive:   { backgroundColor: theme.color.primary + '11' },
  qfStageItemText:     { ...theme.typography.body, color: theme.color.textPrimary, flex: 1 },
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
  chipOverdue: {
    backgroundColor: '#7f1d1d',
    borderColor: theme.color.danger,
  },
  chipTextOverdue: {
    color: theme.color.danger,
    fontWeight: '700',
  },
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
  bellWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  bellBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: theme.color.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: theme.color.bgBase,
  },
  bellBadgeText: { color: theme.color.white, fontSize: 10, fontWeight: '800' },

  // My Files / All Files toggle
  myFilesToggle: {
    flexDirection:     'row',
    marginHorizontal:  theme.spacing.space4,
    marginVertical:    theme.spacing.space2 + 2,
    backgroundColor:   theme.color.bgSurface,
    borderRadius:      theme.radius.lg,
    borderWidth:       1,
    borderColor:       theme.color.border,
    overflow:          'hidden',
  },
  myFilesBtn: {
    flex:            1,
    paddingVertical: theme.spacing.space2 + 2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  myFilesBtnActive: {
    backgroundColor: theme.color.primary,
  },
  myFilesBtnText: {
    ...theme.typography.label,
    color:      theme.color.textMuted,
    fontWeight: '700',
  },
  myFilesBtnTextActive: {
    color: theme.color.white,
  },

  // Quick Status bottom sheet
  qsOverlay: {
    flex: 1,
    backgroundColor: theme.color.overlayDark,
    justifyContent: 'flex-end',
  },
  qsSheet: {
    backgroundColor: theme.color.bgSurface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: theme.spacing.space5,
    gap: 16,
    paddingBottom: 40,
  },
  qsHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.color.border,
    alignSelf: 'center',
    marginBottom: 4,
  },
  qsTitle: {
    ...theme.typography.heading,
    fontSize: 20,
    fontWeight: '700',
  },
  qsSubtitle: {
    ...theme.typography.body,
    color: theme.color.textSecondary,
  },
  qsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  qsChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
  },
  qsChipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  qsCancelBtn: {
    alignItems: 'center',
    paddingVertical: 6,
    marginTop: 4,
  },
  qsCancelText: {
    ...theme.typography.body,
    color: theme.color.textMuted,
  },

  // Select mode
  selectModeBtn: {
    alignSelf: 'flex-end',
    marginHorizontal: theme.spacing.space4,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.bgSurface,
  },
  selectModeBtnText: { ...theme.typography.caption, color: theme.color.textMuted, fontWeight: '700' },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.space4,
    marginBottom: theme.spacing.space2,
    gap: 10,
  },
  selectRowActive: {
    backgroundColor: theme.color.primary + '10',
    borderRadius: theme.radius.lg,
  },
  selectCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.color.border,
    backgroundColor: theme.color.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectCheckActive: {
    borderColor: theme.color.primary,
    backgroundColor: theme.color.primary,
  },
  selectCheckMark: { color: theme.color.white, fontSize: 13, fontWeight: '800' },

  // Bulk action bar
  bulkBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.color.bgSurface,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    paddingHorizontal: theme.spacing.space4,
    paddingVertical: theme.spacing.space3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 32,
  },
  bulkCount: { ...theme.typography.body, color: theme.color.textSecondary, fontWeight: '700' },
  bulkActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  bulkActionBtn: {
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  bulkActionBtnText: { color: theme.color.white, fontWeight: '700', fontSize: 13 },
  bulkCancelBtn: {
    backgroundColor: theme.color.bgBase,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  bulkCancelBtnText: { color: theme.color.textMuted, fontWeight: '700', fontSize: 13 },

  // ── Help button ──────────────────────────────────────────────
  helpBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.color.bgSurface,
    borderWidth: 1,
    borderColor: theme.color.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpBtnText: {
    color: theme.color.primary,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },

  // ── Welcome overlay ──────────────────────────────────────────
  welcomeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.space4,
  },
  welcomeCard: {
    backgroundColor: theme.color.bgSurface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.space5,
    width: '100%',
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: theme.color.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.color.textPrimary,
    marginBottom: theme.spacing.space2,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: theme.color.textSecondary,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: theme.spacing.space4,
  },
  welcomeStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.space3,
    marginBottom: theme.spacing.space3,
    backgroundColor: theme.color.bgBase,
    borderRadius: theme.radius.md,
    padding: theme.spacing.space3,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  welcomeStepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.color.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  welcomeStepNumText: {
    color: theme.color.white,
    fontSize: 13,
    fontWeight: '800',
  },
  welcomeStepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.color.textPrimary,
    marginBottom: 3,
  },
  welcomeStepLink: {
    color: theme.color.primary,
    textDecorationLine: 'underline',
  },
  welcomeStepBody: {
    fontSize: 12,
    color: theme.color.textSecondary,
    lineHeight: 17,
  },
  welcomeReady: {
    backgroundColor: '#064e3b',
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.space2 + 2,
    paddingHorizontal: theme.spacing.space3,
    marginTop: theme.spacing.space2,
    marginBottom: theme.spacing.space4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.color.success,
  },
  welcomeReadyText: {
    color: theme.color.success,
    fontSize: 14,
    fontWeight: '700',
  },
  welcomeCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.space2 + 2,
    marginBottom: theme.spacing.space4,
    paddingHorizontal: 2,
  },
  welcomeCheckBox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: theme.color.border,
    backgroundColor: theme.color.bgBase,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  welcomeCheckBoxTicked: {
    borderColor: theme.color.primary,
    backgroundColor: theme.color.primary,
  },
  welcomeCheckMark: {
    color: theme.color.white,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 16,
  },
  welcomeCheckLabel: {
    flex: 1,
    fontSize: 12,
    color: theme.color.textSecondary,
    lineHeight: 17,
  },
  welcomeCloseBtn: {
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.space3,
    alignItems: 'center',
    marginTop: theme.spacing.space2,
  },
  welcomeCloseBtnText: {
    color: theme.color.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
