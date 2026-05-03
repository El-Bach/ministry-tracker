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
import { DocumentsSection } from './TaskDetail/components/DocumentsSection';
import { CommentsSection } from './TaskDetail/components/CommentsSection';
import { FinancialsSection } from './TaskDetail/components/FinancialsSection';
import { StagesSection } from './TaskDetail/components/StagesSection';
import { TaskHeader } from './TaskDetail/components/TaskHeader';
import { fetchTaskData } from './TaskDetail/fetchTaskData';
import { useTaskActions } from './TaskDetail/hooks/useTaskActions';

type DetailRoute = RouteProp<DashboardStackParamList, 'TaskDetail'>;
type Nav = NativeStackNavigationProp<DashboardStackParamList>;

interface FileTransaction {
  id: string;
  task_id: string;
  type: 'expense' | 'revenue';
  description: string;
  amount_usd: number;
  amount_lbp: number;
  /** Exchange rate (LBP per $1) locked at the time this transaction was recorded. NULL on legacy rows. */
  rate_usd_lbp?: number | null;
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

  // ─── Phase 5 COMPLETE: every action handler is in useTaskActions ──────
  // After session 52f, the entire action layer lives in the hook. The
  // orchestrator (this file) is now a pure JSX wiring layer + state owner —
  // ready for Phase 6 (TanStack Query migration).
  const {
    // file-level
    handlePhonePress,
    handleShareWhatsApp,
    handleShareDocsWhatsApp,
    handleDuplicateTask,
    // documents
    handleOpenDoc,
    handlePrintDoc,
    handleShareDoc,
    handleRenameDoc,
    handleDeleteDocument,
    handlePickPdf,
    // transactions / contract price
    handleAddTransaction,
    handleEditTransaction,
    handleDeleteTransaction,
    handleSavePrice,
    // status update cascade
    handleUpdateStopStatus,
    // stage CRUD
    handleCreateStageInEdit,
    handleSaveStages,
    handleSetStopDueDate,
    handleRenameStopMinistry,
    handleSetStopCity,
    handleSetStopAssignee,
    handleCreateExtAssigneeForStop,
    handleCreateCity,
    handleCreateCityInEditModal,
    // comments + voice notes
    handlePostComment,
    handleSaveEditComment,
    handleDeleteComment,
    handleStartRecording,
    handleStopRecording,
    handleDiscardRecording,
    handleSendVoiceNote,
    handlePlayPause,
    handleTextFromVoice,
    handleStopListening,
  } = useTaskActions({
    task,
    sheetDocs,
    sheetDocReqs,
    setDuplicating,
    taskId,
    fetchTask: () => fetchTask(),
    setViewingDoc,
    setPrintingDoc,
    setStatusMsg,
    setDeletingDocId,
    setUploadingPdf,
    // transactions — add form
    txDescription, txAmountUSD, txAmountLBP, txType, txStopId, exchangeRate,
    setSavingTx, setTxDescription, setTxAmountUSD, setTxAmountLBP, setTxType,
    setTxStopId, setShowTxStagePicker, setShowAddTransaction,
    // transactions — edit form
    editingTx, editTxDescription, editTxAmountUSD, editTxAmountLBP, editTxType, editTxStopId,
    setSavingEditTx, setEditingTx, setEditTxStopId, setShowEditTxStagePicker,
    // transactions — delete
    setDeletingTxId,
    // contract price
    editPriceUSD, editPriceLBP, editPriceNote, contractPriceUSD, contractPriceLBP,
    setSavingPrice, setContractPriceUSD, setContractPriceLBP, setShowEditPrice, setEditPriceNote,
    // status update cascade
    setUpdatingStop, setShowStatusPicker, setSelectedStop,
    // stage CRUD
    newStageName, allStages, editingStops, editStageCities,
    extAssignees, newExtName, newExtPhone, newExtReference, newCityName,
    setSavingNewStage, setAllStages, setEditingStops, setNewStageName, setShowNewStageInEdit,
    setSavingStages, setShowEditStages,
    setSavingStopDueDate, setStopDueDatePickerStopId,
    setSavingStageNameId, setOpenStageNameId,
    setSavingStopField, setOpenCityStopId, setStopCitySearch, setOpenAssigneeStopId,
    setSavingExtAssignee, setExtAssignees, setNewExtName, setNewExtPhone, setNewExtReference,
    setShowCreateExtForm,
    setSavingCity, setNewCityName, setShowCreateCityForm,
    setAllCities, setEditStageCities, setEditCreateCityOpen, setEditCityPickerMiniId,
    // comments + voice notes
    newComment, editingCommentId, editingCommentBody,
    setNewComment, setPostingComment, setEditingCommentId, setEditingCommentBody, setSavingEditComment,
    recordingObj, recordedUri, recordingTimerRef,
    setIsRecording, setRecordingObj, setRecordingDuration, setRecordedUri, setUploadingVoice,
    setIsListening, setVoicePartial,
    soundObj, playingCommentId,
    setSoundObj, setPlayingCommentId, setPlaybackPosition, setPlaybackDuration,
  });

