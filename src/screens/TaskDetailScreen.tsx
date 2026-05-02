// src/screens/TaskDetailScreen.tsx
// Full task detail: route, status updates, comments, assignment, financials with edit

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
  Linking,
} from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Final closure stage — always last, auto-created, non-removable ─
const FINAL_STAGE_NAME = 'تسليم المعاملة النهائية و اغلاق الحسابات';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Calendar } from 'react-native-calendars';
import { WebView } from 'react-native-webview';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Speech-to-text removed (package caused Android Gradle duplicate-class errors).
// Voice note recording via expo-av still works.
const VoiceModule: any = null;
type SpeechResultsEvent = { value?: string[] };
type SpeechErrorEvent   = { error?: { message?: string } };
import supabase from '../lib/supabase';
import { theme } from '../theme';
import { useTranslation } from '../lib/i18n';
import { sendPushNotification, sendActivityNotificationToAll } from '../lib/notifications';
import { formatPhoneDisplay } from '../lib/phone';
import { useAuth } from '../hooks/useAuth';
import { useRealtime } from '../hooks/useRealtime';
import { useOfflineQueue } from '../store/offlineQueue';
import {
  Task,
  TaskComment,
  StatusLabel,
  TaskRouteStop,
  TeamMember,
  DashboardStackParamList,
  Ministry,
  Service,
  TaskPriceHistory,
  City,
} from '../types';
import StatusBadge from '../components/StatusBadge';
import RouteStop from '../components/RouteStop';
import DocumentScannerModal from '../components/DocumentScannerModal';

type DetailRoute = RouteProp<DashboardStackParamList, 'TaskDetail'>;
type Nav = NativeStackNavigationProp<DashboardStackParamList>;

interface FileTransaction {
  id: string;
  task_id: string;
  type: 'expense' | 'revenue';
  description: string;
  amount_usd: number;
  amount_lbp: number;
  stop_id?: string | null;
  stop?: { id: string; ministry?: { name: string } } | null;
  created_by?: string;
  creator?: { name: string };
  created_at: string;
}

interface TaskDocument {
  id: string;
  task_id: string;
  file_name: string;
  display_name?: string;
  file_url: string;
  file_type: string;
  uploaded_by?: string;
  uploader?: { name: string };
  requirement_id?: string;
  requirement?: { title: string };
  created_at: string;
}


