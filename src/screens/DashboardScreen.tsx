// src/screens/DashboardScreen.tsx
// Main dashboard: filterable task list with realtime updates

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  Switch,
  I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
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
type ManageSection = 'clients' | 'services' | 'stages' | null;

const SWIPE_ACTION_WIDTH = 130; // left-swipe: Edit + Delete
const FINANCE_ACTION_WIDTH = 80;  // right-swipe: Add Financial

function SwipeableTaskRow({
  task,
  statusColor,
  allStatusColors,
  onPress,
  onClientPress,
  onEdit,
  onDelete,
  onFinance,
}: {
  task: Task;
  statusColor: string;
  allStatusColors: Record<string, string>;
  onPress: () => void;
  onClientPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFinance: () => void;
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

      {/* Left-swipe: Edit + Delete actions (right side) — hidden at rest */}
      <Animated.View style={[swipeStyles.actions, { opacity: actionsOpacity }]}>
        <TouchableOpacity
          style={swipeStyles.editBtn}
          onPress={() => { close(); onEdit(); }}
        >
          <Text style={swipeStyles.editBtnText}>✎{'\n'}Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={swipeStyles.deleteBtn}
          onPress={() => { close(); onDelete(); }}
        >
          <Text style={swipeStyles.deleteBtnText}>✕{'\n'}Delete</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Swipeable card */}
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <TaskCard
          task={task}
          statusColor={statusColor}
          allStatusColors={allStatusColors}
          onPress={() => { if (isOpen.current) { close(); } else { onPress(); } }}
          onClientPress={onClientPress}
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
});

interface Filters {
  search: string;
  teamMemberId: string;
  ministryId: string;
  statusLabel: string;
  cityId: string;
  dateFilter: 'all' | 'overdue' | 'today' | 'week';
  showArchived: boolean;
}