  const fetchTask = useCallback(async () => {
    const data = await fetchTaskData(supabase, taskId, teamMember?.org_id ?? '');
    setAllCities(data.allCities);
    setExtAssignees(data.extAssignees);
    if (data.task) {
      setTask(data.task);
      setContractPriceUSD(data.task.price_usd ?? 0);
      setContractPriceLBP(data.task.price_lbp ?? 0);
    }
    setComments(data.comments);
    setStatusLabels(data.statusLabels);
    setAllMembers(data.allMembers);
    setStopHistories(data.stopHistories);
    setTransactions(data.transactions as FileTransaction[]);
    setPriceHistory(data.priceHistory as any[]);
    setDocuments(data.documents);
    setAllStages(data.allStages);
    setAllServices(data.allServices);
    setLoading(false);
  }, [taskId, teamMember?.org_id]);

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
    ),
    teamMember?.org_id ?? null,
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

  // Transactions / contract price handlers (handleAddTransaction,
  // handleEditTransaction, handleDeleteTransaction, handleSavePrice) are
  // now provided by useTaskActions. See ./TaskDetail/hooks/useTaskActions.ts

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

  // handleCreateStageInEdit + handleSaveStages now provided by useTaskActions

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
  // Document handlers (handleOpenDoc, handlePrintDoc, handleShareDoc,
  // handleRenameDoc, handleDeleteDocument, handlePickPdf) are now provided
  // by useTaskActions. See ./TaskDetail/hooks/useTaskActions.ts

  // handleUpdateStopStatus is now provided by useTaskActions.
  // See ./TaskDetail/hooks/useTaskActions.ts

  // Comments + voice notes handlers (handlePostComment, handleSaveEditComment,
  // handleDeleteComment, handleStartRecording, handleStopRecording,
  // handleDiscardRecording, handleSendVoiceNote, handlePlayPause,
  // handleTextFromVoice, handleStopListening) are now provided by useTaskActions.
  // See ./TaskDetail/hooks/useTaskActions.ts

  const fmtDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // ─── Per-stage city / assignee handlers ─────────────────
  // handleSetStopDueDate / handleRenameStopMinistry / handleSetStopCity /
  // handleSetStopAssignee / handleCreateExtAssigneeForStop are now provided
  // by useTaskActions. See ./TaskDetail/hooks/useTaskActions.ts

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

  // handleCreateCity + handleCreateCityInEditModal now provided by useTaskActions

  // handleDeleteComment provided by useTaskActions

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

  // handlePhonePress + handleShareWhatsApp are now provided by useTaskActions
  // (declared near the top of this component). See ./TaskDetail/hooks/useTaskActions.ts

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

  // handleShareDocsWhatsApp + handleDuplicateTask are now provided by useTaskActions
  // (declared near the top of this component). See ./TaskDetail/hooks/useTaskActions.ts

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

        {/* ── HEADER CARD ── (Phase 4 extracted module) */}
        <TaskHeader
          task={task}
          derivedStatus={derivedStatus}
          derivedStatusColor={derivedStatusColor}
          allMembers={allMembers}
          showAssigneePicker={showAssigneePicker}
          setShowAssigneePicker={setShowAssigneePicker}
          assigneeSearch={assigneeSearch}
          setAssigneeSearch={setAssigneeSearch}
          savingAssignee={savingAssignee}
          duplicating={duplicating}
          canEdit={permissions.can_edit_file_details}
          onSetAssignee={handleSetFileAssignee}
          onClientPress={() => navigation.navigate('ClientProfile', { clientId: task.client_id })}
          onPhonePress={(phone, name) => handlePhonePress(phone, name)}
          onOpenDocSheet={() => { setShowDocSheet(true); loadServiceDocsForSheet(task.service!.id); }}
          onToggleDueDateCalendar={() => setShowDueDateCalendar(v => !v)}
          onEdit={openEditTask}
          onShareWhatsApp={handleShareWhatsApp}
          onDuplicate={handleDuplicateTask}
          formatDate={formatDate}
          formatDateOnly={formatDateOnly}
        />

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

        {/* ── COMMENTS ── (Phase 3 extracted module) */}
        <CommentsSection
          comments={comments}
          permissions={permissions}
          newComment={newComment}
          setNewComment={setNewComment}
          postingComment={postingComment}
          onPostComment={handlePostComment}
          editingCommentId={editingCommentId}
          setEditingCommentId={setEditingCommentId}
          editingCommentBody={editingCommentBody}
          setEditingCommentBody={setEditingCommentBody}
          savingEditComment={savingEditComment}
          onSaveEditComment={handleSaveEditComment}
          onDeleteComment={handleDeleteComment}
          isRecording={isRecording}
          recordingDuration={recordingDuration}
          recordedUri={recordedUri}
          uploadingVoice={uploadingVoice}
          isListening={isListening}
          voicePartial={voicePartial}
          playingCommentId={playingCommentId}
          playbackPosition={playbackPosition}
          playbackDuration={playbackDuration}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          onSendVoiceNote={handleSendVoiceNote}
          onDiscardRecording={handleDiscardRecording}
          onStopListening={handleStopListening}
          onPlayPause={handlePlayPause}
          formatDate={formatDate}
          fmtDuration={fmtDuration}
        />

        {/* ── DOCUMENTS ── (Phase 3 extracted module) */}
        <DocumentsSection
          documents={documents as any}
          permissions={permissions}
          uploadingPdf={uploadingPdf}
          deletingDocId={deletingDocId}
          onScanCamera={() => setScanMode('camera')}
          onScanLibrary={() => setScanMode('library')}
          onPickPdf={handlePickPdf}
          onOpenDoc={(doc) => handleOpenDoc(doc as any)}
          onRenameDoc={(doc) => {
            setRenamingDoc(doc as any);
            setRenameText(doc.display_name || doc.file_name || '');
          }}
          onDeleteDoc={(doc) => handleDeleteDocument(doc as any)}
          formatDate={formatDate}
        />

        {/* ── STAGES ROUTE ── (Phase 3 extracted module) */}
        <StagesSection
          task={task}
          permissions={permissions}
          openStageNameId={openStageNameId}
          setOpenStageNameId={setOpenStageNameId}
          stageNameEdit={stageNameEdit}
          setStageNameEdit={setStageNameEdit}
          savingStageNameId={savingStageNameId}
          onRenameStopMinistry={handleRenameStopMinistry}
          openCityStopId={openCityStopId}
          setOpenCityStopId={setOpenCityStopId}
          stopCitySearch={stopCitySearch}
          setStopCitySearch={setStopCitySearch}
          showCreateCityForm={showCreateCityForm}
          setShowCreateCityForm={setShowCreateCityForm}
          newCityName={newCityName}
          setNewCityName={setNewCityName}
          savingCity={savingCity}
          onCreateCity={handleCreateCity}
          onSetStopCity={handleSetStopCity}
          pinnedCityIds={pinnedCityIds}
          togglePinCity={togglePinCity}
          allCities={allCities}
          openAssigneeStopId={openAssigneeStopId}
          setOpenAssigneeStopId={setOpenAssigneeStopId}
          stopAssigneeSearch={stopAssigneeSearch}
          setStopAssigneeSearch={setStopAssigneeSearch}
          showCreateExtForm={showCreateExtForm}
          setShowCreateExtForm={setShowCreateExtForm}
          newExtName={newExtName}
          setNewExtName={setNewExtName}
          newExtPhone={newExtPhone}
          setNewExtPhone={setNewExtPhone}
          newExtReference={newExtReference}
          setNewExtReference={setNewExtReference}
          savingExtAssignee={savingExtAssignee}
          onCreateExtAssigneeForStop={handleCreateExtAssigneeForStop}
          onSetStopAssignee={handleSetStopAssignee}
          allMembers={allMembers}
          extAssignees={extAssignees as any}
          formatPhoneDisplay={formatPhoneDisplay}
          setStopDueDatePickerStopId={setStopDueDatePickerStopId}
          savingStopDueDate={savingStopDueDate}
          setSelectedStop={setSelectedStop}
          setShowStatusPicker={setShowStatusPicker}
          updatingStop={updatingStop}
          stopHistories={stopHistories}
          expandedStopHistory={expandedStopHistory}
          setExpandedStopHistory={setExpandedStopHistory}
          savingStopField={savingStopField}
          onOpenEditStages={openEditStages}
          formatDate={formatDate}
          formatDateOnly={formatDateOnly}
          getStatusColor={getStatusColor}
        />

        {/* ── FINANCIALS ── (Phase 3 extracted module) */}
        <FinancialsSection
          task={task}
          permissions={permissions}
          contractPriceUSD={contractPriceUSD}
          contractPriceLBP={contractPriceLBP}
          outstandingUSD={outstandingUSD}
          outstandingLBP={outstandingLBP}
          showPriceHistory={showPriceHistory}
          setShowPriceHistory={setShowPriceHistory}
          priceHistory={priceHistory}
          onOpenEditPrice={() => {
            setEditPriceUSD(contractPriceUSD > 0 ? String(contractPriceUSD) : '');
            setEditPriceLBP(contractPriceLBP > 0 ? contractPriceLBP.toLocaleString('en-US') : '');
            setEditPriceNote('');
            setShowEditPrice(true);
          }}
          totalRevenueUSD={totalRevenueUSD}
          totalRevenueLBP={totalRevenueLBP}
          totalExpenseUSD={totalExpenseUSD}
          totalExpenseLBP={totalExpenseLBP}
          balanceUSD={balanceUSD}
          balanceLBP={balanceLBP}
          totalCombinedUSD={totalCombinedUSD}
          exchangeRate={exchangeRate}
          setExchangeRate={setExchangeRate}
          editingRate={editingRate}
          setEditingRate={setEditingRate}
          rateInput={rateInput}
          setRateInput={setRateInput}
          transactions={transactions as any}
          showAddTransaction={showAddTransaction}
          setShowAddTransaction={setShowAddTransaction}
          txType={txType}
          setTxType={setTxType}
          txDescription={txDescription}
          setTxDescription={setTxDescription}
          txAmountUSD={txAmountUSD}
          setTxAmountUSD={setTxAmountUSD}
          txAmountLBP={txAmountLBP}
          setTxAmountLBP={setTxAmountLBP}
          txStopId={txStopId}
          setTxStopId={setTxStopId}
          showTxStagePicker={showTxStagePicker}
          setShowTxStagePicker={setShowTxStagePicker}
          savingTx={savingTx}
          onAddTransaction={handleAddTransaction}
          editingTx={editingTx as any}
          setEditingTx={setEditingTx as any}
          editTxType={editTxType}
          setEditTxType={setEditTxType}
          editTxDescription={editTxDescription}
          setEditTxDescription={setEditTxDescription}
          editTxAmountUSD={editTxAmountUSD}
          setEditTxAmountUSD={setEditTxAmountUSD}
          editTxAmountLBP={editTxAmountLBP}
          setEditTxAmountLBP={setEditTxAmountLBP}
          editTxStopId={editTxStopId}
          setEditTxStopId={setEditTxStopId}
          showEditTxStagePicker={showEditTxStagePicker}
          setShowEditTxStagePicker={setShowEditTxStagePicker}
          savingEditTx={savingEditTx}
          onSaveEditTransaction={handleEditTransaction}
          deletingTxId={deletingTxId}
          onDeleteTransaction={(tx) => handleDeleteTransaction(tx as any)}
          fmtUSD={fmtUSD}
          fmtLBP={fmtLBP}
          formatDate={formatDate}
        />

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
                      {editStageCities[stage.id]?.cityName ? `📍 ${editStageCities[stage.id]?.cityName}` : t('setCity')}
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
  cvCell:       { flexDirection: 'row' as const },
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