function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// For date-only fields (YYYY-MM-DD) — parse without timezone to avoid day-shift
function formatDateOnly(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${parseInt(y)}`;
}

export default function TaskDetailScreen() {
  const route = useRoute<DetailRoute>();
  const navigation = useNavigation<Nav>();
  const { taskId } = route.params;
  const { teamMember, organization, permissions } = useAuth();
  const { isOnline, enqueue } = useOfflineQueue();
  const { t } = useTranslation();

  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [statusLabels, setStatusLabels] = useState<StatusLabel[]>([]);
  const [allMembers, setAllMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Status update states
  const [selectedStop, setSelectedStop] = useState<TaskRouteStop | null>(null);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [stopHistories, setStopHistories] = useState<Record<string, Array<{id: string; old_status?: string; new_status: string; updated_by?: string; updater?: TeamMember; created_at: string}>>>({});
  const [expandedStopHistory, setExpandedStopHistory] = useState<string | null>(null);
  const [updatingStop, setUpdatingStop] = useState<string | null>(null);
  // Rejection reason
  const [showRejectionInput, setShowRejectionInput] = useState(false);
  const [pendingRejectionStop, setPendingRejectionStop] = useState<TaskRouteStop | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Comment states
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState('');
  const [savingEditComment, setSavingEditComment] = useState(false);

  // Voice note states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingObj, setRecordingObj] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voicePartial, setVoicePartial] = useState('');
  const [playingCommentId, setPlayingCommentId] = useState<string | null>(null);
  const [soundObj, setSoundObj] = useState<Audio.Sound | null>(null);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Financial transaction states
  const [transactions, setTransactions] = useState<FileTransaction[]>([]);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [txType, setTxType] = useState<'expense' | 'revenue'>('expense');
  const [txDescription, setTxDescription] = useState('');
  const [txAmountUSD, setTxAmountUSD] = useState('');
  const [txAmountLBP, setTxAmountLBP] = useState('');
  const [savingTx, setSavingTx] = useState(false);
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null);
  const [txStopId, setTxStopId] = useState<string | null>(null);
  const [showTxStagePicker, setShowTxStagePicker] = useState(false);
  // Edit transaction
  const [editingTx, setEditingTx] = useState<FileTransaction | null>(null);
  const [editTxType, setEditTxType] = useState<'expense' | 'revenue'>('expense');
  const [editTxDescription, setEditTxDescription] = useState('');
  const [editTxAmountUSD, setEditTxAmountUSD] = useState('');
  const [editTxAmountLBP, setEditTxAmountLBP] = useState('');
  const [editTxStopId, setEditTxStopId] = useState<string | null>(null);
  const [showEditTxStagePicker, setShowEditTxStagePicker] = useState(false);
  const [savingEditTx, setSavingEditTx] = useState(false);

  // Contract price states
  const [contractPriceUSD, setContractPriceUSD] = useState(0);
  const [contractPriceLBP, setContractPriceLBP] = useState(0);
  const [priceHistory, setPriceHistory] = useState<Array<{id:string;old_price_usd:number;old_price_lbp:number;new_price_usd:number;new_price_lbp:number;note?:string;changer?:{name:string};created_at:string}>>([]);
  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const [showEditPrice, setShowEditPrice] = useState(false);
  const [editPriceUSD, setEditPriceUSD] = useState('');
  const [editPriceLBP, setEditPriceLBP] = useState('');
  const [editPriceNote, setEditPriceNote] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);

  // Edit stages states
  const [showEditStages, setShowEditStages] = useState(false);
  const [allStages, setAllStages] = useState<Ministry[]>([]);
  const [editingStops, setEditingStops] = useState<Ministry[]>([]);
  const [editStageCities, setEditStageCities] = useState<Record<string, { cityId: string | null; cityName: string | null }>>({});
  const [editCityPickerMiniId, setEditCityPickerMiniId] = useState<string | null>(null);
  const [editCitySearch, setEditCitySearch] = useState('');
  const [editCreateCityOpen, setEditCreateCityOpen] = useState(false);
  const [savingStages, setSavingStages] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [savingNewStage, setSavingNewStage] = useState(false);
  const [showNewStageInEdit, setShowNewStageInEdit] = useState(false);
  const [editStageSearch, setEditStageSearch] = useState('');

  // Edit task states
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [showEditTask, setShowEditTask] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [showDueDateCalendar, setShowDueDateCalendar] = useState(false);
  const [editServiceId, setEditServiceId] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // File-level assignment
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [savingAssignee, setSavingAssignee] = useState(false);

  // Document archive states
  const [documents, setDocuments] = useState<TaskDocument[]>([]);
  const [scanMode, setScanMode] = useState<'camera' | 'library' | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [renamingDoc, setRenamingDoc] = useState<TaskDocument | null>(null);
  const [renameText, setRenameText] = useState('');
  const [printingDoc, setPrintingDoc] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<TaskDocument | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [duplicating, setDuplicating] = useState(false);

  // Exchange rate — initialized from org setting, user can override locally for this session
  const orgRate = organization?.usd_to_lbp_rate ?? 89500;
  const [exchangeRate, setExchangeRate] = useState(orgRate);
  const [editingRate, setEditingRate]   = useState(false);
  const [rateInput, setRateInput]       = useState(orgRate.toLocaleString('en-US'));

  // Per-stage city / assignee
  const [allCities, setAllCities] = useState<City[]>([]);
  const [extAssignees, setExtAssignees] = useState<any[]>([]);
  const [openCityStopId, setOpenCityStopId] = useState<string | null>(null);
  const [stopCitySearch, setStopCitySearch] = useState('');
  const [openAssigneeStopId, setOpenAssigneeStopId] = useState<string | null>(null);
  const [stopAssigneeSearch, setStopAssigneeSearch] = useState('');
  const [savingStopField, setSavingStopField] = useState<string | null>(null);
  const [showCreateExtForm, setShowCreateExtForm] = useState(false);
  const [newExtName, setNewExtName] = useState('');
  const [newExtPhone, setNewExtPhone] = useState('');
  const [newExtReference, setNewExtReference] = useState('');
  const [savingExtAssignee, setSavingExtAssignee] = useState(false);
  const [pinnedCityIds, setPinnedCityIds] = useState<string[]>([]);
  const [showCreateCityForm, setShowCreateCityForm] = useState(false);
  const [newCityName, setNewCityName] = useState('');
  const [savingCity, setSavingCity] = useState(false);
  const [stopDueDatePickerStopId, setStopDueDatePickerStopId] = useState<string | null>(null);
  const [savingStopDueDate, setSavingStopDueDate] = useState<string | null>(null);
  const [openStageNameId, setOpenStageNameId] = useState<string | null>(null);
  const [stageNameEdit, setStageNameEdit] = useState('');
  const [savingStageNameId, setSavingStageNameId] = useState<string | null>(null);

  // Service documents sheet
  const [showDocSheet, setShowDocSheet]         = useState(false);
  const [sheetDocs, setSheetDocs]               = useState<any[]>([]);
  const [sheetDocReqs, setSheetDocReqs]         = useState<Record<string, any[]>>({});
  const [sheetExpandedId, setSheetExpandedId]   = useState<string | null>(null);
  const [loadingSheetDocs, setLoadingSheetDocs] = useState(false);

  const fetchTask = useCallback(async () => {
    const [taskRes, commentsRes, labelsRes, membersRes, citiesRes, assigneesRes] = await Promise.all([
      supabase
        .from('tasks')
        .select(
          `*, client:clients(*), service:services(*), assignee:team_members!assigned_to(id,name,role,push_token),
           route_stops:task_route_stops(*, ministry:ministries(*, city:cities(id,name)), updater:team_members!updated_by(*), city:cities(id,name), assignee:team_members!assigned_to(id,name,role,push_token), ext_assignee:assignees!ext_assignee_id(id,name,phone))`
        )
        .eq('id', taskId)
        .single(),
      supabase
        .from('task_comments')
        .select('*, author:team_members(*)')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true }),
      supabase.from('status_labels').select('*').eq('org_id', teamMember?.org_id ?? '').order('sort_order'),
      supabase.from('team_members').select('*').eq('org_id', teamMember?.org_id ?? '').is('deleted_at', null).order('name'),
      supabase.from('cities').select('*').eq('org_id', teamMember?.org_id ?? '').order('name'),
      supabase.from('assignees').select('*, creator:team_members!created_by(name), city:cities(id,name)').eq('org_id', teamMember?.org_id ?? '').order('name'),
    ]);

    if (citiesRes.data) setAllCities(citiesRes.data as City[]);
    if (assigneesRes.data) setExtAssignees(assigneesRes.data as any[]);
    if (taskRes.data) {
      const t = taskRes.data as Task;
      if (t.route_stops) {
        t.route_stops = [...t.route_stops].sort((a, b) => a.stop_order - b.stop_order);
      }
      setTask(t);
      setContractPriceUSD(t.price_usd ?? 0);
      setContractPriceLBP(t.price_lbp ?? 0);
    }
    if (commentsRes.data) setComments(commentsRes.data as TaskComment[]);
    if (labelsRes.data) setStatusLabels(labelsRes.data as StatusLabel[]);
    if (membersRes.data) setAllMembers(membersRes.data as TeamMember[]);

    // Fetch status update history per stop
    const { data: statusHistData } = await supabase
      .from('status_updates')
      .select('*, updater:team_members!updated_by(*)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (statusHistData) {
      const grouped: Record<string, any[]> = {};
      for (const entry of statusHistData) {
        const key = entry.stop_id ?? 'task';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(entry);
      }
      setStopHistories(grouped);
    }

    // Fetch financial transactions
    const { data: txData } = await supabase
      .from('file_transactions')
      .select('*, creator:team_members!created_by(name), stop:task_route_stops(id, ministry:ministries(name))')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });
    if (txData) setTransactions(txData as FileTransaction[]);

    // Fetch price history
    const { data: phData } = await supabase
      .from('task_price_history')
      .select('*, changer:team_members!changed_by(name)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });
    if (phData) setPriceHistory(phData as any[]);

    // Fetch task documents
    const { data: docsData } = await supabase
      .from('task_documents')
      .select('*, uploader:team_members!uploaded_by(name), requirement:stop_requirements!requirement_id(title)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });
    if (docsData) setDocuments(docsData as TaskDocument[]);

    // Load all available stages (with default city) — scoped to current org, parent type only
    const { data: stagesData } = await supabase
      .from('ministries')
      .select('*, city:cities(id,name)')
      .eq('org_id', teamMember?.org_id ?? '')
      .eq('type', 'parent')
      .order('name');
    if (stagesData) setAllStages(stagesData as Ministry[]);

    const { data: servicesData } = await supabase
      .from('services')
      .select('*')
      .order('name');
    if (servicesData) setAllServices(servicesData as Service[]);

    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  useRealtime(
    useCallback(
      (payload) => {
        if (
          payload.table === 'task_route_stops' ||
          payload.table === 'task_comments' ||
          payload.table === 'tasks'
        ) {
          fetchTask();
        }
      },
      [fetchTask]
    )
  );

  // Cleanup sound when it changes
  useEffect(() => {
    return () => { if (soundObj) { soundObj.unloadAsync(); } };
  }, [soundObj]);

  // Cleanup recording when it changes
  useEffect(() => {
    return () => { if (recordingObj) { recordingObj.stopAndUnloadAsync(); } };
  }, [recordingObj]);

  // Cleanup timer on unmount only — must NOT depend on recordingObj or the
  // interval gets cleared immediately when setRecordingObj(recording) triggers a re-render
  useEffect(() => {
    return () => { if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); } };
  }, []);

  // ─── @react-native-voice/voice setup (no-op in Expo Go) ────
  useEffect(() => {
    if (!VoiceModule) return; // Expo Go — native module not available
    VoiceModule.onSpeechResults = (e: SpeechResultsEvent) => {
      const text = (e.value ?? [])[0] ?? '';
      if (text) setNewComment(text);
      setIsListening(false);
      setVoicePartial('');
    };
    VoiceModule.onSpeechPartialResults = (e: SpeechResultsEvent) => {
      setVoicePartial((e.value ?? [])[0] ?? '');
    };
    VoiceModule.onSpeechEnd = () => {
      setIsListening(false);
    };
    VoiceModule.onSpeechError = (e: SpeechErrorEvent) => {
      setIsListening(false);
      setVoicePartial('');
      const msg = e.error?.message ?? '';
      // Code 7 on Android = "No match" (user didn't speak) — not an error worth showing
      if (!msg.includes('7/') && !msg.includes('No match')) {
        Alert.alert('لم يتم التعرف على الكلام', msg || 'حاول مرة أخرى.');
      }
    };
    return () => {
      VoiceModule?.destroy().then(VoiceModule?.removeAllListeners).catch(() => {});
    };
  }, []);

  const getStatusColor = (label: string) =>
    statusLabels.find((s) => s.label === label)?.color ?? '#6366f1';

  // ─── Add transaction ─────────────────────────────────────
  const handleAddTransaction = async () => {
    if (!txDescription.trim()) {
      Alert.alert(t('required'), t('fieldRequired'));
      return;
    }
    const usd = parseFloat(txAmountUSD) || 0;
    const lbp = parseFloat(txAmountLBP.replace(/,/g, '')) || 0;
    if (usd === 0 && lbp === 0) {
      Alert.alert(t('required'), t('fieldRequired'));
      return;
    }
    setSavingTx(true);
    const { error } = await supabase.from('file_transactions').insert({
      task_id:      taskId,
      type:         txType,
      description:  txDescription.trim(),
      amount_usd:   usd,
      amount_lbp:   lbp,
      rate_usd_lbp: exchangeRate,   // snapshot rate at time of entry
      stop_id:      txStopId ?? null,
      created_by:   teamMember?.id,
    });
    setSavingTx(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    setTxDescription('');
    setTxAmountUSD('');
    setTxAmountLBP('');
    setTxType('expense');
    setTxStopId(null);
    setShowTxStagePicker(false);
    setShowAddTransaction(false);
    fetchTask();
  };

  // ─── Edit transaction ────────────────────────────────────
  const handleEditTransaction = async () => {
    if (!editingTx) return;
    if (!editTxDescription.trim()) {
      Alert.alert(t('required'), t('fieldRequired'));
      return;
    }
    const usd = parseFloat(editTxAmountUSD) || 0;
    const lbp = parseFloat(editTxAmountLBP.replace(/,/g, '')) || 0;
    if (usd === 0 && lbp === 0) {
      Alert.alert(t('required'), t('fieldRequired'));
      return;
    }
    setSavingEditTx(true);
    const { error } = await supabase.from('file_transactions')
      .update({
        type:        editTxType,
        description: editTxDescription.trim(),
        amount_usd:  usd,
        amount_lbp:  lbp,
        stop_id:     editTxStopId ?? null,
      })
      .eq('id', editingTx.id);
    setSavingEditTx(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    setEditingTx(null);
    setEditTxStopId(null);
    setShowEditTxStagePicker(false);
    fetchTask();
  };

  const handleDeleteTransaction = (tx: FileTransaction) => {
    const doDelete = async () => {
      setDeletingTxId(tx.id);
      await supabase.from('task_comments').insert({
        task_id: taskId,
        author_id: teamMember?.id,
        body: `🗑 Deleted ${tx.type}: "${tx.description}" (${
          tx.amount_usd > 0 ? fmtUSD(tx.amount_usd) : ''
        }${tx.amount_usd > 0 && tx.amount_lbp > 0 ? ' / ' : ''}${
          tx.amount_lbp > 0 ? fmtLBP(tx.amount_lbp) : ''
        })`,
      });
      await supabase.from('file_transactions').delete().eq('id', tx.id);
      setDeletingTxId(null);
      fetchTask();
    };
    if (Platform.OS === 'web') {
      if ((window as any).confirm(`Delete "${tx.description}"? This cannot be undone.`)) {
        doDelete();
      }
      return;
    }
    Alert.alert(t('delete'), `${t('confirmDelete')} — "${tx.description}"`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  };

  // ─── Save contract price ─────────────────────────────────
  const handleSavePrice = async () => {
    const newUSD = parseFloat(editPriceUSD) || 0;
    const newLBP = parseFloat(editPriceLBP.replace(/,/g, '')) || 0;
    setSavingPrice(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ price_usd: newUSD, price_lbp: newLBP, updated_at: new Date().toISOString() })
        .eq('id', taskId);
      if (error) throw error;
      await supabase.from('task_price_history').insert({
        task_id: taskId,
        old_price_usd: contractPriceUSD,
        old_price_lbp: contractPriceLBP,
        new_price_usd: newUSD,
        new_price_lbp: newLBP,
        note: editPriceNote.trim() || null,
        changed_by: teamMember?.id ?? null,
      });
      setContractPriceUSD(newUSD);
      setContractPriceLBP(newLBP);
      setShowEditPrice(false);
      setEditPriceNote('');
      fetchTask();
    } catch (e: any) {
      Alert.alert(t('error'), e.message);
    } finally {
      setSavingPrice(false);
    }
  };

  // ─── Open edit stages modal ──────────────────────────────
  const openEditStages = () => {
    if (!task?.route_stops) return;
    const sorted = [...task.route_stops].sort((a, b) => a.stop_order - b.stop_order);
    // Exclude the final closure stage — it's always last and auto-managed
    const editable = sorted.filter(s => s.ministry?.name !== FINAL_STAGE_NAME);
    const current = editable.map((s) => ({
      id: s.ministry_id,
      name: s.ministry?.name ?? '',
      type: 'parent' as const,
      created_at: '',
    }));
    setEditingStops(current);
    // Populate city map from existing route_stops (editable only)
    // Fall back to the ministry's default city if the stop has no city set yet
    const cityMap: Record<string, { cityId: string | null; cityName: string | null }> = {};
    for (const s of editable) {
      const stopCity   = s.city_id  ?? (s.ministry as any)?.city_id  ?? null;
      const stopCityNm = (s.city as any)?.name ?? (s.ministry as any)?.city?.name ?? null;
      cityMap[s.ministry_id] = { cityId: stopCity, cityName: stopCityNm };
    }
    setEditStageCities(cityMap);
    setEditCityPickerMiniId(null);
    setShowEditStages(true);
  };

  const toggleEditStage = (stage: Ministry) => {
    if (editingStops.find((r) => r.id === stage.id)) {
      setEditingStops((prev) => prev.filter((r) => r.id !== stage.id));
    } else {
      setEditingStops((prev) => [...prev, stage]);
      // Auto-populate city from ministry default if not already mapped
      setEditStageCities(prev => {
        if (prev[stage.id]) return prev; // already has a city mapping
        const defCityId = stage.city_id ?? null;
        const defCityNm = stage.city?.name ?? null;
        if (!defCityId) return prev;
        return { ...prev, [stage.id]: { cityId: defCityId, cityName: defCityNm } };
      });
    }
  };

  const moveEditStop = (index: number, dir: -1 | 1) => {
    const arr = [...editingStops];
    const target = index + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    setEditingStops(arr);
  };

  const handleCreateStageInEdit = async () => {
    if (!newStageName.trim()) {
      Alert.alert(t('required'), t('fieldRequired'));
      return;
    }
    const duplicate = allStages.find(
      (m) => m.name.trim().toLowerCase() === newStageName.trim().toLowerCase()
    );
    if (duplicate) {
      Alert.alert(t('warning'), `"${duplicate.name}" — ${t('duplicateClient')}`);
      return;
    }
    setSavingNewStage(true);
    const { data, error } = await supabase
      .from('ministries')
      .insert({ name: newStageName.trim(), type: 'parent', org_id: teamMember?.org_id ?? null })
      .select()
      .single();
    setSavingNewStage(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    const stage = data as Ministry;
    setAllStages((prev) => [...prev, stage].sort((a, b) => a.name.localeCompare(b.name)));
    setEditingStops((prev) => [...prev, stage]);
    setNewStageName('');
    setShowNewStageInEdit(false);
  };

  const handleSaveStages = async () => {
    setSavingStages(true);
    try {
      // Preserve the existing final stage stop (to keep its status/city)
      const existingFinal = task?.route_stops?.find(s => s.ministry?.name === FINAL_STAGE_NAME);

      // Get or create the final stage ministry — scoped to current org
      let finalMinistryId = existingFinal?.ministry_id ?? null;
      if (!finalMinistryId) {
        const { data: existingMin } = await supabase
          .from('ministries')
          .select('id')
          .eq('name', FINAL_STAGE_NAME)
          .eq('org_id', teamMember?.org_id ?? '')
          .maybeSingle();
        if (existingMin) {
          finalMinistryId = existingMin.id;
        } else {
          const { data: newMin, error: minErr } = await supabase
            .from('ministries')
            .insert({ name: FINAL_STAGE_NAME, type: 'parent', org_id: teamMember?.org_id ?? null })
            .select()
            .single();
          if (minErr) throw minErr;
          finalMinistryId = newMin.id;
        }
      }

      // Delete all existing stops for this task
      const { error: delErr } = await supabase
        .from('task_route_stops')
        .delete()
        .eq('task_id', taskId);
      if (delErr) throw delErr;

      // Re-insert in new order + final stage always last
      const newStops = [
        ...editingStops.map((s, idx) => ({
          task_id: taskId,
          ministry_id: s.id,
          stop_order: idx + 1,
          status: task?.route_stops?.find(r => r.ministry_id === s.id)?.status ?? 'Pending',
          // Use the mapped city; fall back to ministry's default city for newly added stages
          city_id: editStageCities[s.id]?.cityId ?? s.city_id ?? null,
        })),
        {
          task_id: taskId,
          ministry_id: finalMinistryId,
          stop_order: editingStops.length + 1,
          status: existingFinal?.status ?? 'Pending',
          city_id: existingFinal?.city_id ?? null,
        },
      ];

      const { error: insErr } = await supabase
        .from('task_route_stops')
        .insert(newStops);
      if (insErr) throw insErr;

      setShowEditStages(false);
      fetchTask();
    } catch (e: unknown) {
      Alert.alert(t('error'), (e as Error).message);
    } finally {
      setSavingStages(false);
    }
  };

  // ─── Edit task ───────────────────────────────────────────────
  const isoToDisplay = (iso: string) => {
    const parts = iso.split('-');
    if (parts.length !== 3) return iso;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const displayToISO = (display: string): string | null => {
    const clean = display.trim().replace(/[^0-9/]/g, '');
    const parts = clean.split('/');
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    if (year < 100) year += 2000;
    const d = new Date(year, month - 1, day);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const openEditTask = () => {
    setEditNotes(task?.notes ?? '');
    setEditServiceId(task?.service_id ?? '');
    setShowEditTask(true);
  };

  const handleSetDueDate = async (isoDate: string | null) => {
    await supabase.from('tasks').update({ due_date: isoDate, updated_at: new Date().toISOString() }).eq('id', taskId);
    setShowDueDateCalendar(false);
    fetchTask();
  };

  const handleSaveEdit = async () => {
    if (!editServiceId) {
      Alert.alert(t('required'), t('fieldRequired'));
      return;
    }
    setSavingEdit(true);
    const { error } = await supabase
      .from('tasks')
      .update({
        notes: editNotes.trim() || null,
        service_id: editServiceId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);
    setSavingEdit(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    setShowEditTask(false);
    fetchTask();
  };

  // ─── File-level assignee ────────────────────────────────────
  const handleSetFileAssignee = async (memberId: string | null) => {
    setSavingAssignee(true);
    await supabase.from('tasks').update({ assigned_to: memberId, updated_at: new Date().toISOString() }).eq('id', taskId);
    setSavingAssignee(false);
    setShowAssigneePicker(false);
    setAssigneeSearch('');
    fetchTask();
  };

  // ─── Document actions ─────────────────────────────────────────
  const handleOpenDoc = (doc: TaskDocument) => {
    setViewingDoc(doc);
  };

  const handlePrintDoc = async (doc: TaskDocument) => {
    setPrintingDoc(true);
    try {
      await Print.printAsync({ uri: doc.file_url });
    } catch (e: any) {
      Alert.alert(t('error'), e.message ?? t('somethingWrong'));
    } finally {
      setPrintingDoc(false);
    }
  };

  const handleShareDoc = async (doc: TaskDocument) => {
    try {
      // Download the file locally first, then share the actual file (not a URL)
      const label    = doc.display_name || doc.file_name;
      const ext      = doc.file_type === 'application/pdf' ? 'pdf' : 'jpg';
      const localUri = `${FileSystem.cacheDirectory}${label.replace(/[^a-z0-9]/gi, '_')}.${ext}`;

      setStatusMsg('Preparing file...');
      const { uri } = await FileSystem.downloadAsync(doc.file_url, localUri);
      setStatusMsg('');

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert(t('error'), t('somethingWrong'));
        return;
      }
      const isImg = /image\//i.test(doc.file_type) || /\.(jpg|jpeg|png)$/i.test(doc.file_url);
      await Sharing.shareAsync(uri, {
        mimeType: isImg ? 'image/jpeg' : 'application/pdf',
        dialogTitle: label,
        UTI: isImg ? 'public.jpeg' : 'com.adobe.pdf',
      });
    } catch (e: any) {
      setStatusMsg('');
      Alert.alert(t('error'), e.message ?? t('somethingWrong'));
    }
  };

  // ─── Document rename ──────────────────────────────────────────
  const handleRenameDoc = async (doc: TaskDocument, newName: string) => {
    const name = newName.trim();
    if (!name) return;
    await supabase.from('task_documents').update({ display_name: name, file_name: name }).eq('id', doc.id);
    fetchTask();
  };

  // ─── Document archive ────────────────────────────────────────
  const handleDeleteDocument = (doc: TaskDocument) => {
    Alert.alert(t('deleteDoc'), `${t('confirmDelete')} — "${doc.file_name}"`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingDocId(doc.id);
          await supabase.from('task_documents').delete().eq('id', doc.id);
          setDeletingDocId(null);
          fetchTask();
        },
      },
    ]);
  };

  // ─── PDF upload from device ───────────────────────────────
  const handlePickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const localUri = asset.uri;
      const originalName = asset.name ?? `Document_${Date.now()}.pdf`;
      const displayName  = originalName.replace(/\.pdf$/i, '');

      setUploadingPdf(true);
      const timestamp  = Date.now();
      const safeName   = displayName.replace(/[^a-z0-9]/gi, '_');
      const filePath   = `documents/${taskId}/${safeName}_${timestamp}.pdf`;

      if (Platform.OS === 'web') {
        const response = await fetch(localUri);
        const blob     = await response.blob();
        const { error: upErr } = await supabase.storage
          .from('task-attachments')
          .upload(filePath, blob, { contentType: 'application/pdf', upsert: false });
        if (upErr) throw upErr;
      } else {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        const anonKey     = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
        const uploadUrl   = `${supabaseUrl}/storage/v1/object/task-attachments/${filePath}`;
        const uploadResult = await FileSystem.uploadAsync(uploadUrl, localUri, {
          httpMethod:  'POST',
          uploadType:  FileSystem.FileSystemUploadType.MULTIPART,
          fieldName:   'file',
          mimeType:    'application/pdf',
          headers: {
            apikey:        anonKey,
            Authorization: `Bearer ${accessToken ?? anonKey}`,
          },
        });
        if (uploadResult.status < 200 || uploadResult.status >= 300) {
          throw new Error(`Upload failed (${uploadResult.status}): ${uploadResult.body}`);
        }
      }

      const { data: urlData } = supabase.storage.from('task-attachments').getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      const { error: dbErr } = await supabase.from('task_documents').insert({
        task_id:      taskId,
        file_name:    displayName,
        display_name: displayName,
        file_url:     publicUrl,
        file_type:    'application/pdf',
        uploaded_by:  teamMember?.id ?? null,
      });
      if (dbErr) throw dbErr;

      fetchTask();
    } catch (e: any) {
      Alert.alert(t('error'), e.message ?? t('somethingWrong'));
    } finally {
      setUploadingPdf(false);
    }
  };

  // ─── Status update ────────────────────────────────────────
  const handleUpdateStopStatus = async (stop: TaskRouteStop, newStatus: string, reason?: string) => {
    setUpdatingStop(stop.id);
    const oldStatus = stop.status;
    const now = new Date().toISOString();

    if (isOnline) {
      try {
        // Update the stop status (clear rejection_reason unless new status is Rejected)
        const { error } = await supabase
          .from('task_route_stops')
          .update({
            status: newStatus,
            updated_at: now,
            updated_by: teamMember?.id,
            rejection_reason: newStatus === 'Rejected' ? (reason ?? null) : null,
          })
          .eq('id', stop.id);

        if (error) throw error;

        // Log to status_updates history
        await supabase.from('status_updates').insert({
          task_id: taskId,
          stop_id: stop.id,
          updated_by: teamMember?.id,
          old_status: oldStatus,
          new_status: newStatus,
        });

        // Only update task overall status if ALL stops are Done
        // or set to the latest updated stop status if not all done
        const { data: allStops } = await supabase
          .from('task_route_stops')
          .select('id, status')
          .eq('task_id', taskId);

        const TERMINAL = ['Done', 'Rejected', 'Received & Closed'];
        let newTaskStatus = newStatus;
        let shouldArchive = false;
        if (allStops) {
          const allDone = allStops.every((s: { id: string; status: string }, i: number) =>
            (i === allStops.findIndex((x: { id: string }) => x.id === stop.id))
              ? TERMINAL.includes(newStatus)
              : TERMINAL.includes(s.status)
          );
          newTaskStatus = allDone ? 'Done' : newStatus;
          shouldArchive = allDone;
        }

        // Auto-set due_date to today when file closes (if not already set)
        const todayStr = now.slice(0, 10); // YYYY-MM-DD
        await supabase
          .from('tasks')
          .update({
            current_status: newTaskStatus,
            updated_at: now,
            ...(shouldArchive ? {
              is_archived: true,
              closed_at: now,
              ...(!task?.due_date ? { due_date: todayStr } : {}),
            } : {}),
          })
          .eq('id', taskId);

        if (shouldArchive) {
          Alert.alert(t('done'), `${t('archive')} — ${t('savedSuccess')}`);
        }

        // Notify the assignee if it's not the current user (direct push)
        if (task?.assignee?.push_token && task.assignee.id !== teamMember?.id) {
          sendPushNotification(
            task.assignee.push_token,
            'Stage Updated',
            `${task.client?.name} — ${stop.ministry?.name}: ${newStatus}`,
            { taskId }
          );
        }

        // Broadcast status change to all team members
        const actorName = teamMember?.name ?? 'Someone';
        sendActivityNotificationToAll(
          supabase,
          teamMember?.id,
          `🔄 ${actorName}`,
          `${task?.client?.name ?? 'File'} · ${stop.ministry?.name ?? 'Stage'} → ${newStatus}`,
          'status',
          { taskId }
        );

        fetchTask();
      } catch (e: unknown) {
        Alert.alert(t('error'), (e as Error).message);
      }
    } else {
      await enqueue({
        type: 'status_update',
        payload: {
          stopId: stop.id,
          taskId,
          newStatus,
          oldStatus,
          updatedBy: teamMember?.id ?? '',
        },
      });
      Alert.alert(t('saved'), t('savedSuccess'));
      fetchTask();
    }

    setUpdatingStop(null);
    setShowStatusPicker(false);
    setSelectedStop(null);
  };

  // ─── Post comment ─────────────────────────────────────────
  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    setPostingComment(true);

    if (isOnline) {
      const { error } = await supabase.from('task_comments').insert({
        task_id: taskId,
        author_id: teamMember?.id,
        body: newComment.trim(),
      });
      if (error) {
        Alert.alert(t('error'), error.message);
      } else {
        setNewComment('');
        fetchTask();
        // Notify all team members except the author
        const clientName  = task?.client?.name  ?? 'a file';
        const actorName   = teamMember?.name     ?? 'Someone';
        sendActivityNotificationToAll(
          supabase,
          teamMember?.id,
          `💬 ${actorName}`,
          `${clientName}: ${newComment.trim()}`,
          'comment',
          { taskId }
        );
      }
    } else {
      await enqueue({
        type: 'comment',
        payload: {
          taskId,
          authorId: teamMember?.id ?? '',
          body: newComment.trim(),
        },
      });
      setNewComment('');
      Alert.alert(t('saved'), t('savedSuccess'));
    }

    setPostingComment(false);
  };

  // ─── Edit comment ─────────────────────────────────────────
  const handleSaveEditComment = async () => {
    if (!editingCommentId || !editingCommentBody.trim()) return;
    setSavingEditComment(true);
    const { error } = await supabase
      .from('task_comments')
      .update({ body: editingCommentBody.trim() })
      .eq('id', editingCommentId);
    setSavingEditComment(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    setEditingCommentId(null);
    setEditingCommentBody('');
    fetchTask();
  };

  // ─── Voice note: start recording ────────────────────────
  const handleStartRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { Alert.alert(t('warning'), t('fieldRequired')); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      // Use explicit prepare+start instead of createAsync for better Expo Go compatibility
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();

      // Set state AFTER recording is fully started, then start timer separately
      setIsRecording(true);
      setRecordingDuration(0);
      setRecordingObj(rec);
      // Delay interval slightly so React has flushed the state update before we start ticking
      setTimeout(() => {
        recordingTimerRef.current = setInterval(() => {
          setRecordingDuration(d => d + 1);
        }, 1000);
      }, 100);
    } catch (e: unknown) {
      Alert.alert(t('error'), (e as any)?.message ?? String(e) ?? t('somethingWrong'));
    }
  };

  // ─── Voice note: stop recording ─────────────────────────
  const handleStopRecording = async () => {
    if (!recordingObj) return;
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    try {
      const uri = recordingObj.getURI(); // must capture BEFORE stopAndUnloadAsync
      await recordingObj.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      setRecordingObj(null);
      setIsRecording(false);
      if (!uri) {
        Alert.alert(t('error'), t('somethingWrong'));
        setRecordingDuration(0);
        return;
      }
      setRecordedUri(uri);
    } catch (e: unknown) {
      setIsRecording(false);
      setRecordingObj(null);
      Alert.alert(t('error'), (e as any)?.message ?? String(e) ?? t('somethingWrong'));
    }
  };

  // ─── Voice note: discard recording ──────────────────────
  const handleDiscardRecording = () => {
    setRecordedUri(null);
    setRecordingDuration(0);
  };

  // ─── Voice → Text  (native speech recognition, no API key needed) ──────
  // Discards the current voice recording and starts a live recognition session.
  // Uses iOS SFSpeechRecognizer / Android Google SpeechRecognizer — both free.
  // Lebanese Arabic locale: 'ar-LB' (falls back to 'ar' on devices without LB pack).
  const handleTextFromVoice = async () => {
    if (!VoiceModule) {
      Alert.alert('يتطلب بناء APK', 'ميزة تحويل الصوت إلى نص تعمل فقط في نسخة APK، وليس في Expo Go.');
      return;
    }
    handleDiscardRecording(); // discard the m4a
    try {
      setIsListening(true);
      setVoicePartial('');
      await VoiceModule.start('ar-LB');
    } catch (e: any) {
      setIsListening(false);
      // Try plain 'ar' locale if 'ar-LB' not installed
      try {
        await VoiceModule.start('ar');
        setIsListening(true);
      } catch (e2: any) {
        Alert.alert('خطأ', e2?.message ?? 'تعذّر بدء التعرف على الكلام.');
      }
    }
  };

  const handleStopListening = async () => {
    try { await VoiceModule?.stop(); } catch {}
    setIsListening(false);
    setVoicePartial('');
  };

  // ─── Voice note: upload + post as comment ───────────────
  const handleSendVoiceNote = async () => {
    if (!recordedUri) return;
    setUploadingVoice(true);
    try {
      const timestamp = Date.now();
      const ext = recordedUri.split('.').pop()?.toLowerCase() ?? 'm4a';
      const storagePath = `voice-notes/${taskId}/${timestamp}.${ext}`;
      const contentType = ext === 'mp4' ? 'audio/mp4' : 'audio/m4a';

      // Read as base64 → ArrayBuffer → upload via supabase client (same proven pattern as PDF)
      const base64 = await FileSystem.readAsStringAsync(recordedUri, {
        encoding: (FileSystem as any).EncodingType?.Base64 ?? 'base64',
      });
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

      const { error: upErr } = await supabase.storage
        .from('task-attachments')
        .upload(storagePath, bytes.buffer as ArrayBuffer, { contentType, upsert: true });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from('task-attachments').getPublicUrl(storagePath);
      const audioUrl = urlData?.publicUrl ?? '';

      const { error } = await supabase.from('task_comments').insert({
        task_id: taskId,
        author_id: teamMember?.id,
        body: '🎤 Voice note',
        audio_url: audioUrl,
      });
      if (error) throw error;
      setRecordedUri(null);
      setRecordingDuration(0);
      fetchTask();
    } catch (e: unknown) {
      Alert.alert(t('error'), (e as any)?.message ?? String(e) ?? t('somethingWrong'));
    } finally {
      setUploadingVoice(false);
    }
  };

  // ─── Voice note: play / pause ────────────────────────────
  const handlePlayPause = async (commentId: string, audioUrl: string) => {
    if (playingCommentId === commentId) {
      // Pause
      if (soundObj) { await soundObj.pauseAsync(); }
      setPlayingCommentId(null);
      return;
    }
    // Stop any current playback
    if (soundObj) { await soundObj.unloadAsync(); setSoundObj(null); }
    setPlayingCommentId(commentId);
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded) {
            setPlaybackPosition(status.positionMillis ?? 0);
            setPlaybackDuration(status.durationMillis ?? 0);
            if (status.didJustFinish) {
              setPlayingCommentId(null);
              setSoundObj(null);
            }
          }
        }
      );
      setSoundObj(sound);
    } catch (e: unknown) {
      Alert.alert(t('error'), t('somethingWrong'));
      setPlayingCommentId(null);
    }
  };

  const fmtDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // ─── Per-stage city / assignee handlers ─────────────────
  const handleSetStopDueDate = async (stopId: string, date: string | null) => {
    setSavingStopDueDate(stopId);
    const { error } = await supabase
      .from('task_route_stops')
      .update({ due_date: date })
      .eq('id', stopId);
    setSavingStopDueDate(null);
    if (error) {
      Alert.alert(t('error'), error.message);
      return;
    }
    setStopDueDatePickerStopId(null);
    fetchTask();
  };

  const handleRenameStopMinistry = async (ministryId: string, newName: string) => {
    if (!newName.trim()) return;
    setSavingStageNameId(ministryId);
    await supabase.from('ministries').update({ name: newName.trim() }).eq('id', ministryId);
    setSavingStageNameId(null);
    setOpenStageNameId(null);
    fetchTask();
  };

  const handleSetStopCity = async (stopId: string, cityId: string | null) => {
    setSavingStopField(stopId);
    await supabase.from('task_route_stops').update({ city_id: cityId }).eq('id', stopId);
    setSavingStopField(null);
    setOpenCityStopId(null);
    setStopCitySearch('');
    fetchTask();
  };

  const handleSetStopAssignee = async (stopId: string, memberId: string | null, extId: string | null) => {
    setSavingStopField(stopId);
    const updates: Record<string, any> = { assigned_to: memberId, ext_assignee_id: extId };
    // Auto-fill city from Network contact's city if stop has no city yet
    if (extId) {
      const ext = extAssignees.find((a: any) => a.id === extId);
      const currentStop = task?.route_stops?.find(rs => rs.id === stopId);
      if (ext?.city_id && !currentStop?.city_id) {
        updates.city_id = ext.city_id;
      }
    }
    await supabase.from('task_route_stops').update(updates).eq('id', stopId);
    setSavingStopField(null);
    setOpenAssigneeStopId(null);
    fetchTask();
  };

  const handleCreateExtAssigneeForStop = async (stopId: string) => {
    if (!newExtName.trim()) { Alert.alert(t('required'), t('fieldRequired')); return; }
    setSavingExtAssignee(true);
    const { data, error } = await supabase
      .from('assignees')
      .insert({ name: newExtName.trim(), phone: newExtPhone.trim() || null, reference: newExtReference.trim() || null, created_by: teamMember?.id, org_id: teamMember?.org_id ?? null })
      .select('*, creator:team_members!created_by(name)')
      .single();
    setSavingExtAssignee(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    setExtAssignees(prev => [...prev, data as any].sort((a, b) => a.name.localeCompare(b.name)));
    setNewExtName(''); setNewExtPhone(''); setNewExtReference('');
    setShowCreateExtForm(false);
    await handleSetStopAssignee(stopId, null, (data as any).id);
  };

  const PINNED_KEY = '@pinned_city_ids';

  useEffect(() => {
    AsyncStorage.getItem(PINNED_KEY).then(raw => { if (raw) setPinnedCityIds(JSON.parse(raw)); });
  }, []);

  const togglePinCity = async (cityId: string) => {
    const next = pinnedCityIds.includes(cityId)
      ? pinnedCityIds.filter(id => id !== cityId)
      : [cityId, ...pinnedCityIds];
    setPinnedCityIds(next);
    await AsyncStorage.setItem(PINNED_KEY, JSON.stringify(next));
  };

  const handleCreateCity = async (stopId: string) => {
    if (!newCityName.trim()) { Alert.alert(t('required'), t('fieldRequired')); return; }
    setSavingCity(true);
    const { data, error } = await supabase.from('cities').insert({ name: newCityName.trim(), org_id: teamMember?.org_id ?? null }).select().single();
    setSavingCity(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    const created = data as City;
    setAllCities(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setNewCityName('');
    setShowCreateCityForm(false);
    await handleSetStopCity(stopId, created.id);
  };

  const handleCreateCityInEditModal = async (stageId: string) => {
    if (!newCityName.trim()) { Alert.alert(t('required'), t('fieldRequired')); return; }
    setSavingCity(true);
    const { data, error } = await supabase.from('cities').insert({ name: newCityName.trim(), org_id: teamMember?.org_id ?? null }).select().single();
    setSavingCity(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    const created = data as City;
    setAllCities(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setEditStageCities(prev => ({ ...prev, [stageId]: { cityId: created.id, cityName: created.name } }));
    setNewCityName('');
    setEditCreateCityOpen(false);
    setEditCityPickerMiniId(null);
  };

  const handleDeleteComment = (commentId: string) => {
    Alert.alert(t('deleteComment'), t('confirmDelete'), [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('task_comments').delete().eq('id', commentId);
        fetchTask();
      }},
    ]);
  };

  if (loading || !task) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={theme.color.primary} size="large" />
      </View>
    );
  }

  const mainStatusColor = getStatusColor(task.current_status);

  // Derived status — same terminal logic as dashboard (Done + Rejected = terminal)
  const DETAIL_URGENCY: Record<string, number> = {
    Rejected: 1, 'Pending Signature': 2, 'In Review': 3,
    Submitted: 4, Pending: 5, Done: 99, Closed: 100,
  };
  const nonTerminalStops = (task.route_stops ?? []).filter(
    (s) => s.status !== 'Done' && s.status !== 'Rejected'
  );
  const derivedStatus = nonTerminalStops.length > 0
    ? nonTerminalStops.reduce((a, b) =>
        (DETAIL_URGENCY[a.status] ?? 50) <= (DETAIL_URGENCY[b.status] ?? 50) ? a : b
      ).status
    : ((task.route_stops && task.route_stops.length > 0) ? 'Done' : task.current_status);
  const derivedStatusColor = getStatusColor(derivedStatus);

  // Compute balances — contract price is NOT revenue, it's the agreed billing amount
  const totalRevenueUSD = transactions.filter((t) => t.type === 'revenue').reduce((sum, t) => sum + t.amount_usd, 0);
  const totalExpenseUSD = transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount_usd, 0);
  const balanceUSD = totalRevenueUSD - totalExpenseUSD;
  const outstandingUSD = contractPriceUSD - totalRevenueUSD;

  const totalRevenueLBP = transactions.filter((t) => t.type === 'revenue').reduce((sum, t) => sum + t.amount_lbp, 0);
  const totalExpenseLBP = transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount_lbp, 0);
  const balanceLBP = totalRevenueLBP - totalExpenseLBP;
  const outstandingLBP = contractPriceLBP - totalRevenueLBP;
  const totalCombinedUSD = balanceUSD + (balanceLBP / exchangeRate);

  const fmtUSD = (n: number) => `$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const fmtLBP = (n: number) => `LBP ${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  const handlePhonePress = (phone: string, name?: string) => {
    const clean = phone.replace(/[^0-9+]/g, '');
    Alert.alert(name ?? phone, phone, [
      { text: '📞 Phone Call', onPress: () => Linking.openURL(`tel:${clean}`) },
      { text: '💬 WhatsApp',  onPress: () => Linking.openURL(`https://wa.me/${clean.replace(/^\+/, '')}`) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ─── Share status via WhatsApp ────────────────────────────
  const handleShareWhatsApp = () => {
    if (!task) return;
    const stops = [...(task.route_stops ?? [])].sort((a, b) => a.stop_order - b.stop_order);
    const stageLines = stops
      .map((s, i) => `  ${i + 1}. ${s.ministry?.name ?? 'Stage'}: ${s.status}`)
      .join('\n');

    const parts: string[] = [
      `📁 *تحديث ملف*`,
      `العميل: ${task.client?.name ?? '-'}`,
      `الخدمة: ${task.service?.name ?? '-'}`,
      `الحالة: *${task.current_status}*`,
    ];
    if (task.due_date) parts.push(`تاريخ الاستحقاق: ${formatDateOnly(task.due_date)}`);
    if (stops.length > 0) parts.push(`\n*المراحل:*\n${stageLines}`);
    if (task.notes) parts.push(`\nملاحظات: ${task.notes}`);
    if (teamMember?.name) parts.push(`\n_Generated by ${teamMember.name}_`);
    parts.push('_GovPilot, Powered by KTS_');

    const msg = parts.join('\n');
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`);
  };

  // ─── Service documents sheet ──────────────────────────────
  const loadServiceDocsForSheet = async (serviceId: string) => {
    setLoadingSheetDocs(true);
    setSheetDocs([]);
    setSheetDocReqs({});
    setSheetExpandedId(null);
    const { data: docs } = await supabase
      .from('service_documents')
      .select('*')
      .eq('service_id', serviceId)
      .order('sort_order');
    const docList = docs ?? [];
    setSheetDocs(docList);
    if (docList.length > 0) {
      const results = await Promise.all(
        docList.map((d: any) =>
          supabase.from('service_document_requirements')
            .select('*').eq('doc_id', d.id).order('sort_order')
        )
      );
      const reqs: Record<string, any[]> = {};
      docList.forEach((d: any, i: number) => { reqs[d.id] = results[i].data ?? []; });
      setSheetDocReqs(reqs);
    }
    setLoadingSheetDocs(false);
  };

  const handleToggleSheetDocCheck = async (doc: any) => {
    const newVal = !doc.is_checked;
    setSheetDocs(prev => prev.map(d => d.id === doc.id ? { ...d, is_checked: newVal } : d));
    await supabase.from('service_documents').update({ is_checked: newVal }).eq('id', doc.id);
  };

  const handleShareDocsWhatsApp = () => {
    if (!task?.service || sheetDocs.length === 0) return;
    const lines = [`📋 *${task.service.name}* — Required Documents:\n`];
    sheetDocs.forEach((doc: any, idx: number) => {
      if (doc.is_checked) {
        lines.push(`~${idx + 1}. ${doc.title}~`);
        (sheetDocReqs[doc.id] ?? []).forEach((r: any) => lines.push(`   ~• ${r.title}~`));
      } else {
        lines.push(`${idx + 1}. *${doc.title}*`);
        (sheetDocReqs[doc.id] ?? []).forEach((r: any) => lines.push(`   • ${r.title}`));
      }
    });
    if (teamMember?.name) lines.push(`\n_Generated by ${teamMember.name}_`);
    lines.push('_GovPilot, Powered by KTS_');
    const msg = encodeURIComponent(lines.join('\n'));
    Linking.openURL(`https://wa.me/?text=${msg}`).catch(() =>
      Alert.alert(t('error'), t('somethingWrong'))
    );
  };

  // ─── Duplicate task ───────────────────────────────────────
  const handleDuplicateTask = () => {
    if (!task) return;
    Alert.alert(
      'Duplicate File',
      `Create a new file for ${task.client?.name} with the same service and stages?\n\nThe new file will start as "Submitted" with all stages reset to "Pending".`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Duplicate',
          onPress: async () => {
            setDuplicating(true);
            try {
              const now = new Date().toISOString();
              const { data: newTask, error: taskErr } = await supabase
                .from('tasks')
                .insert({
                  client_id:      task.client_id,
                  service_id:     task.service_id,
                  assigned_to:    task.assigned_to    ?? null,
                  ext_assignee_id: task.ext_assignee_id ?? null,
                  current_status: 'Submitted',
                  due_date:       null,
                  notes:          task.notes          ?? null,
                  price_usd:      task.price_usd      ?? 0,
                  price_lbp:      task.price_lbp      ?? 0,
                  is_archived:    false,
                  created_at:     now,
                  updated_at:     now,
                  org_id:         teamMember?.org_id  ?? null,
                })
                .select()
                .single();
              if (taskErr) throw taskErr;

              const sortedStops = [...(task.route_stops ?? [])].sort((a, b) => a.stop_order - b.stop_order);
              if (sortedStops.length > 0) {
                const newStops = sortedStops.map((s, idx) => ({
                  task_id:    newTask.id,
                  ministry_id: s.ministry_id,
                  stop_order: idx + 1,
                  status:     'Pending',
                  city_id:    s.city_id ?? null,
                }));
                const { error: stopsErr } = await supabase.from('task_route_stops').insert(newStops);
                if (stopsErr) throw stopsErr;
              }

              await supabase.from('status_updates').insert({
                task_id: newTask.id,
                updated_by: teamMember?.id,
                new_status: 'Submitted',
              });

              setDuplicating(false);
              Alert.alert(t('duplicate'), t('savedSuccess'), [
                {
                  text: 'Open New File',
                  onPress: () => {
                    // Go back to dashboard first (triggers useFocusEffect refresh),
                    // then push the new file's detail on top.
                    navigation.navigate('DashboardHome');
                    setTimeout(() => navigation.navigate('TaskDetail', { taskId: newTask.id }), 50);
                  },
                },
                { text: 'Stay Here', style: 'cancel' },
              ]);
            } catch (e: any) {
              setDuplicating(false);
              Alert.alert(t('error'), e.message ?? t('somethingWrong'));
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <KeyboardAwareScrollView
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={80}
        extraHeight={80}
      >

        {/* ── HEADER CARD ── */}
        <View style={s.headerCard}>
          <View style={s.headerTop}>
            <View style={{ flex: 1 }}>
              <TouchableOpacity
                onPress={() => navigation.navigate('ClientProfile', { clientId: task.client_id })}
                activeOpacity={0.7}
              >
                <Text style={s.clientName}>{task.client?.name}</Text>
                <Text style={s.clientProfileHint}>View profile →</Text>
              </TouchableOpacity>
              {task.client?.phone && (
                <TouchableOpacity onPress={() => handlePhonePress(task.client!.phone!, task.client?.name)}>
                  <Text style={[s.clientSub, { color: theme.color.primary }]}>{formatPhoneDisplay(task.client.phone)}</Text>
                </TouchableOpacity>
              )}
            </View>
            <StatusBadge label={derivedStatus} color={derivedStatusColor} />
          </View>

          {/* ── ASSIGNED TO ── */}
          <TouchableOpacity
            style={s.assigneeRow}
            onPress={() => { setShowAssigneePicker(v => !v); setAssigneeSearch(''); }}
            activeOpacity={0.7}
          >
            <Text style={s.metaLabel}>{t('assignTo').toUpperCase()} ✎</Text>
            {savingAssignee ? (
              <ActivityIndicator size="small" color={theme.color.primary} style={{ marginTop: 2 }} />
            ) : (
              <Text style={[s.assigneeValue, !task.assignee && { color: theme.color.textMuted }]}>
                {task.assignee ? `👤 ${task.assignee.name}` : `👤 ${t('assignTo')}`}
              </Text>
            )}
          </TouchableOpacity>

          {/* Inline assignee picker */}
          {showAssigneePicker && (
            <View style={s.assigneePickerPanel}>
              <TextInput
                style={s.assigneeSearchInput}
                value={assigneeSearch}
                onChangeText={setAssigneeSearch}
                placeholder={t('searchMember')}
                placeholderTextColor={theme.color.textMuted}
                autoFocus
              />
              <View>
                {task.assignee && (
                  <TouchableOpacity style={s.assigneePickerItem} onPress={() => handleSetFileAssignee(null)}>
                    <Text style={[s.assigneePickerItemText, { color: theme.color.danger }]}>✕ Remove assignment</Text>
                  </TouchableOpacity>
                )}
                {allMembers
                  .filter(m => !assigneeSearch.trim() || m.name.toLowerCase().includes(assigneeSearch.toLowerCase()))
                  .slice(0, 15)
                  .map(m => (
                    <TouchableOpacity
                      key={m.id}
                      style={[s.assigneePickerItem, task.assigned_to === m.id && s.assigneePickerItemActive]}
                      onPress={() => handleSetFileAssignee(m.id)}
                    >
                      <Text style={[s.assigneePickerItemText, task.assigned_to === m.id && { color: theme.color.primary, fontWeight: '700' }]}>
                        {task.assigned_to === m.id ? '✓ ' : ''}{m.name}
                      </Text>
                      {m.role ? <Text style={s.assigneePickerItemRole}>{m.role}</Text> : null}
                    </TouchableOpacity>
                  ))}
              </View>
            </View>
          )}

          {/* ROW 1: SERVICE (left) + DOCUMENTS (right) — equal width, same level */}
          <View style={s.metaGrid}>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>SERVICE</Text>
              <Text style={s.metaValue} numberOfLines={2}>{task.service?.name}</Text>
            </View>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>DOCUMENTS</Text>
              {task.service?.id ? (
                <TouchableOpacity
                  onPress={() => { setShowDocSheet(true); loadServiceDocsForSheet(task.service!.id); }}
                  activeOpacity={0.75}
                  style={ds.docSheetChip}
                >
                  <Text style={ds.docSheetChipText}>📋 Required Docs</Text>
                </TouchableOpacity>
              ) : (
                <Text style={[s.metaValue, { color: theme.color.textMuted }]}>—</Text>
              )}
            </View>
          </View>

          {/* ROW 2: OPENED (left) + DUE DATE (right) — equal width, same level */}
          <View style={s.metaGrid}>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>OPENED</Text>
              <Text style={s.metaValue}>{formatDate(task.created_at)}</Text>
            </View>
            <TouchableOpacity style={s.metaCell} onPress={() => setShowDueDateCalendar(v => !v)} activeOpacity={0.7}>
              <Text style={s.metaLabel}>{t('dueDate').toUpperCase()} ✎</Text>
              <Text style={[s.metaValue, !task.due_date && { color: theme.color.textMuted }]}>
                {task.due_date ? formatDateOnly(task.due_date) : 'Tap to set'}
              </Text>
            </TouchableOpacity>
          </View>

          {task.notes ? (
            <View style={s.notesBlock}>
              <Text style={s.metaLabel}>{t('notes').toUpperCase()}</Text>
              <Text style={s.notesText}>{task.notes}</Text>
            </View>
          ) : null}

          <View style={s.headerActionsRow}>
            {permissions.can_edit_file_details && (
              <TouchableOpacity style={s.editTaskBtn} onPress={openEditTask}>
                <Text style={s.editTaskBtnText}>✎ Edit</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.shareWhatsAppBtn} onPress={handleShareWhatsApp}>
              <Text style={s.shareWhatsAppBtnText}>📤 WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.duplicateBtn, duplicating && { opacity: 0.6 }]} onPress={handleDuplicateTask} disabled={duplicating}>
              {duplicating
                ? <ActivityIndicator size="small" color={theme.color.white} />
                : <Text style={s.duplicateBtnText}>📋 Duplicate</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── INLINE DUE DATE CALENDAR ── */}
        {showDueDateCalendar && (
          <View style={s.dueDateCalendarCard}>
            <Calendar
              firstDay={1}
              current={task.due_date ?? undefined}
              markedDates={task.due_date ? { [task.due_date]: { selected: true, selectedColor: theme.color.primary } } : {}}
              onDayPress={(day: { dateString: string }) => handleSetDueDate(day.dateString)}
              theme={{
                backgroundColor: theme.color.bgBase,
                calendarBackground: theme.color.bgBase,
                textSectionTitleColor: theme.color.textMuted,
                selectedDayBackgroundColor: theme.color.primary,
                selectedDayTextColor: theme.color.white,
                todayBackgroundColor: theme.color.primary,
                todayTextColor: theme.color.white,
                dayTextColor: theme.color.textSecondary,
                textDisabledColor: theme.color.border,
                arrowColor: theme.color.primary,
                monthTextColor: theme.color.textPrimary,
              }}
            />
            {task.due_date && (
              <TouchableOpacity style={s.dueDateClearBtn} onPress={() => handleSetDueDate(null)}>
                <Text style={s.dueDateClearBtnText}>✕ Clear due date</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── COMMENTS ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('commentsSection').toUpperCase()} & ACTIVITY</Text>
          {comments.length === 0 && (
            <Text style={s.emptyText}>No comments yet.</Text>
          )}
          {comments.map((c) => (
            <View key={c.id} style={s.commentRow}>
              <View style={s.commentAvatar}>
                <Text style={s.commentAvatarText}>
                  {(c.author?.name ?? '?').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={s.commentHeader}>
                  <Text style={s.commentAuthor}>{c.author?.name ?? 'Unknown'}</Text>
                  <Text style={s.commentTime}>{formatDate(c.created_at)}</Text>
                  {editingCommentId !== c.id && (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {permissions.can_add_comments && (
                        <TouchableOpacity onPress={() => { setEditingCommentId(c.id); setEditingCommentBody(c.body); }}>
                          <Text style={s.commentEditBtn}>✎</Text>
                        </TouchableOpacity>
                      )}
                      {permissions.can_delete_comments && (
                        <TouchableOpacity onPress={() => handleDeleteComment(c.id)}>
                          <Text style={s.commentDeleteBtn}>🗑</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
                {editingCommentId === c.id ? (
                  <View style={s.commentEditRow}>
                    <TextInput
                      style={s.commentEditInput}
                      value={editingCommentBody}
                      onChangeText={setEditingCommentBody}
                      multiline
                      autoFocus
                      placeholderTextColor={theme.color.textMuted}
                    />
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                      <TouchableOpacity style={s.commentSaveBtn} onPress={handleSaveEditComment} disabled={savingEditComment}>
                        {savingEditComment
                          ? <ActivityIndicator size="small" color={theme.color.white} />
                          : <Text style={s.commentSaveBtnText}>{t('save')}</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity style={s.commentCancelBtn} onPress={() => { setEditingCommentId(null); setEditingCommentBody(''); }}>
                        <Text style={s.commentCancelBtnText}>{t('cancel')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : c.audio_url ? (
                  /* Voice note player */
                  <View style={s.voiceNotePlayer}>
                    <TouchableOpacity
                      style={s.voiceNotePlayBtn}
                      onPress={() => handlePlayPause(c.id, c.audio_url!)}
                    >
                      <Text style={s.voiceNotePlayBtnText}>
                        {playingCommentId === c.id ? '⏸' : '▶'}
                      </Text>
                    </TouchableOpacity>
                    <View style={s.voiceNoteInfo}>
                      <View style={s.voiceNoteBar}>
                        {playingCommentId === c.id && playbackDuration > 0 ? (
                          <View style={[s.voiceNoteProgress, { width: `${(playbackPosition / playbackDuration) * 100}%` as any }]} />
                        ) : (
                          <View style={[s.voiceNoteProgress, { width: '0%' }]} />
                        )}
                      </View>
                      <Text style={s.voiceNoteDuration}>
                        {playingCommentId === c.id && playbackDuration > 0
                          ? `${fmtDuration(Math.floor(playbackPosition / 1000))} / ${fmtDuration(Math.floor(playbackDuration / 1000))}`
                          : '🎤 Voice note'}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={s.commentBody}>{c.body}</Text>
                )}
              </View>
            </View>
          ))}
          {/* Recording indicator */}
          {isRecording && (
            <View style={s.recordingBar}>
              <View style={s.recordingDot} />
              <Text style={s.recordingText}>Recording... {fmtDuration(recordingDuration)}</Text>
              <TouchableOpacity style={s.recordingStopBtn} onPress={handleStopRecording}>
                <Text style={s.recordingStopBtnText}>⏹ Stop</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Recorded preview (before sending) */}
          {!isRecording && !isListening && recordedUri && (
            <View style={s.voicePreviewBar}>
              <Text style={s.voicePreviewLabel}>🎤 {fmtDuration(recordingDuration)}</Text>

              {/* Save — upload recording as voice note comment */}
              <TouchableOpacity
                style={[s.commentSendBtn, { backgroundColor: theme.color.success }]}
                onPress={handleSendVoiceNote}
                disabled={uploadingVoice}
              >
                {uploadingVoice
                  ? <ActivityIndicator color={theme.color.white} size="small" />
                  : <Text style={s.commentSendBtnText}>{t('save')}</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={s.voiceDiscardBtn}
                onPress={handleDiscardRecording}
                disabled={uploadingVoice}
              >
                <Text style={s.voiceDiscardBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Listening state — live speech recognition active */}
          {isListening && (
            <View style={s.voicePreviewBar}>
              <ActivityIndicator color={theme.color.primary} size="small" />
              <Text style={[s.voicePreviewLabel, { flex: 1 }]}>
                {voicePartial || '🎤 Listening...'}
              </Text>
              <TouchableOpacity style={s.voiceDiscardBtn} onPress={handleStopListening}>
                <Text style={s.voiceDiscardBtnText}>⏹</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Normal comment input (hidden while recording/preview/listening, gated by permission) */}
          {!isRecording && !recordedUri && !isListening && permissions.can_add_comments && (
            <View style={s.commentInput}>
              <TextInput
                style={s.commentTextInput}
                value={newComment}
                onChangeText={setNewComment}
                placeholder={t('addComment')}
                placeholderTextColor={theme.color.textMuted}
                multiline
              />
              {/* Mic button — record voice note */}
              <TouchableOpacity style={s.micBtn} onPress={handleStartRecording}>
                <Text style={s.micBtnText}>🎙</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.commentSendBtn, postingComment && s.disabledBtn]}
                onPress={handlePostComment}
                disabled={postingComment}
              >
                {postingComment ? (
                  <ActivityIndicator color={theme.color.white} size="small" />
                ) : (
                  <Text style={s.commentSendBtnText}>Post</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── DOCUMENTS ── */}
        <View style={s.section}>
          <View style={s.sectionTitleRow}>
            <Text style={s.sectionTitle}>{t('documentsSection').toUpperCase()} ({documents.length})</Text>
            {permissions.can_upload_documents && (
              <View style={s.docBtnRow}>
                <TouchableOpacity style={s.scanDocBtn} onPress={() => setScanMode('camera')}>
                  <Text style={s.scanDocBtnText}>📷 Scan</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.addDocBtn} onPress={() => setScanMode('library')}>
                  <Text style={s.addDocBtnText}>🖼 Image</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.pdfDocBtn} onPress={handlePickPdf} disabled={uploadingPdf}>
                  {uploadingPdf
                    ? <ActivityIndicator size="small" color={theme.color.white} />
                    : <Text style={s.pdfDocBtnText}>📄 PDF</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {documents.length === 0 ? (
            <View style={s.docEmpty}>
              <Text style={s.docEmptyIcon}>📄</Text>
              <Text style={s.docEmptyText}>No documents yet</Text>
              {permissions.can_upload_documents && (
                <View style={s.docEmptyBtnRow}>
                  <TouchableOpacity style={s.scanDocBtn} onPress={() => setScanMode('camera')}>
                    <Text style={s.scanDocBtnText}>📷 Scan</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.addDocBtn} onPress={() => setScanMode('library')}>
                    <Text style={s.addDocBtnText}>🖼 Image</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.pdfDocBtn} onPress={handlePickPdf} disabled={uploadingPdf}>
                    {uploadingPdf
                      ? <ActivityIndicator size="small" color={theme.color.white} />
                      : <Text style={s.pdfDocBtnText}>📄 PDF</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            documents.map((doc) => {
              const isPDF  = /application\/pdf/i.test(doc.file_type) || /\.pdf$/i.test(doc.file_url);
              const isImage = /image\//i.test(doc.file_type) || /\.(jpg|jpeg|png)$/i.test(doc.file_url);
              const label  = doc.display_name || doc.file_name;
              return (
                <View key={doc.id} style={s.docRow}>
                  {/* Icon */}
                  <View style={s.docRowIcon}>
                    <Text style={s.docRowIconText}>{isPDF ? '📄' : '🖼'}</Text>
                  </View>

                  {/* Info — tap name to view */}
                  <TouchableOpacity style={{ flex: 1, gap: 3 }} onPress={() => handleOpenDoc(doc)} activeOpacity={0.7}>
                    <Text style={[s.docRowName, s.docRowNameTappable]} numberOfLines={1}>{label}</Text>
                    {doc.requirement?.title && (
                      <View style={s.docReqTag}>
                        <Text style={s.docReqTagText}>📋 {doc.requirement.title}</Text>
                      </View>
                    )}
                    <Text style={s.docRowMeta}>
                      {isPDF ? 'PDF' : isImage ? 'Image' : 'File'}
                      {doc.uploader?.name ? `  ·  ${doc.uploader.name}` : ''}
                      {`  ·  ${formatDate(doc.created_at)}`}
                    </Text>
                  </TouchableOpacity>

                  {/* Rename + Delete buttons */}
                  <View style={s.docActionBtns}>
                    {permissions.can_upload_documents && (
                      <TouchableOpacity
                        onPress={() => { setRenamingDoc(doc); setRenameText(doc.display_name || doc.file_name || ''); }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={s.docRenameBtn}
                      >
                        <Text style={s.docRenameBtnText}>✎</Text>
                      </TouchableOpacity>
                    )}
                    {permissions.can_delete_documents && (deletingDocId === doc.id ? (
                      <ActivityIndicator size="small" color={theme.color.danger} />
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleDeleteDocument(doc)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={s.docDeleteBtn}
                      >
                        <Text style={s.docDeleteBtnText}>🗑</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* ── STAGES ROUTE ── */}
        <View style={s.section}>
          <View style={s.sectionTitleRow}>
            <Text style={s.sectionTitle}>{t('stagesSection').toUpperCase()}</Text>
            {permissions.can_add_edit_stages && (
              <>
                <TouchableOpacity style={s.addStageBtn} onPress={openEditStages}>
                  <Text style={s.addStageBtnText}>+ {t('addStage')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.editStagesBtn} onPress={openEditStages}>
                  <Text style={s.editStagesBtnText}>✎ {t('edit')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          <View style={s.routeContainer}>
            {task.route_stops?.map((stop, idx) => {
              const stopHistory = stopHistories[stop.id] ?? [];
              const isHistoryExpanded = expandedStopHistory === stop.id;
              // Resolve city name: prefer joined data, fall back to allCities cache
              // (newly created cities may not appear in the join on immediate refetch)
              const stopCityName = stop.city?.name ?? allCities.find(c => c.id === stop.city_id)?.name ?? null;
              const isLast = idx === (task.route_stops?.length ?? 0) - 1;
              return (
                <View key={stop.id} style={s.stageRow}>

                  {/* ── Rail: dot + continuous line ── */}
                  <View style={s.stageRail}>
                    <View style={[s.stageDot, { backgroundColor: getStatusColor(stop.status) }]} />
                    {!isLast && <View style={s.stageLine} />}
                  </View>

                  {/* ── All stage content (rail line spans this full height) ── */}
                  <View style={s.stageContent}>

                    {/* Ministry name + order — tap to edit name / city / requirements */}
                    <TouchableOpacity
                      style={s.stageHeader}
                      onPress={() => {
                        setOpenStageNameId(v => v === stop.id ? null : stop.id);
                        setStageNameEdit(stop.ministry?.name ?? '');
                        setOpenCityStopId(null);
                        setOpenAssigneeStopId(null);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.stageMinistryName} numberOfLines={2}>
                          {stop.ministry?.name ?? 'Unknown Ministry'}
                        </Text>
                        {/* City is already shown in the 📍 chip below — don't duplicate it under the stage name */}
                      </View>
                      <Text style={[s.stageOrder, { color: theme.color.primary }]}>
                        {openStageNameId === stop.id ? '▲' : '✎'}
                      </Text>
                    </TouchableOpacity>

                    {/* Inline name-edit + city + requirements panel */}
                    {openStageNameId === stop.id && (
                      <View style={s.stageNamePanel}>
                        <TextInput
                          style={s.stageNameInput}
                          value={stageNameEdit}
                          onChangeText={setStageNameEdit}
                          placeholder={t('stageName')}
                          placeholderTextColor={theme.color.textMuted}
                          autoFocus
                        />

                        {/* City picker chip inside panel */}
                        <TouchableOpacity
                          style={[s.stopMetaChip, { marginTop: theme.spacing.space2, alignSelf: 'flex-start' }]}
                          onPress={() => {
                            setOpenCityStopId(v => v === stop.id ? null : stop.id);
                            setStopCitySearch('');
                            setShowCreateCityForm(false);
                            setNewCityName('');
                          }}
                        >
                          <Text style={[s.stopMetaChipText, stopCityName ? { color: theme.color.primary, fontWeight: '600' } : {}]}>
                            {stopCityName ? `📍 ${stopCityName}` : '📍 Set city'}
                          </Text>
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', gap: theme.spacing.space2, marginTop: theme.spacing.space2 }}>
                          <TouchableOpacity
                            style={[s.stageNameBtn, { flex: 1, backgroundColor: theme.color.primary }]}
                            onPress={() => stop.ministry_id && handleRenameStopMinistry(stop.ministry_id, stageNameEdit)}
                            disabled={savingStageNameId === stop.ministry_id}
                          >
                            {savingStageNameId === stop.ministry_id
                              ? <ActivityIndicator size="small" color={theme.color.white} />
                              : <Text style={[s.stageNameBtnText, { color: theme.color.white }]}>💾 Save</Text>}
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {/* ── 2×2 chip grid (City · Due Date / Status · Assignee) ── */}
                    <View style={s.stageChipGrid}>
                    <View style={s.stageChipRow}>
                      {/* City chip */}
                      <TouchableOpacity
                        style={[s.stageChip, {
                          borderColor: stop.city_id ? theme.color.primary + '70' : theme.color.border,
                          backgroundColor: stop.city_id ? theme.color.primary + '18' : theme.color.bgBase,
                        }]}
                        onPress={() => { setOpenCityStopId(v => v === stop.id ? null : stop.id); setStopCitySearch(''); setShowCreateCityForm(false); setNewCityName(''); }}
                        activeOpacity={0.7}
                      >
                        <>
                          <Text style={s.stageChipIcon}>📍</Text>
                          <Text style={[s.stageChipLabel, { color: stop.city_id ? theme.color.primary : theme.color.textMuted }]} numberOfLines={1}>
                            {stopCityName ?? 'Set city'}
                          </Text>
                          <Text style={[s.stageChipArrow, { color: stop.city_id ? theme.color.primary + 'BB' : theme.color.border }]}>▾</Text>
                        </>
                      </TouchableOpacity>

                      {/* Due date chip */}
                      <TouchableOpacity
                        style={[s.stageChip, {
                          borderColor: stop.due_date ? theme.color.warning + '70' : theme.color.border,
                          backgroundColor: stop.due_date ? theme.color.warning + '18' : theme.color.bgBase,
                        }]}
                        onPress={() => setStopDueDatePickerStopId(stop.id)}
                        activeOpacity={0.7}
                      >
                        {savingStopDueDate === stop.id ? (
                          <ActivityIndicator size="small" color={theme.color.warning} />
                        ) : (
                          <>
                            <Text style={s.stageChipIcon}>📅</Text>
                            <Text style={[s.stageChipLabel, { color: stop.due_date ? theme.color.warning : theme.color.textMuted }]} numberOfLines={1}>
                              {stop.due_date ? formatDateOnly(stop.due_date) : 'Due date'}
                            </Text>
                            <Text style={[s.stageChipArrow, { color: stop.due_date ? theme.color.warning + 'BB' : theme.color.border }]}>▾</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>{/* end Row 1 */}

                    {/* Rejection reason — shown inline when status is Rejected */}
                    {stop.status === 'Rejected' && stop.rejection_reason ? (
                      <View style={s.rejectionReasonRow}>
                        <Text style={s.rejectionReasonText}>⚠ {stop.rejection_reason}</Text>
                      </View>
                    ) : null}

                    {/* ── Row 2: Status + Assignee ── */}
                    <View style={s.stageChipRow}>
                      {/* Status chip */}
                      <TouchableOpacity
                        style={[s.stageChip, {
                          borderColor: getStatusColor(stop.status) + '70',
                          backgroundColor: getStatusColor(stop.status) + '18',
                        }]}
                        onPress={() => { if (permissions.can_update_stage_status) { setSelectedStop(stop); setShowStatusPicker(true); } }}
                        disabled={updatingStop === stop.id || !permissions.can_update_stage_status}
                        activeOpacity={permissions.can_update_stage_status ? 0.7 : 1}
                      >
                        {updatingStop === stop.id ? (
                          <ActivityIndicator size="small" color={getStatusColor(stop.status)} />
                        ) : (
                          <>
                            <View style={[s.stageChipDot, { backgroundColor: getStatusColor(stop.status) }]} />
                            <Text style={[s.stageChipLabel, { color: getStatusColor(stop.status) }]} numberOfLines={1}>
                              {stop.status}
                            </Text>
                            <Text style={[s.stageChipArrow, { color: getStatusColor(stop.status) + 'BB' }]}>▾</Text>
                          </>
                        )}
                      </TouchableOpacity>

                      {/* Assignee chip */}
                      <TouchableOpacity
                        style={[s.stageChip, {
                          borderColor: (stop.assignee || stop.ext_assignee) ? theme.color.success + '70' : theme.color.border,
                          backgroundColor: (stop.assignee || stop.ext_assignee) ? theme.color.success + '18' : theme.color.bgBase,
                        }]}
                        onPress={() => { setOpenAssigneeStopId(v => v === stop.id ? null : stop.id); setShowCreateExtForm(false); setNewExtName(''); setNewExtPhone(''); setNewExtReference(''); setStopAssigneeSearch(''); }}
                        activeOpacity={0.7}
                      >
                        <>
                          <Text style={s.stageChipIcon}>👤</Text>
                          <Text style={[s.stageChipLabel, { color: (stop.assignee || stop.ext_assignee) ? theme.color.success : theme.color.textMuted }]} numberOfLines={1}>
                            {stop.assignee?.name ?? stop.ext_assignee?.name ?? 'Set assignee'}
                          </Text>
                          <Text style={[s.stageChipArrow, { color: (stop.assignee || stop.ext_assignee) ? theme.color.success + 'BB' : theme.color.border }]}>▾</Text>
                        </>
                      </TouchableOpacity>
                    </View>{/* end Row 2 */}
                    </View>{/* end stageChipGrid */}

                    {/* Saving indicator + History toggle */}
                    {(savingStopField === stop.id || stopHistory.length > 0) && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {savingStopField === stop.id && <ActivityIndicator size="small" color={theme.color.primary} />}
                        {stopHistory.length > 0 && (
                          <TouchableOpacity
                            style={s.historyToggleBtn}
                            onPress={() => setExpandedStopHistory(isHistoryExpanded ? null : stop.id)}
                          >
                            <Text style={s.historyToggleBtnText}>
                              {isHistoryExpanded ? '▲ Hide' : `▼ History (${stopHistory.length})`}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                  {/* City dropdown */}
                  {openCityStopId === stop.id && (
                    <View style={s.stopDropdown}>
                      <TextInput style={s.citySearchInner} value={stopCitySearch}
                        onChangeText={text => { setStopCitySearch(text); setShowCreateCityForm(false); setNewCityName(text); }}
                        placeholder={t('searchCity')} placeholderTextColor={theme.color.textMuted} autoFocus autoCorrect={false} />
                      {/* Create new city — always visible above the list */}
                      <TouchableOpacity
                        style={[s.cityDropdownItem, { borderBottomWidth: 1, borderBottomColor: theme.color.border }]}
                        onPress={() => { setShowCreateCityForm(v => !v); if (!newCityName) setNewCityName(stopCitySearch); }}
                      >
                        <Text style={{ color: theme.color.primary, fontSize: 13, fontWeight: '600', padding: theme.spacing.space2 }}>
                          {showCreateCityForm ? '− Cancel' : '+ Create New City'}
                        </Text>
                      </TouchableOpacity>
                      {showCreateCityForm && (
                        <View style={{ padding: theme.spacing.space2, gap: 6, borderBottomWidth: 1, borderBottomColor: theme.color.border }}>
                          <TextInput style={s.newMemberInput} value={newCityName} onChangeText={setNewCityName}
                            placeholder={`${t('city')} *`} placeholderTextColor={theme.color.textMuted} />
                          <TouchableOpacity
                            style={[s.newMemberSaveBtn, savingCity && s.disabledBtn]}
                            onPress={() => handleCreateCity(stop.id)}
                            disabled={savingCity}
                          >
                            {savingCity
                              ? <ActivityIndicator color={theme.color.white} size="small" />
                              : <Text style={s.newMemberSaveBtnText}>Save & Select</Text>}
                          </TouchableOpacity>
                        </View>
                      )}
                      <View>
                        {/* Remove current city */}
                        {stop.city_id && (
                          <TouchableOpacity style={s.cityDropdownItem} onPress={() => handleSetStopCity(stop.id, null)}>
                            <Text style={{ color: theme.color.danger, fontSize: 13, padding: theme.spacing.space2 }}>✕ Remove city</Text>
                          </TouchableOpacity>
                        )}
                        {/* Pinned cities — always visible */}
                        {pinnedCityIds.length > 0 && !stopCitySearch.trim() && (
                          <View style={{ backgroundColor: theme.color.bgBase, paddingHorizontal: theme.spacing.space3, paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: theme.color.border }}>
                            <Text style={{ ...theme.typography.caption, color: theme.color.textMuted, fontWeight: '700' }}>PINNED</Text>
                          </View>
                        )}
                        {allCities.filter(c => pinnedCityIds.includes(c.id) && (!stopCitySearch.trim() || c.name.toLowerCase().includes(stopCitySearch.trim().toLowerCase()))).map(city => (
                          <View key={city.id} style={[s.cityDropdownItem, stop.city_id === city.id && s.cityDropdownItemActive]}>
                            <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                              onPress={() => handleSetStopCity(stop.id, city.id)}>
                              <Text style={[s.cityDropdownItemText, stop.city_id === city.id && { fontWeight: '600' }]}>{city.name}</Text>
                              {stop.city_id === city.id && <Text style={s.checkmark}>✓</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => togglePinCity(city.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <Text style={{ fontSize: 14 }}>📌</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                        {/* Search results (non-pinned) */}
                        {stopCitySearch.trim() ? (
                          allCities.filter(c => !pinnedCityIds.includes(c.id) && c.name.toLowerCase().includes(stopCitySearch.trim().toLowerCase())).length === 0
                          && pinnedCityIds.filter(id => allCities.find(c => c.id === id)?.name.toLowerCase().includes(stopCitySearch.trim().toLowerCase())).length === 0
                            ? <Text style={{ color: theme.color.textMuted, fontSize: 13, padding: theme.spacing.space3 }}>No cities match "{stopCitySearch}"</Text>
                            : allCities.filter(c => !pinnedCityIds.includes(c.id) && c.name.toLowerCase().includes(stopCitySearch.trim().toLowerCase())).map(city => (
                              <View key={city.id} style={[s.cityDropdownItem, stop.city_id === city.id && s.cityDropdownItemActive]}>
                                <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                                  onPress={() => handleSetStopCity(stop.id, city.id)}>
                                  <Text style={[s.cityDropdownItemText, stop.city_id === city.id && { fontWeight: '600' }]}>{city.name}</Text>
                                  {stop.city_id === city.id && <Text style={s.checkmark}>✓</Text>}
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => togglePinCity(city.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                  <Text style={{ fontSize: 14, opacity: 0.35 }}>📍</Text>
                                </TouchableOpacity>
                              </View>
                            ))
                        ) : (
                          pinnedCityIds.length === 0 && !stop.city_id && (
                            <Text style={{ color: theme.color.textMuted, fontSize: 12, padding: theme.spacing.space3 }}>
                              Search for a city or pin one to show it here
                            </Text>
                          )
                        )}
                      </View>
                    </View>
                  )}

                  {/* Assignee dropdown */}
                  {openAssigneeStopId === stop.id && (
                    <View style={s.stopDropdown}>
                      {/* Search bar */}
                      <TextInput
                        style={s.stopAssigneeSearch}
                        value={stopAssigneeSearch}
                        onChangeText={setStopAssigneeSearch}
                        placeholder={t('searchContact')}
                        placeholderTextColor={theme.color.textMuted}
                        autoCorrect={false}
                        clearButtonMode="while-editing"
                      />
                      <View>
                        {(stop.assigned_to || stop.ext_assignee_id) && !stopAssigneeSearch.trim() && (
                          <TouchableOpacity style={s.cityDropdownItem} onPress={() => handleSetStopAssignee(stop.id, null, null)}>
                            <Text style={{ color: theme.color.danger, fontSize: 13, padding: theme.spacing.space2 }}>✕ Remove assignee</Text>
                          </TouchableOpacity>
                        )}
                        {/* Team members section */}
                        {allMembers
                          .filter(m => !stopAssigneeSearch.trim() || m.name.toLowerCase().includes(stopAssigneeSearch.toLowerCase()) || m.role?.toLowerCase().includes(stopAssigneeSearch.toLowerCase()))
                          .slice(0, 15)
                          .map(m => (
                            <TouchableOpacity key={m.id}
                              style={[s.cityDropdownItem, stop.assigned_to === m.id && s.cityDropdownItemActive]}
                              onPress={() => handleSetStopAssignee(stop.id, m.id, null)}>
                              <View style={{ flex: 1 }}>
                                <Text style={s.cityDropdownItemText}>{m.name}</Text>
                                {m.role ? <Text style={{ fontSize: 11, color: theme.color.textMuted }}>{m.role}</Text> : null}
                              </View>
                              {stop.assigned_to === m.id && <Text style={s.checkmark}>✓</Text>}
                            </TouchableOpacity>
                          ))}
                        {/* Network contacts (ext assignees) */}
                        {extAssignees
                          .filter(a => {
                            if (!stopAssigneeSearch.trim()) return true;
                            const q = stopAssigneeSearch.toLowerCase();
                            return (
                              a.name?.toLowerCase().includes(q) ||
                              a.phone?.toLowerCase().includes(q) ||
                              a.reference?.toLowerCase().includes(q) ||
                              a.reference_phone?.toLowerCase().includes(q) ||
                              a.city?.name?.toLowerCase().includes(q)
                            );
                          })
                          .slice(0, 15)
                          .map((a: any) => (
                            <TouchableOpacity key={a.id}
                              style={[s.cityDropdownItem, stop.ext_assignee_id === a.id && s.cityDropdownItemActive]}
                              onPress={() => handleSetStopAssignee(stop.id, null, a.id)}>
                              <View style={{ flex: 1 }}>
                                <Text style={s.cityDropdownItemText}>{a.name}</Text>
                                {a.phone ? <Text style={{ fontSize: 11, color: theme.color.textMuted }}>📞 {formatPhoneDisplay(a.phone)}</Text> : null}
                                {a.reference ? <Text style={{ fontSize: 11, color: theme.color.textMuted }}>عبر {a.reference}</Text> : null}
                                {a.city?.name ? <Text style={{ fontSize: 11, color: theme.color.textMuted }}>📍 {a.city.name}</Text> : null}
                              </View>
                              {stop.ext_assignee_id === a.id && <Text style={s.checkmark}>✓</Text>}
                            </TouchableOpacity>
                          ))}
                        {/* No results */}
                        {stopAssigneeSearch.trim() &&
                          allMembers.filter(m => m.name.toLowerCase().includes(stopAssigneeSearch.toLowerCase())).length === 0 &&
                          extAssignees.filter(a => a.name?.toLowerCase().includes(stopAssigneeSearch.toLowerCase()) || a.phone?.toLowerCase().includes(stopAssigneeSearch.toLowerCase()) || a.reference?.toLowerCase().includes(stopAssigneeSearch.toLowerCase())).length === 0 && (
                            <Text style={{ padding: theme.spacing.space3, color: theme.color.textMuted, fontSize: 13 }}>No contacts match "{stopAssigneeSearch}"</Text>
                          )}
                        {/* Create new external assignee — toggle button */}
                        {!stopAssigneeSearch.trim() && (
                          <TouchableOpacity style={s.cityDropdownItem}
                            onPress={() => setShowCreateExtForm(v => !v)}>
                            <Text style={{ color: theme.color.primary, fontSize: 13, fontWeight: '600', padding: theme.spacing.space2 }}>
                              {showCreateExtForm ? '− Cancel' : '+ Create New Contact'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {/* Create form rendered below — page now scrolls naturally to reveal it */}
                      {showCreateExtForm && (
                        <View style={{ padding: theme.spacing.space3, gap: 8, borderTopWidth: 1, borderTopColor: theme.color.border }}>
                          <TextInput style={s.newMemberInput} value={newExtName} onChangeText={setNewExtName}
                            placeholder={t('fullNameRequired')} placeholderTextColor={theme.color.textMuted} />
                          <TextInput style={s.newMemberInput} value={newExtPhone} onChangeText={setNewExtPhone}
                            placeholder={t('phone')} placeholderTextColor={theme.color.textMuted} keyboardType="phone-pad" />
                          <TextInput style={s.newMemberInput} value={newExtReference} onChangeText={setNewExtReference}
                            placeholder={t('reference')} placeholderTextColor={theme.color.textMuted} />
                          <TouchableOpacity
                            style={[s.newMemberSaveBtn, savingExtAssignee && s.disabledBtn]}
                            onPress={() => handleCreateExtAssigneeForStop(stop.id)}
                            disabled={savingExtAssignee}
                          >
                            {savingExtAssignee
                              ? <ActivityIndicator color={theme.color.white} size="small" />
                              : <Text style={s.newMemberSaveBtnText}>Save & Assign</Text>}
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Status history for this stop */}
                  {isHistoryExpanded && stopHistory.length > 0 && (
                    <View style={s.stopHistoryBlock}>
                      {stopHistory.map((h) => (
                        <View key={h.id} style={s.stopHistoryRow}>
                          <View style={s.stopHistoryDot} />
                          <View style={{ flex: 1 }}>
                            <View style={s.stopHistoryTextRow}>
                              {h.old_status && (
                                <Text style={s.stopHistoryOld}>{h.old_status}</Text>
                              )}
                              {h.old_status && (
                                <Text style={s.stopHistoryArrow}> → </Text>
                              )}
                              <Text style={s.stopHistoryNew}>{h.new_status}</Text>
                            </View>
                            <Text style={s.stopHistoryMeta}>
                              {h.updater?.name ?? 'Unknown'} · {formatDate(h.created_at)}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── FINANCIALS ── */}
        {(permissions.can_see_file_financials || permissions.can_see_contract_price ||
          permissions.can_add_expenses || permissions.can_add_revenue) && (
        <View style={s.section}>
          {/* Title row */}
          <View style={s.sectionTitleRow}>
            <Text style={s.sectionTitle}>{t('financialsSection').toUpperCase()}</Text>
          </View>

          {/* Contract price row — only if permitted */}
          {permissions.can_see_contract_price && (
          <View style={s.contractPriceRow}>
            {/* Header row: CONTRACT PRICE label (left) + Edit button (right, aligned with label) */}
            <View style={s.contractPriceHeaderRow}>
              <TouchableOpacity onPress={() => setShowPriceHistory(v => !v)} activeOpacity={0.7} style={{ flex: 1 }}>
                <Text style={s.balanceLabel}>{t('contractPrice').toUpperCase()} {showPriceHistory ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {permissions.can_edit_contract_price && (
                <TouchableOpacity
                  style={s.editPriceBtn}
                  onPress={() => {
                    setEditPriceUSD(contractPriceUSD > 0 ? String(contractPriceUSD) : '');
                    setEditPriceLBP(contractPriceLBP > 0 ? contractPriceLBP.toLocaleString('en-US') : '');
                    setEditPriceNote('');
                    setShowEditPrice(true);
                  }}
                >
                  <Text style={s.editPriceBtnText}>✎ Edit</Text>
                </TouchableOpacity>
              )}
            </View>
            {/* Contract price USD/LBP values */}
            <View style={s.balanceAmounts}>
              <Text style={s.contractPriceVal}>{fmtUSD(contractPriceUSD)}</Text>
              <Text style={s.contractPriceValLBP}>{fmtLBP(contractPriceLBP)}</Text>
            </View>
            {/* BALANCE row — full width so USD/LBP cols align with P&L section below */}
            {contractPriceUSD > 0 && (
              <View style={[s.balanceRow, { marginTop: theme.spacing.space2 }]}>
                <Text style={s.balanceLabel}>{t('balance').toUpperCase()}</Text>
                <Text style={[s.balanceCol, outstandingUSD > 0 ? s.negative : s.positive]}>
                  {fmtUSD(outstandingUSD)}
                </Text>
                <Text style={[
                  s.balanceColLBP,
                  contractPriceLBP > 0
                    ? (outstandingLBP > 0 ? s.negative : s.positive)
                    : s.balanceRevenueLBP,
                ]}>
                  {fmtLBP(outstandingLBP)}
                </Text>
              </View>
            )}
          </View>
          )}

          {/* Contract price change history — collapsible */}
          {showPriceHistory && <View style={s.priceHistoryBlock}>
            <Text style={s.priceHistoryLabel}>CONTRACT PRICE CHANGES</Text>
            {priceHistory.length === 0 ? (
              <Text style={s.priceHistoryEmpty}>No changes recorded yet</Text>
            ) : (
              priceHistory.map((h) => (
                <View key={h.id} style={s.priceHistoryRow}>
                  <View style={s.stopHistoryDot} />
                  <View style={{ flex: 1 }}>
                    <View style={s.stopHistoryTextRow}>
                      <Text style={s.stopHistoryOld}>{fmtUSD(h.old_price_usd)}</Text>
                      <Text style={s.stopHistoryArrow}> → </Text>
                      <Text style={s.stopHistoryNew}>{fmtUSD(h.new_price_usd)}</Text>
                      {h.old_price_lbp > 0 && (
                        <Text style={[s.stopHistoryOld, { marginStart: 8 }]}>{fmtLBP(h.old_price_lbp)}</Text>
                      )}
                      {h.old_price_lbp > 0 && (
                        <Text style={s.stopHistoryArrow}> → </Text>
                      )}
                      {h.new_price_lbp > 0 && (
                        <Text style={s.stopHistoryNew}>{fmtLBP(h.new_price_lbp)}</Text>
                      )}
                    </View>
                    <Text style={s.stopHistoryMeta}>
                      Changed by <Text style={{ color: theme.color.primaryText }}>{h.changer?.name ?? 'Unknown'}</Text>
                      {' · '}{formatDate(h.created_at)}
                      {h.note ? `\n"${h.note}"` : ''}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>}

          {/* P&L summary — only visible when can_see_file_financials is on */}
          {permissions.can_see_file_financials && (
          <View style={s.balanceSummary}>
            <View style={s.balanceRow}>
              <Text style={s.balanceLabel}>{t('paymentsReceived').toUpperCase()}</Text>
              <Text style={[s.balanceCol, s.balanceRevenue]}>{fmtUSD(totalRevenueUSD)}</Text>
              <Text style={[s.balanceColLBP, s.balanceRevenueLBP]}>{fmtLBP(totalRevenueLBP)}</Text>
            </View>
            <View style={s.balanceRow}>
              <Text style={s.balanceLabel}>{t('expense').toUpperCase()}S</Text>
              <Text style={[s.balanceCol, s.balanceExpense]}>- {fmtUSD(totalExpenseUSD)}</Text>
              <Text style={[s.balanceColLBP, s.balanceExpenseLBP]}>- {fmtLBP(totalExpenseLBP)}</Text>
            </View>
            <View style={s.balanceDivider} />
            <View style={s.balanceRow}>
              <Text style={s.balanceTotalLabel}>RESULT (P&L)</Text>
              <Text style={[s.balanceCol, s.balanceTotal, balanceUSD >= 0 ? s.positive : s.negative]}>
                {balanceUSD >= 0 ? '+' : '-'} {fmtUSD(balanceUSD)}
              </Text>
              <Text style={[s.balanceColLBP, s.balanceTotalLBP, balanceLBP >= 0 ? s.positive : s.negative]}>
                {balanceLBP >= 0 ? '+' : '-'} {fmtLBP(balanceLBP)}
              </Text>
            </View>
            <View style={s.balanceDivider} />
            {/* TOTAL USD = USD P&L + (LBP P&L / rate) */}
            <View style={s.balanceRow}>
              <Text style={s.balanceTotalLabel}>TOTAL USD</Text>
              <Text style={[s.balanceCol, s.balanceTotal, totalCombinedUSD >= 0 ? s.positive : s.negative]}>
                {totalCombinedUSD >= 0 ? '+' : '-'} ${Math.abs(totalCombinedUSD).toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </Text>
              <View style={{ width: 120, alignItems: 'flex-end' }}>
                {editingRate ? (
                  <TextInput
                    style={s.rateInput}
                    value={rateInput}
                    onChangeText={setRateInput}
                    keyboardType="number-pad"
                    autoFocus
                    onBlur={() => {
                      const v = parseInt(rateInput.replace(/,/g, ''), 10);
                      if (!isNaN(v) && v > 0) { setExchangeRate(v); setRateInput(v.toLocaleString('en-US')); }
                      setEditingRate(false);
                    }}
                    onSubmitEditing={() => {
                      const v = parseInt(rateInput.replace(/,/g, ''), 10);
                      if (!isNaN(v) && v > 0) { setExchangeRate(v); setRateInput(v.toLocaleString('en-US')); }
                      setEditingRate(false);
                    }}
                  />
                ) : (
                  <TouchableOpacity onPress={() => { setRateInput(exchangeRate.toLocaleString('en-US')); setEditingRate(true); }}>
                    <Text style={s.rateDisplay}>÷ {exchangeRate.toLocaleString('en-US')} ✎</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
          )}

          {/* ── C/V USD Conversion Table ── */}
          {permissions.can_see_file_financials && transactions.length > 0 && (() => {
            const cvFmt = (n: number) =>
              `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            // C/V = USD + (LBP ÷ locked rate) — both currencies included, per-tx rate used
            const cvOf = (tx: FileTransaction) => {
              const r = tx.rate_usd_lbp ?? exchangeRate;
              return tx.amount_usd + tx.amount_lbp / r;
            };
            const totalCvReceived = transactions
              .filter((tx) => tx.type === 'revenue')
              .reduce((s, tx) => s + cvOf(tx), 0);
            const totalCvExpense = transactions
              .filter((tx) => tx.type === 'expense')
              .reduce((s, tx) => s + cvOf(tx), 0);
            const totalCvUSD = transactions.reduce((s, tx) =>
              s + (tx.type === 'revenue' ? cvOf(tx) : -cvOf(tx)), 0);
            const totalTxUSD = transactions.reduce((s, tx) =>
              s + (tx.type === 'revenue' ? tx.amount_usd : -tx.amount_usd), 0);
            const totalTxLBP = transactions.reduce((s, tx) =>
              s + (tx.type === 'revenue' ? tx.amount_lbp : -tx.amount_lbp), 0);

            return (
              <View style={s.cvTable}>
                {/* Header */}
                <View style={[s.cvRow, s.cvHeader]}>
                  <Text style={[s.cvCell, s.cvCellDesc, s.cvHeaderText]}>DESCRIPTION</Text>
                  <Text style={[s.cvCell, s.cvCellNum, s.cvHeaderText]}>USD</Text>
                  <Text style={[s.cvCell, s.cvCellNum, s.cvHeaderText]}>LBP</Text>
                  <Text style={[s.cvCell, s.cvCellNum, s.cvHeaderText]}>C/V USD</Text>
                </View>
                {/* Rows */}
                {transactions.map((tx) => {
                  const cv = cvOf(tx);
                  const sign = tx.type === 'revenue' ? '+' : '-';
                  const col = tx.type === 'revenue' ? theme.color.success : theme.color.danger;
                  return (
                    <View key={tx.id} style={s.cvRow}>
                      <View style={[s.cvCell, s.cvCellDesc]}>
                        <Text style={[s.cvDescText, { color: col }]}>{sign} {tx.description || '—'}</Text>
                        {tx.stop?.ministry?.name && (
                          <Text style={s.cvStagePill}>📌 {tx.stop.ministry.name}</Text>
                        )}
                      </View>
                      <Text style={[s.cvCell, s.cvCellNum, { color: tx.amount_usd > 0 ? col : theme.color.textMuted }]}>
                        {tx.amount_usd > 0 ? `${sign}${fmtUSD(tx.amount_usd)}` : '—'}
                      </Text>
                      <Text style={[s.cvCell, s.cvCellNum, { color: tx.amount_lbp > 0 ? col : theme.color.textMuted }]}>
                        {tx.amount_lbp > 0 ? `${sign}${fmtLBP(tx.amount_lbp)}` : '—'}
                      </Text>
                      <Text style={[s.cvCell, s.cvCellNum, { color: col, fontWeight: '700' }]}>
                        {sign}{cvFmt(cv)}
                      </Text>
                    </View>
                  );
                })}
                {/* Totals */}
                <View style={[s.cvRow, s.cvTotalRow]}>
                  <Text style={[s.cvCell, s.cvCellDesc, s.cvTotalText]}>TOTAL</Text>
                  <Text style={[s.cvCell, s.cvCellNum, s.cvTotalText, totalTxUSD >= 0 ? s.positive : s.negative]}>
                    {totalTxUSD >= 0 ? '+' : '-'}{fmtUSD(Math.abs(totalTxUSD))}
                  </Text>
                  <Text style={[s.cvCell, s.cvCellNum, s.cvTotalText, totalTxLBP >= 0 ? s.positive : s.negative]}>
                    {totalTxLBP >= 0 ? '+' : '-'}{fmtLBP(Math.abs(totalTxLBP))}
                  </Text>
                  <Text style={[s.cvCell, s.cvCellNum, s.cvTotalText, totalCvUSD >= 0 ? s.positive : s.negative]}>
                    {totalCvUSD >= 0 ? '+' : '-'}{cvFmt(Math.abs(totalCvUSD))}
                  </Text>
                </View>
                <Text style={s.cvRateNote}>
                  * C/V calculated using each transaction's locked rate
                  {transactions.some(tx => !tx.rate_usd_lbp)
                    ? ` (legacy rows use current rate: ${exchangeRate.toLocaleString('en-US')} LBP/$1)`
                    : ''}
                </Text>
              </View>
            );
          })()}

          {/* + Add button — sits between summary table and transaction list */}
          {(permissions.can_add_expenses || permissions.can_add_revenue) && (
            <TouchableOpacity
              style={s.addTxBtn}
              onPress={() => setShowAddTransaction((v) => !v)}
            >
              <Text style={s.addTxBtnText}>{showAddTransaction ? `✕ ${t('cancel')}` : '+ Add Transaction'}</Text>
            </TouchableOpacity>
          )}

          {/* Add transaction form */}
          {showAddTransaction && (
            <View style={s.txForm}>
              {/* Type toggle — only show types the user is permitted to add */}
              <View style={s.txTypeRow}>
                {permissions.can_add_expenses && (
                  <TouchableOpacity
                    style={[s.txTypeBtn, txType === 'expense' && s.txTypeBtnExpense]}
                    onPress={() => setTxType('expense')}
                  >
                    <Text style={[s.txTypeBtnText, txType === 'expense' && s.txTypeBtnTextExpense]}>
                      ↑ {t('expense')}
                    </Text>
                  </TouchableOpacity>
                )}
                {permissions.can_add_revenue && (
                  <TouchableOpacity
                    style={[s.txTypeBtn, txType === 'revenue' && s.txTypeBtnRevenue]}
                    onPress={() => setTxType('revenue')}
                  >
                    <Text style={[s.txTypeBtnText, txType === 'revenue' && s.txTypeBtnTextRevenue]}>
                      ↓ {t('revenue')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Description */}
              <TextInput
                style={s.txInput}
                value={txDescription}
                onChangeText={setTxDescription}
                placeholder={`${t('description')} *`}
                placeholderTextColor={theme.color.textMuted}
              />

              {/* Amounts */}
              <View style={s.txAmountsRow}>
                <View style={s.txAmountField}>
                  <Text style={s.txAmountLabel}>USD ($)</Text>
                  <TextInput
                    style={s.txInput}
                    value={txAmountUSD}
                    onChangeText={setTxAmountUSD}
                    placeholder="0.00"
                    placeholderTextColor={theme.color.textMuted}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={s.txAmountField}>
                  <Text style={s.txAmountLabel}>LBP (ل.ل)</Text>
                  <TextInput
                    style={s.txInput}
                    value={txAmountLBP}
                    onChangeText={(v) => {
                      const digits = v.replace(/,/g, '');
                      if (digits === '' || /^\d*$/.test(digits)) {
                        setTxAmountLBP(digits === '' ? '' : parseInt(digits, 10).toLocaleString('en-US'));
                      }
                    }}
                    placeholder="0"
                    placeholderTextColor={theme.color.textMuted}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              {/* Stage link (expenses only) */}
              {txType === 'expense' && task?.route_stops && task.route_stops.length > 0 && (
                <View style={s.txStageSection}>
                  <TouchableOpacity
                    style={s.txStageTrigger}
                    onPress={() => setShowTxStagePicker(v => !v)}
                  >
                    <Text style={s.txStageTriggerText}>
                      {txStopId
                        ? `📌 ${task.route_stops.find(rs => rs.id === txStopId)?.ministry?.name ?? 'Stage'}`
                        : '📌 Link to stage (optional)'}
                    </Text>
                    {txStopId && (
                      <TouchableOpacity onPress={() => { setTxStopId(null); setShowTxStagePicker(false); }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <Text style={s.txStageRemove}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                  {showTxStagePicker && (
                    <View style={s.txStageDropdown}>
                      {task.route_stops.map(rs => (
                        <TouchableOpacity key={rs.id} style={[s.txStageItem, txStopId === rs.id && s.txStageItemActive]}
                          onPress={() => { setTxStopId(rs.id); setShowTxStagePicker(false); }}>
                          <Text style={[s.txStageItemText, txStopId === rs.id && { color: theme.color.primary, fontWeight: '700' }]}>
                            {rs.stop_order}. {rs.ministry?.name}
                          </Text>
                          {txStopId === rs.id && <Text style={{ color: theme.color.primary }}>✓</Text>}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={[s.txSaveBtn, txType === 'expense' ? s.txSaveBtnExpense : s.txSaveBtnRevenue, savingTx && s.disabledBtn]}
                onPress={handleAddTransaction}
                disabled={savingTx}
              >
                {savingTx ? (
                  <ActivityIndicator color={theme.color.white} size="small" />
                ) : (
                  <Text style={s.txSaveBtnText}>
                    {t('save')} {txType === 'expense' ? t('expense') : t('revenue')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Transaction list — only visible when can_see_file_financials is on */}
          {permissions.can_see_file_financials && (transactions.length === 0 ? (
            <Text style={s.emptyText}>No transactions yet</Text>
          ) : (
            transactions.map((tx) => {
              // ── Inline edit form ──
              if (editingTx?.id === tx.id) {
                return (
                  <View key={tx.id} style={s.txEditForm}>
                    {/* Type toggle */}
                    <View style={s.txTypeRow}>
                      <TouchableOpacity
                        style={[s.txTypeBtn, editTxType === 'expense' && s.txTypeBtnExpense]}
                        onPress={() => setEditTxType('expense')}
                      >
                        <Text style={[s.txTypeBtnText, editTxType === 'expense' && s.txTypeBtnTextExpense]}>
                          ↑ {t('expense')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.txTypeBtn, editTxType === 'revenue' && s.txTypeBtnRevenue]}
                        onPress={() => setEditTxType('revenue')}
                      >
                        <Text style={[s.txTypeBtnText, editTxType === 'revenue' && s.txTypeBtnTextRevenue]}>
                          ↓ {t('revenue')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {/* Description */}
                    <TextInput
                      style={s.txInput}
                      value={editTxDescription}
                      onChangeText={setEditTxDescription}
                      placeholder={t('description')}
                      placeholderTextColor={theme.color.textMuted}
                      returnKeyType="done"
                    />
                    {/* Amounts */}
                    <View style={s.txAmountsRow}>
                      <View style={s.txAmountField}>
                        <Text style={s.txAmountLabel}>USD</Text>
                        <TextInput
                          style={s.txInput}
                          value={editTxAmountUSD}
                          onChangeText={setEditTxAmountUSD}
                          placeholder="0.00"
                          placeholderTextColor={theme.color.textMuted}
                          keyboardType="decimal-pad"
                        />
                      </View>
                      <View style={s.txAmountField}>
                        <Text style={s.txAmountLabel}>LBP</Text>
                        <TextInput
                          style={s.txInput}
                          value={editTxAmountLBP}
                          onChangeText={(v) => {
                            const raw = v.replace(/,/g, '');
                            const n   = parseInt(raw, 10);
                            setEditTxAmountLBP(isNaN(n) ? '' : n.toLocaleString('en-US'));
                          }}
                          placeholder="0"
                          placeholderTextColor={theme.color.textMuted}
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>
                    {/* Stage link (expenses only) */}
                    {editTxType === 'expense' && task?.route_stops && task.route_stops.length > 0 && (
                      <View style={s.txStageSection}>
                        <TouchableOpacity
                          style={s.txStageTrigger}
                          onPress={() => setShowEditTxStagePicker(v => !v)}
                        >
                          <Text style={s.txStageTriggerText}>
                            {editTxStopId
                              ? `📌 ${task.route_stops.find(rs => rs.id === editTxStopId)?.ministry?.name ?? 'Stage'}`
                              : '📌 Link to stage (optional)'}
                          </Text>
                          {editTxStopId && (
                            <TouchableOpacity onPress={() => { setEditTxStopId(null); setShowEditTxStagePicker(false); }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                              <Text style={s.txStageRemove}>✕</Text>
                            </TouchableOpacity>
                          )}
                        </TouchableOpacity>
                        {showEditTxStagePicker && (
                          <View style={s.txStageDropdown}>
                            {task.route_stops.map(rs => (
                              <TouchableOpacity key={rs.id} style={[s.txStageItem, editTxStopId === rs.id && s.txStageItemActive]}
                                onPress={() => { setEditTxStopId(rs.id); setShowEditTxStagePicker(false); }}>
                                <Text style={[s.txStageItemText, editTxStopId === rs.id && { color: theme.color.primary, fontWeight: '700' }]}>
                                  {rs.stop_order}. {rs.ministry?.name}
                                </Text>
                                {editTxStopId === rs.id && <Text style={{ color: theme.color.primary }}>✓</Text>}
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    )}
                    {/* Save / Cancel */}
                    <View style={s.txEditActions}>
                      <TouchableOpacity
                        style={s.txCancelBtn}
                        onPress={() => setEditingTx(null)}
                      >
                        <Text style={s.txCancelBtnText}>{t('cancel')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.txSaveBtn, editTxType === 'expense' ? s.txSaveBtnExpense : s.txSaveBtnRevenue, savingEditTx && s.disabledBtn, { flex: 1 }]}
                        onPress={handleEditTransaction}
                        disabled={savingEditTx}
                      >
                        {savingEditTx ? (
                          <ActivityIndicator color={theme.color.white} size="small" />
                        ) : (
                          <Text style={s.txSaveBtnText}>
                            {t('save')} {editTxType === 'expense' ? t('expense') : t('revenue')}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }

              // ── Normal display row ──
              return (
                <View key={tx.id} style={[s.txRow, tx.type === 'expense' ? s.txRowExpense : s.txRowRevenue]}>
                  <View style={[s.txTypeDot, tx.type === 'expense' ? s.txDotExpense : s.txDotRevenue]} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={s.txDesc}>{tx.description}</Text>
                    {tx.stop?.ministry?.name && (
                      <Text style={s.txStageTag}>📌 {tx.stop.ministry.name}</Text>
                    )}
                    <View style={s.txAmountDisplay}>
                      {tx.amount_usd > 0 && (
                        <Text style={[s.txAmt, tx.type === 'expense' ? s.txAmtExpense : s.txAmtRevenue]}>
                          {tx.type === 'expense' ? '- ' : '+ '}{fmtUSD(tx.amount_usd)}
                        </Text>
                      )}
                      {tx.amount_lbp > 0 && (
                        <Text style={[s.txAmt, tx.type === 'expense' ? s.txAmtExpense : s.txAmtRevenue]}>
                          {tx.type === 'expense' ? '- ' : '+ '}{fmtLBP(tx.amount_lbp)}
                        </Text>
                      )}
                    </View>
                    <Text style={s.txMeta}>
                      Added by <Text style={s.txMetaName}>{tx.creator?.name ?? 'Unknown'}</Text>
                      {' · '}{formatDate(tx.created_at)}
                    </Text>
                  </View>
                  <View style={s.txRowActions}>
                    <TouchableOpacity
                      onPress={() => {
                        setEditingTx(tx);
                        setEditTxType(tx.type);
                        setEditTxDescription(tx.description);
                        setEditTxAmountUSD(tx.amount_usd > 0 ? tx.amount_usd.toString() : '');
                        setEditTxAmountLBP(tx.amount_lbp > 0 ? tx.amount_lbp.toLocaleString('en-US') : '');
                        setEditTxStopId(tx.stop_id ?? null);
                        setShowEditTxStagePicker(false);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={s.txEdit}>✎</Text>
                    </TouchableOpacity>
                    {permissions.can_delete_transactions && (
                      <TouchableOpacity
                        onPress={() => handleDeleteTransaction(tx)}
                        disabled={deletingTxId === tx.id}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        {deletingTxId === tx.id ? (
                          <ActivityIndicator size="small" color={theme.color.danger} />
                        ) : (
                          <Text style={s.txDelete}>✕</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          ))}
        </View>
        )}

      </KeyboardAwareScrollView>

      {/* ── EDIT CONTRACT PRICE MODAL ── */}
      <Modal
        visible={showEditPrice}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditPrice(false)}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{t('edit')} {t('contractPrice')}</Text>
              <TouchableOpacity onPress={() => setShowEditPrice(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={s.modalBody}>
              <Text style={s.txAmountLabel}>USD ($)</Text>
              <TextInput
                style={s.txInput}
                value={editPriceUSD}
                onChangeText={setEditPriceUSD}
                placeholder="0.00"
                placeholderTextColor={theme.color.textMuted}
                keyboardType="decimal-pad"
              />
              <Text style={[s.txAmountLabel, { marginTop: 12 }]}>LBP (ل.ل)</Text>
              <TextInput
                style={s.txInput}
                value={editPriceLBP}
                onChangeText={(v) => {
                  const digits = v.replace(/,/g, '');
                  if (digits === '' || /^\d*$/.test(digits)) {
                    setEditPriceLBP(digits === '' ? '' : parseInt(digits, 10).toLocaleString('en-US'));
                  }
                }}
                placeholder="0"
                placeholderTextColor={theme.color.textMuted}
                keyboardType="number-pad"
              />
              <Text style={[s.txAmountLabel, { marginTop: 12 }]}>Note (optional)</Text>
              <TextInput
                style={s.txInput}
                value={editPriceNote}
                onChangeText={setEditPriceNote}
                placeholder={t('description')}
                placeholderTextColor={theme.color.textMuted}
              />
              <TouchableOpacity
                style={[s.txSaveBtn, s.txSaveBtnRevenue, savingPrice && s.disabledBtn]}
                onPress={handleSavePrice}
                disabled={savingPrice}
              >
                {savingPrice
                  ? <ActivityIndicator color={theme.color.white} size="small" />
                  : <Text style={s.txSaveBtnText}>{t('save')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── STATUS PICKER MODAL ── */}
      <Modal
        visible={showStatusPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStatusPicker(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Update: {selectedStop?.ministry?.name}</Text>
              <TouchableOpacity onPress={() => setShowStatusPicker(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.modalHint}>Current: {selectedStop?.status}</Text>
            {statusLabels.map((sl) => (
              <TouchableOpacity
                key={sl.id}
                style={[s.optionRow, selectedStop?.status === sl.label && s.optionRowActive]}
                onPress={() => {
                  if (!selectedStop) return;
                  if (sl.label === 'Rejected') {
                    // Show rejection reason input before saving
                    setPendingRejectionStop(selectedStop);
                    setRejectionReason(selectedStop.rejection_reason ?? '');
                    setShowStatusPicker(false);
                    setShowRejectionInput(true);
                  } else {
                    handleUpdateStopStatus(selectedStop, sl.label);
                  }
                }}
              >
                <View style={[s.optionDot, { backgroundColor: sl.color }]} />
                <Text style={[s.optionText, { color: sl.color }]}>{sl.label}</Text>
                {selectedStop?.status === sl.label && (
                  <Text style={s.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ── REJECTION REASON MODAL ── */}
      <Modal
        visible={showRejectionInput}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowRejectionInput(false); setPendingRejectionStop(null); setRejectionReason(''); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <View style={s.modalOverlay}>
            <View style={[s.modalSheet, { paddingBottom: theme.spacing.space4 }]}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Rejection Reason</Text>
                <TouchableOpacity onPress={() => { setShowRejectionInput(false); setPendingRejectionStop(null); setRejectionReason(''); }}>
                  <Text style={s.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={[s.modalHint, { marginBottom: theme.spacing.space3 }]}>
                Stage: {pendingRejectionStop?.ministry?.name}
              </Text>
              <TextInput
                style={[s.stageNameInput, { minHeight: 80, textAlignVertical: 'top' }]}
                value={rejectionReason}
                onChangeText={setRejectionReason}
                placeholder={t('rejectionReason')}
                placeholderTextColor={theme.color.textMuted}
                multiline
                autoFocus
              />
              <View style={{ flexDirection: 'row', gap: theme.spacing.space2, marginTop: theme.spacing.space3 }}>
                <TouchableOpacity
                  style={[s.stageNameBtn, { flex: 1, backgroundColor: theme.color.bgBase, borderColor: theme.color.border, borderWidth: 1 }]}
                  onPress={() => { setShowRejectionInput(false); setPendingRejectionStop(null); setRejectionReason(''); }}
                >
                  <Text style={[s.stageNameBtnText, { color: theme.color.textSecondary }]}>{t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.stageNameBtn, { flex: 2, backgroundColor: theme.color.danger }]}
                  onPress={() => {
                    if (!pendingRejectionStop) return;
                    setShowRejectionInput(false);
                    handleUpdateStopStatus(pendingRejectionStop, 'Rejected', rejectionReason.trim() || undefined);
                    setPendingRejectionStop(null);
                    setRejectionReason('');
                  }}
                >
                  <Text style={[s.stageNameBtnText, { color: theme.color.white }]}>✕ Confirm Rejection</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── EDIT STAGES MODAL ── */}
      <Modal
        visible={showEditStages}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowEditStages(false); setEditStageSearch(''); }}
      >
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
          <View style={[s.modalSheet, { maxHeight: '90%' }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{t('edit')} {t('stagesSection')}</Text>
              <TouchableOpacity onPress={() => { setShowEditStages(false); setEditStageSearch(''); }}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.editStagesScroll} keyboardShouldPersistTaps="handled">
              {/* Selected stages list */}
              <Text style={s.editStagesSubtitle}>CURRENT STAGES</Text>
              {editingStops.length === 0 && (
                <Text style={s.editStagesEmpty}>No stages added yet</Text>
              )}
              {editingStops.map((stage, idx) => (
                <View key={stage.id}>
                  <View style={s.editStageRow}>
                    <View style={s.editStageIndex}>
                      <Text style={s.editStageIndexText}>{idx + 1}</Text>
                    </View>
                    <Text style={s.editStageName} numberOfLines={1}>{stage.name}</Text>
                    <View style={s.editStageActions}>
                      <TouchableOpacity
                        onPress={() => moveEditStop(idx, -1)}
                        disabled={idx === 0}
                      >
                        <Text style={[s.editStageArrow, idx === 0 && s.editStageDisabled]}>↑</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => moveEditStop(idx, 1)}
                        disabled={idx === editingStops.length - 1}
                      >
                        <Text style={[s.editStageArrow, idx === editingStops.length - 1 && s.editStageDisabled]}>↓</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => toggleEditStage(stage)}>
                        <Text style={s.editStageRemove}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {/* Inline city chip */}
                  <TouchableOpacity
                    style={s.editStageCityChip}
                    onPress={() => {
                      setEditCityPickerMiniId(v => v === stage.id ? null : stage.id);
                      setEditCitySearch('');
                    }}
                  >
                    <Text style={s.editStageCityChipText}>
                      {editStageCities[stage.id]?.cityName ? `📍 ${editStageCities[stage.id]?.cityName}` : '📍 Set city'}
                    </Text>
                  </TouchableOpacity>
                  {/* City picker dropdown for this stage */}
                  {editCityPickerMiniId === stage.id && (
                    <View style={s.editStageCityDropdown}>
                      <TextInput
                        style={s.citySearchInner}
                        value={editCitySearch}
                        onChangeText={text => { setEditCitySearch(text); setEditCreateCityOpen(false); setNewCityName(text); }}
                        placeholder={t('searchCity')}
                        placeholderTextColor={theme.color.textMuted}
                        autoFocus
                        autoCorrect={false}
                      />
                      {/* Create new city — always visible above the list */}
                      <TouchableOpacity
                        style={[s.cityDropdownItem, { borderBottomWidth: 1, borderBottomColor: theme.color.border }]}
                        onPress={() => { setEditCreateCityOpen(v => !v); if (!newCityName) setNewCityName(editCitySearch); }}
                      >
                        <Text style={{ color: theme.color.primary, fontSize: 13, fontWeight: '600', padding: theme.spacing.space2 }}>
                          {editCreateCityOpen ? '− Cancel' : '+ Create New City'}
                        </Text>
                      </TouchableOpacity>
                      {editCreateCityOpen && (
                        <View style={{ padding: theme.spacing.space2, gap: 6, borderBottomWidth: 1, borderBottomColor: theme.color.border }}>
                          <TextInput
                            style={s.newMemberInput}
                            value={newCityName}
                            onChangeText={setNewCityName}
                            placeholder={`${t('city')} *`}
                            placeholderTextColor={theme.color.textMuted}
                          />
                          <TouchableOpacity
                            style={[s.newMemberSaveBtn, savingCity && s.disabledBtn]}
                            onPress={() => handleCreateCityInEditModal(stage.id)}
                            disabled={savingCity}
                          >
                            {savingCity
                              ? <ActivityIndicator size="small" color={theme.color.white} />
                              : <Text style={s.newMemberSaveBtnText}>Save City</Text>}
                          </TouchableOpacity>
                        </View>
                      )}
                      <View>
                        {editStageCities[stage.id]?.cityId && (
                          <TouchableOpacity
                            style={s.cityDropdownItem}
                            onPress={() => {
                              setEditStageCities(prev => ({ ...prev, [stage.id]: { cityId: null, cityName: null } }));
                              setEditCityPickerMiniId(null);
                            }}
                          >
                            <Text style={{ color: theme.color.danger, fontSize: 13, padding: theme.spacing.space2 }}>✕ Remove city</Text>
                          </TouchableOpacity>
                        )}
                        {allCities
                          .filter(c => !editCitySearch.trim() || c.name.toLowerCase().includes(editCitySearch.trim().toLowerCase()))
                          .slice(0, 12)
                          .map(city => (
                            <TouchableOpacity
                              key={city.id}
                              style={[s.cityDropdownItem, editStageCities[stage.id]?.cityId === city.id && s.cityDropdownItemActive]}
                              onPress={() => {
                                setEditStageCities(prev => ({ ...prev, [stage.id]: { cityId: city.id, cityName: city.name } }));
                                setEditCityPickerMiniId(null);
                                setEditCreateCityOpen(false);
                              }}
                            >
                              <Text style={[s.cityDropdownItemText, editStageCities[stage.id]?.cityId === city.id && { fontWeight: '600' }]}>{city.name}</Text>
                              {editStageCities[stage.id]?.cityId === city.id && <Text style={s.checkmark}>✓</Text>}
                            </TouchableOpacity>
                          ))}
                        {editCitySearch.trim().length > 0 && allCities.filter(c => c.name.toLowerCase().includes(editCitySearch.trim().toLowerCase())).length === 0 && (
                          <Text style={{ color: theme.color.textMuted, fontSize: 13, padding: theme.spacing.space3 }}>No cities match "{editCitySearch}"</Text>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              ))}

              {/* Fixed final stage row — always last, not editable */}
              <View style={[s.editStageRow, { opacity: 0.5, marginTop: theme.spacing.space2 }]}>
                <View style={[s.editStageIndex, { backgroundColor: theme.color.border }]}>
                  <Text style={s.editStageIndexText}>🔒</Text>
                </View>
                <Text style={[s.editStageName, { flex: 1, color: theme.color.textMuted }]} numberOfLines={1}>{FINAL_STAGE_NAME}</Text>
              </View>

              {/* All available stages to add */}
              <Text style={[s.editStagesSubtitle, { marginTop: 16 }]}>ADD STAGES</Text>
              <TextInput
                style={s.editStageSearchInput}
                value={editStageSearch}
                onChangeText={setEditStageSearch}
                placeholder={t('searchStage')}
                placeholderTextColor={theme.color.textMuted}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {[...allStages]
                .filter((st) => !editingStops.find((e) => e.id === st.id))
                .filter((st) => st.name !== FINAL_STAGE_NAME)
                .filter((st) => !editStageSearch || st.name.toLowerCase().includes(editStageSearch.toLowerCase()))
                .sort((a, b) => a.name.localeCompare(b.name, ['ar', 'en'], { sensitivity: 'base' }))
                .map((stage) => (
                  <TouchableOpacity
                    key={stage.id}
                    style={s.addStageRow}
                    onPress={() => { toggleEditStage(stage); setEditStageSearch(''); }}
                  >
                    <Text style={s.addStageName}>{stage.name}</Text>
                    <Text style={s.addStageIcon}>+</Text>
                  </TouchableOpacity>
                ))}
              {[...allStages].filter((st) => !editingStops.find((e) => e.id === st.id) && st.name !== FINAL_STAGE_NAME).length === 0 && (
                <Text style={s.editStagesEmpty}>All stages are already added.</Text>
              )}
              {editStageSearch !== '' && [...allStages].filter((st) => !editingStops.find((e) => e.id === st.id) && st.name !== FINAL_STAGE_NAME && st.name.toLowerCase().includes(editStageSearch.toLowerCase())).length === 0 && [...allStages].filter((st) => !editingStops.find((e) => e.id === st.id) && st.name !== FINAL_STAGE_NAME).length > 0 && (
                <Text style={s.editStagesEmpty}>No stages match "{editStageSearch}"</Text>
              )}

              {/* Create new stage */}
              <TouchableOpacity
                style={s.createStageToggle}
                onPress={() => setShowNewStageInEdit((v) => !v)}
              >
                <Text style={s.createStageToggleText}>
                  {showNewStageInEdit ? `− ${t('cancel')}` : `+ ${t('newStage') ?? 'Create New Stage'}`}
                </Text>
              </TouchableOpacity>

              {showNewStageInEdit && (
                <View style={s.createStageForm}>
                  <TextInput
                    style={s.createStageInput}
                    value={newStageName}
                    onChangeText={setNewStageName}
                    placeholder={`${t('stageName')} *`}
                    placeholderTextColor={theme.color.textMuted}
                  />
                  <TouchableOpacity
                    style={[s.createStageSaveBtn, savingNewStage && s.editStageDisabled]}
                    onPress={handleCreateStageInEdit}
                    disabled={savingNewStage}
                  >
                    {savingNewStage ? (
                      <ActivityIndicator color={theme.color.white} size="small" />
                    ) : (
                      <Text style={s.createStageSaveBtnText}>{t('save')} & {t('add')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            {/* Save button */}
            <View style={s.editStagesSaveRow}>
              <TouchableOpacity
                style={[s.editStagesSaveBtn, savingStages && s.editStageDisabled]}
                onPress={handleSaveStages}
                disabled={savingStages}
              >
                {savingStages ? (
                  <ActivityIndicator color={theme.color.white} />
                ) : (
                  <Text style={s.editStagesSaveBtnText}>{t('save')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── DOCUMENT SCANNER / UPLOAD MODAL ── */}
      <DocumentScannerModal
        visible={scanMode !== null}
        startMode={scanMode ?? 'camera'}
        taskId={taskId}
        uploadedBy={teamMember?.id}
        onClose={() => setScanMode(null)}
        onSuccess={() => {
          setScanMode(null);
          fetchTask();
        }}
      />

      {/* ── RENAME DOCUMENT MODAL ── */}
      <Modal
        visible={renamingDoc !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRenamingDoc(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <TouchableOpacity style={s.renameOverlay} activeOpacity={1} onPress={() => setRenamingDoc(null)}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={s.renameSheet}>
                <Text style={s.renameTitle}>{t('edit')} {t('documentsSection')}</Text>
                <TextInput
                  style={s.renameInput}
                  value={renameText}
                  onChangeText={setRenameText}
                  placeholder={t('documentName')}
                  placeholderTextColor={theme.color.textMuted}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (renamingDoc) handleRenameDoc(renamingDoc, renameText);
                    setRenamingDoc(null);
                  }}
                />
                <View style={s.renameBtnRow}>
                  <TouchableOpacity style={s.renameCancelBtn} onPress={() => setRenamingDoc(null)}>
                    <Text style={s.renameCancelText}>{t('cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.renameSaveBtn}
                    onPress={() => {
                      if (renamingDoc) handleRenameDoc(renamingDoc, renameText);
                      setRenamingDoc(null);
                    }}
                  >
                    <Text style={s.renameSaveText}>{t('save')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── STOP DUE DATE PICKER MODAL ── */}
      <Modal
        visible={!!stopDueDatePickerStopId}
        transparent
        animationType="slide"
        onRequestClose={() => setStopDueDatePickerStopId(null)}
      >
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() => setStopDueDatePickerStopId(null)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={s.modalSheet}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>{t('stageDue')}</Text>
                <TouchableOpacity onPress={() => setStopDueDatePickerStopId(null)}>
                  <Text style={s.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              {stopDueDatePickerStopId &&
                task?.route_stops?.find((r) => r.id === stopDueDatePickerStopId)?.due_date && (
                <TouchableOpacity
                  style={s.clearStopDueDateBtn}
                  onPress={() => handleSetStopDueDate(stopDueDatePickerStopId, null)}
                  disabled={!!savingStopDueDate}
                >
                  {savingStopDueDate
                    ? <ActivityIndicator color={theme.color.danger} size="small" />
                    : <Text style={s.clearStopDueDateBtnText}>✕ Clear Due Date</Text>}
                </TouchableOpacity>
              )}
              <Calendar
                firstDay={1}
                current={
                  (stopDueDatePickerStopId &&
                    task?.route_stops?.find((r) => r.id === stopDueDatePickerStopId)?.due_date) ||
                  new Date().toISOString().split('T')[0]
                }
                onDayPress={(day: { dateString: string }) => {
                  if (stopDueDatePickerStopId)
                    handleSetStopDueDate(stopDueDatePickerStopId, day.dateString);
                }}
                markedDates={(() => {
                  const d =
                    stopDueDatePickerStopId &&
                    task?.route_stops?.find((r) => r.id === stopDueDatePickerStopId)?.due_date;
                  return d ? { [d]: { selected: true, selectedColor: theme.color.warning } } : {};
                })()}
                theme={{
                  backgroundColor: theme.color.bgSurface,
                  calendarBackground: theme.color.bgSurface,
                  textSectionTitleColor: theme.color.textMuted,
                  selectedDayBackgroundColor: theme.color.warning,
                  selectedDayTextColor: theme.color.white,
                  todayBackgroundColor: theme.color.primary,
                  todayTextColor: theme.color.white,
                  dayTextColor: theme.color.textSecondary,
                  textDisabledColor: theme.color.border,
                  arrowColor: theme.color.primary,
                  monthTextColor: theme.color.textPrimary,
                  textDayFontWeight: '600',
                  textMonthFontWeight: '700',
                }}
              />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── IN-APP PDF VIEWER ── */}
      <Modal
        visible={!!viewingDoc}
        animationType="slide"
        onRequestClose={() => setViewingDoc(null)}
      >
        <View style={s.viewerScreen}>
          {/* Header */}
          <View style={s.viewerHeader}>
            <TouchableOpacity onPress={() => setViewingDoc(null)} style={s.viewerCloseBtn}>
              <Text style={s.viewerCloseBtnText}>✕ {t('close')}</Text>
            </TouchableOpacity>
            <Text style={s.viewerTitle} numberOfLines={1}>
              {viewingDoc?.display_name || viewingDoc?.file_name || 'Document'}
            </Text>
            <TouchableOpacity
              style={s.viewerShareBtn}
              onPress={() => { if (viewingDoc) handleShareDoc(viewingDoc); }}
            >
              <Text style={s.viewerShareBtnText}>↗ {t('shareDoc')}</Text>
            </TouchableOpacity>
          </View>

          {/* Image viewer for JPEGs; WebView fallback for PDFs */}
          {viewingDoc && (/image\//i.test(viewingDoc.file_type) || /\.(jpg|jpeg|png)$/i.test(viewingDoc.file_url)) ? (
            Platform.OS === 'android' ? (
              // Android: WebView handles pinch-to-zoom natively; ScrollView maximumZoomScale is iOS-only
              <WebView
                style={{ flex: 1, backgroundColor: '#000000' }}
                source={{ html: `<html><body style="margin:0;padding:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh"><img src="${viewingDoc.file_url}" style="max-width:100%;max-height:100vh;object-fit:contain;touch-action:pinch-zoom"/></body></html>` }}
                scalesPageToFit={false}
                bounces={false}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <ScrollView
                style={{ flex: 1, backgroundColor: '#000000' }}
                contentContainerStyle={s.viewerImageScroll}
                maximumZoomScale={4}
                minimumZoomScale={1}
                showsVerticalScrollIndicator={false}
                bouncesZoom
              >
                <Image
                  source={{ uri: viewingDoc.file_url }}
                  style={s.viewerImage}
                  resizeMode="contain"
                />
              </ScrollView>
            )
          ) : viewingDoc ? (
            <WebView
              style={{ flex: 1, backgroundColor: theme.color.bgBase }}
              source={{
                uri: Platform.OS === 'ios'
                  ? viewingDoc.file_url
                  : `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(viewingDoc.file_url)}`,
              }}
              startInLoadingState
              renderLoading={() => (
                <View style={s.viewerLoading}>
                  <ActivityIndicator size="large" color={theme.color.primary} />
                  <Text style={s.viewerLoadingText}>Loading document...</Text>
                </View>
              )}
              onError={() => { Alert.alert(t('error'), t('somethingWrong')); setViewingDoc(null); }}
              scalesPageToFit
            />
          ) : null}

          {/* Bottom bar: Share + Print */}
          <View style={s.viewerBottom}>
            {!!statusMsg && (
              <View style={s.viewerStatusMsg}>
                <ActivityIndicator size="small" color={theme.color.primary} />
                <Text style={s.viewerStatusMsgText}>{statusMsg}</Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[s.viewerActionBtn, { flex: 1 }, !!statusMsg && { opacity: 0.6 }]}
                onPress={() => { if (viewingDoc) handleShareDoc(viewingDoc); }}
                disabled={!!statusMsg}
              >
                <Text style={s.viewerActionBtnText}>↗  {t('shareDoc')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.viewerActionBtn, { flex: 1 }, printingDoc && { opacity: 0.6 }]}
                onPress={() => { if (viewingDoc) handlePrintDoc(viewingDoc); }}
                disabled={printingDoc}
              >
                {printingDoc
                  ? <ActivityIndicator color={theme.color.textPrimary} size="small" />
                  : <Text style={s.viewerActionBtnText}>🖨  Print</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── EDIT TASK MODAL ── */}
      <Modal
        visible={showEditTask}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditTask(false)}
      >
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
            <View style={[s.modalSheet, { maxHeight: '85%' }]}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>{t('edit')} {t('fileDetail')}</Text>
                <TouchableOpacity onPress={() => setShowEditTask(false)}>
                  <Text style={s.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={s.editTaskScroll}>
                {/* Service */}
                <Text style={s.editFieldLabel}>{t('services').toUpperCase()}</Text>
                {allServices.map((svc) => (
                  <TouchableOpacity
                    key={svc.id}
                    style={[s.memberOption, editServiceId === svc.id && s.memberOptionActive]}
                    onPress={() => setEditServiceId(svc.id)}
                  >
                    <Text style={[s.memberName, { fontSize: 14 }]}>{svc.name}</Text>
                    {editServiceId === svc.id && <Text style={s.checkmark}>✓</Text>}
                  </TouchableOpacity>
                ))}

                {/* Notes */}
                <Text style={[s.editFieldLabel, { marginTop: 16 }]}>{t('notes').toUpperCase()}</Text>
                <TextInput
                  style={[s.newMemberInput, { minHeight: 80, textAlignVertical: 'top' }]}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  placeholder={t('notes')}
                  placeholderTextColor={theme.color.textMuted}
                  multiline
                />

              </ScrollView>

              <View style={s.editStagesSaveRow}>
                <TouchableOpacity
                  style={[s.editStagesSaveBtn, savingEdit && s.disabledBtn]}
                  onPress={handleSaveEdit}
                  disabled={savingEdit}
                >
                  {savingEdit ? (
                    <ActivityIndicator color={theme.color.white} />
                  ) : (
                    <Text style={s.editStagesSaveBtnText}>{t('save')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      {/* ── SERVICE DOCUMENTS SHEET ── */}
      <Modal visible={showDocSheet} transparent animationType="slide" onRequestClose={() => setShowDocSheet(false)}>
        <View style={ds.overlay}>
          <View style={ds.sheet}>
            <View style={ds.header}>
              <View style={{ flex: 1 }}>
                <Text style={ds.title}>📋 Required Documents</Text>
                {task?.service && <Text style={ds.subtitle}>{task.service.name}</Text>}
              </View>
              <TouchableOpacity onPress={() => setShowDocSheet(false)}>
                <Text style={ds.close}>✕</Text>
              </TouchableOpacity>
            </View>
            {loadingSheetDocs ? (
              <ActivityIndicator color={theme.color.primary} style={{ margin: 32 }} />
            ) : sheetDocs.length === 0 ? (
              <Text style={ds.empty}>No documents listed for this service.</Text>
            ) : (
              <ScrollView contentContainerStyle={{ padding: theme.spacing.space3 }} keyboardShouldPersistTaps="handled">
                {sheetDocs.map((doc: any, idx: number) => {
                  const reqs = sheetDocReqs[doc.id] ?? [];
                  const isOpen = sheetExpandedId === doc.id;
                  return (
                    <View key={doc.id} style={ds.docCard}>
                      <View style={ds.docRow}>
                        <TouchableOpacity onPress={() => handleToggleSheetDocCheck(doc)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Text style={[ds.docCheck, doc.is_checked && ds.docCheckDone]}>
                            {doc.is_checked ? '☑' : '☐'}
                          </Text>
                        </TouchableOpacity>
                        <Text style={ds.docNum}>{idx + 1}.</Text>
                        <TouchableOpacity style={{ flex: 1 }} onPress={() => handleToggleSheetDocCheck(doc)} activeOpacity={0.7}>
                          <Text style={[ds.docTitle, doc.is_checked && ds.docTitleDone]} numberOfLines={2}>{doc.title}</Text>
                        </TouchableOpacity>
                        {reqs.length > 0 && (
                          <View style={ds.badge}><Text style={ds.badgeText}>{reqs.length}</Text></View>
                        )}
                        {reqs.length > 0 && (
                          <TouchableOpacity onPress={() => setSheetExpandedId(isOpen ? null : doc.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Text style={ds.arrow}>{isOpen ? '▼' : '▶'}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {isOpen && reqs.length > 0 && (
                        <View style={ds.reqList}>
                          {reqs.map((r: any) => (
                            <View key={r.id} style={ds.reqRow}>
                              <Text style={ds.reqBullet}>•</Text>
                              <Text style={ds.reqTitle}>{r.title}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            )}
            {sheetDocs.length > 0 && (
              <TouchableOpacity style={ds.waBtn} onPress={handleShareDocsWhatsApp}>
                <Text style={ds.waBtnText}>💬 Share via WhatsApp</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: theme.color.bgBase },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.color.bgBase },
  container: { padding: theme.spacing.space4, gap: theme.spacing.space3, paddingBottom: 40 },

  // Header
  headerCard: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    padding:         theme.spacing.space4,
    gap:             14,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  headerTop:         { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing.space3 },
  clientName:        { ...theme.typography.heading, fontSize: 20, fontWeight: '800' },
  clientProfileHint: { ...theme.typography.caption, color: theme.color.primary, fontWeight: '600', marginTop: 2 },
  clientSub:         { ...theme.typography.body, color: theme.color.textSecondary, marginTop: 2 },
  metaGrid:          { flexDirection: 'row', gap: 14 },
  metaCell:          { flex: 1, gap: 3 },
  metaLabel:         { ...theme.typography.sectionDivider, fontSize: theme.typography.caption.fontSize },
  metaValue:         { ...theme.typography.label, color: theme.color.textSecondary, fontWeight: '600' },

  // File assignment
  assigneeRow: {
    paddingVertical:   theme.spacing.space2 + 2,
    paddingHorizontal: theme.spacing.space1,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    marginBottom:      theme.spacing.space3,
    gap:               3,
  },
  assigneeValue: {
    ...theme.typography.label,
    color:      theme.color.primary,
    fontWeight: '700',
    fontSize:   14,
  },
  assigneePickerPanel: {
    backgroundColor:  theme.color.bgBase,
    borderRadius:     theme.radius.md,
    borderWidth:      1,
    borderColor:      theme.color.border,
    marginBottom:     theme.spacing.space3,
    overflow:         'hidden',
  },
  assigneeSearchInput: {
    ...theme.typography.body,
    color:             theme.color.textPrimary,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space2 + 2,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  assigneePickerItem: {
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space2 + 2,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  assigneePickerItemActive: { backgroundColor: theme.color.primaryDim },
  assigneePickerItemText:   { ...theme.typography.body, fontWeight: '600' },
  assigneePickerItemRole:   { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 2 },
  notesBlock:        { gap: theme.spacing.space1 },
  notesText:         { ...theme.typography.body, color: theme.color.textSecondary, lineHeight: 18 },

  // Section
  section: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    padding:         theme.spacing.space4,
    gap:             theme.spacing.space3,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  sectionTitle: { ...theme.typography.sectionDivider },

  // Route
  routeContainer: { gap: theme.spacing.space1 },
  // ── Unified stage chips (status / due date / city / assignee) ──
  stageChipGrid: {
    gap:             theme.spacing.space2,   // consistent vertical gap between row 1 and row 2
  },
  stageChipRow: {
    flexDirection:   'row',
    alignItems:      'stretch',              // both chips in a row match the taller one
    gap:             theme.spacing.space2,
  },
  stageChip: {
    flex:            1,                      // equal width within each row
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'flex-start',
    gap:             6,
    borderRadius:    theme.radius.lg,
    borderWidth:     1.5,
    paddingHorizontal: 10,
    height:          40,                     // fixed height — all 4 chips identical
    overflow:        'hidden',
  },
  stageChipDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    flexShrink:      0,
  },
  stageChipIcon: {
    fontSize:        14,
    lineHeight:      18,                     // normalise emoji vertical rhythm across platforms
    flexShrink:      0,
    width:           18,
    textAlign:       'center',
  },
  stageChipLabel: {
    flex:            1,
    fontSize:        12,
    fontWeight:      '600',
    lineHeight:      16,
  },
  stageChipArrow: {
    fontSize:        10,
    fontWeight:      '700',
    flexShrink:      0,
    lineHeight:      14,
  },

  // kept for any remaining references
  updateStopBtn: {
    borderWidth:     1,
    borderColor:     theme.color.primary + '55',
    borderRadius:    theme.radius.sm,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: 5,
    alignItems:      'center',
    justifyContent:  'center',
  },
  updateStopBtnText: { ...theme.typography.label, color: theme.color.primaryText, fontWeight: '600', textAlign: 'center' },
  reqStopBtn: {
    backgroundColor: theme.color.bgBase,
    borderWidth:     1,
    borderColor:     theme.color.border,
    borderRadius:    theme.radius.sm,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: 5,
    alignItems:      'center',
    justifyContent:  'center',
  },
  reqStopBtnText: { ...theme.typography.label, color: theme.color.textSecondary, fontWeight: '600', textAlign: 'center' },

  // Comments
  emptyText: { ...theme.typography.body, color: theme.color.textMuted, textAlign: 'center', paddingVertical: theme.spacing.space2 },
  commentRow: {
    flexDirection:   'row',
    gap:             10,
    paddingBottom:   theme.spacing.space3,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgBase,
  },
  commentAvatar: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: theme.color.border,
    justifyContent:  'center',
    alignItems:      'center',
  },
  commentAvatarText: { ...theme.typography.body, color: theme.color.textSecondary, fontSize: 15, fontWeight: '700' },
  commentHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  commentAuthor:     { ...theme.typography.body, color: theme.color.textPrimary, fontWeight: '700' },
  commentTime:       { ...theme.typography.caption, color: theme.color.textMuted },
  commentBody:       { ...theme.typography.body, color: theme.color.textSecondary, lineHeight: 18 },
  commentGps:        { ...theme.typography.caption, color: theme.color.primary },
  commentInput:      { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  // Mic button
  micBtn:            { backgroundColor: theme.color.bgSurface, borderRadius: theme.radius.md, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.color.border },
  micBtnText:        { fontSize: 20 },
  // Recording bar
  recordingBar:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.color.danger + '18', borderRadius: theme.radius.md, padding: theme.spacing.space3, marginBottom: 6 },
  recordingDot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.color.danger },
  recordingText:     { ...theme.typography.body, color: theme.color.danger, fontWeight: '600', flex: 1 },
  recordingStopBtn:  { backgroundColor: theme.color.danger, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.space3, paddingVertical: 6 },
  recordingStopBtnText: { color: theme.color.white, fontWeight: '700', fontSize: 13 },
  // Voice preview bar (after recording, before sending)
  voicePreviewBar:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.color.bgSurface, borderRadius: theme.radius.md, padding: theme.spacing.space3, marginBottom: 6, borderWidth: 1, borderColor: theme.color.border },
  voicePreviewLabel: { ...theme.typography.body, color: theme.color.textPrimary, fontWeight: '600', flex: 1 },
  voiceDiscardBtn:   { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.color.bgBase, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.color.border },
  voiceDiscardBtnText: { color: theme.color.danger, fontWeight: '700', fontSize: 14 },
  voiceTextBtn: {
    borderWidth:       1.5,
    borderColor:       theme.color.primary,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space2,
    minWidth:          52,
    alignItems:        'center',
    justifyContent:    'center',
  },
  voiceTextBtnText: { color: theme.color.primary, fontWeight: '700', fontSize: 13 },
  // Voice note player (in comment list)
  voiceNotePlayer:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.color.bgBase, borderRadius: theme.radius.md, padding: theme.spacing.space2, borderWidth: 1, borderColor: theme.color.border },
  voiceNotePlayBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.color.primary, alignItems: 'center', justifyContent: 'center' },
  voiceNotePlayBtnText: { color: theme.color.white, fontSize: 14, fontWeight: '700' },
  voiceNoteInfo:     { flex: 1, gap: 4 },
  voiceNoteBar:      { height: 4, backgroundColor: theme.color.border, borderRadius: 2, overflow: 'hidden' },
  voiceNoteProgress: { height: 4, backgroundColor: theme.color.primary, borderRadius: 2 },
  voiceNoteDuration: { ...theme.typography.caption, color: theme.color.textMuted },
  commentTextInput: {
    flex:            1,
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: 10,
    color:           theme.color.textPrimary,
    fontSize:        theme.typography.body.fontSize,
    borderWidth:     1,
    borderColor:     theme.color.border,
    minHeight:       44,
    maxHeight:       100,
  },
  commentSendBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.md,
    paddingHorizontal: theme.spacing.space4,
    paddingVertical: theme.spacing.space3,
  },
  commentSendBtnText: { ...theme.typography.body, color: theme.color.white, fontWeight: '700' },
  commentEditBtn:   { ...theme.typography.caption, color: theme.color.primaryText },
  commentDeleteBtn: { ...theme.typography.caption, color: theme.color.danger },
  commentEditRow:   { gap: 4 },
  commentEditInput: {
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    borderWidth:     1,
    borderColor:     theme.color.primary,
    color:           theme.color.textPrimary,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space2,
    ...theme.typography.body,
    minHeight:       60,
  },
  commentSaveBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space2,
  },
  commentSaveBtnText:   { ...theme.typography.caption, color: theme.color.white, fontWeight: '700' },
  commentCancelBtn: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space2,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  commentCancelBtnText: { ...theme.typography.caption, color: theme.color.textSecondary },
  disabledBtn: { opacity: 0.5 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: theme.color.overlayDark, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor:    theme.color.bgSurface,
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    paddingBottom:      40,
    maxHeight:          '85%',
    ...theme.shadow.modal,
    zIndex:             theme.zIndex.modal,
  },
  modalHeader: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    padding:         theme.spacing.space4,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  modalTitle:  { ...theme.typography.body, color: theme.color.textPrimary, fontSize: 16, fontWeight: '700', flex: 1 },
  modalClose:  { ...theme.typography.body, color: theme.color.textSecondary, fontSize: 20 },
  modalBody:   { padding: 20 },
  modalHint:   { ...theme.typography.label, color: theme.color.textMuted, paddingHorizontal: theme.spacing.space4, paddingTop: theme.spacing.space2 },
  optionRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             theme.spacing.space3,
    paddingHorizontal: theme.spacing.space4,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgBase,
  },
  optionRowActive: { backgroundColor: theme.color.hairline },
  optionDot:       { width: 10, height: 10, borderRadius: 5 },
  optionText:      { flex: 1, fontSize: 15, fontWeight: '600' },
  checkmark:       { color: theme.color.success, fontSize: 18 },

  // City picker (reused by per-stage dropdowns)
  citySearchInner: {
    fontSize:          14,
    color:             theme.color.textPrimary,
    backgroundColor:   theme.color.bgBase,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space2,
  },
  cityDropdownItem: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space2,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgBase,
  },
  cityDropdownItemActive: {
    backgroundColor: theme.color.primary + '11',
  },
  cityDropdownItemText: {
    fontSize: 14,
    color:    theme.color.textPrimary,
    flex:     1,
  },
  memberOption: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             theme.spacing.space3,
    paddingHorizontal: theme.spacing.space4,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgBase,
  },
  memberOptionActive: { backgroundColor: theme.color.primary + '11' },
  memberAvatar: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: theme.color.border,
    justifyContent:  'center',
    alignItems:      'center',
  },
  memberAvatarText: { ...theme.typography.body, color: theme.color.textSecondary, fontSize: 15, fontWeight: '700' },
  memberName:       { ...theme.typography.body, color: theme.color.textPrimary, fontWeight: '700' },
  memberRole:       { ...theme.typography.caption, color: theme.color.textSecondary, marginTop: 2 },
  createMemberBtn: {
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   14,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgBase,
  },
  createMemberBtnText: { ...theme.typography.body, color: theme.color.primary, fontWeight: '700' },
  newMemberForm: {
    margin:          theme.spacing.space3,
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.lg,
    padding:         theme.spacing.space3,
    gap:             10,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  newMemberInput: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   11,
    color:           theme.color.textPrimary,
    fontSize:        theme.typography.body.fontSize,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  newMemberSaveBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.md,
    paddingVertical: theme.spacing.space3,
    alignItems:      'center',
  },
  newMemberSaveBtnText: { ...theme.typography.body, color: theme.color.white, fontWeight: '700' },

  // ── Financials ──
  addTxBtn: {
    backgroundColor: theme.color.primary + '14',
    borderRadius:    theme.radius.md,
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   12,
    borderWidth:       1,
    borderColor:       theme.color.primary + '44',
    alignItems:        'center',
  },
  addTxBtnText: { color: theme.color.primary, fontWeight: '700', fontSize: 15 },
  balanceSummary: {
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.lg,
    padding:         14,
    gap:             theme.spacing.space2,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  balanceLabel: { ...theme.typography.sectionDivider, letterSpacing: 0.8, flex: 1 },
  contractPriceRow: {
    flexDirection:   'column',
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    padding:         14,
    marginBottom:    theme.spacing.space2,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  contractPriceHeaderRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           theme.spacing.space2,
  },
  contractPriceVal:     { color: theme.color.primary, fontSize: 15, fontWeight: '700', marginTop: 4 },
  contractPriceValLBP:  { color: theme.color.primary, fontSize: 15, fontWeight: '700', marginTop: 4 },
  contractPriceActions: { flexDirection: 'row', gap: theme.spacing.space1 + 2, alignItems: 'center' },
  editPriceBtn: {
    backgroundColor: theme.color.primary + '22',
    borderWidth:     1,
    borderColor:     theme.color.primary + '44',
    borderRadius:    theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editPriceBtnText:   { ...theme.typography.label, color: theme.color.primaryText, fontWeight: '600' },
  priceHistoryBtn: {
    backgroundColor: theme.color.bgBase,
    borderWidth:     1,
    borderColor:     theme.color.border,
    borderRadius:    theme.radius.sm,
    paddingHorizontal: theme.spacing.space2,
    paddingVertical: 5,
  },
  priceHistoryBtnText: { ...theme.typography.caption, color: theme.color.textSecondary },
  priceHistoryBlock:   { marginTop: theme.spacing.space3, marginBottom: theme.spacing.space2, paddingStart: theme.spacing.space3, borderStartWidth: 2, borderStartColor: theme.color.primary + '44' },
  priceHistoryLabel:   { ...theme.typography.caption, color: theme.color.textMuted, fontWeight: '700', marginBottom: theme.spacing.space2 },
  priceHistoryEmpty:   { ...theme.typography.caption, color: theme.color.textMuted, fontStyle: 'italic' },
  priceHistoryRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.space2, marginBottom: 6 },
  balanceTotalLabel:   { ...theme.typography.caption, color: theme.color.textSecondary, fontWeight: '800', letterSpacing: 0.8, flex: 1 },
  balanceAmounts:      { flexDirection: 'row', gap: theme.spacing.space3, justifyContent: 'space-between' },
  balanceCol:    { width: 80, textAlign: 'right', ...theme.typography.label, fontWeight: '700' },
  balanceColLBP: { width: 120, textAlign: 'right', ...theme.typography.caption, color: theme.color.textSecondary },
  balanceRevenue:      { color: theme.color.success, fontSize: 13, fontWeight: '700' },
  balanceRevenueLBP:   { color: theme.color.success + 'BB', fontSize: 11, fontWeight: '600' },
  balanceExpenseLBP:   { color: theme.color.danger + 'BB', fontSize: 11, fontWeight: '600' },
  balanceTotalLBP:     { fontSize: 12, fontWeight: '700' },
  txMetaName:          { color: theme.color.textSecondary, fontWeight: '700' },
  balanceExpense:      { color: theme.color.danger, fontSize: 13, fontWeight: '700' },
  stopDueChipSet: { borderColor: theme.color.warning + '66', backgroundColor: theme.color.warning + '15' },
  rejectionReasonRow: { backgroundColor: theme.color.danger + '18', borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.space3, paddingVertical: 6, borderLeftWidth: 3, borderLeftColor: theme.color.danger, marginTop: 2 },
  rejectionReasonText: { color: theme.color.danger, fontSize: 12, fontWeight: '500', lineHeight: 17 },
  clearStopDueDateBtn: {
    marginHorizontal: theme.spacing.space4,
    marginVertical: theme.spacing.space2,
    padding: 10,
    backgroundColor: theme.color.danger + '20',
    borderRadius: theme.radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.color.danger + '40',
  },
  clearStopDueDateBtnText: { color: theme.color.danger, fontWeight: '700', fontSize: 14 },
  balanceDivider:      { height: 1, backgroundColor: theme.color.bgSurface, marginVertical: 2 },
  balanceTotal:        { fontSize: 14, fontWeight: '800' },
  positive:            { color: theme.color.success },
  negative:            { color: theme.color.danger },
  rateInput: {
    color:           theme.color.textPrimary,
    fontSize:        11,
    fontWeight:      '600',
    borderWidth:     1,
    borderColor:     theme.color.primary,
    borderRadius:    theme.radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    textAlign:       'right',
    minWidth:        80,
  },
  rateDisplay: {
    color:      theme.color.primary,
    fontSize:   10,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  // C/V USD conversion table
  cvTable: {
    borderWidth:     1,
    borderColor:     theme.color.border,
    borderRadius:    theme.radius.lg,
    overflow:        'hidden',
    marginBottom:    theme.spacing.space3,
  },
  cvRow: {
    flexDirection:     'row',
    alignItems:        'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    paddingVertical:   6,
    paddingHorizontal: theme.spacing.space2,
  },
  cvHeader:     { backgroundColor: theme.color.bgBase },
  cvHeaderText: { color: theme.color.textMuted, fontWeight: '700', fontSize: 9 },
  cvTotalRow:   { backgroundColor: theme.color.bgBase, borderBottomWidth: 0 },
  cvTotalText:  { fontWeight: '700', fontSize: 12 },
  cvCell:       { fontSize: 11 },
  cvCellDesc:   { flex: 1.8, gap: 2 },
  cvCellNum:    { flex: 1, textAlign: 'right' },
  cvDescText:   { fontSize: 11, fontWeight: '600' },
  cvStagePill:  { ...theme.typography.caption, color: theme.color.textMuted, fontSize: 9 },
  cvRateNote:   { ...theme.typography.caption, color: theme.color.textMuted, textAlign: 'right', padding: theme.spacing.space2, fontSize: 9 },

  txForm: {
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.lg,
    padding:         theme.spacing.space3,
    gap:             10,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  txTypeRow: { flexDirection: 'row', gap: theme.spacing.space2 },
  txTypeBtn: {
    flex:            1,
    paddingVertical: 10,
    borderRadius:    theme.radius.md,
    alignItems:      'center',
    backgroundColor: theme.color.bgSurface,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  txTypeBtnExpense:     { backgroundColor: theme.color.danger + '22', borderColor: theme.color.danger + '66' },
  txTypeBtnRevenue:     { backgroundColor: theme.color.success + '22', borderColor: theme.color.success + '66' },
  txTypeBtnText:        { ...theme.typography.label, color: theme.color.textSecondary, fontWeight: '700' },
  txTypeBtnTextExpense: { color: theme.color.danger },
  txTypeBtnTextRevenue: { color: theme.color.success },
  txInput: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   11,
    color:           theme.color.textPrimary,
    fontSize:        theme.typography.body.fontSize,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  txAmountsRow:   { flexDirection: 'row', gap: 10 },
  txAmountField:  { flex: 1, gap: 5 },
  txAmountLabel:  { ...theme.typography.sectionDivider },
  txSaveBtn: {
    borderRadius:    theme.radius.md,
    paddingVertical: theme.spacing.space3,
    alignItems:      'center',
  },
  txSaveBtnExpense:  { backgroundColor: theme.color.danger },
  txSaveBtnRevenue:  { backgroundColor: theme.color.success },
  txSaveBtnText:     { ...theme.typography.body, color: theme.color.white, fontWeight: '700' },
  txRow: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    gap:               10,
    paddingVertical:   10,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgBase,
  },
  txRowExpense: {},
  txRowRevenue: {},
  txTypeDot:    { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  txDotExpense: { backgroundColor: theme.color.danger },
  txDotRevenue: { backgroundColor: theme.color.success },
  txDesc:          { ...theme.typography.body, color: theme.color.textPrimary, fontWeight: '600' },
  txAmountDisplay: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  txAmt:           { fontSize: theme.typography.body.fontSize, fontWeight: '700' },
  txAmtExpense:    { color: theme.color.danger },
  txAmtRevenue:    { color: theme.color.success },
  txMeta:          { ...theme.typography.caption, color: theme.color.textMuted },
  txRowActions:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  txEdit:          { color: theme.color.primary, fontSize: 16, padding: 4 },
  txDelete:        { color: theme.color.textMuted, fontSize: 16, padding: 4 },
  txEditForm: {
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.lg,
    padding:         theme.spacing.space3,
    gap:             10,
    borderWidth:     1,
    borderColor:     theme.color.primary + '44',
    marginVertical:  2,
  },
  txEditActions:  { flexDirection: 'row', gap: 8 },
  txCancelBtn: {
    flex:            0,
    paddingHorizontal: theme.spacing.space4,
    paddingVertical: theme.spacing.space3,
    borderRadius:    theme.radius.md,
    backgroundColor: theme.color.bgSurface,
    borderWidth:     1,
    borderColor:     theme.color.border,
    alignItems:      'center',
  },
  txCancelBtnText: { ...theme.typography.body, color: theme.color.textSecondary, fontWeight: '600' },
  txStageSection: { marginTop: 2 },
  txStageTrigger: {
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
  txStageTriggerText: { ...theme.typography.caption, color: theme.color.textSecondary, flex: 1 },
  txStageRemove:      { ...theme.typography.caption, color: theme.color.danger, paddingStart: 8 },
  txStageDropdown: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.sm,
    borderWidth:     1,
    borderColor:     theme.color.border,
    marginTop:       4,
    overflow:        'hidden',
  },
  txStageItem: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   10,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  txStageItemActive: { backgroundColor: theme.color.primary + '11' },
  txStageItemText:   { ...theme.typography.body, color: theme.color.textPrimary, flex: 1 },
  txStageTag: {
    ...theme.typography.caption,
    color:           theme.color.textSecondary,
    fontStyle:       'italic',
  },

  // Section title row with edit button
  sectionTitleRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  addStageBtn:     { backgroundColor: theme.color.success, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.space3, paddingVertical: 5 },
  addStageBtnText: { color: theme.color.white, fontSize: 12, fontWeight: '700' },
  editStagesBtn: {
    backgroundColor: theme.color.primary + '11',
    borderRadius:    theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth:     1,
    borderColor:     theme.color.primary + '55',
  },
  editStagesBtnText: { ...theme.typography.label, color: theme.color.primaryText, fontWeight: '600' },

  // Header action buttons row
  headerActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.space2,
    marginTop: theme.spacing.space2,
  },
  shareWhatsAppBtn: {
    borderWidth: 1,
    borderColor: '#25D366',
    borderRadius: theme.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(37,211,102,0.08)',
  },
  shareWhatsAppBtnText: { ...theme.typography.label, color: '#25D366', fontWeight: '600' },
  duplicateBtn: {
    borderRadius: theme.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: theme.color.primary,
    minWidth: 40,
    alignItems: 'center',
  },
  duplicateBtnText: { ...theme.typography.label, color: theme.color.white, fontWeight: '600' },

  // Edit task button (header)
  editTaskBtn: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editTaskBtnText: { ...theme.typography.label, color: theme.color.textSecondary, fontWeight: '600' },
  editTaskScroll:  { padding: theme.spacing.space4, paddingBottom: theme.spacing.space2 },
  editFieldLabel:  { ...theme.typography.sectionDivider, marginBottom: theme.spacing.space2 },

  // Edit stages modal content
  editStagesScroll:   { padding: theme.spacing.space4, gap: theme.spacing.space2, paddingBottom: theme.spacing.space2 },
  editStagesSubtitle: { ...theme.typography.sectionDivider, letterSpacing: 1, marginBottom: 4 },
  editStagesEmpty:    { ...theme.typography.body, color: theme.color.border, textAlign: 'center', paddingVertical: theme.spacing.space2 },
  editStageSearchInput: {
    backgroundColor: theme.color.bgBase,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: 8,
    color: theme.color.textPrimary,
    fontSize: theme.typography.body.fontSize,
    borderWidth: 1,
    borderColor: theme.color.border,
    marginBottom: theme.spacing.space2,
  },
  editStageRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    padding:         10,
    gap:             10,
    borderWidth:     1,
    borderColor:     theme.color.border,
    marginBottom:    6,
  },
  editStageIndex: {
    width:           24,
    height:          24,
    borderRadius:    12,
    backgroundColor: theme.color.primary + '33',
    justifyContent:  'center',
    alignItems:      'center',
  },
  editStageIndexText: { ...theme.typography.label, color: theme.color.primaryText, fontWeight: '700' },
  editStageName:      { flex: 1, color: theme.color.textPrimary, fontSize: theme.typography.body.fontSize, fontWeight: '600' },
  editStageActions:   { flexDirection: 'row', gap: theme.spacing.space2, alignItems: 'center' },
  editStageArrow:     { color: theme.color.primary, fontSize: 18, fontWeight: '700', padding: 2 },
  editStageRemove:    { color: theme.color.danger, fontSize: 16, padding: 2 },
  editStageDisabled:  { opacity: 0.3 },
  editStageCityChip: {
    alignSelf:         'flex-start',
    flexShrink:        0,
    maxWidth:          200,
    backgroundColor:   theme.color.bgBase,
    borderRadius:      theme.radius.sm,
    paddingHorizontal: theme.spacing.space2 + 2,
    paddingVertical:   4,
    marginTop:         4,
    marginBottom:      6,
    borderWidth:       1,
    borderColor:       theme.color.border,
  },
  editStageCityChipText: { ...theme.typography.caption, color: theme.color.textSecondary, flexShrink: 0, flexWrap: 'wrap' },
  editStageCityDropdown: {
    backgroundColor:  theme.color.bgSurface,
    borderRadius:     theme.radius.md,
    borderWidth:      1,
    borderColor:      theme.color.border,
    marginBottom:     8,
    overflow:         'hidden',
  },
  addStageRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    backgroundColor: theme.color.bgBase,
    borderRadius:   theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: theme.spacing.space3,
    borderWidth:    1,
    borderColor:    theme.color.border,
    marginBottom:   6,
  },
  addStageName:         { ...theme.typography.body, color: theme.color.textSecondary, fontWeight: '500', flex: 1 },
  addStageIcon:         { color: theme.color.primary, fontSize: 20, fontWeight: '700' },
  createStageToggle:    { paddingVertical: theme.spacing.space2 },
  createStageToggleText: { ...theme.typography.label, color: theme.color.primary, fontWeight: '600' },
  createStageForm: {
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    padding:         theme.spacing.space3,
    gap:             10,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  createStageInput: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   10,
    color:           theme.color.textPrimary,
    fontSize:        theme.typography.body.fontSize,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  createStageSaveBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.md,
    paddingVertical: 10,
    alignItems:      'center',
  },
  createStageSaveBtnText: { ...theme.typography.body, color: theme.color.white, fontWeight: '700' },
  editStagesSaveRow: {
    padding:         theme.spacing.space4,
    borderTopWidth:  1,
    borderTopColor:  theme.color.border,
  },
  editStagesSaveBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.lg,
    paddingVertical: 14,
    alignItems:      'center',
  },
  editStagesSaveBtnText: { ...theme.typography.body, color: theme.color.white, fontSize: 15, fontWeight: '700' },

  // Stage row — inline rail layout (replaces RouteStop + separate action rows)
  stageRow:          { flexDirection: 'row', gap: theme.spacing.space3 },
  stageRail:         { alignItems: 'center', width: theme.spacing.space5 },
  stageDot:          { width: 12, height: 12, borderRadius: 6, marginTop: theme.spacing.space1 },
  stageLine:         { width: 2, flex: 1, backgroundColor: theme.color.border, marginTop: theme.spacing.space1 },
  stageContent:      { flex: 1, paddingBottom: theme.spacing.space5, gap: theme.spacing.space2 },
  stageHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stageMinistryName: { ...theme.typography.body, fontWeight: '700', flex: 1 },
  stageOrder:        { ...theme.typography.caption, fontWeight: '600' },
  stageNamePanel: {
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    padding:         theme.spacing.space3,
    marginTop:       theme.spacing.space1,
    borderWidth:     1,
    borderColor:     theme.color.primary + '44',
  },
  stageNameInput: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.md,
    borderWidth:     1,
    borderColor:     theme.color.border,
    color:           theme.color.textPrimary,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: theme.spacing.space2,
    fontSize:        14,
  },
  stageNameBtn: {
    paddingVertical:   theme.spacing.space2,
    borderRadius:      theme.radius.md,
    alignItems:        'center',
  },
  stageNameBtnText: { ...theme.typography.label, fontWeight: '700' },
  stageBtnGrid:      { flexDirection: 'row', gap: theme.spacing.space2, marginTop: 2, alignItems: 'stretch' },
  stageBtnCol:       { flex: 1, gap: theme.spacing.space2 },

  // Stop action row (kept for any remaining references)
  stopActionRow: {
    flexDirection:  'row',
    alignItems:     'center',
    flexWrap:       'wrap',
    gap:            theme.spacing.space2,
    marginStart:    32,
    marginBottom:   theme.spacing.space2,
  },
  historyToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:      theme.radius.sm,
    borderWidth:       1,
    borderColor:       theme.color.border,
    backgroundColor:   theme.color.bgBase,
  },
  historyToggleBtnText: { ...theme.typography.caption, color: theme.color.textSecondary, fontWeight: '600' },

  // Stop status history
  stopHistoryBlock: {
    marginStart:     32,
    marginBottom:    theme.spacing.space3,
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    padding:         10,
    gap:             theme.spacing.space2,
    borderWidth:     1,
    borderColor:     theme.color.bgSurface,
  },
  stopHistoryRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           theme.spacing.space2,
  },
  stopHistoryDot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: theme.color.textMuted,
    marginTop:       5,
  },
  stopHistoryTextRow: {
    flexDirection: 'row',
    alignItems:    'center',
    flexWrap:      'wrap',
  },
  stopHistoryOld: {
    color:              theme.color.danger,
    fontSize:           theme.typography.label.fontSize,
    fontWeight:         '600',
    textDecorationLine: 'line-through',
  },
  stopHistoryArrow: { color: theme.color.textMuted, fontSize: theme.typography.label.fontSize },
  stopHistoryNew:   { color: theme.color.success, fontSize: theme.typography.label.fontSize, fontWeight: '700' },
  stopHistoryMeta:  { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 2 },

  // Documents section
  docBtnRow:      { flexDirection: 'row', gap: 6 },
  scanDocBtn: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    7,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: 6,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  scanDocBtnText: { ...theme.typography.label, color: theme.color.textPrimary, fontWeight: '700' },
  addDocBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    7,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: 6,
  },
  addDocBtnText:  { ...theme.typography.label, color: theme.color.white, fontWeight: '700' },
  pdfDocBtn: {
    backgroundColor: '#dc2626',
    borderRadius:    7,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: 6,
    minWidth:        52,
    alignItems:      'center',
  },
  pdfDocBtnText:  { ...theme.typography.label, color: theme.color.white, fontWeight: '700' },
  docEmpty: {
    alignItems:    'center',
    paddingVertical: 24,
    gap:           12,
  },
  docEmptyBtnRow: { flexDirection: 'row', gap: 8 },
  docEmptyIcon:   { fontSize: 32 },
  docEmptyText:   { ...theme.typography.body, color: theme.color.textSecondary, fontWeight: '600' },
  docRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.lg,
    padding:         theme.spacing.space3,
    gap:             10,
    borderWidth:     1,
    borderColor:     theme.color.bgSurface,
  },
  docRowIcon: {
    width:           40,
    height:          40,
    borderRadius:    theme.radius.md,
    backgroundColor: theme.color.bgSurface,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  docRowIconText:      { fontSize: 20 },
  docRowName:          { ...theme.typography.body, color: theme.color.textPrimary, fontWeight: '600' },
  docRowNameTappable:  { color: theme.color.primaryText, textDecorationLine: 'underline' },
  docReqTag: {
    backgroundColor: theme.color.primary + '15',
    borderRadius:    theme.radius.sm - 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf:       'flex-start',
  },
  docReqTagText:  { ...theme.typography.caption, color: theme.color.primaryText, fontWeight: '600' },
  docRowMeta:     { ...theme.typography.caption, color: theme.color.textMuted },

  // In-app PDF viewer
  viewerScreen: { flex: 1, backgroundColor: theme.color.bgBase, zIndex: theme.zIndex.modal },
  viewerHeader: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: theme.spacing.space4,
    paddingTop:      Platform.OS === 'ios' ? 56 : theme.spacing.space4,
    paddingBottom:   theme.spacing.space3,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgSurface,
    gap:             10,
  },
  viewerCloseBtn:       { paddingVertical: 4, paddingEnd: 4 },
  viewerCloseBtnText:   { ...theme.typography.body, color: theme.color.primary, fontSize: 15, fontWeight: '600' },
  viewerTitle:          { flex: 1, color: theme.color.textPrimary, fontSize: theme.typography.body.fontSize, fontWeight: '700', textAlign: 'center' },
  viewerShareBtn:       { paddingVertical: 4, paddingStart: 4 },
  viewerShareBtnText:   { ...theme.typography.body, color: theme.color.primary, fontSize: 15, fontWeight: '600' },
  viewerImageScroll:    { flexGrow: 1, alignItems: 'center', justifyContent: 'center', minHeight: SCREEN_H - 160 },
  viewerImage:          { width: SCREEN_W, height: SCREEN_W * (297 / 210) },
  viewerLoading: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: theme.color.bgBase,
    alignItems: 'center', justifyContent: 'center', gap: theme.spacing.space4,
  },
  viewerLoadingText: { ...theme.typography.body, color: theme.color.textSecondary },
  viewerBottom: {
    paddingHorizontal: 20,
    paddingTop:        theme.spacing.space3,
    paddingBottom:     Platform.OS === 'ios' ? 32 : theme.spacing.space4,
    borderTopWidth:    1,
    borderTopColor:    theme.color.bgSurface,
  },
  viewerActionBtn: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    paddingVertical: 13,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  viewerActionBtnText: { ...theme.typography.body, color: theme.color.textPrimary, fontWeight: '600' },
  viewerStatusMsg: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.space2,
    justifyContent: 'center', marginBottom: 10,
  },
  viewerStatusMsgText: { ...theme.typography.body, color: theme.color.textSecondary },

  docActionBtns:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  docRenameBtn:     { padding: 4 },
  docRenameBtnText: { fontSize: 18, color: theme.color.primary },
  docDeleteBtn:     { padding: 4 },
  docDeleteBtnText: { fontSize: 18 },

  // Rename document modal
  renameOverlay: { flex: 1, backgroundColor: theme.color.overlayDark, justifyContent: 'flex-end' },
  renameSheet: {
    backgroundColor:   theme.color.bgSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding:           theme.spacing.space5,
    paddingBottom:     Platform.OS === 'ios' ? 40 : theme.spacing.space5,
    gap:               theme.spacing.space4,
    ...theme.shadow.modal,
  },
  renameTitle:      { ...theme.typography.heading, color: theme.color.textPrimary, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  renameInput: {
    backgroundColor: theme.color.bgBase, color: theme.color.textPrimary,
    borderRadius:    theme.radius.lg, paddingHorizontal: 14, paddingVertical: theme.spacing.space3,
    fontSize:        15, borderWidth: 1, borderColor: theme.color.border,
  },
  renameBtnRow:     { flexDirection: 'row', gap: theme.spacing.space3 },
  renameCancelBtn:  { flex: 1, backgroundColor: theme.color.bgBase, borderRadius: theme.radius.lg, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: theme.color.border },
  renameCancelText: { ...theme.typography.body, color: theme.color.textSecondary, fontWeight: '600' },
  renameSaveBtn:    { flex: 1, backgroundColor: theme.color.primary, borderRadius: theme.radius.lg, paddingVertical: 13, alignItems: 'center' },
  renameSaveText:   { ...theme.typography.body, color: theme.color.white, fontWeight: '700' },

  // Per-stage city + assignee
  stopMetaRow:      { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.space2, marginTop: theme.spacing.space2, flexWrap: 'wrap' },
  stopMetaChip:     { backgroundColor: theme.color.bgBase, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.space3, paddingVertical: 5, borderWidth: 1, borderColor: theme.color.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0, maxWidth: 200 },
  stopMetaChipText: { fontSize: 12, color: theme.color.textSecondary, flexWrap: 'wrap' },
  stopDropdown:     { backgroundColor: theme.color.bgSurface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.border, marginTop: theme.spacing.space1, overflow: 'hidden' },
  stopAssigneeSearch: { margin: theme.spacing.space2, paddingHorizontal: theme.spacing.space3, paddingVertical: 8, backgroundColor: theme.color.bgBase, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.border, color: theme.color.textPrimary, fontSize: 13 },
  dueDateCalendarCard: { backgroundColor: theme.color.bgSurface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.border, overflow: 'hidden' },
  dueDateClearBtn:     { padding: theme.spacing.space3, alignItems: 'center', borderTopWidth: 1, borderTopColor: theme.color.border },
  dueDateClearBtnText: { color: theme.color.danger, fontSize: 13, fontWeight: '600' },
});

// ─── Service Documents Sheet styles ───────────────────────────────────────────
const ds = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet:         { backgroundColor: theme.color.bgSurface, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, maxHeight: '75%', paddingBottom: theme.spacing.space4 },
  header:        { flexDirection: 'row', alignItems: 'flex-start', padding: theme.spacing.space4, borderBottomWidth: 1, borderBottomColor: theme.color.border },
  title:         { color: theme.color.textPrimary, fontSize: 17, fontWeight: '700' },
  subtitle:      { color: theme.color.textSecondary, fontSize: 13, marginTop: 2 },
  close:         { color: theme.color.textSecondary, fontSize: 20, padding: 4 },
  empty:         { color: theme.color.textMuted, padding: theme.spacing.space4, textAlign: 'center' },
  docCard:       { backgroundColor: theme.color.bgBase, borderRadius: theme.radius.md, marginBottom: theme.spacing.space2, borderWidth: 1, borderColor: theme.color.border, overflow: 'hidden' },
  docRow:        { flexDirection: 'row', alignItems: 'center', padding: theme.spacing.space3, gap: 6 },
  docCheck:      { fontSize: 20, color: theme.color.textMuted, width: 24 },
  docCheckDone:  { color: theme.color.success },
  docNum:        { color: theme.color.textMuted, fontSize: 13, minWidth: 18, fontWeight: '600' },
  docTitle:      { flex: 1, color: theme.color.textPrimary, fontSize: 14, fontWeight: '600' },
  docTitleDone:  { color: theme.color.textMuted, textDecorationLine: 'line-through' },
  badge:         { backgroundColor: theme.color.primary + '33', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText:     { color: theme.color.primaryText, fontSize: 10, fontWeight: '700' },
  arrow:         { color: theme.color.textMuted, fontSize: 11, paddingHorizontal: 4 },
  reqList:       { paddingHorizontal: theme.spacing.space3, paddingBottom: theme.spacing.space2, gap: 4 },
  reqRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 2 },
  reqBullet:     { color: theme.color.primary, fontSize: 16, lineHeight: 20 },
  reqTitle:      { flex: 1, color: theme.color.textSecondary, fontSize: 13, lineHeight: 20 },
  waBtn:         { margin: theme.spacing.space3, marginTop: theme.spacing.space2, backgroundColor: '#25D366', borderRadius: theme.radius.lg, paddingVertical: 13, alignItems: 'center' },
  waBtnText:     { color: '#fff', fontSize: 15, fontWeight: '700' },
  docSheetChip:  { backgroundColor: theme.color.primary + '18', borderRadius: theme.radius.md, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: theme.color.primary + '44', alignSelf: 'flex-start' },
  docSheetChipText: { fontSize: 13, color: theme.color.primaryText, fontWeight: '600' },
});