const DATE_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
] as const;

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
    teamMemberId: '',
    ministryId: '',
    statusLabel: '',
    cityId: '',
    dateFilter: 'all',
    showArchived: false,
  });
  const [showFilters, setShowFilters] = useState(false);

  const [services, setServices] = useState<Service[]>([]);

  // New client modal
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientRefName, setNewClientRefName] = useState('');
  const [newClientRefPhone, setNewClientRefPhone] = useState('');
  const [savingClient, setSavingClient] = useState(false);

  // Management menu
  const [manageSection, setManageSection] = useState<ManageSection>(null);

  // Manage clients
  const [editClientId, setEditClientId] = useState<string | null>(null);
  const [editClientName, setEditClientName] = useState('');
  const [editClientPhone, setEditClientPhone] = useState('');
  const [savingEditClient, setSavingEditClient] = useState(false);

  // Manage services
  const [newSvcName, setNewSvcName] = useState('');
  const [newSvcPriceUSD, setNewSvcPriceUSD] = useState('');
  const [newSvcPriceLBP, setNewSvcPriceLBP] = useState('');
  const [savingNewSvc, setSavingNewSvc] = useState(false);
  const [editSvcId, setEditSvcId] = useState<string | null>(null);
  const [editSvcName, setEditSvcName] = useState('');
  const [editSvcPriceUSD, setEditSvcPriceUSD] = useState('');
  const [editSvcPriceLBP, setEditSvcPriceLBP] = useState('');
  const [savingEditSvc, setSavingEditSvc] = useState(false);

  // Manage stages (ministries)
  const [newStageName, setNewStageName] = useState('');
  const [savingNewStage, setSavingNewStage] = useState(false);
  const [editStageId, setEditStageId] = useState<string | null>(null);
  const [editStageName, setEditStageName] = useState('');
  const [savingEditStage, setSavingEditStage] = useState(false);

  // Quick-add financial transaction (swipe right)
  const [showQuickFinance, setShowQuickFinance] = useState(false);
  const [quickFinanceTask, setQuickFinanceTask] = useState<Task | null>(null);
  const [quickTxType, setQuickTxType] = useState<'expense' | 'revenue'>('expense');
  const [quickTxDesc, setQuickTxDesc] = useState('');
  const [quickTxUSD, setQuickTxUSD] = useState('');
  const [quickTxLBP, setQuickTxLBP] = useState('');
  const [savingQuickTx, setSavingQuickTx] = useState(false);

  // Search within manage modals
  const [clientSearch, setClientSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [stageSearch, setStageSearch] = useState('');

  // Manage dropdown + full client form
  const [showManageMenu, setShowManageMenu] = useState(false);
  const [showClientForm, setShowClientForm] = useState(false);
  const [clientFormFieldDefs, setClientFormFieldDefs] = useState<any[]>([]);
  const [clientFormFieldValues, setClientFormFieldValues] = useState<Record<string, string>>({});
  const [loadingClientFields, setLoadingClientFields] = useState(false);

  // Date picker modal for date fields
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentDateField, setCurrentDateField] = useState<string | null>(null);
  const [showMonthYearPicker, setShowMonthYearPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [calCurrentDate, setCalCurrentDate] = useState<string | undefined>(undefined);


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
          `*, client:clients(*), service:services(*), assignee:team_members!assigned_to(*), route_stops:task_route_stops(*, ministry:ministries(*)), city:cities(id,name)`
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

  // Apply filters
  const filteredTasks = tasks.filter((task) => {
    // Archive filter: a task is archived if DB flag is set OR all route stops are Done
    const stopsTotal = task.route_stops?.length ?? 0;
    const taskIsArchived =
      task.is_archived === true ||
      (stopsTotal > 0 && task.route_stops!.every((s) => s.status === 'Done'));
    if (!filters.showArchived && taskIsArchived) return false;
    if (filters.showArchived && !taskIsArchived) return false;

    if (
      filters.search &&
      !task.client?.name.toLowerCase().includes(filters.search.toLowerCase()) &&
      !task.service?.name.toLowerCase().includes(filters.search.toLowerCase())
    ) {
      return false;
    }
    if (filters.teamMemberId && task.assigned_to !== filters.teamMemberId) return false;
    if (filters.statusLabel && task.current_status !== filters.statusLabel) return false;
    if (filters.cityId && task.city_id !== filters.cityId) return false;
    if (filters.ministryId) {
      const hasMinistry = task.route_stops?.some((s) => s.ministry_id === filters.ministryId);
      if (!hasMinistry) return false;
    }
    if (filters.dateFilter !== 'all') {
      const due = task.due_date ? new Date(task.due_date) : null;
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 86400000 - 1);
      const endOfWeek = new Date(startOfDay.getTime() + 7 * 86400000);
      if (filters.dateFilter === 'overdue' && (!due || due >= startOfDay)) return false;
      if (filters.dateFilter === 'today' && (!due || due < startOfDay || due > endOfDay))
        return false;
      if (filters.dateFilter === 'week' && (!due || due < startOfDay || due > endOfWeek))
        return false;
    }
    return true;
  });

  const getStatusColor = (label: string) =>
    statusLabels.find((s) => s.label === label)?.color ?? theme.color.primary;

  const clientFileCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tasks) {
      counts[t.client_id] = (counts[t.client_id] ?? 0) + 1;
    }
    return counts;
  }, [tasks]);

  const openNewClientForm = async () => {
    setNewClientName('');
    setNewClientPhone('');
    setClientFormFieldValues({});
    setLoadingClientFields(true);
    setShowClientForm(true);
    const { data } = await supabase
      .from('client_field_definitions')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    setClientFormFieldDefs(data ?? []);
    setLoadingClientFields(false);
  };

  const handleCreateClientWithFields = async () => {
    if (!newClientName.trim()) { Alert.alert('Required', 'Client name is required.'); return; }
    setSavingClient(true);
    const autoId = `CLT-${Date.now()}`;
    const { data, error } = await supabase
      .from('clients')
      .insert({ name: newClientName.trim(), client_id: autoId, phone: newClientPhone.trim() || null, reference_name: newClientRefName.trim() || null, reference_phone: newClientRefPhone.trim() || null })
      .select()
      .single();
    if (error || !data) { setSavingClient(false); Alert.alert('Error', error?.message ?? 'Failed'); return; }
    const inserts: any[] = [];
    for (const def of clientFormFieldDefs) {
      const val = clientFormFieldValues[def.id];
      if (val !== undefined && val.trim() !== '') {
        inserts.push({ client_id: (data as any).id, field_id: def.id, value_text: val });
      }
    }
    if (inserts.length > 0) await supabase.from('client_field_values').insert(inserts);
    setSavingClient(false);
    setShowClientForm(false);
    setNewClientName(''); setNewClientPhone('');
    setNewClientRefName(''); setNewClientRefPhone('');
    setClientFormFieldValues({});
    fetchData();
  };

  const handleCreateClient = async () => {
    if (!newClientName.trim()) {
      Alert.alert('Required', 'Client name is required.');
      return;
    }
    setSavingClient(true);
    const autoId = `CLT-${Date.now()}`;
    const { data, error } = await supabase
      .from('clients')
      .insert({
        name: newClientName.trim(),
        client_id: autoId,
        phone: newClientPhone.trim() || null,
        reference_name: newClientRefName.trim() || null,
        reference_phone: newClientRefPhone.trim() || null,
      })
      .select()
      .single();
    setSavingClient(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setNewClientName(''); setNewClientPhone('');
    setNewClientRefName(''); setNewClientRefPhone('');
    setShowNewClient(false);
    navigation.navigate('ClientProfile', { clientId: (data as { id: string }).id });
  };

  // ── Manage clients CRUD ────────────────────────────────────
  const handleCreateClientInMgmt = async () => {
    if (!newClientName.trim()) { Alert.alert('Required', 'Client name is required.'); return; }
    setSavingClient(true);
    const autoId = `CLT-${Date.now()}`;
    await supabase.from('clients').insert({ name: newClientName.trim(), client_id: autoId, phone: newClientPhone.trim() || null, reference_name: newClientRefName.trim() || null, reference_phone: newClientRefPhone.trim() || null });
    setSavingClient(false);
    setNewClientName(''); setNewClientPhone('');
    setNewClientRefName(''); setNewClientRefPhone('');
    fetchData();
  };
  const handleSaveEditClient = async () => {
    if (!editClientId || !editClientName.trim()) return;
    setSavingEditClient(true);
    await supabase.from('clients').update({ name: editClientName.trim(), phone: editClientPhone.trim() || null }).eq('id', editClientId);
    setSavingEditClient(false);
    setEditClientId(null);
    fetchData();
  };
  const handleDeleteClient = (c: Client) => {
    Alert.alert('Delete Client', `Delete "${c.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await supabase.from('clients').delete().eq('id', c.id); fetchData(); } },
    ]);
  };

  // ── Manage services CRUD ────────────────────────────────────
  const handleCreateService = async () => {
    if (!newSvcName.trim()) { Alert.alert('Required', 'Service name is required.'); return; }
    setSavingNewSvc(true);
    await supabase.from('services').insert({ name: newSvcName.trim(), estimated_duration_days: 0, base_price_usd: parseFloat(newSvcPriceUSD) || 0, base_price_lbp: parseFloat(newSvcPriceLBP.replace(/,/g, '')) || 0 });
    setSavingNewSvc(false);
    setNewSvcName(''); setNewSvcPriceUSD(''); setNewSvcPriceLBP('');
    fetchData();
  };
  const handleSaveEditService = async () => {
    if (!editSvcId || !editSvcName.trim()) return;
    setSavingEditSvc(true);
    await supabase.from('services').update({ name: editSvcName.trim(), base_price_usd: parseFloat(editSvcPriceUSD) || 0, base_price_lbp: parseFloat(editSvcPriceLBP.replace(/,/g, '')) || 0 }).eq('id', editSvcId);
    setSavingEditSvc(false);
    setEditSvcId(null);
    fetchData();
  };
  const handleDeleteService = (sv: Service) => {
    Alert.alert('Delete Service', `Delete "${sv.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await supabase.from('services').delete().eq('id', sv.id); fetchData(); } },
    ]);
  };

  // ── Manage stages CRUD ──────────────────────────────────────
  const handleCreateStage = async () => {
    if (!newStageName.trim()) { Alert.alert('Required', 'Stage name is required.'); return; }
    setSavingNewStage(true);
    await supabase.from('ministries').insert({ name: newStageName.trim(), type: 'parent' });
    setSavingNewStage(false);
    setNewStageName('');
    fetchData();
  };
  const handleSaveEditStage = async () => {
    if (!editStageId || !editStageName.trim()) return;
    setSavingEditStage(true);
    await supabase.from('ministries').update({ name: editStageName.trim() }).eq('id', editStageId);
    setSavingEditStage(false);
    setEditStageId(null);
    fetchData();
  };
  const handleDeleteStage = (m: Ministry) => {
    Alert.alert('Delete Stage', `Delete "${m.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await supabase.from('ministries').delete().eq('id', m.id); fetchData(); } },
    ]);
  };

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
    Alert.alert('Delete File', `Delete "${label}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('tasks').delete().eq('id', task.id);
          fetchData();
        },
      },
    ]);
  };

  const activeFilterCount = [
    filters.teamMemberId,
    filters.ministryId,
    filters.statusLabel,
    filters.dateFilter !== 'all',
  ].filter(Boolean).length;

  // Stable named renderItem — avoids FlatList re-renders on every state change
  const allStatusColorsMap = useMemo(
    () => Object.fromEntries(statusLabels.map((sl) => [sl.label, sl.color])),
    [statusLabels]
  );

  const renderTaskRow = useCallback(
    ({ item }: { item: Task }) => (
      <SwipeableTaskRow
        task={item}
        statusColor={getStatusColor(item.current_status)}
        allStatusColors={allStatusColorsMap}
        onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })}
        onClientPress={() => navigation.navigate('ClientProfile', { clientId: item.client_id })}
        onEdit={() => navigation.navigate('TaskDetail', { taskId: item.id })}
        onDelete={() => handleDeleteTask(item)}
        onFinance={() => openQuickFinance(item)}
      />
    ),
    [allStatusColorsMap, statusLabels, navigation, handleDeleteTask, openQuickFinance]
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
      </View>

      {/* Management dropdown button */}
      <View style={styles.mgmtRow}>
        <TouchableOpacity style={styles.manageDropBtn} onPress={() => setShowManageMenu(true)} activeOpacity={0.75}>
          <Text style={styles.manageDropIcon}>⊙</Text>
          <Text style={styles.manageDropLabel}>Manage</Text>
          <View style={styles.manageDropBadges}>
            <Text style={styles.manageDropBadge}>{clients.length} clients</Text>
            <Text style={styles.manageDropBadge}>{services.length} services</Text>
            <Text style={styles.manageDropBadge}>{ministries.length} stages</Text>
          </View>
          <Text style={styles.manageDropChevron}>▾</Text>
        </TouchableOpacity>
      </View>

      {/* Expanded filter panel */}
      {showFilters && (
        <View style={styles.filterPanel}>
          {/* Team member filter */}
          <Text style={styles.filterSectionLabel}>TEAM MEMBER</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, !filters.teamMemberId && styles.chipActive]}
              onPress={() => setFilters((f) => ({ ...f, teamMemberId: '' }))}
            >
              <Text style={[styles.chipText, !filters.teamMemberId && styles.chipTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            {teamMembers.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.chip, filters.teamMemberId === m.id && styles.chipActive]}
                onPress={() =>
                  setFilters((f) => ({
                    ...f,
                    teamMemberId: f.teamMemberId === m.id ? '' : m.id,
                  }))
                }
              >
                <Text
                  style={[
                    styles.chipText,
                    filters.teamMemberId === m.id && styles.chipTextActive,
                  ]}
                >
                  {m.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Status filter */}
          <Text style={styles.filterSectionLabel}>STATUS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, !filters.statusLabel && styles.chipActive]}
              onPress={() => setFilters((f) => ({ ...f, statusLabel: '' }))}
            >
              <Text style={[styles.chipText, !filters.statusLabel && styles.chipTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            {statusLabels.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.chip,
                  filters.statusLabel === s.label && { backgroundColor: s.color + '33' },
                ]}
                onPress={() =>
                  setFilters((f) => ({
                    ...f,
                    statusLabel: f.statusLabel === s.label ? '' : s.label,
                  }))
                }
              >
                <Text
                  style={[
                    styles.chipText,
                    filters.statusLabel === s.label && { color: s.color, fontWeight: '700' },
                  ]}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* City filter */}
          <Text style={styles.filterSectionLabel}>CITY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, !filters.cityId && styles.chipActive]}
              onPress={() => setFilters((f) => ({ ...f, cityId: '' }))}
            >
              <Text style={[styles.chipText, !filters.cityId && styles.chipTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            {cities.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, filters.cityId === c.id && styles.chipActive]}
                onPress={() =>
                  setFilters((f) => ({
                    ...f,
                    cityId: f.cityId === c.id ? '' : c.id,
                  }))
                }
              >
                <Text style={[styles.chipText, filters.cityId === c.id && styles.chipTextActive]}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Date filter */}
          <Text style={styles.filterSectionLabel}>DATE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {DATE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.chip, filters.dateFilter === opt.key && styles.chipActive]}
                onPress={() => setFilters((f) => ({ ...f, dateFilter: opt.key }))}
              >
                <Text
                  style={[
                    styles.chipText,
                    filters.dateFilter === opt.key && styles.chipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Result count + action buttons */}
      <View style={styles.resultRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.resultCount}>
            {filteredTasks.length} file{filteredTasks.length !== 1 ? 's' : ''}
          </Text>
          <TouchableOpacity
            style={[styles.archiveToggle, filters.showArchived && styles.archiveToggleActive]}
            onPress={() => setFilters((f) => ({ ...f, showArchived: !f.showArchived }))}
          >
            <Text style={[styles.archiveToggleText, filters.showArchived && styles.archiveToggleTextActive]}>
              {filters.showArchived ? '📦 Archive' : '📋 Active'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.resultBtns}>
          <TouchableOpacity
            style={styles.newClientBtn}
            onPress={openNewClientForm}
            activeOpacity={0.8}
          >
            <Text style={styles.newClientBtnText}>+ New Client</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.newBtn}
            onPress={() => navigation.navigate('NewTask')}
            activeOpacity={0.8}
          >
            <Text style={styles.newBtnText}>+ New File</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Task list */}
      <FlatList
        data={filteredTasks}
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
                    {c.phone ? <Text style={styles.clientRowPhone}>{c.phone}</Text> : null}
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

      {/* ── MANAGE DROPDOWN MENU ── */}
      <Modal visible={showManageMenu} transparent animationType="fade" onRequestClose={() => setShowManageMenu(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowManageMenu(false)}>
          <View style={styles.menuSheet}>
            <Text style={styles.menuTitle}>MANAGE</Text>
            {[
              { key: 'clients' as ManageSection, icon: '👤', label: 'Clients', count: clients.length },
              { key: 'services' as ManageSection, icon: '⚙', label: 'Services', count: services.length },
              { key: 'stages' as ManageSection, icon: '◎', label: 'Stages', count: ministries.length },
            ].map((item, i) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.menuItem, i < 2 && styles.menuItemBorder]}
                onPress={() => { setShowManageMenu(false); setClientSearch(''); setServiceSearch(''); setStageSearch(''); setManageSection(item.key); }}
              >
                <Text style={styles.menuItemIcon}>{item.icon}</Text>
                <Text style={styles.menuItemLabel}>{item.label}</Text>
                <View style={styles.menuItemBadge}><Text style={styles.menuItemCount}>{item.count}</Text></View>
                <Text style={styles.menuItemArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── MANAGE CLIENTS MODAL ── */}
      <Modal
        visible={manageSection === 'clients'}
        transparent
        animationType="slide"
        onRequestClose={() => { setManageSection(null); setClientSearch(''); }}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={[styles.modalSheet, { maxHeight: '82%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Clients</Text>
                <Text style={styles.modalSubtitle}>
                  {clientSearch ? `${clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()) || (c.phone ?? '').includes(clientSearch)).length} of ${clients.length}` : `${clients.length} total`}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity style={styles.modalAddBtn} onPress={() => { setManageSection(null); setClientSearch(''); openNewClientForm(); }}>
                  <Text style={styles.modalAddBtnText}>+ New</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setManageSection(null); setClientSearch(''); }}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.mgmtSearchRow}>
              <TextInput
                style={styles.mgmtSearchInput}
                value={clientSearch}
                onChangeText={setClientSearch}
                placeholder="Search clients..."
                placeholderTextColor={theme.color.textMuted}
                clearButtonMode="while-editing"
                autoCorrect={false}
              />
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
              {clients.length === 0 ? (
                <Text style={styles.mgmtEmpty}>No clients yet.</Text>
              ) : clients.filter(c =>
                  !clientSearch.trim() ||
                  c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                  (c.phone ?? '').includes(clientSearch)
                ).length === 0 ? (
                <Text style={styles.mgmtEmpty}>No clients match "{clientSearch}"</Text>
              ) : clients.filter(c =>
                  !clientSearch.trim() ||
                  c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                  (c.phone ?? '').includes(clientSearch)
                ).map((c) => (
                <View key={c.id} style={styles.mgmtClientRow}>
                  <View style={styles.mgmtClientAvatar}>
                    <Text style={styles.mgmtClientAvatarText}>{c.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mgmtItemName}>{c.name}</Text>
                    {!!c.reference_name && (
                      <Text style={styles.mgmtItemRef}>via {c.reference_name}</Text>
                    )}
                    <Text style={styles.mgmtItemSub}>
                      {c.phone ? `${c.phone}  ·  ` : ''}{clientFileCounts[c.id] ?? 0} file{(clientFileCounts[c.id] ?? 0) !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.mgmtEditBtn}
                    onPress={() => { setManageSection(null); navigation.navigate('EditClient', { clientId: c.id }); }}
                  >
                    <Text style={styles.mgmtEditBtnText}>✎</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.mgmtDelBtn} onPress={() => handleDeleteClient(c)}>
                    <Text style={styles.mgmtDelBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── ADD NEW CLIENT FORM (with fields) ── */}
      <Modal
        visible={showClientForm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowClientForm(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={[styles.modalSheet, { maxHeight: '92%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Client</Text>
                <TouchableOpacity onPress={() => setShowClientForm(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
                <TextInput
                  style={styles.modalInput}
                  value={newClientName}
                  onChangeText={setNewClientName}
                  placeholder="Full name *"
                  placeholderTextColor={theme.color.textMuted}
                  autoFocus
                />
                <TextInput
                  style={styles.modalInput}
                  value={newClientPhone}
                  onChangeText={setNewClientPhone}
                  placeholder="Phone number"
                  placeholderTextColor={theme.color.textMuted}
                  keyboardType="phone-pad"
                />
                <Text style={styles.fieldsSectionLabel}>REFERENCE (OPTIONAL)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newClientRefName}
                  onChangeText={setNewClientRefName}
                  placeholder="Reference name"
                  placeholderTextColor={theme.color.textMuted}
                />
                <TextInput
                  style={styles.modalInput}
                  value={newClientRefPhone}
                  onChangeText={setNewClientRefPhone}
                  placeholder="Reference phone"
                  placeholderTextColor={theme.color.textMuted}
                  keyboardType="phone-pad"
                />
                {loadingClientFields ? (
                  <ActivityIndicator color={theme.color.primary} style={{ marginVertical: 20 }} />
                ) : clientFormFieldDefs.length > 0 ? (
                  <>
                    <Text style={styles.fieldsSectionLabel}>ADDITIONAL FIELDS</Text>
                    {clientFormFieldDefs.map((def) => (
                      <View key={def.id} style={{ marginBottom: 12 }}>
                        <Text style={styles.fieldDefLabel}>{def.label}{def.is_required ? ' *' : ''}</Text>
                        {def.field_type === 'boolean' ? (
                          <View style={styles.fieldBoolRow}>
                            <Text style={styles.fieldBoolText}>{clientFormFieldValues[def.id] === 'true' ? 'Yes' : 'No'}</Text>
                            <Switch
                              value={clientFormFieldValues[def.id] === 'true'}
                              onValueChange={(v) => setClientFormFieldValues((p) => ({ ...p, [def.id]: v ? 'true' : 'false' }))}
                              trackColor={{ false: theme.color.border, true: theme.color.primary }}
                              thumbColor={theme.color.white}
                            />
                          </View>
                        ) : def.field_type === 'select' && def.options?.length > 0 ? (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {(def.options as string[]).map((opt) => (
                              <TouchableOpacity
                                key={opt}
                                style={[styles.selectOption, clientFormFieldValues[def.id] === opt && styles.selectOptionActive]}
                                onPress={() => setClientFormFieldValues((p) => ({ ...p, [def.id]: opt }))}
                              >
                                <Text style={[styles.selectOptionText, clientFormFieldValues[def.id] === opt && styles.selectOptionTextActive]}>{opt}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        ) : def.field_type === 'date' ? (
                          <View>
                            <TouchableOpacity
                              style={styles.dateBtn}
                              onPress={() => {
                                if (currentDateField === def.id && showDatePicker) {
                                  setShowDatePicker(false);
                                  setCurrentDateField(null);
                                  setShowMonthYearPicker(false);
                                  setCalCurrentDate(undefined);
                                } else {
                                  setCurrentDateField(def.id);
                                  setShowMonthYearPicker(false);
                                  setCalCurrentDate(undefined);
                                  setShowDatePicker(true);
                                }
                              }}
                            >
                              <Text style={clientFormFieldValues[def.id] ? styles.dateBtnText : styles.dateBtnPlaceholder}>
                                {clientFormFieldValues[def.id] || `Select ${def.label}`}
                              </Text>
                              <Text style={styles.dateBtnIcon}>{currentDateField === def.id && showDatePicker ? '▲' : '📅'}</Text>
                            </TouchableOpacity>
                            {currentDateField === def.id && showDatePicker && (
                              <View style={styles.inlineCalendarContainer}>
                                {/* Month/Year quick-jump picker */}
                                {showMonthYearPicker ? (
                                  <View style={styles.monthYearPicker}>
                                    {/* Year navigation */}
                                    <View style={styles.monthYearPickerHeader}>
                                      <TouchableOpacity onPress={() => setPickerYear((y) => y - 1)} style={styles.monthYearArrow}>
                                        <Text style={styles.monthYearArrowText}>‹</Text>
                                      </TouchableOpacity>
                                      <TextInput
                                        style={styles.monthYearPickerYearInput}
                                        value={String(pickerYear)}
                                        onChangeText={(v) => {
                                          const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
                                          if (!isNaN(n)) setPickerYear(n);
                                          else if (v === '') setPickerYear(0);
                                        }}
                                        keyboardType="number-pad"
                                        maxLength={4}
                                        selectTextOnFocus
                                        placeholderTextColor={theme.color.textMuted}
                                      />
                                      <TouchableOpacity onPress={() => setPickerYear((y) => y + 1)} style={styles.monthYearArrow}>
                                        <Text style={styles.monthYearArrowText}>›</Text>
                                      </TouchableOpacity>
                                    </View>
                                    {/* Month grid */}
                                    <View style={styles.monthGrid}>
                                      {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((mon, idx) => (
                                        <TouchableOpacity
                                          key={mon}
                                          style={styles.monthGridItem}
                                          onPress={() => {
                                            const isoDate = `${pickerYear}-${String(idx + 1).padStart(2, '0')}-01`;
                                            setCalCurrentDate(isoDate);
                                            setShowMonthYearPicker(false);
                                          }}
                                        >
                                          <Text style={styles.monthGridItemText}>{mon}</Text>
                                        </TouchableOpacity>
                                      ))}
                                    </View>
                                  </View>
                                ) : (
                                <Calendar
                                  current={calCurrentDate ?? (
                                    clientFormFieldValues[def.id]
                                      ? (() => {
                                          const val = clientFormFieldValues[def.id];
                                          if (val?.includes('/')) {
                                            const [d, m, y] = val.split('/');
                                            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                                          }
                                          return val || undefined;
                                        })()
                                      : undefined
                                  )}
                                  onDayPress={(day) => {
                                    const [y, m, d] = day.dateString.split('-');
                                    setClientFormFieldValues((p) => ({ ...p, [def.id]: `${d}/${m}/${y}` }));
                                    setShowDatePicker(false);
                                    setCurrentDateField(null);
                                    setCalCurrentDate(undefined);
                                    setShowMonthYearPicker(false);
                                  }}
                                  onMonthChange={(date) => setCalCurrentDate(date.dateString)}
                                  renderHeader={(date) => {
                                    const d = typeof date === 'string' ? new Date(date) : date as any;
                                    const label = d?.toString ? d.toString('MMMM yyyy') : '';
                                    return (
                                      <TouchableOpacity
                                        onPress={() => {
                                          const year = typeof d?.getFullYear === 'function' ? d.getFullYear() : new Date().getFullYear();
                                          setPickerYear(year);
                                          setShowMonthYearPicker(true);
                                        }}
                                        style={styles.calHeaderBtn}
                                      >
                                        <Text style={styles.calHeaderText}>{label} ▾</Text>
                                      </TouchableOpacity>
                                    );
                                  }}
                                  markedDates={clientFormFieldValues[def.id] ? {
                                    [(() => {
                                      const val = clientFormFieldValues[def.id];
                                      if (val?.includes('/')) {
                                        const [d, m, y] = val.split('/');
                                        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                                      }
                                      return val || '';
                                    })()]: { selected: true, selectedColor: theme.color.primary },
                                  } : {}}
                                  theme={{
                                    backgroundColor: theme.color.bgBase,
                                    calendarBackground: theme.color.bgBase,
                                    textSectionTitleColor: theme.color.textMuted,
                                    selectedDayBackgroundColor: theme.color.primary,
                                    selectedDayTextColor: theme.color.white,
                                    todayTextColor: theme.color.primary,
                                    dayTextColor: theme.color.textPrimary,
                                    textDisabledColor: theme.color.textMuted,
                                    arrowColor: theme.color.primary,
                                    monthTextColor: theme.color.textPrimary,
                                    textDayFontWeight: '500',
                                    textMonthFontWeight: '700',
                                    textDayHeaderFontWeight: '600',
                                    textDayFontSize: 14,
                                    textMonthFontSize: 15,
                                    textDayHeaderFontSize: 12,
                                  }}
                                />
                                )}
                                {clientFormFieldValues[def.id] ? (
                                  <TouchableOpacity
                                    style={styles.clearDateBtn}
                                    onPress={() => {
                                      setClientFormFieldValues((p) => ({ ...p, [def.id]: '' }));
                                      setShowDatePicker(false);
                                      setCurrentDateField(null);
                                    }}
                                  >
                                    <Text style={styles.clearDateBtnText}>Clear Date</Text>
                                  </TouchableOpacity>
                                ) : null}
                              </View>
                            )}
                          </View>
                        ) : (
                          <TextInput
                            style={[styles.modalInput, def.field_type === 'textarea' && { height: 80, textAlignVertical: 'top' }]}
                            value={clientFormFieldValues[def.id] ?? ''}
                            onChangeText={(v) => setClientFormFieldValues((p) => ({ ...p, [def.id]: v }))}
                            placeholder={def.label}
                            placeholderTextColor={theme.color.textMuted}
                            multiline={def.field_type === 'textarea'}
                            keyboardType={
                              def.field_type === 'number' || def.field_type === 'currency' ? 'decimal-pad' :
                              def.field_type === 'phone' ? 'phone-pad' :
                              def.field_type === 'email' ? 'email-address' : 'default'
                            }
                          />
                        )}
                      </View>
                    ))}
                  </>
                ) : null}
                <TouchableOpacity
                  style={[styles.modalSaveBtn, savingClient && styles.modalSaveBtnDisabled]}
                  onPress={handleCreateClientWithFields}
                  disabled={savingClient}
                >
                  {savingClient ? <ActivityIndicator color={theme.color.white} size="small" /> : <Text style={styles.modalSaveBtnText}>Create Client</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── MANAGE SERVICES MODAL ── */}
      <Modal
        visible={manageSection === 'services'}
        transparent
        animationType="slide"
        onRequestClose={() => { setManageSection(null); setEditSvcId(null); setServiceSearch(''); }}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={[styles.modalSheet, { maxHeight: '90%' }]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Services</Text>
                  <Text style={styles.modalSubtitle}>
                    {serviceSearch ? `${services.filter(s => s.name.toLowerCase().includes(serviceSearch.toLowerCase())).length} of ${services.length}` : `${services.length} total`}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => { setManageSection(null); setEditSvcId(null); setServiceSearch(''); }}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.mgmtSearchRow}>
                <TextInput
                  style={styles.mgmtSearchInput}
                  value={serviceSearch}
                  onChangeText={setServiceSearch}
                  placeholder="Search services..."
                  placeholderTextColor={theme.color.textMuted}
                  clearButtonMode="while-editing"
                  autoCorrect={false}
                />
              </View>
              <ScrollView contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
                {/* Add new service */}
                <View style={styles.mgmtAddBlock}>
                  <Text style={styles.mgmtAddSectionLabel}>NEW SERVICE</Text>
                  <TextInput style={styles.modalInput} value={newSvcName} onChangeText={setNewSvcName} placeholder="Service name *" placeholderTextColor={theme.color.textMuted} />
                  <View style={styles.mgmtPriceRow}>
                    <TextInput style={[styles.modalInput, { flex: 1 }]} value={newSvcPriceUSD} onChangeText={setNewSvcPriceUSD} placeholder="Base price USD" placeholderTextColor={theme.color.textMuted} keyboardType="decimal-pad" />
                    <TextInput style={[styles.modalInput, { flex: 1 }]} value={newSvcPriceLBP} onChangeText={(v) => { const d = v.replace(/,/g, ''); if (d === '' || /^\d*$/.test(d)) setNewSvcPriceLBP(d === '' ? '' : parseInt(d, 10).toLocaleString('en-US')); }} placeholder="Base price LBP" placeholderTextColor={theme.color.textMuted} keyboardType="number-pad" />
                  </View>
                  <TouchableOpacity style={styles.mgmtAddBtn} onPress={handleCreateService} disabled={savingNewSvc}>
                    {savingNewSvc ? <ActivityIndicator color={theme.color.white} size="small" /> : <Text style={styles.mgmtAddBtnText}>+ Add Service</Text>}
                  </TouchableOpacity>
                </View>
                {services.filter(sv =>
                  !serviceSearch.trim() ||
                  sv.name.toLowerCase().includes(serviceSearch.toLowerCase())
                ).map((sv) => (
                  <View key={sv.id}>
                    {editSvcId === sv.id ? (
                      <View style={[styles.mgmtEditRow, { flexDirection: 'column', gap: 8 }]}>
                        <TextInput style={styles.modalInput} value={editSvcName} onChangeText={setEditSvcName} placeholder="Name" placeholderTextColor={theme.color.textMuted} autoFocus />
                        <View style={styles.mgmtPriceRow}>
                          <TextInput style={[styles.modalInput, { flex: 1 }]} value={editSvcPriceUSD} onChangeText={setEditSvcPriceUSD} placeholder="Price USD" placeholderTextColor={theme.color.textMuted} keyboardType="decimal-pad" />
                          <TextInput style={[styles.modalInput, { flex: 1 }]} value={editSvcPriceLBP} onChangeText={(v) => { const d = v.replace(/,/g, ''); if (d === '' || /^\d*$/.test(d)) setEditSvcPriceLBP(d === '' ? '' : parseInt(d, 10).toLocaleString('en-US')); }} placeholder="Price LBP" placeholderTextColor={theme.color.textMuted} keyboardType="number-pad" />
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity style={[styles.mgmtSaveBtn, { flex: 1 }]} onPress={handleSaveEditService} disabled={savingEditSvc}>
                            {savingEditSvc ? <ActivityIndicator color={theme.color.white} size="small" /> : <Text style={styles.mgmtSaveBtnText}>Save</Text>}
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.mgmtCancelBtn} onPress={() => setEditSvcId(null)}>
                            <Text style={styles.mgmtCancelBtnText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.mgmtItemRow}>
                        <TouchableOpacity
                          style={{ flex: 1 }}
                          onPress={() => { setManageSection(null); navigation.navigate('ServiceStages', { serviceId: sv.id, serviceName: sv.name }); }}
                        >
                          <Text style={[styles.mgmtItemName, { color: theme.color.primaryText }]}>{sv.name} ›</Text>
                          {(sv.base_price_usd > 0 || sv.base_price_lbp > 0) && (
                            <Text style={styles.mgmtItemPrice}>
                              {sv.base_price_usd > 0 ? `$${sv.base_price_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                              {sv.base_price_usd > 0 && sv.base_price_lbp > 0 ? '  ·  ' : ''}
                              {sv.base_price_lbp > 0 ? `ل.ل${sv.base_price_lbp.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : ''}
                            </Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.mgmtEditBtn} onPress={() => { setEditSvcId(sv.id); setEditSvcName(sv.name); setEditSvcPriceUSD(sv.base_price_usd > 0 ? String(sv.base_price_usd) : ''); setEditSvcPriceLBP(sv.base_price_lbp > 0 ? sv.base_price_lbp.toLocaleString('en-US') : ''); }}>
                          <Text style={styles.mgmtEditBtnText}>✎</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.mgmtDelBtn} onPress={() => handleDeleteService(sv)}>
                          <Text style={styles.mgmtDelBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
                {serviceSearch.trim() && services.filter(sv => sv.name.toLowerCase().includes(serviceSearch.toLowerCase())).length === 0 && (
                  <Text style={styles.mgmtEmpty}>No services match "{serviceSearch}"</Text>
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── MANAGE STAGES MODAL ── */}
      <Modal
        visible={manageSection === 'stages'}
        transparent
        animationType="slide"
        onRequestClose={() => { setManageSection(null); setEditStageId(null); setStageSearch(''); }}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={[styles.modalSheet, { maxHeight: '90%' }]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Stages</Text>
                  <Text style={styles.modalSubtitle}>
                    {stageSearch ? `${ministries.filter(m => m.name.toLowerCase().includes(stageSearch.toLowerCase())).length} of ${ministries.length}` : `${ministries.length} total`}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => { setManageSection(null); setEditStageId(null); setStageSearch(''); }}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.mgmtSearchRow}>
                <TextInput
                  style={styles.mgmtSearchInput}
                  value={stageSearch}
                  onChangeText={setStageSearch}
                  placeholder="Search stages..."
                  placeholderTextColor={theme.color.textMuted}
                  clearButtonMode="while-editing"
                  autoCorrect={false}
                />
              </View>
              <ScrollView contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
                {/* Add new stage */}
                <View style={[styles.mgmtAddBlock, { flexDirection: 'row', alignItems: 'flex-end', gap: 8 }]}>
                  <Text style={[styles.mgmtAddSectionLabel, { position: 'absolute', top: 14, left: 14 }]}>NEW STAGE</Text>
                  <TextInput style={[styles.modalInput, { flex: 1, marginTop: 20 }]} value={newStageName} onChangeText={setNewStageName} placeholder="Stage name *" placeholderTextColor={theme.color.textMuted} />
                  <TouchableOpacity style={styles.mgmtAddBtn} onPress={handleCreateStage} disabled={savingNewStage}>
                    {savingNewStage ? <ActivityIndicator color={theme.color.white} size="small" /> : <Text style={styles.mgmtAddBtnText}>+ Add</Text>}
                  </TouchableOpacity>
                </View>
                {ministries.filter(m =>
                  !stageSearch.trim() ||
                  m.name.toLowerCase().includes(stageSearch.toLowerCase())
                ).map((m) => (
                  <View key={m.id}>
                    {editStageId === m.id ? (
                      <View style={styles.mgmtEditRow}>
                        <TextInput style={[styles.modalInput, { flex: 1 }]} value={editStageName} onChangeText={setEditStageName} placeholder="Stage name" placeholderTextColor={theme.color.textMuted} autoFocus />
                        <TouchableOpacity style={styles.mgmtSaveBtn} onPress={handleSaveEditStage} disabled={savingEditStage}>
                          {savingEditStage ? <ActivityIndicator color={theme.color.white} size="small" /> : <Text style={styles.mgmtSaveBtnText}>Save</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.mgmtCancelBtn} onPress={() => setEditStageId(null)}>
                          <Text style={styles.mgmtCancelBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.mgmtItemRow}>
                        <Text style={[styles.mgmtItemName, { flex: 1 }]}>{m.name}</Text>
                        <TouchableOpacity
                          style={styles.mgmtReqBtn}
                          onPress={() => { setManageSection(null); navigation.navigate('MinistryRequirements', { ministryId: m.id, ministryName: m.name }); }}
                        >
                          <Text style={styles.mgmtReqBtnText}>📋 Req</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.mgmtEditBtn} onPress={() => { setEditStageId(m.id); setEditStageName(m.name); }}>
                          <Text style={styles.mgmtEditBtnText}>✎</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.mgmtDelBtn} onPress={() => handleDeleteStage(m)}>
                          <Text style={styles.mgmtDelBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
                {stageSearch.trim() && ministries.filter(m => m.name.toLowerCase().includes(stageSearch.toLowerCase())).length === 0 && (
                  <Text style={styles.mgmtEmpty}>No stages match "{stageSearch}"</Text>
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
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
  archiveToggle: {
    paddingHorizontal: theme.spacing.space2,
    paddingVertical:   3,
    borderRadius:      theme.radius.sm,
    borderWidth:       1,
    borderColor:       theme.color.border,
  },
  archiveToggleActive: {
    borderColor:      theme.color.warning,
    backgroundColor:  theme.color.warning + '22',
  },
  archiveToggleText: { ...theme.typography.caption, color: theme.color.textMuted },
  archiveToggleTextActive: { color: theme.color.warning, fontWeight: '700' },
  resultBtns: {
    flexDirection: 'row',
    gap:           theme.spacing.space2,
  },
  newClientBtn: {
    backgroundColor:   theme.color.bgSurface,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3 + 2,
    paddingVertical:   theme.spacing.space2 + 1,
    borderWidth:       1,
    borderColor:       theme.color.border,
  },
  newClientBtnText: {
    ...theme.typography.label,
    color:      theme.color.textSecondary,
    fontWeight: '700',
  },
  newBtn: {
    backgroundColor:   theme.color.primary,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   theme.spacing.space2 + 1,
    minHeight:         theme.touchTarget.min,
    justifyContent:    'center',
  },
  newBtnText: {
    ...theme.typography.label,
    color:      theme.color.white,
    fontWeight: '700',
  },
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

  // Management dropdown bar
  mgmtRow: {
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   theme.spacing.space2 + 2,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgSurface,
  },
  manageDropBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   theme.color.bgSurface,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3 + 2,
    paddingVertical:   theme.spacing.space2 + 3,
    gap:               theme.spacing.space2,
    borderWidth:       1,
    borderColor:       theme.color.border,
    minHeight:         theme.touchTarget.min,
  },
  manageDropIcon:    { fontSize: theme.icon.sm },
  manageDropLabel:   { ...theme.typography.label, color: theme.color.textPrimary, fontWeight: '700' },
  manageDropBadges:  { flex: 1, flexDirection: 'row', gap: theme.spacing.space1 + 2 },
  manageDropBadge: {
    ...theme.typography.caption,
    color:             theme.color.textMuted,
    backgroundColor:   theme.color.bgBase,
    paddingHorizontal: theme.spacing.space1 + 2,
    paddingVertical:   theme.spacing.space1 - 2,
    borderRadius:      theme.radius.sm,
    fontWeight:        '600',
    overflow:          'hidden',
  },
  manageDropChevron: { ...theme.typography.label, color: theme.color.primary, fontWeight: '700' },

  // Dropdown menu sheet
  menuOverlay: {
    flex:              1,
    backgroundColor:   theme.color.overlayDark,
    justifyContent:    'center',
    alignItems:        'center',
    paddingHorizontal: theme.spacing.space10,
    zIndex:            theme.zIndex.dropdown,
  },
  menuSheet: {
    backgroundColor: theme.color.bgElevated,
    borderRadius:    theme.radius.lg,
    width:           '100%',
    borderWidth:     1,
    borderColor:     theme.color.border,
    overflow:        'hidden',
    ...theme.shadow.modal,
  },
  menuTitle: {
    ...theme.typography.sectionDivider,
    paddingHorizontal: theme.spacing.space4 + 2,
    paddingTop:        theme.spacing.space3 + 2,
    paddingBottom:     theme.spacing.space2,
  },
  menuItem: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: theme.spacing.space4 + 2,
    paddingVertical:   theme.spacing.space3 + 3,
    gap:               theme.spacing.space3,
    minHeight:         theme.touchTarget.min,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  menuItemIcon:  { fontSize: theme.icon.md },
  menuItemLabel: { flex: 1, ...theme.typography.body, fontWeight: '600' },
  menuItemBadge: {
    backgroundColor:   theme.color.primaryDim,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space2,
    paddingVertical:   theme.spacing.space1 - 1,
  },
  menuItemCount: { ...theme.typography.label, color: theme.color.primaryText, fontWeight: '700' },
  menuItemArrow: { ...theme.typography.heading, color: theme.color.textMuted },

  // Client modal rows
  mgmtClientRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: theme.spacing.space3 + 2,
    paddingVertical:   theme.spacing.space3 + 1,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgBase,
    gap:               theme.spacing.space3,
    minHeight:         theme.touchTarget.min,
  },
  mgmtClientAvatar: {
    width:           38,
    height:          38,
    borderRadius:    theme.radius.full,
    backgroundColor: theme.color.primaryDim,
    borderWidth:     1,
    borderColor:     theme.color.primary + '55',
    justifyContent:  'center',
    alignItems:      'center',
  },
  mgmtClientAvatarText: { ...theme.typography.body, color: theme.color.primaryText, fontWeight: '800' },
  mgmtEmpty: { ...theme.typography.body, color: theme.color.textMuted, textAlign: 'center', padding: theme.spacing.space8 },

  // Modal subtitle + add button
  modalSubtitle: { ...theme.typography.caption, marginTop: theme.spacing.space1 - 2 },
  modalAddBtn: {
    backgroundColor:   theme.color.primaryDim,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space2 - 1,
    borderWidth:       1,
    borderColor:       theme.color.primary + '44',
    minHeight:         theme.touchTarget.min,
    justifyContent:    'center',
  },
  modalAddBtnText: { ...theme.typography.label, color: theme.color.primaryText, fontWeight: '700' },

  // Client form fields
  fieldsSectionLabel: {
    ...theme.typography.sectionDivider,
    marginTop:    theme.spacing.space2,
    marginBottom: theme.spacing.space3,
  },
  fieldDefLabel: { ...theme.typography.label, color: theme.color.textSecondary, marginBottom: theme.spacing.space1 + 2 },
  fieldBoolRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    backgroundColor:   theme.color.bgBase,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3 + 2,
    paddingVertical:   theme.spacing.space3,
    borderWidth:       1,
    borderColor:       theme.color.border,
  },
  fieldBoolText: { ...theme.typography.body, fontWeight: '600' },
  selectOption: {
    backgroundColor:   theme.color.bgBase,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3 + 2,
    paddingVertical:   theme.spacing.space2,
    marginEnd:         theme.spacing.space2,
    borderWidth:       1,
    borderColor:       theme.color.border,
  },
  selectOptionActive:     { borderColor: theme.color.primary, backgroundColor: theme.color.primaryDim },
  selectOptionText:       { ...theme.typography.label, color: theme.color.textMuted },
  selectOptionTextActive: { color: theme.color.primaryText },
  dateBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   theme.color.bgBase,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3 + 2,
    paddingVertical:   theme.spacing.space3,
    borderWidth:       1,
    borderColor:       theme.color.border,
    minHeight:         theme.touchTarget.min,
  },
  dateBtnText:        { ...theme.typography.body, flex: 1 },
  dateBtnPlaceholder: { ...theme.typography.body, color: theme.color.textMuted, flex: 1 },
  dateBtnIcon:        { fontSize: theme.icon.md },
  inlineCalendarContainer: {
    marginTop:       theme.spacing.space1 + 2,
    borderRadius:    theme.radius.lg,
    overflow:        'hidden',
    borderWidth:     1,
    borderColor:     theme.color.border,
    backgroundColor: theme.color.bgBase,
  },
  clearDateBtn: {
    margin:          theme.spacing.space3,
    backgroundColor: theme.color.border,
    borderRadius:    theme.radius.md,
    paddingVertical: theme.spacing.space3,
    alignItems:      'center',
  },
  clearDateBtnText: { ...theme.typography.body, fontWeight: '600' },

  // Month/year picker
  monthYearPicker: {
    padding: theme.spacing.space3,
    backgroundColor: theme.color.bgBase,
  },
  monthYearPickerHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   theme.spacing.space3,
  },
  monthYearPickerYearInput: {
    ...theme.typography.heading,
    color:           theme.color.textPrimary,
    borderBottomWidth: 2,
    borderBottomColor: theme.color.primary,
    minWidth:        64,
    textAlign:       'center',
    paddingVertical: theme.spacing.space1,
  },
  monthYearArrow: {
    padding: theme.spacing.space2,
  },
  monthYearArrowText: {
    fontSize: 24,
    color: theme.color.primary,
    fontWeight: '700',
    lineHeight: 28,
  },
  monthGrid: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            theme.spacing.space2,
  },
  monthGridItem: {
    width:           '22%',
    paddingVertical: theme.spacing.space2,
    borderRadius:    theme.radius.md,
    backgroundColor: theme.color.bgSurface,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  monthGridItemText: {
    ...theme.typography.label,
    color: theme.color.textPrimary,
  },
  calHeaderBtn: {
    paddingVertical: theme.spacing.space2,
    paddingHorizontal: theme.spacing.space3,
    alignSelf: 'center',
  },
  calHeaderText: {
    ...theme.typography.body,
    fontWeight: '700',
    color: theme.color.textPrimary,
  },

  // Services section label
  mgmtAddSectionLabel: {
    ...theme.typography.sectionDivider,
    marginBottom: theme.spacing.space2 + 2,
  },
  mgmtDivider:  { width: 0 },
  mgmtBtn:      { flex: 1 },
  mgmtBtnIcon:  { fontSize: theme.icon.sm },
  mgmtBtnLabel: { ...theme.typography.caption, color: theme.color.textSecondary, fontWeight: '700' },
  mgmtBtnCount: { ...theme.typography.caption, color: theme.color.primaryText },

  // Management modals shared
  mgmtAddRow:   { flexDirection: 'row', gap: theme.spacing.space2, padding: theme.spacing.space3 + 2, paddingBottom: theme.spacing.space2, alignItems: 'flex-end' },
  mgmtAddBlock: { padding: theme.spacing.space3 + 2, paddingBottom: theme.spacing.space2, gap: theme.spacing.space2 },
  mgmtPriceRow: { flexDirection: 'row', gap: theme.spacing.space2 },
  mgmtAddBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.md,
    paddingHorizontal: theme.spacing.space3 + 2,
    paddingVertical:   theme.spacing.space2 + 3,
    justifyContent:    'center',
    alignItems:        'center',
    minHeight:         theme.touchTarget.min,
  },
  mgmtAddBtnText: { ...theme.typography.label, color: theme.color.white, fontWeight: '700' },
  mgmtItemRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: theme.spacing.space3 + 2,
    paddingVertical:   theme.spacing.space3,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgBase,
    gap:               theme.spacing.space2,
    minHeight:         theme.touchTarget.min,
  },
  mgmtItemName:  { ...theme.typography.body, fontWeight: '600' },
  mgmtItemRef:   { ...theme.typography.caption, fontStyle: 'italic', marginTop: theme.spacing.space1 - 3 },
  mgmtItemSub:   { ...theme.typography.caption, marginTop: theme.spacing.space1 - 2 },
  mgmtItemPrice: { ...theme.typography.caption, color: theme.color.primary, fontWeight: '600', marginTop: theme.spacing.space1 - 2 },
  mgmtEditBtn: {
    backgroundColor:   theme.color.border,
    borderRadius:      theme.radius.sm,
    paddingHorizontal: theme.spacing.space2 + 2,
    paddingVertical:   theme.spacing.space1 + 2,
    minWidth:          theme.touchTarget.min,
    minHeight:         theme.touchTarget.min,
    justifyContent:    'center',
    alignItems:        'center',
  },
  mgmtEditBtnText: { ...theme.typography.body, color: theme.color.textSecondary },
  mgmtDelBtn: {
    backgroundColor:   theme.color.dangerDim,
    borderRadius:      theme.radius.sm,
    paddingHorizontal: theme.spacing.space2 + 2,
    paddingVertical:   theme.spacing.space1 + 2,
    minWidth:          theme.touchTarget.min,
    minHeight:         theme.touchTarget.min,
    justifyContent:    'center',
    alignItems:        'center',
  },
  mgmtDelBtnText: { ...theme.typography.caption, color: theme.color.danger + 'a5' },
  mgmtStagesBtn: {
    backgroundColor:   theme.color.primaryDim,
    borderRadius:      theme.radius.sm,
    paddingHorizontal: theme.spacing.space2 + 2,
    paddingVertical:   theme.spacing.space1 + 2,
    borderWidth:       1,
    borderColor:       theme.color.primary + '44',
    minHeight:         theme.touchTarget.min,
    justifyContent:    'center',
  },
  mgmtStagesBtnText: { ...theme.typography.caption, color: theme.color.primaryText, fontWeight: '700' },
  mgmtReqBtn: {
    backgroundColor:   theme.color.successDim,
    borderRadius:      theme.radius.sm,
    paddingHorizontal: theme.spacing.space2 + 2,
    paddingVertical:   theme.spacing.space1 + 2,
    borderWidth:       1,
    borderColor:       theme.color.success + '44',
    minHeight:         theme.touchTarget.min,
    justifyContent:    'center',
  },
  mgmtReqBtnText: { ...theme.typography.caption, color: theme.color.success, fontWeight: '700' },
  mgmtEditRow: {
    flexDirection:   'row',
    gap:             theme.spacing.space2,
    padding:         theme.spacing.space3 + 2,
    paddingVertical: theme.spacing.space2 + 2,
    backgroundColor: theme.color.bgBase,
    alignItems:      'center',
  },
  mgmtSaveBtn: {
    backgroundColor:   theme.color.success,
    borderRadius:      theme.radius.sm,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space2,
    alignItems:        'center',
    minHeight:         theme.touchTarget.min,
    justifyContent:    'center',
  },
  mgmtSaveBtnText:   { ...theme.typography.label, color: theme.color.white, fontWeight: '700' },
  mgmtCancelBtn: {
    backgroundColor:   theme.color.border,
    borderRadius:      theme.radius.sm,
    paddingHorizontal: theme.spacing.space2 + 2,
    paddingVertical:   theme.spacing.space2,
    minHeight:         theme.touchTarget.min,
    justifyContent:    'center',
  },
  mgmtCancelBtnText: { ...theme.typography.label, color: theme.color.textSecondary },

  // Search bar inside manage modals
  mgmtSearchRow: {
    paddingHorizontal: theme.spacing.space4,
    paddingTop:        theme.spacing.space2 + 2,
    paddingBottom:     theme.spacing.space1 + 2,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgSurface,
  },
  mgmtSearchInput: {
    backgroundColor:   theme.color.bgBase,
    color:             theme.color.textPrimary,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3 + 2,
    paddingVertical:   theme.spacing.space2 + 1,
    ...theme.typography.body,
    borderWidth:       1,
    borderColor:       theme.color.border,
  },

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
});
