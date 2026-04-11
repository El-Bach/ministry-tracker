// src/screens/TaskDetailScreen.tsx
// Full task detail: route, GPS status updates, comments, assignment with history

import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';

import { WebView } from 'react-native-webview';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import supabase from '../lib/supabase';
import { theme } from '../theme';
import { sendPushNotification } from '../lib/notifications';
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
} from '../types';
import StatusBadge from '../components/StatusBadge';
import RouteStop from '../components/RouteStop';
import DocumentScannerModal from '../components/DocumentScannerModal';

type DetailRoute = RouteProp<DashboardStackParamList, 'TaskDetail'>;
type Nav = NativeStackNavigationProp<DashboardStackParamList>;

interface AssignmentHistory {
  id: string;
  task_id: string;
  assigned_to?: string;
  assignee?: TeamMember;
  assigned_by?: string;
  assigner?: TeamMember;
  created_at: string;
}

interface FileTransaction {
  id: string;
  task_id: string;
  type: 'expense' | 'revenue';
  description: string;
  amount_usd: number;
  amount_lbp: number;
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

async function getGPS(): Promise<{ lat: number; lng: number } | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: loc.coords.latitude, lng: loc.coords.longitude };
  } catch {
    return null;
  }
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

export default function TaskDetailScreen() {
  const route = useRoute<DetailRoute>();
  const navigation = useNavigation<Nav>();
  const { taskId } = route.params;
  const { teamMember } = useAuth();
  const { isOnline, enqueue } = useOfflineQueue();

  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [statusLabels, setStatusLabels] = useState<StatusLabel[]>([]);
  const [allMembers, setAllMembers] = useState<TeamMember[]>([]);
  const [assignmentHistory, setAssignmentHistory] = useState<AssignmentHistory[]>([]);
  const [loading, setLoading] = useState(true);

  // Assign states
  const [assigningMe, setAssigningMe] = useState(false);
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // New team member creation (existing)
  const [showNewAssigneeForm, setShowNewAssigneeForm] = useState(false);
  const [newAssigneeName, setNewAssigneeName] = useState('');
  const [newAssigneeRole, setNewAssigneeRole] = useState('');
  const [newAssigneeEmail, setNewAssigneeEmail] = useState('');
  const [savingAssignee, setSavingAssignee] = useState(false);

  // External assignees (new)
  const [extAssignees, setExtAssignees] = useState<Array<{id:string;name:string;phone?:string;reference?:string;notes?:string;created_by?:string;creator?:{name:string};created_at:string}>>([]);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [showCreateAssigneeForm, setShowCreateAssigneeForm] = useState(false);
  const [newExtName, setNewExtName] = useState('');
  const [newExtPhone, setNewExtPhone] = useState('');
  const [newExtReference, setNewExtReference] = useState('');
  const [newExtNotes, setNewExtNotes] = useState('');
  const [savingExtAssignee, setSavingExtAssignee] = useState(false);

  // Status update states
  const [selectedStop, setSelectedStop] = useState<TaskRouteStop | null>(null);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [stopHistories, setStopHistories] = useState<Record<string, Array<{id: string; old_status?: string; new_status: string; updated_by?: string; updater?: TeamMember; created_at: string}>>>({});
  const [expandedStopHistory, setExpandedStopHistory] = useState<string | null>(null);
  const [updatingStop, setUpdatingStop] = useState<string | null>(null);

  // Comment states
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState('');
  const [savingEditComment, setSavingEditComment] = useState(false);

  // Financial transaction states
  const [transactions, setTransactions] = useState<FileTransaction[]>([]);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [txType, setTxType] = useState<'expense' | 'revenue'>('expense');
  const [txDescription, setTxDescription] = useState('');
  const [txAmountUSD, setTxAmountUSD] = useState('');
  const [txAmountLBP, setTxAmountLBP] = useState('');
  const [savingTx, setSavingTx] = useState(false);
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null);

  // Contract price states
  const [contractPriceUSD, setContractPriceUSD] = useState(0);
  const [contractPriceLBP, setContractPriceLBP] = useState(0);
  const [priceHistory, setPriceHistory] = useState<Array<{id:string;old_price_usd:number;old_price_lbp:number;new_price_usd:number;new_price_lbp:number;note?:string;changer?:{name:string};created_at:string}>>([]);
  // showPriceHistory removed — price history is always visible
  const [showEditPrice, setShowEditPrice] = useState(false);
  const [editPriceUSD, setEditPriceUSD] = useState('');
  const [editPriceLBP, setEditPriceLBP] = useState('');
  const [editPriceNote, setEditPriceNote] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);

  // Edit stages states
  const [showEditStages, setShowEditStages] = useState(false);
  const [allStages, setAllStages] = useState<Ministry[]>([]);
  const [editingStops, setEditingStops] = useState<Ministry[]>([]);
  const [savingStages, setSavingStages] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [savingNewStage, setSavingNewStage] = useState(false);
  const [showNewStageInEdit, setShowNewStageInEdit] = useState(false);

  // Edit task states
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [showEditTask, setShowEditTask] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editServiceId, setEditServiceId] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Quick add requirement states
  const [showQuickReq, setShowQuickReq] = useState(false);
  const [quickReqStopId, setQuickReqStopId] = useState('');
  const [quickReqStageName, setQuickReqStageName] = useState('');
  const [quickReqTitle, setQuickReqTitle] = useState('');
  const [savingQuickReq, setSavingQuickReq] = useState(false);

  // Document archive states
  const [documents, setDocuments] = useState<TaskDocument[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [printingDoc, setPrintingDoc] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<TaskDocument | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  const fetchTask = useCallback(async () => {
    const [taskRes, commentsRes, labelsRes, membersRes, historyRes] = await Promise.all([
      supabase
        .from('tasks')
        .select(
          `*, client:clients(*), service:services(*), assignee:team_members!assigned_to(*),
           ext_assignee:assignees!ext_assignee_id(*, creator:team_members!created_by(name)),
           route_stops:task_route_stops(*, ministry:ministries(*), updater:team_members!updated_by(*))`
        )
        .eq('id', taskId)
        .single(),
      supabase
        .from('task_comments')
        .select('*, author:team_members(*)')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true }),
      supabase.from('status_labels').select('*').order('sort_order'),
      supabase.from('team_members').select('*').order('name'),
      supabase
        .from('assignment_history')
        .select('*, assignee:team_members!assigned_to(*), assigner:team_members!assigned_by(*)')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false }),
    ]);

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
    if (historyRes.data) setAssignmentHistory(historyRes.data as AssignmentHistory[]);

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
      .select('*, creator:team_members!created_by(name)')
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

    // Load all external assignees
    const { data: assigneesData } = await supabase
      .from('assignees')
      .select('*, creator:team_members!created_by(name)')
      .order('name');
    if (assigneesData) setExtAssignees(assigneesData as any[]);

    // Load all available stages
    const { data: stagesData } = await supabase
      .from('ministries')
      .select('*')
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

  const getStatusColor = (label: string) =>
    statusLabels.find((s) => s.label === label)?.color ?? '#6366f1';

  // ─── Add transaction ─────────────────────────────────────
  const handleAddTransaction = async () => {
    if (!txDescription.trim()) {
      Alert.alert('Required', 'Please enter a description.');
      return;
    }
    const usd = parseFloat(txAmountUSD) || 0;
    const lbp = parseFloat(txAmountLBP.replace(/,/g, '')) || 0;
    if (usd === 0 && lbp === 0) {
      Alert.alert('Required', 'Enter at least one amount (USD or LBP).');
      return;
    }
    setSavingTx(true);
    const { error } = await supabase.from('file_transactions').insert({
      task_id: taskId,
      type: txType,
      description: txDescription.trim(),
      amount_usd: usd,
      amount_lbp: lbp,
      created_by: teamMember?.id,
    });
    setSavingTx(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setTxDescription('');
    setTxAmountUSD('');
    setTxAmountLBP('');
    setTxType('expense');
    setShowAddTransaction(false);
    fetchTask();
  };

  const handleDeleteTransaction = (tx: FileTransaction) => {
    Alert.alert('Delete', `Delete "${tx.description}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setDeletingTxId(tx.id);
          // Log deletion as a comment for audit trail
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
        },
      },
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
      Alert.alert('Error', e.message);
    } finally {
      setSavingPrice(false);
    }
  };

  // ─── Open edit stages modal ──────────────────────────────
  const openEditStages = () => {
    if (!task?.route_stops) return;
    const sorted = [...task.route_stops].sort((a, b) => a.stop_order - b.stop_order);
    const current = sorted.map((s) => ({
      id: s.ministry_id,
      name: s.ministry?.name ?? '',
      type: 'parent' as const,
      created_at: '',
    }));
    setEditingStops(current);
    setShowEditStages(true);
  };

  const toggleEditStage = (stage: Ministry) => {
    if (editingStops.find((r) => r.id === stage.id)) {
      setEditingStops((prev) => prev.filter((r) => r.id !== stage.id));
    } else {
      setEditingStops((prev) => [...prev, stage]);
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
      Alert.alert('Required', 'Stage name is required.');
      return;
    }
    setSavingNewStage(true);
    const { data, error } = await supabase
      .from('ministries')
      .insert({ name: newStageName.trim(), type: 'parent' })
      .select()
      .single();
    setSavingNewStage(false);
    if (error) { Alert.alert('Error', error.message); return; }
    const stage = data as Ministry;
    setAllStages((prev) => [...prev, stage].sort((a, b) => a.name.localeCompare(b.name)));
    setEditingStops((prev) => [...prev, stage]);
    setNewStageName('');
    setShowNewStageInEdit(false);
  };

  const handleSaveStages = async () => {
    if (editingStops.length === 0) {
      Alert.alert('Required', 'Add at least one stage.');
      return;
    }
    setSavingStages(true);
    try {
      // Delete all existing stops for this task
      const { error: delErr } = await supabase
        .from('task_route_stops')
        .delete()
        .eq('task_id', taskId);
      if (delErr) throw delErr;

      // Re-insert in new order
      const newStops = editingStops.map((s, idx) => ({
        task_id: taskId,
        ministry_id: s.id,
        stop_order: idx + 1,
        status: 'Pending',
      }));
      const { error: insErr } = await supabase
        .from('task_route_stops')
        .insert(newStops);
      if (insErr) throw insErr;

      setShowEditStages(false);
      fetchTask();
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error).message);
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
    setEditDueDate(task?.due_date ? isoToDisplay(task.due_date) : '');
    setEditServiceId(task?.service_id ?? '');
    setShowEditTask(true);
  };

  const handleSaveEdit = async () => {
    if (!editServiceId) {
      Alert.alert('Required', 'Please select a service.');
      return;
    }
    const isoDate = editDueDate.trim() ? displayToISO(editDueDate) : null;
    if (editDueDate.trim() && !isoDate) {
      Alert.alert('Invalid Date', 'Enter date as DD/MM/YYYY.');
      return;
    }
    setSavingEdit(true);
    const { error } = await supabase
      .from('tasks')
      .update({
        notes: editNotes.trim() || null,
        due_date: isoDate,
        service_id: editServiceId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);
    setSavingEdit(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setShowEditTask(false);
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
      Alert.alert('Print failed', e.message ?? 'Could not print document.');
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
        Alert.alert('Not available', 'Sharing is not supported on this device.');
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
      Alert.alert('Share failed', e.message ?? 'Could not share document.');
    }
  };

  // ─── Document archive ────────────────────────────────────────
  const handleDeleteDocument = (doc: TaskDocument) => {
    Alert.alert('Delete Document', `Delete "${doc.file_name}"?`, [
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

  // ─── Core assign function (saves history) ─────────────────
  const assignToMember = async (memberId: string | null) => {
    const { error } = await supabase
      .from('tasks')
      .update({ assigned_to: memberId, updated_at: new Date().toISOString() })
      .eq('id', taskId);

    if (error) { Alert.alert('Error', error.message); return false; }

    // Save to assignment history
    await supabase.from('assignment_history').insert({
      task_id: taskId,
      assigned_to: memberId,
      assigned_by: teamMember?.id,
    });

    // Notify newly assigned member if it's not the current user
    if (memberId && memberId !== teamMember?.id) {
      const assignedMember = allMembers.find((m) => m.id === memberId);
      if (assignedMember?.push_token) {
        sendPushNotification(
          assignedMember.push_token,
          'File Assigned to You',
          `${task?.client?.name} — ${task?.service?.name}`,
          { taskId }
        );
      }
    }

    fetchTask();
    return true;
  };

  // ─── Assign me ────────────────────────────────────────────
  const handleAssignMe = async () => {
    if (!teamMember) return;
    setAssigningMe(true);
    await assignToMember(teamMember.id);
    setAssigningMe(false);
  };

  // ─── Assign specific member ───────────────────────────────
  const handleAssignMember = async (member: TeamMember) => {
    setAssigning(true);
    await assignToMember(member.id);
    setAssigning(false);
    setShowAssignPicker(false);
  };

  // ─── Unassign ─────────────────────────────────────────────
  const handleUnassign = () => {
    Alert.alert('Unassign', 'Remove current assignment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unassign',
        style: 'destructive',
        onPress: async () => {
          await assignToMember(null);
        },
      },
    ]);
  };

  // ─── External assignee operations ────────────────────────
  const handleAssignExternal = async (assigneeId: string) => {
    const { error } = await supabase
      .from('tasks')
      .update({ ext_assignee_id: assigneeId, updated_at: new Date().toISOString() })
      .eq('id', taskId);
    if (error) { Alert.alert('Error', error.message); return; }
    setShowAssigneePicker(false);
    fetchTask();
  };

  const handleUnassignExternal = () => {
    Alert.alert('Remove Assignee', 'Remove the current assignee?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        await supabase.from('tasks').update({ ext_assignee_id: null, updated_at: new Date().toISOString() }).eq('id', taskId);
        fetchTask();
      }},
    ]);
  };

  const handleCreateExternalAssignee = async () => {
    if (!newExtName.trim()) { Alert.alert('Required', 'Name is required.'); return; }
    setSavingExtAssignee(true);
    const { data, error } = await supabase
      .from('assignees')
      .insert({
        name: newExtName.trim(),
        phone: newExtPhone.trim() || null,
        reference: newExtReference.trim() || null,
        notes: newExtNotes.trim() || null,
        created_by: teamMember?.id,
      })
      .select('*, creator:team_members!created_by(name)')
      .single();
    setSavingExtAssignee(false);
    if (error) { Alert.alert('Error', error.message); return; }
    const newAssignee = data as any;
    setExtAssignees((prev) => [...prev, newAssignee].sort((a, b) => a.name.localeCompare(b.name)));
    setNewExtName(''); setNewExtPhone(''); setNewExtReference(''); setNewExtNotes('');
    setShowCreateAssigneeForm(false);
    // Auto-assign to this task
    await handleAssignExternal(newAssignee.id);
  };

  // ─── Create new team member assignee ──────────────────────────────────
  const handleCreateAssignee = async () => {
    if (!newAssigneeName.trim()) {
      Alert.alert('Required', 'Name is required.');
      return;
    }
    if (!newAssigneeEmail.trim()) {
      Alert.alert('Required', 'Email is required.');
      return;
    }
    setSavingAssignee(true);
    const { data, error } = await supabase
      .from('team_members')
      .insert({
        name: newAssigneeName.trim(),
        role: newAssigneeRole.trim() || 'Agent',
        email: newAssigneeEmail.trim().toLowerCase(),
      })
      .select()
      .single();
    setSavingAssignee(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    const newMember = data as TeamMember;
    setAllMembers((prev) => [...prev, newMember].sort((a, b) => a.name.localeCompare(b.name)));

    // Auto-assign the newly created member
    await assignToMember(newMember.id);

    setShowNewAssigneeForm(false);
    setNewAssigneeName('');
    setNewAssigneeRole('');
    setNewAssigneeEmail('');
    setShowAssignPicker(false);

    Alert.alert(
      'Member Added',
      `${newMember.name} has been added and assigned to this task.\n\nRemember to create their Supabase Auth account so they can log in.`
    );
  };

  // ─── Status update ────────────────────────────────────────
  const handleUpdateStopStatus = async (stop: TaskRouteStop, newStatus: string) => {
    setUpdatingStop(stop.id);
    const oldStatus = stop.status;
    const now = new Date().toISOString();

    if (isOnline) {
      try {
        // Update the stop status
        const { error } = await supabase
          .from('task_route_stops')
          .update({
            status: newStatus,
            updated_at: now,
            updated_by: teamMember?.id,
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

        let newTaskStatus = newStatus;
        let shouldArchive = false;
        if (allStops) {
          const allDone = allStops.every((s: { id: string; status: string }, i: number) =>
            (i === allStops.findIndex((x: { id: string }) => x.id === stop.id))
              ? newStatus === 'Done'
              : s.status === 'Done'
          );
          newTaskStatus = allDone ? 'Done' : newStatus;
          shouldArchive = allDone;
        }

        await supabase
          .from('tasks')
          .update({ current_status: newTaskStatus, updated_at: now, ...(shouldArchive ? { is_archived: true } : {}) })
          .eq('id', taskId);

        if (shouldArchive) {
          Alert.alert('File Completed', 'All stages are done. This file has been moved to the archive.');
        }

        // Notify the assignee if it's not the current user
        if (task?.assignee?.push_token && task.assignee.id !== teamMember?.id) {
          sendPushNotification(
            task.assignee.push_token,
            'Stage Updated',
            `${task.client?.name} — ${stop.ministry?.name}: ${newStatus}`,
            { taskId }
          );
        }

        fetchTask();
      } catch (e: unknown) {
        Alert.alert('Error', (e as Error).message);
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
      Alert.alert('Queued', 'Update saved locally. It will sync when you reconnect.');
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
    const gps = await getGPS();

    if (isOnline) {
      const { error } = await supabase.from('task_comments').insert({
        task_id: taskId,
        author_id: teamMember?.id,
        body: newComment.trim(),
        gps_lat: gps?.lat,
        gps_lng: gps?.lng,
      });
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        setNewComment('');
        fetchTask();
      }
    } else {
      await enqueue({
        type: 'comment',
        payload: {
          taskId,
          authorId: teamMember?.id ?? '',
          body: newComment.trim(),
          gpsLat: gps?.lat,
          gpsLng: gps?.lng,
        },
      });
      setNewComment('');
      Alert.alert('Queued', 'Comment will sync when you reconnect.');
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
    if (error) { Alert.alert('Error', error.message); return; }
    setEditingCommentId(null);
    setEditingCommentBody('');
    fetchTask();
  };

  // ─── Quick add requirement ────────────────────────────────
  const handleSaveQuickReq = async () => {
    if (!quickReqTitle.trim()) {
      Alert.alert('Required', 'Requirement title is required.');
      return;
    }
    setSavingQuickReq(true);
    const { data: existing } = await supabase
      .from('stop_requirements')
      .select('sort_order')
      .eq('stop_id', quickReqStopId)
      .order('sort_order', { ascending: false })
      .limit(1);
    const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1;
    const { error } = await supabase.from('stop_requirements').insert({
      stop_id: quickReqStopId,
      title: quickReqTitle.trim(),
      req_type: 'document',
      is_completed: false,
      sort_order: nextOrder,
      created_by: teamMember?.id,
    });
    setSavingQuickReq(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setShowQuickReq(false);
    setQuickReqTitle('');
    Alert.alert('Added', `Requirement added to ${quickReqStageName}.`);
  };

  const handleDeleteComment = (commentId: string) => {
    Alert.alert('Delete Comment', 'Delete this comment?', [
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
  const isAssignedToMe = task.assigned_to === teamMember?.id;

  // Compute balances — contract price is NOT revenue, it's the agreed billing amount
  const totalRevenueUSD = transactions.filter((t) => t.type === 'revenue').reduce((sum, t) => sum + t.amount_usd, 0);
  const totalExpenseUSD = transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount_usd, 0);
  const balanceUSD = totalRevenueUSD - totalExpenseUSD;
  const outstandingUSD = contractPriceUSD - totalRevenueUSD;

  const totalRevenueLBP = transactions.filter((t) => t.type === 'revenue').reduce((sum, t) => sum + t.amount_lbp, 0);
  const totalExpenseLBP = transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount_lbp, 0);
  const balanceLBP = totalRevenueLBP - totalExpenseLBP;
  const outstandingLBP = contractPriceLBP - totalRevenueLBP;

  const fmtUSD = (n: number) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtLBP = (n: number) => `LBP ${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

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
                <Text style={s.clientSub}>{task.client.phone}</Text>
              )}
            </View>
            <StatusBadge label={task.current_status} color={mainStatusColor} />
          </View>

          <View style={s.metaGrid}>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>SERVICE</Text>
              <Text style={s.metaValue}>{task.service?.name}</Text>
            </View>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>DUE DATE</Text>
              <Text style={s.metaValue}>{task.due_date ?? '—'}</Text>
            </View>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>OPENED</Text>
              <Text style={s.metaValue}>{formatDate(task.created_at)}</Text>
            </View>
          </View>

          {task.notes ? (
            <View style={s.notesBlock}>
              <Text style={s.metaLabel}>NOTES</Text>
              <Text style={s.notesText}>{task.notes}</Text>
            </View>
          ) : null}

          <TouchableOpacity style={s.editTaskBtn} onPress={openEditTask}>
            <Text style={s.editTaskBtnText}>✎ Edit File Details</Text>
          </TouchableOpacity>
        </View>

        {/* ── ASSIGNMENT CARD ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>ASSIGNMENT</Text>

          {/* Current assignee */}
          <View style={s.assignRow}>
            <View style={s.assignAvatar}>
              <Text style={s.assignAvatarText}>
                {task.assignee ? task.assignee.name.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.assignName}>
                {task.assignee?.name ?? 'Unassigned'}
                {isAssignedToMe && <Text style={s.youTag}> (you)</Text>}
              </Text>
              {task.assignee?.role && (
                <Text style={s.assignRole}>{task.assignee.role}</Text>
              )}
            </View>
          </View>

          {/* Action buttons */}
          <View style={s.assignBtns}>
            {!isAssignedToMe && (
              <TouchableOpacity
                style={[s.assignMeBtn, assigningMe && s.disabledBtn]}
                onPress={handleAssignMe}
                disabled={assigningMe}
              >
                {assigningMe ? (
                  <ActivityIndicator color={theme.color.white} size="small" />
                ) : (
                  <Text style={s.assignMeBtnText}>⚡ Assign to Me</Text>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={s.assignPickerBtn}
              onPress={() => setShowAssignPicker(true)}
            >
              <Text style={s.assignPickerBtnText}>
                {task.assigned_to ? '↺ Reassign' : '+ Assign Member'}
              </Text>
            </TouchableOpacity>
            {task.assigned_to && (
              <TouchableOpacity style={s.unassignBtn} onPress={handleUnassign}>
                <Text style={s.unassignBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* External Assignee subsection */}
          <View style={s.extAssigneeSection}>
            <Text style={s.extAssigneeSectionLabel}>ASSIGNEE</Text>
            {task.ext_assignee ? (
              <View style={s.extAssigneeCard}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={s.extAssigneeName}>{task.ext_assignee.name}</Text>
                  {(task.ext_assignee as any).phone ? (
                    <Text style={s.extAssigneeMeta}>📞 {(task.ext_assignee as any).phone}</Text>
                  ) : null}
                  {(task.ext_assignee as any).reference ? (
                    <Text style={s.extAssigneeMeta}>Ref: {(task.ext_assignee as any).reference}</Text>
                  ) : null}
                  {(task.ext_assignee as any).notes ? (
                    <Text style={s.extAssigneeMeta}>📝 {(task.ext_assignee as any).notes}</Text>
                  ) : null}
                  {(task.ext_assignee as any).creator?.name ? (
                    <Text style={s.extAssigneeCreatedBy}>Added by {(task.ext_assignee as any).creator.name}</Text>
                  ) : null}
                </View>
                <View style={{ gap: 6 }}>
                  <TouchableOpacity style={s.extReassignBtn} onPress={() => setShowAssigneePicker(true)}>
                    <Text style={s.extReassignBtnText}>↺ Change</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.extRemoveBtn} onPress={handleUnassignExternal}>
                    <Text style={s.extRemoveBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={s.extAssignBtn} onPress={() => setShowAssigneePicker(true)}>
                <Text style={s.extAssignBtnText}>+ Assign Assignee</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Assignment history */}
          {assignmentHistory.length > 0 && (
            <View style={s.historyBlock}>
              <Text style={s.historyTitle}>ASSIGNMENT HISTORY</Text>
              {assignmentHistory.map((h) => (
                <View key={h.id} style={s.historyRow}>
                  <View style={s.historyDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.historyText}>
                      {h.assignee
                        ? <Text style={s.historyName}>{h.assignee.name}</Text>
                        : <Text style={s.historyUnassigned}>Unassigned</Text>
                      }
                      {h.assigner && (
                        <Text style={s.historyBy}> · by {h.assigner.name}</Text>
                      )}
                    </Text>
                    <Text style={s.historyDate}>{formatDate(h.created_at)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── STAGES ROUTE ── */}
        <View style={s.section}>
          <View style={s.sectionTitleRow}>
            <Text style={s.sectionTitle}>STAGES</Text>
            <TouchableOpacity style={s.editStagesBtn} onPress={openEditStages}>
              <Text style={s.editStagesBtnText}>✎ Edit Stages</Text>
            </TouchableOpacity>
          </View>
          <View style={s.routeContainer}>
            {task.route_stops?.map((stop, idx) => {
              const stopHistory = stopHistories[stop.id] ?? [];
              const isHistoryExpanded = expandedStopHistory === stop.id;
              return (
                <View key={stop.id}>
                  <RouteStop
                    stop={stop}
                    isLast={idx === (task.route_stops?.length ?? 0) - 1}
                    statusColor={getStatusColor(stop.status)}
                  />

                  {/* Action row: Update + Requirements + History toggle */}
                  <View style={s.stopActionRow}>
                    <TouchableOpacity
                      style={s.updateStopBtn}
                      onPress={() => {
                        setSelectedStop(stop);
                        setShowStatusPicker(true);
                      }}
                      disabled={updatingStop === stop.id}
                    >
                      {updatingStop === stop.id ? (
                        <ActivityIndicator color={theme.color.primary} size="small" />
                      ) : (
                        <Text style={s.updateStopBtnText}>Update Status</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={s.reqStopBtn}
                      onPress={() =>
                        navigation.navigate('StageRequirements', {
                          stopId: stop.id,
                          stageName: stop.ministry?.name ?? 'Requirements',
                          taskId,
                        })
                      }
                    >
                      <Text style={s.reqStopBtnText}>📋 Requirements</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={s.addReqBtn}
                      onPress={() => {
                        setQuickReqStopId(stop.id);
                        setQuickReqStageName(stop.ministry?.name ?? 'Stage');
                        setQuickReqTitle('');
                        setShowQuickReq(true);
                      }}
                    >
                      <Text style={s.addReqBtnText}>+ Req</Text>
                    </TouchableOpacity>

                    {stopHistory.length > 0 && (
                      <TouchableOpacity
                        style={s.historyToggleBtn}
                        onPress={() =>
                          setExpandedStopHistory(isHistoryExpanded ? null : stop.id)
                        }
                      >
                        <Text style={s.historyToggleBtnText}>
                          {isHistoryExpanded ? '▲ Hide' : `▼ History (${stopHistory.length})`}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

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
              );
            })}
          </View>
        </View>

        {/* ── FINANCIALS ── */}
        <View style={s.section}>
          {/* Title + balance always visible + add button */}
          <View style={s.sectionTitleRow}>
            <Text style={s.sectionTitle}>FINANCIALS</Text>
            <TouchableOpacity
              style={s.addTxBtn}
              onPress={() => setShowAddTransaction((v) => !v)}
            >
              <Text style={s.addTxBtnText}>{showAddTransaction ? '✕ Cancel' : '+ Add'}</Text>
            </TouchableOpacity>
          </View>

          {/* Contract price row */}
          <View style={s.contractPriceRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.balanceLabel}>CONTRACT PRICE</Text>
              <View style={s.balanceAmounts}>
                <Text style={s.contractPriceVal}>{fmtUSD(contractPriceUSD)}</Text>
                <Text style={s.contractPriceValLBP}>{fmtLBP(contractPriceLBP)}</Text>
              </View>
            </View>
            <View style={s.contractPriceActions}>
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
            </View>
          </View>

          {/* Contract price change history — always visible */}
          <View style={s.priceHistoryBlock}>
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
          </View>

          {/* P&L summary */}
          <View style={s.balanceSummary}>
            <View style={s.balanceRow}>
              <Text style={s.balanceLabel}>PAYMENTS RECEIVED</Text>
              <View style={s.balanceAmounts}>
                <Text style={s.balanceRevenue}>{fmtUSD(totalRevenueUSD)}</Text>
                <Text style={s.balanceRevenueLBP}>{fmtLBP(totalRevenueLBP)}</Text>
              </View>
            </View>
            {contractPriceUSD > 0 && (
              <View style={s.balanceRow}>
                <Text style={s.balanceLabel}>DUE</Text>
                <View style={s.balanceAmounts}>
                  <Text style={[s.balanceRevenue, outstandingUSD > 0 ? s.negative : s.positive]}>
                    {fmtUSD(outstandingUSD)}
                  </Text>
                  {contractPriceLBP > 0 && (
                    <Text style={[s.balanceRevenueLBP, outstandingLBP > 0 ? s.negative : s.positive]}>
                      {fmtLBP(outstandingLBP)}
                    </Text>
                  )}
                </View>
              </View>
            )}
            <View style={s.balanceRow}>
              <Text style={s.balanceLabel}>EXPENSES</Text>
              <View style={s.balanceAmounts}>
                <Text style={s.balanceExpense}>- {fmtUSD(totalExpenseUSD)}</Text>
                <Text style={s.balanceExpenseLBP}>- {fmtLBP(totalExpenseLBP)}</Text>
              </View>
            </View>
            <View style={s.balanceDivider} />
            <View style={s.balanceRow}>
              <Text style={s.balanceTotalLabel}>NET (P&L)</Text>
              <View style={s.balanceAmounts}>
                <Text style={[s.balanceTotal, balanceUSD >= 0 ? s.positive : s.negative]}>
                  {balanceUSD >= 0 ? '+' : '-'} {fmtUSD(balanceUSD)}
                </Text>
                <Text style={[s.balanceTotalLBP, balanceLBP >= 0 ? s.positive : s.negative]}>
                  {balanceLBP >= 0 ? '+' : '-'} {fmtLBP(balanceLBP)}
                </Text>
              </View>
            </View>
          </View>

          {/* Add transaction form */}
          {showAddTransaction && (
            <View style={s.txForm}>
              {/* Type toggle */}
              <View style={s.txTypeRow}>
                <TouchableOpacity
                  style={[s.txTypeBtn, txType === 'expense' && s.txTypeBtnExpense]}
                  onPress={() => setTxType('expense')}
                >
                  <Text style={[s.txTypeBtnText, txType === 'expense' && s.txTypeBtnTextExpense]}>
                    ↑ Expense
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.txTypeBtn, txType === 'revenue' && s.txTypeBtnRevenue]}
                  onPress={() => setTxType('revenue')}
                >
                  <Text style={[s.txTypeBtnText, txType === 'revenue' && s.txTypeBtnTextRevenue]}>
                    ↓ Revenue
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Description */}
              <TextInput
                style={s.txInput}
                value={txDescription}
                onChangeText={setTxDescription}
                placeholder="Description *"
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

              <TouchableOpacity
                style={[s.txSaveBtn, txType === 'expense' ? s.txSaveBtnExpense : s.txSaveBtnRevenue, savingTx && s.disabledBtn]}
                onPress={handleAddTransaction}
                disabled={savingTx}
              >
                {savingTx ? (
                  <ActivityIndicator color={theme.color.white} size="small" />
                ) : (
                  <Text style={s.txSaveBtnText}>
                    Save {txType === 'expense' ? 'Expense' : 'Revenue'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Transaction list */}
          {transactions.length === 0 ? (
            <Text style={s.emptyText}>No transactions yet</Text>
          ) : (
            transactions.map((tx) => (
              <View key={tx.id} style={[s.txRow, tx.type === 'expense' ? s.txRowExpense : s.txRowRevenue]}>
                <View style={[s.txTypeDot, tx.type === 'expense' ? s.txDotExpense : s.txDotRevenue]} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={s.txDesc}>{tx.description}</Text>
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
                <TouchableOpacity
                  onPress={() => handleDeleteTransaction(tx)}
                  disabled={deletingTxId === tx.id}
                >
                  {deletingTxId === tx.id ? (
                    <ActivityIndicator size="small" color={theme.color.danger} />
                  ) : (
                    <Text style={s.txDelete}>✕</Text>
                  )}
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* ── DOCUMENTS ── */}
        <View style={s.section}>
          <View style={s.sectionTitleRow}>
            <Text style={s.sectionTitle}>DOCUMENTS ({documents.length})</Text>
            <TouchableOpacity style={s.addDocBtn} onPress={() => setShowScanner(true)}>
              <Text style={s.addDocBtnText}>+ Scan / Add</Text>
            </TouchableOpacity>
          </View>

          {documents.length === 0 ? (
            <TouchableOpacity style={s.docEmpty} onPress={() => setShowScanner(true)}>
              <Text style={s.docEmptyIcon}>📄</Text>
              <Text style={s.docEmptyText}>No documents yet</Text>
              <Text style={s.docEmptyHint}>Tap to scan or upload a document</Text>
            </TouchableOpacity>
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

                  {/* Delete button */}
                  {deletingDocId === doc.id ? (
                    <ActivityIndicator size="small" color={theme.color.danger} />
                  ) : (
                    <TouchableOpacity
                      onPress={() => handleDeleteDocument(doc)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={s.docDeleteBtn}
                    >
                      <Text style={s.docDeleteBtnText}>🗑</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* ── COMMENTS ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>COMMENTS & ACTIVITY</Text>
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
                  {c.author_id === teamMember?.id && editingCommentId !== c.id && (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity onPress={() => { setEditingCommentId(c.id); setEditingCommentBody(c.body); }}>
                        <Text style={s.commentEditBtn}>✎</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteComment(c.id)}>
                        <Text style={s.commentDeleteBtn}>🗑</Text>
                      </TouchableOpacity>
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
                          : <Text style={s.commentSaveBtnText}>Save</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity style={s.commentCancelBtn} onPress={() => { setEditingCommentId(null); setEditingCommentBody(''); }}>
                        <Text style={s.commentCancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <Text style={s.commentBody}>{c.body}</Text>
                )}
                {c.gps_lat != null && editingCommentId !== c.id && (
                  <Text style={s.commentGps}>
                    📍 {c.gps_lat.toFixed(5)}, {c.gps_lng!.toFixed(5)}
                  </Text>
                )}
              </View>
            </View>
          ))}
          <View style={s.commentInput}>
            <TextInput
              style={s.commentTextInput}
              value={newComment}
              onChangeText={setNewComment}
              placeholder="Add a comment..."
              placeholderTextColor={theme.color.textMuted}
              multiline
            />
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
        </View>
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
              <Text style={s.modalTitle}>Edit Contract Price</Text>
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
                placeholder="Reason for change"
                placeholderTextColor={theme.color.textMuted}
              />
              <TouchableOpacity
                style={[s.txSaveBtn, s.txSaveBtnRevenue, savingPrice && s.disabledBtn]}
                onPress={handleSavePrice}
                disabled={savingPrice}
              >
                {savingPrice
                  ? <ActivityIndicator color={theme.color.white} size="small" />
                  : <Text style={s.txSaveBtnText}>Save Price</Text>}
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
                onPress={() => selectedStop && handleUpdateStopStatus(selectedStop, sl.label)}
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

      {/* ── ASSIGN MEMBER MODAL ── */}
      <Modal
        visible={showAssignPicker}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowAssignPicker(false); setShowNewAssigneeForm(false); }}
      >
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Assign to Member</Text>
              <TouchableOpacity onPress={() => { setShowAssignPicker(false); setShowNewAssigneeForm(false); }}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 500 }}>
              {/* Existing members */}
              {allMembers.map((member) => {
                const isCurrentAssignee = task.assigned_to === member.id;
                const isMe = member.id === teamMember?.id;
                return (
                  <TouchableOpacity
                    key={member.id}
                    style={[s.memberOption, isCurrentAssignee && s.memberOptionActive]}
                    onPress={() => handleAssignMember(member)}
                    disabled={assigning}
                  >
                    <View style={s.memberAvatar}>
                      <Text style={s.memberAvatarText}>
                        {member.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.memberName}>
                        {member.name}{isMe ? ' (you)' : ''}
                      </Text>
                      <Text style={s.memberRole}>{member.role}</Text>
                    </View>
                    {isCurrentAssignee && <Text style={s.checkmark}>✓</Text>}
                  </TouchableOpacity>
                );
              })}

              {/* Create new assignee toggle */}
              <TouchableOpacity
                style={s.createMemberBtn}
                onPress={() => setShowNewAssigneeForm((v) => !v)}
              >
                <Text style={s.createMemberBtnText}>
                  {showNewAssigneeForm ? '− Cancel' : '+ Create New Member'}
                </Text>
              </TouchableOpacity>

              {/* New assignee form */}
              {showNewAssigneeForm && (
                <View style={s.newMemberForm}>
                  <TextInput
                    style={s.newMemberInput}
                    value={newAssigneeName}
                    onChangeText={setNewAssigneeName}
                    placeholder="Full name *"
                    placeholderTextColor={theme.color.textMuted}
                  />
                  <TextInput
                    style={s.newMemberInput}
                    value={newAssigneeRole}
                    onChangeText={setNewAssigneeRole}
                    placeholder="Role"
                    placeholderTextColor={theme.color.textMuted}
                  />
                  <TextInput
                    style={s.newMemberInput}
                    value={newAssigneeEmail}
                    onChangeText={setNewAssigneeEmail}
                    placeholder="Email *"
                    placeholderTextColor={theme.color.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={[s.newMemberSaveBtn, savingAssignee && s.disabledBtn]}
                    onPress={handleCreateAssignee}
                    disabled={savingAssignee}
                  >
                    {savingAssignee ? (
                      <ActivityIndicator color={theme.color.white} size="small" />
                    ) : (
                      <Text style={s.newMemberSaveBtnText}>Save & Assign</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      {/* ── EDIT STAGES MODAL ── */}
      <Modal
        visible={showEditStages}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditStages(false)}
      >
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
          <View style={[s.modalSheet, { maxHeight: '90%' }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Edit Stages</Text>
              <TouchableOpacity onPress={() => setShowEditStages(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.editStagesScroll}>
              {/* Selected stages list */}
              <Text style={s.editStagesSubtitle}>CURRENT STAGES</Text>
              {editingStops.length === 0 && (
                <Text style={s.editStagesEmpty}>No stages added yet</Text>
              )}
              {editingStops.map((stage, idx) => (
                <View key={stage.id} style={s.editStageRow}>
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
              ))}

              {/* All available stages to add */}
              <Text style={[s.editStagesSubtitle, { marginTop: 16 }]}>ADD STAGES</Text>
              {allStages
                .filter((s) => !editingStops.find((e) => e.id === s.id))
                .map((stage) => (
                  <TouchableOpacity
                    key={stage.id}
                    style={s.addStageRow}
                    onPress={() => toggleEditStage(stage)}
                  >
                    <Text style={s.addStageName}>{stage.name}</Text>
                    <Text style={s.addStageIcon}>+</Text>
                  </TouchableOpacity>
                ))}

              {/* Create new stage */}
              <TouchableOpacity
                style={s.createStageToggle}
                onPress={() => setShowNewStageInEdit((v) => !v)}
              >
                <Text style={s.createStageToggleText}>
                  {showNewStageInEdit ? '− Cancel' : '+ Create New Stage'}
                </Text>
              </TouchableOpacity>

              {showNewStageInEdit && (
                <View style={s.createStageForm}>
                  <TextInput
                    style={s.createStageInput}
                    value={newStageName}
                    onChangeText={setNewStageName}
                    placeholder="Stage name *"
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
                      <Text style={s.createStageSaveBtnText}>Save & Add</Text>
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
                  <Text style={s.editStagesSaveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── ASSIGNEE PICKER MODAL ── */}
      <Modal
        visible={showAssigneePicker}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowAssigneePicker(false); setShowCreateAssigneeForm(false); }}
      >
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={[s.modalSheet, { maxHeight: '85%' }]}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Select Assignee</Text>
                <TouchableOpacity onPress={() => { setShowAssigneePicker(false); setShowCreateAssigneeForm(false); }}>
                  <Text style={s.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 400 }} keyboardShouldPersistTaps="handled">
                {extAssignees.length === 0 && !showCreateAssigneeForm && (
                  <Text style={s.emptyText}>No assignees yet. Create one below.</Text>
                )}
                {extAssignees.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    style={[s.memberOption, task.ext_assignee_id === a.id && s.memberOptionActive]}
                    onPress={() => handleAssignExternal(a.id)}
                  >
                    <View style={s.memberAvatar}>
                      <Text style={s.memberAvatarText}>{a.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={s.memberName}>{a.name}</Text>
                      {a.phone ? <Text style={s.memberRole}>{a.phone}</Text> : null}
                      {a.reference ? <Text style={s.memberRole}>Ref: {a.reference}</Text> : null}
                      {a.creator?.name ? <Text style={[s.memberRole, { color: theme.color.textMuted }]}>Added by {a.creator.name}</Text> : null}
                    </View>
                    {task.ext_assignee_id === a.id && <Text style={s.checkmark}>✓</Text>}
                  </TouchableOpacity>
                ))}

                {/* Create new assignee form toggle */}
                <TouchableOpacity style={s.createMemberBtn} onPress={() => setShowCreateAssigneeForm((v) => !v)}>
                  <Text style={s.createMemberBtnText}>
                    {showCreateAssigneeForm ? '− Cancel' : '+ Create New Assignee'}
                  </Text>
                </TouchableOpacity>

                {showCreateAssigneeForm && (
                  <View style={s.newMemberForm}>
                    <TextInput style={s.newMemberInput} value={newExtName} onChangeText={setNewExtName} placeholder="Full name *" placeholderTextColor={theme.color.textMuted} />
                    <TextInput style={s.newMemberInput} value={newExtPhone} onChangeText={setNewExtPhone} placeholder="Phone number" placeholderTextColor={theme.color.textMuted} keyboardType="phone-pad" />
                    <TextInput style={s.newMemberInput} value={newExtReference} onChangeText={setNewExtReference} placeholder="Reference" placeholderTextColor={theme.color.textMuted} />
                    <TextInput style={[s.newMemberInput, { minHeight: 60, textAlignVertical: 'top' }]} value={newExtNotes} onChangeText={setNewExtNotes} placeholder="Notes" placeholderTextColor={theme.color.textMuted} multiline />
                    <TouchableOpacity
                      style={[s.newMemberSaveBtn, savingExtAssignee && s.disabledBtn]}
                      onPress={handleCreateExternalAssignee}
                      disabled={savingExtAssignee}
                    >
                      {savingExtAssignee
                        ? <ActivityIndicator color={theme.color.white} size="small" />
                        : <Text style={s.newMemberSaveBtnText}>Save & Assign</Text>}
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── QUICK ADD REQUIREMENT MODAL ── */}
      <Modal
        visible={showQuickReq}
        transparent
        animationType="slide"
        onRequestClose={() => setShowQuickReq(false)}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add Requirement — {quickReqStageName}</Text>
              <TouchableOpacity onPress={() => setShowQuickReq(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={s.modalBody}>
              <TextInput
                style={s.txInput}
                value={quickReqTitle}
                onChangeText={setQuickReqTitle}
                placeholder="Requirement title *"
                placeholderTextColor={theme.color.textMuted}
                autoFocus
              />
              <TouchableOpacity
                style={[s.txSaveBtn, s.txSaveBtnRevenue, savingQuickReq && s.disabledBtn]}
                onPress={handleSaveQuickReq}
                disabled={savingQuickReq}
              >
                {savingQuickReq
                  ? <ActivityIndicator color={theme.color.white} size="small" />
                  : <Text style={s.txSaveBtnText}>Add Requirement</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── DOCUMENT SCANNER MODAL ── */}
      <DocumentScannerModal
        visible={showScanner}
        taskId={taskId}
        uploadedBy={teamMember?.id}
        onClose={() => setShowScanner(false)}
        onSuccess={() => {
          setShowScanner(false);
          fetchTask();
        }}
      />

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
              <Text style={s.viewerCloseBtnText}>✕ Close</Text>
            </TouchableOpacity>
            <Text style={s.viewerTitle} numberOfLines={1}>
              {viewingDoc?.display_name || viewingDoc?.file_name || 'Document'}
            </Text>
            <TouchableOpacity
              style={s.viewerShareBtn}
              onPress={() => { if (viewingDoc) handleShareDoc(viewingDoc); }}
            >
              <Text style={s.viewerShareBtnText}>↗ Share</Text>
            </TouchableOpacity>
          </View>

          {/* Image viewer for JPEGs; WebView fallback for PDFs */}
          {viewingDoc && (/image\//i.test(viewingDoc.file_type) || /\.(jpg|jpeg|png)$/i.test(viewingDoc.file_url)) ? (
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
              onError={() => { Alert.alert('Error', 'Could not load the document.'); setViewingDoc(null); }}
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
                <Text style={s.viewerActionBtnText}>↗  Share File</Text>
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
                <Text style={s.modalTitle}>Edit File Details</Text>
                <TouchableOpacity onPress={() => setShowEditTask(false)}>
                  <Text style={s.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={s.editTaskScroll}>
                {/* Service */}
                <Text style={s.editFieldLabel}>SERVICE</Text>
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

                {/* Due date */}
                <Text style={[s.editFieldLabel, { marginTop: 16 }]}>DUE DATE</Text>
                <TextInput
                  style={s.newMemberInput}
                  value={editDueDate}
                  onChangeText={setEditDueDate}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor={theme.color.textMuted}
                  keyboardType="decimal-pad"
                />

                {/* Notes */}
                <Text style={[s.editFieldLabel, { marginTop: 16 }]}>NOTES</Text>
                <TextInput
                  style={[s.newMemberInput, { minHeight: 80, textAlignVertical: 'top' }]}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  placeholder="Notes..."
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
                    <Text style={s.editStagesSaveBtnText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
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
  metaGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  metaCell:          { width: '45%', gap: 3 },
  metaLabel:         { ...theme.typography.sectionDivider, fontSize: theme.typography.caption.fontSize },
  metaValue:         { ...theme.typography.label, color: theme.color.textSecondary, fontWeight: '600' },
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

  // Assignment
  assignRow:       { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.space3 },
  assignAvatar: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: theme.color.border,
    justifyContent:  'center',
    alignItems:      'center',
  },
  assignAvatarText: { ...theme.typography.body, color: theme.color.textSecondary, fontSize: 16, fontWeight: '700' },
  assignName:       { ...theme.typography.body, color: theme.color.textPrimary, fontSize: 15, fontWeight: '700' },
  youTag:           { ...theme.typography.body, color: theme.color.primaryText },
  assignRole:       { ...theme.typography.caption, color: theme.color.textSecondary, marginTop: 2 },
  assignBtns:       { flexDirection: 'row', gap: theme.spacing.space2, flexWrap: 'wrap' },
  assignMeBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  assignMeBtnText: { ...theme.typography.label, color: theme.color.white, fontWeight: '700' },
  assignPickerBtn: {
    backgroundColor: theme.color.primaryDim,
    borderRadius:    theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth:     1,
    borderColor:     theme.color.primary + '55',
  },
  assignPickerBtnText: { ...theme.typography.label, color: theme.color.info, fontWeight: '700' },
  unassignBtn: {
    backgroundColor: theme.color.danger + '22',
    borderRadius:    theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth:     1,
    borderColor:     theme.color.danger + '55',
  },
  unassignBtnText: { ...theme.typography.body, color: theme.color.danger, fontWeight: '700' },

  // Assignment history
  historyBlock: {
    borderTopWidth:  1,
    borderTopColor:  theme.color.border,
    paddingTop:      theme.spacing.space3,
    gap:             theme.spacing.space2,
  },
  historyTitle:      { ...theme.typography.sectionDivider },
  historyRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  historyDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: theme.color.border,
    marginTop:       4,
  },
  historyText:       { ...theme.typography.label, color: theme.color.textSecondary },
  historyName:       { color: theme.color.textSecondary, fontWeight: '700' },
  historyUnassigned: { color: theme.color.textMuted, fontStyle: 'italic' },
  historyBy:         { color: theme.color.textMuted },
  historyDate:       { ...theme.typography.caption, color: theme.color.border, marginTop: 1 },

  // Route
  routeContainer: { gap: theme.spacing.space1 },
  updateStopBtn: {
    backgroundColor: theme.color.primary + '11',
    borderWidth:     1,
    borderColor:     theme.color.primary + '55',
    borderRadius:    theme.radius.sm,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: 5,
  },
  updateStopBtnText: { ...theme.typography.label, color: theme.color.primaryText, fontWeight: '600' },
  reqStopBtn: {
    backgroundColor: theme.color.bgBase,
    borderWidth:     1,
    borderColor:     theme.color.border,
    borderRadius:    theme.radius.sm,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: 5,
  },
  reqStopBtnText: { ...theme.typography.label, color: theme.color.textSecondary, fontWeight: '600' },
  addReqBtn: {
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space2,
    borderRadius:      theme.radius.sm,
    backgroundColor:   theme.color.success + '22',
    borderWidth:       1,
    borderColor:       theme.color.success + '55',
  },
  addReqBtnText: { ...theme.typography.label, color: theme.color.success, fontWeight: '600' },

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
  commentInput:      { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
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
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.sm,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: 5,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  addTxBtnText: { ...theme.typography.label, color: theme.color.primary, fontWeight: '700' },
  balanceSummary: {
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.lg,
    padding:         14,
    gap:             theme.spacing.space2,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  balanceRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  balanceLabel:   { ...theme.typography.sectionDivider, letterSpacing: 0.8 },
  contractPriceRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    padding:         theme.spacing.space3,
    marginBottom:    theme.spacing.space2,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  contractPriceVal:     { color: theme.color.primary, fontSize: 15, fontWeight: '700', marginTop: 4 },
  contractPriceValLBP:  { color: theme.color.primaryText, fontSize: 12, marginTop: 2 },
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
  extAssigneeSection: { marginTop: theme.spacing.space3, paddingTop: theme.spacing.space3, borderTopWidth: 1, borderTopColor: theme.color.border },
  extAssigneeSectionLabel: { ...theme.typography.caption, color: theme.color.textMuted, fontWeight: '700', marginBottom: theme.spacing.space2 },
  extAssigneeCard: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.space3, backgroundColor: theme.color.bgBase, borderRadius: theme.radius.md, padding: theme.spacing.space3 },
  extAssigneeName: { ...theme.typography.body, fontWeight: '700' },
  extAssigneeMeta: { ...theme.typography.caption, color: theme.color.textSecondary },
  extAssigneeCreatedBy: { ...theme.typography.caption, color: theme.color.textMuted, fontStyle: 'italic' },
  extAssignBtn: { paddingVertical: theme.spacing.space2, paddingHorizontal: theme.spacing.space3, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.border, alignSelf: 'flex-start' },
  extAssignBtnText: { ...theme.typography.label, color: theme.color.textSecondary },
  extReassignBtn: { paddingVertical: theme.spacing.space1, paddingHorizontal: theme.spacing.space2, borderRadius: theme.radius.sm, backgroundColor: theme.color.primary + '22' },
  extReassignBtnText: { ...theme.typography.caption, color: theme.color.primaryText, fontWeight: '600' },
  extRemoveBtn: { paddingVertical: theme.spacing.space1, paddingHorizontal: theme.spacing.space2, borderRadius: theme.radius.sm, backgroundColor: theme.color.danger + '22' },
  extRemoveBtnText: { ...theme.typography.caption, color: theme.color.danger, fontWeight: '600' },
  priceHistoryBlock:   { marginTop: theme.spacing.space3, marginBottom: theme.spacing.space2, paddingStart: theme.spacing.space3, borderStartWidth: 2, borderStartColor: theme.color.primary + '44' },
  priceHistoryLabel:   { ...theme.typography.caption, color: theme.color.textMuted, fontWeight: '700', marginBottom: theme.spacing.space2 },
  priceHistoryEmpty:   { ...theme.typography.caption, color: theme.color.textMuted, fontStyle: 'italic' },
  priceHistoryRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.space2, marginBottom: 6 },
  balanceTotalLabel:   { ...theme.typography.caption, color: theme.color.textSecondary, fontWeight: '800', letterSpacing: 0.8 },
  balanceAmounts:      { flexDirection: 'row', gap: theme.spacing.space3 },
  balanceRevenue:      { color: theme.color.success, fontSize: 13, fontWeight: '700' },
  balanceRevenueLBP:   { color: theme.color.success + 'BB', fontSize: 11, fontWeight: '600' },
  balanceExpenseLBP:   { color: theme.color.danger + 'BB', fontSize: 11, fontWeight: '600' },
  balanceTotalLBP:     { fontSize: 12, fontWeight: '700' },
  txMetaName:          { color: theme.color.textSecondary, fontWeight: '700' },
  balanceExpense:      { color: theme.color.danger, fontSize: 13, fontWeight: '700' },
  balanceDivider:      { height: 1, backgroundColor: theme.color.bgSurface, marginVertical: 2 },
  balanceTotal:        { fontSize: 14, fontWeight: '800' },
  positive:            { color: theme.color.success },
  negative:            { color: theme.color.danger },
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
  txDelete:        { color: theme.color.textMuted, fontSize: 16, padding: 4 },

  // Section title row with edit button
  sectionTitleRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  editStagesBtn: {
    backgroundColor: theme.color.primary + '11',
    borderRadius:    theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth:     1,
    borderColor:     theme.color.primary + '55',
  },
  editStagesBtnText: { ...theme.typography.label, color: theme.color.primaryText, fontWeight: '600' },

  // Edit task button (header)
  editTaskBtn: {
    alignSelf:   'flex-start',
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.sm,
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

  // Stop action row
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
  addDocBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    7,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: 6,
  },
  addDocBtnText:  { ...theme.typography.label, color: theme.color.white, fontWeight: '700' },
  docEmpty: {
    alignItems:    'center',
    paddingVertical: 24,
  },
  docEmptyIcon:   { fontSize: 32, marginBottom: theme.spacing.space2 },
  docEmptyText:   { ...theme.typography.body, color: theme.color.textSecondary, fontWeight: '600' },
  docEmptyHint:   { ...theme.typography.label, color: theme.color.border, marginTop: theme.spacing.space1 },
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

  docDeleteBtn:     { padding: 4 },
  docDeleteBtnText: { fontSize: 18 },
});
