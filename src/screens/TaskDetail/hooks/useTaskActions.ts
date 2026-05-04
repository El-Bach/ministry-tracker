// src/screens/TaskDetail/hooks/useTaskActions.ts
//
// Slice of the action-handler extraction (Phase 5 of the TaskDetail refactor
// — see ../README.md). This is the central home for all task-level handlers
// that used to live inline in the 4,800-line monolith.
//
// Currently extracted:
//
//   FILE-LEVEL (session 52a)
//   • handlePhonePress       — Alert with Call / WhatsApp links
//   • handleShareWhatsApp    — opens wa.me with a status message
//   • handleShareDocsWhatsApp — opens wa.me with the required-docs checklist
//   • handleDuplicateTask    — clones the file (new file_id, all stages reset)
//
//   DOCUMENTS (session 52b)
//   • handleOpenDoc          — opens the in-app document viewer modal
//   • handlePrintDoc         — opens the OS print sheet for a document
//   • handleShareDoc         — downloads + share-sheets a document file
//   • handleRenameDoc        — updates display_name + file_name
//   • handleDeleteDocument   — Alert + hard-delete from task_documents
//   • handlePickPdf          — DocumentPicker → upload to storage → DB row
//
//   TRANSACTIONS / CONTRACT PRICE (session 52c)
//   • handleAddTransaction    — insert revenue/expense + clear form
//   • handleEditTransaction   — update an existing transaction
//   • handleDeleteTransaction — Alert + delete + audit comment
//   • handleSavePrice         — update contract price + history insert
//
//   STATUS UPDATE CASCADE (session 52d)
//   • handleUpdateStopStatus  — full per-stop status change with archive
//                                cascade, push fan-out, and offline queue
//
//   STAGE CRUD (session 52e)
//   • handleCreateStageInEdit       — insert a new ministry from edit modal
//   • handleSaveStages              — full route_stops rewrite + final stage
//   • handleSetStopDueDate          — patch stop's due_date
//   • handleRenameStopMinistry      — rename a stage (ministry)
//   • handleSetStopCity             — patch stop's city_id
//   • handleSetStopAssignee         — patch stop's assigned_to / ext_assignee_id
//                                      (auto-fills city from Network contact)
//   • handleCreateExtAssigneeForStop — insert assignee + auto-assign to stop
//   • handleCreateCity              — insert city + auto-assign to stop
//   • handleCreateCityInEditModal   — insert city + select for edit-modal
//
//   COMMENTS + VOICE NOTES (session 52f — this commit, FINAL slice)
//   • handlePostComment       — insert a text comment + push fan-out
//                                (offline path enqueues via offline queue)
//   • handleSaveEditComment   — update an existing comment's body
//   • handleDeleteComment     — confirmation Alert + delete
//   • handleStartRecording    — request mic permission, start Audio.Recording
//   • handleStopRecording     — stop + capture URI for upload
//   • handleDiscardRecording  — drop the local URI
//   • handleSendVoiceNote     — base64 → upload to storage → comment with audio_url
//   • handlePlayPause         — toggle Audio.Sound playback for a comment
//   • handleTextFromVoice     — speech-to-text (no-op; VoiceModule shimmed null)
//   • handleStopListening     — stop the speech-to-text session
//
// All action handlers are now in this hook. After this commit,
// TaskDetailScreen.tsx is a pure JSX wiring layer ready for Phase 6
// (TanStack Query migration).
//
// Pattern: the hook gets context (auth, navigation, t) from React hooks
// directly; everything else (the task itself, sheet state, setters) is
// passed in via the options object so the hook stays a pure consumer.
//
// To extend, add another handler in the same shape:
//   1. Take the function out of TaskDetailScreen.tsx
//   2. Identify what state it reads / writes
//   3. Add the read state to UseTaskActionsOptions; add the writers as
//      setter args (setX) on the same options object
//   4. Drop the inline copy and destructure the new handler from the hook

import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';

// Speech-to-text removed (the package caused Android Gradle duplicate-class
// errors). Voice note RECORDING via expo-av still works — only the live
// "transcribe me as I speak" feature is shimmed null. Same shape as the
// parent's VoiceModule constant so handleTextFromVoice / handleStopListening
// behave identically.
const VoiceModule: any = null;

import supabase from '../../../lib/supabase';
import { refreshSignedUrl } from '../../../lib/storage';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../lib/i18n';
import { useOfflineQueue } from '../../../store/offlineQueue';
import { sendPushNotification, sendActivityNotificationToAll } from '../../../lib/notifications';
import { Task, TaskRouteStop, Ministry, City, DashboardStackParamList } from '../../../types';

// The single closure stage that's always the last stop on every file —
// duplicated here so the hook is self-contained. Same Arabic string used
// by TaskDetailScreen and the database.
const FINAL_STAGE_NAME = 'تسليم المعاملة النهائية و اغلاق الحسابات';
import { TaskDocumentLite } from '../components/DocumentsSection';
import { FileTransaction } from '../components/FinancialsSection';

// Local helper — identical to the one at the top of TaskDetailScreen.tsx.
// Inlined here so the hook is self-contained; we'll deduplicate when more
// utility functions get extracted.
function formatDateOnly(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${parseInt(y)}`;
}

type Nav = NativeStackNavigationProp<DashboardStackParamList>;

export interface UseTaskActionsOptions {
  // ── File-level slice ────────────────────────────────────────────────
  /** The currently-loaded task. Handlers no-op when null. */
  task: Task | null;
  /** Service-document rows currently displayed in the Required Docs sheet. */
  sheetDocs: any[];
  /** Sub-requirements per service-document, keyed by doc id. */
  sheetDocReqs: Record<string, any[]>;
  /** Setter for the duplicate-in-progress spinner shown on the duplicate button. */
  setDuplicating: (b: boolean) => void;

  // ── Documents slice ────────────────────────────────────────────────
  /** The current task's id — used as the FK + storage path prefix. */
  taskId: string;
  /** Refetch the task (mutations call this after success to refresh UI). */
  fetchTask: () => void;
  /** Setter for which doc is open in the in-app viewer modal. */
  setViewingDoc: (doc: TaskDocumentLite | null) => void;
  /** Setter for the print-spinner state. */
  setPrintingDoc: (b: boolean) => void;
  /** Setter for the small status banner ("Preparing file…") shown during share. */
  setStatusMsg: (msg: string) => void;
  /** Setter for which doc is currently being deleted (per-row spinner). */
  setDeletingDocId: (id: string | null) => void;
  /** Setter for the global PDF-upload spinner. */
  setUploadingPdf: (b: boolean) => void;

  // ── Transactions slice ─────────────────────────────────────────────
  // Add-transaction form state (read by handleAddTransaction)
  txDescription:    string;
  txAmountUSD:      string;
  txAmountLBP:      string;
  txType:           'expense' | 'revenue';
  txStopId:         string | null;
  /** The currently-active LBP/USD exchange rate, snapshotted onto each new tx. */
  exchangeRate:     number;

  // Add-transaction form setters (called by handleAddTransaction on success/clear)
  setSavingTx:           (b: boolean) => void;
  setTxDescription:      (s: string) => void;
  setTxAmountUSD:        (s: string) => void;
  setTxAmountLBP:        (s: string) => void;
  setTxType:             (t: 'expense' | 'revenue') => void;
  setTxStopId:           (id: string | null) => void;
  setShowTxStagePicker:  (b: boolean) => void;
  setShowAddTransaction: (b: boolean) => void;

  // Edit-transaction form state (read by handleEditTransaction)
  editingTx:           FileTransaction | null;
  editTxDescription:   string;
  editTxAmountUSD:     string;
  editTxAmountLBP:     string;
  editTxType:          'expense' | 'revenue';
  editTxStopId:        string | null;

  // Edit-transaction form setters
  setSavingEditTx:         (b: boolean) => void;
  setEditingTx:            (tx: FileTransaction | null) => void;
  setEditTxStopId:         (id: string | null) => void;
  setShowEditTxStagePicker:(b: boolean) => void;

  // Delete-transaction setter (per-row spinner)
  setDeletingTxId: (id: string | null) => void;

  // Contract-price form state (read by handleSavePrice)
  editPriceUSD:      string;
  editPriceLBP:      string;
  editPriceNote:     string;
  contractPriceUSD:  number;
  contractPriceLBP:  number;

  // Contract-price setters
  setSavingPrice:      (b: boolean) => void;
  setContractPriceUSD: (n: number) => void;
  setContractPriceLBP: (n: number) => void;
  setShowEditPrice:    (b: boolean) => void;
  setEditPriceNote:    (s: string) => void;

  // ── Status update cascade ──────────────────────────────────────────
  /** Setter for the per-stop "updating…" spinner (id of stop being saved). */
  setUpdatingStop:     (id: string | null) => void;
  /** Setter for the status-picker modal's open state. */
  setShowStatusPicker: (b: boolean) => void;
  /** Setter for which stop the status picker is targeting. */
  setSelectedStop:     (stop: TaskRouteStop | null) => void;

  // ── Stage CRUD ─────────────────────────────────────────────────────
  // Read state — the edit modal's working set (ordered list + per-stage city map)
  newStageName:       string;
  allStages:          Ministry[];
  editingStops:       Ministry[];
  editStageCities:    Record<string, { cityId: string | null; cityName: string | null }>;
  extAssignees:       any[];
  newExtName:         string;
  newExtPhone:        string;
  newExtReference:    string;
  newCityName:        string;

  // Setters used by handleCreateStageInEdit
  setSavingNewStage:    (b: boolean) => void;
  setAllStages:         Dispatch<SetStateAction<Ministry[]>>;
  setEditingStops:      Dispatch<SetStateAction<Ministry[]>>;
  setNewStageName:      (s: string) => void;
  setShowNewStageInEdit:(b: boolean) => void;

  // Setters used by handleSaveStages
  setSavingStages:    (b: boolean) => void;
  setShowEditStages:  (b: boolean) => void;

  // Setters used by handleSetStopDueDate
  setSavingStopDueDate:        (id: string | null) => void;
  setStopDueDatePickerStopId:  (id: string | null) => void;

  // Setters used by handleRenameStopMinistry
  setSavingStageNameId: (id: string | null) => void;
  setOpenStageNameId:   (id: string | null) => void;

  // Setters used by handleSetStopCity / handleSetStopAssignee
  setSavingStopField:  (id: string | null) => void;
  setOpenCityStopId:   (id: string | null) => void;
  setStopCitySearch:   (s: string) => void;
  setOpenAssigneeStopId: (id: string | null) => void;

  // Setters used by handleCreateExtAssigneeForStop
  setSavingExtAssignee: (b: boolean) => void;
  setExtAssignees:      Dispatch<SetStateAction<any[]>>;
  setNewExtName:        (s: string) => void;
  setNewExtPhone:       (s: string) => void;
  setNewExtReference:   (s: string) => void;
  setShowCreateExtForm: (b: boolean) => void;

  // Setters used by handleCreateCity / handleCreateCityInEditModal
  setSavingCity:           (b: boolean) => void;
  setNewCityName:          (s: string) => void;
  setShowCreateCityForm:   (b: boolean) => void;
  setAllCities:            Dispatch<SetStateAction<City[]>>;
  setEditStageCities:      Dispatch<SetStateAction<Record<string, { cityId: string | null; cityName: string | null }>>>;
  setEditCreateCityOpen:   (b: boolean) => void;
  setEditCityPickerMiniId: (id: string | null) => void;

  // ── Comments + voice notes ─────────────────────────────────────────
  // Comment form
  newComment:             string;
  editingCommentId:       string | null;
  editingCommentBody:     string;
  setNewComment:          (s: string) => void;
  setPostingComment:      (b: boolean) => void;
  setEditingCommentId:    (id: string | null) => void;
  setEditingCommentBody:  (s: string) => void;
  setSavingEditComment:   (b: boolean) => void;

  // Voice recording state
  recordingObj:           Audio.Recording | null;
  recordedUri:            string | null;
  /** Interval id for the recording-duration counter — owned by the parent so
   *  cleanup on unmount stays simple (parent has a useEffect cleanup). */
  recordingTimerRef:      MutableRefObject<ReturnType<typeof setInterval> | null>;
  setIsRecording:         (b: boolean) => void;
  setRecordingObj:        (rec: Audio.Recording | null) => void;
  setRecordingDuration:   Dispatch<SetStateAction<number>>;
  setRecordedUri:         (uri: string | null) => void;
  setUploadingVoice:      (b: boolean) => void;

  // Speech-to-text (shimmed — handlers no-op when VoiceModule is null)
  setIsListening:         (b: boolean) => void;
  setVoicePartial:        (s: string) => void;

  // Voice playback
  soundObj:               Audio.Sound | null;
  playingCommentId:       string | null;
  setSoundObj:            (s: Audio.Sound | null) => void;
  setPlayingCommentId:    (id: string | null) => void;
  setPlaybackPosition:    (n: number) => void;
  setPlaybackDuration:    (n: number) => void;
}

export interface UseTaskActionsReturn {
  // File-level
  handlePhonePress:        (phone: string, name?: string) => void;
  handleShareWhatsApp:     () => void;
  handleShareDocsWhatsApp: () => void;
  handleDuplicateTask:     () => void;
  // Documents
  handleOpenDoc:           (doc: TaskDocumentLite) => Promise<void>;
  handlePrintDoc:          (doc: TaskDocumentLite) => Promise<void>;
  handleShareDoc:          (doc: TaskDocumentLite) => Promise<void>;
  handleRenameDoc:         (doc: TaskDocumentLite, newName: string) => Promise<void>;
  handleDeleteDocument:    (doc: TaskDocumentLite) => void;
  handlePickPdf:           () => Promise<void>;
  // Transactions / contract price
  handleAddTransaction:    () => Promise<void>;
  handleEditTransaction:   () => Promise<void>;
  handleDeleteTransaction: (tx: FileTransaction) => void;
  handleSavePrice:         () => Promise<void>;
  // Status update cascade
  handleUpdateStopStatus:  (stop: TaskRouteStop, newStatus: string, reason?: string) => Promise<void>;
  // Stage CRUD
  handleCreateStageInEdit:        () => Promise<void>;
  handleSaveStages:               () => Promise<void>;
  handleSetStopDueDate:           (stopId: string, date: string | null) => Promise<void>;
  handleRenameStopMinistry:       (ministryId: string, newName: string) => Promise<void>;
  handleSetStopCity:              (stopId: string, cityId: string | null) => Promise<void>;
  handleSetStopAssignee:          (stopId: string, memberId: string | null, extId: string | null) => Promise<void>;
  handleCreateExtAssigneeForStop: (stopId: string) => Promise<void>;
  handleCreateCity:               (stopId: string) => Promise<void>;
  handleCreateCityInEditModal:    (stageId: string) => Promise<void>;
  // Comments + voice notes
  handlePostComment:              () => Promise<void>;
  handleSaveEditComment:          () => Promise<void>;
  handleDeleteComment:            (commentId: string) => void;
  handleStartRecording:           () => Promise<void>;
  handleStopRecording:            () => Promise<void>;
  handleDiscardRecording:         () => void;
  handleSendVoiceNote:            () => Promise<void>;
  handlePlayPause:                (commentId: string, audioUrl: string) => Promise<void>;
  handleTextFromVoice:            () => Promise<void>;
  handleStopListening:            () => Promise<void>;
}

export function useTaskActions(opts: UseTaskActionsOptions): UseTaskActionsReturn {
  const {
    task, sheetDocs, sheetDocReqs, setDuplicating,
    taskId, fetchTask,
    setViewingDoc, setPrintingDoc, setStatusMsg, setDeletingDocId, setUploadingPdf,
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
    // comments + voice
    newComment, editingCommentId, editingCommentBody,
    setNewComment, setPostingComment, setEditingCommentId, setEditingCommentBody, setSavingEditComment,
    recordingObj, recordedUri, recordingTimerRef,
    setIsRecording, setRecordingObj, setRecordingDuration, setRecordedUri, setUploadingVoice,
    setIsListening, setVoicePartial,
    soundObj, playingCommentId,
    setSoundObj, setPlayingCommentId, setPlaybackPosition, setPlaybackDuration,
  } = opts;
  const { teamMember } = useAuth();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { isOnline, enqueue } = useOfflineQueue();

  // ─── Phone-number long-press menu (Call / WhatsApp / Cancel) ───────────
  const handlePhonePress = (phone: string, name?: string) => {
    const clean = phone.replace(/[^0-9+]/g, '');
    Alert.alert(name ?? phone, phone, [
      { text: '📞 Phone Call', onPress: () => Linking.openURL(`tel:${clean}`) },
      { text: '💬 WhatsApp',   onPress: () => Linking.openURL(`https://wa.me/${clean.replace(/^\+/, '')}`) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ─── Share file status via WhatsApp ────────────────────────────────────
  // Composes an Arabic-language status message (client / service / status /
  // stage list / notes) and opens wa.me. Footer includes "Generated by …"
  // line + the GovPilot branding line.
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

  // ─── Share required-docs checklist via WhatsApp ────────────────────────
  // Checked docs render with strikethrough (~~~) so the recipient sees what's
  // already collected vs what's still pending. Sub-requirements follow the
  // same pattern.
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

  // ─── Duplicate file ────────────────────────────────────────────────────
  // Clones tasks row + task_route_stops with all stages reset to "Pending"
  // and current_status reset to "Submitted". Preserves: client, service,
  // assignees (team + ext), notes, prices, per-stage city_id. Resets:
  // due_date, archive flag, status_updates audit (a fresh "Submitted" row
  // gets inserted to seed the new file's history).
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
                  client_id:       task.client_id,
                  service_id:      task.service_id,
                  assigned_to:     task.assigned_to     ?? null,
                  ext_assignee_id: task.ext_assignee_id ?? null,
                  current_status:  'Submitted',
                  due_date:        null,
                  notes:           task.notes           ?? null,
                  price_usd:       task.price_usd       ?? 0,
                  price_lbp:       task.price_lbp       ?? 0,
                  is_archived:     false,
                  created_at:      now,
                  updated_at:      now,
                  org_id:          teamMember?.org_id   ?? null,
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
                task_id:    newTask.id,
                updated_by: teamMember?.id,
                new_status: 'Submitted',
              });

              setDuplicating(false);
              Alert.alert(t('duplicate'), t('savedSuccess'), [
                {
                  text: 'Open New File',
                  onPress: () => {
                    // Bounce through the Dashboard so its useFocusEffect refreshes
                    // (the new task isn't in its in-memory list yet), then push
                    // the new TaskDetail on top.
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

  // ─── Documents ─────────────────────────────────────────────────────────
  // Open a document in the in-app viewer modal. The viewer reads `viewingDoc`
  // state from the parent and renders an Image / WebView accordingly.
  const handleOpenDoc = async (doc: TaskDocumentLite) => {
    // The bucket is private — we must mint a fresh signed URL before showing
    // the document. extractStoragePath() inside refreshSignedUrl handles
    // both legacy rows (full public URL) and any future rows that store
    // just the storage path.
    const signed = await refreshSignedUrl(doc.file_url);
    if (!signed) {
      Alert.alert(t('error'), t('somethingWrong'));
      return;
    }
    setViewingDoc({ ...doc, file_url: signed });
  };

  // Print a document via the OS print sheet.
  const handlePrintDoc = async (doc: TaskDocumentLite) => {
    setPrintingDoc(true);
    try {
      const signed = await refreshSignedUrl(doc.file_url);
      if (!signed) throw new Error('Could not generate signed URL');
      await Print.printAsync({ uri: signed });
    } catch (e: any) {
      Alert.alert(t('error'), e.message ?? t('somethingWrong'));
    } finally {
      setPrintingDoc(false);
    }
  };

  // Download a document to the cache, then open the OS share sheet with the
  // actual file (not just the URL — that way the recipient gets the file
  // attached, not a link).
  const handleShareDoc = async (doc: TaskDocumentLite) => {
    try {
      const label    = doc.display_name || doc.file_name;
      const ext      = doc.file_type === 'application/pdf' ? 'pdf' : 'jpg';
      const localUri = `${FileSystem.cacheDirectory}${label.replace(/[^a-z0-9]/gi, '_')}.${ext}`;

      setStatusMsg('Preparing file...');
      const signed = await refreshSignedUrl(doc.file_url);
      if (!signed) throw new Error('Could not generate signed URL');
      const { uri } = await FileSystem.downloadAsync(signed, localUri);
      setStatusMsg('');

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert(t('error'), t('somethingWrong'));
        return;
      }
      const isImg = /image\//i.test(doc.file_type) || /\.(jpg|jpeg|png)$/i.test(doc.file_url);
      await Sharing.shareAsync(uri, {
        mimeType:    isImg ? 'image/jpeg' : 'application/pdf',
        dialogTitle: label,
        UTI:         isImg ? 'public.jpeg' : 'com.adobe.pdf',
      });
    } catch (e: any) {
      setStatusMsg('');
      Alert.alert(t('error'), e.message ?? t('somethingWrong'));
    }
  };

  // Rename a document — updates display_name + file_name in the DB then
  // refreshes the task to pull the change back into the UI.
  const handleRenameDoc = async (doc: TaskDocumentLite, newName: string) => {
    const name = newName.trim();
    if (!name) return;
    await supabase
      .from('task_documents')
      .update({ display_name: name, file_name: name })
      .eq('id', doc.id);
    fetchTask();
  };

  // Delete a document with a confirmation Alert. Hard-deletes from
  // task_documents (does NOT touch the storage object — that's left for a
  // background cleanup job to handle).
  const handleDeleteDocument = (doc: TaskDocumentLite) => {
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

  // PDF upload from the device's file picker. Goes:
  //   DocumentPicker → cache URI → Supabase Storage upload → DB row insert
  // Web uses fetch + storage.upload (Blob), native uses FileSystem.uploadAsync
  // (multipart) — same destination, two paths because RN's File API
  // doesn't read local file:// URIs as Blobs.
  const handlePickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset        = result.assets[0];
      const localUri     = asset.uri;
      const originalName = asset.name ?? `Document_${Date.now()}.pdf`;
      const displayName  = originalName.replace(/\.pdf$/i, '');

      setUploadingPdf(true);
      const timestamp = Date.now();
      const safeName  = displayName.replace(/[^a-z0-9]/gi, '_');
      const filePath  = `documents/${taskId}/${safeName}_${timestamp}.pdf`;

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

  // ─── Transactions / Contract price ─────────────────────────────────────
  // Insert a new file_transactions row (revenue or expense). Snapshots the
  // current LBP/USD exchange rate onto the row (rate_usd_lbp) so historical
  // C/V calculations stay correct even if the org rate changes later.
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
      rate_usd_lbp: exchangeRate, // snapshot rate at time of entry
      stop_id:      txStopId ?? null,
      created_by:   teamMember?.id,
    });
    setSavingTx(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    // Reset form + close modal
    setTxDescription('');
    setTxAmountUSD('');
    setTxAmountLBP('');
    setTxType('expense');
    setTxStopId(null);
    setShowTxStagePicker(false);
    setShowAddTransaction(false);
    fetchTask();
  };

  // Update an existing transaction's description/amounts/type/stop. Note: we
  // intentionally do NOT update `rate_usd_lbp` on edit — the original rate
  // stays locked so historical reports remain consistent.
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
    const { error } = await supabase
      .from('file_transactions')
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

  // Delete a transaction with confirmation. Inserts an audit comment first so
  // the file's activity log preserves the deleted amount even though the
  // transaction row itself is gone.
  // Local fmt helpers — same shape as the ones in TaskDetailScreen, kept
  // local so the hook doesn't depend on more imports.
  const fmtUSDLocal = (n: number) => `$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const fmtLBPLocal = (n: number) => `LBP ${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  const handleDeleteTransaction = (tx: FileTransaction) => {
    const doDelete = async () => {
      setDeletingTxId(tx.id);
      // Audit comment so the deleted amount is preserved in activity history
      await supabase.from('task_comments').insert({
        task_id:   taskId,
        author_id: teamMember?.id,
        body: `🗑 Deleted ${tx.type}: "${tx.description}" (${
          tx.amount_usd > 0 ? fmtUSDLocal(tx.amount_usd) : ''
        }${tx.amount_usd > 0 && tx.amount_lbp > 0 ? ' / ' : ''}${
          tx.amount_lbp > 0 ? fmtLBPLocal(tx.amount_lbp) : ''
        })`,
      });
      await supabase.from('file_transactions').delete().eq('id', tx.id);
      setDeletingTxId(null);
      fetchTask();
    };
    // Web: native Alert.alert doesn't render a button bar in browsers — use
    // confirm() directly. Native: regular Alert with destructive style.
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

  // Save a new contract price for the file. Updates `tasks.price_usd/lbp` and
  // appends a row to `task_price_history` so the change shows up under the
  // collapsible "CONTRACT PRICE CHANGES" panel.
  const handleSavePrice = async () => {
    const newUSD = parseFloat(editPriceUSD) || 0;
    const newLBP = parseFloat(editPriceLBP.replace(/,/g, '')) || 0;
    setSavingPrice(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          price_usd:  newUSD,
          price_lbp:  newLBP,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);
      if (error) throw error;
      await supabase.from('task_price_history').insert({
        task_id:       taskId,
        old_price_usd: contractPriceUSD,
        old_price_lbp: contractPriceLBP,
        new_price_usd: newUSD,
        new_price_lbp: newLBP,
        note:          editPriceNote.trim() || null,
        changed_by:    teamMember?.id ?? null,
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

  // ─── Status update cascade ─────────────────────────────────────────────
  // The single most central handler in TaskDetailScreen. Updates one stop's
  // status and cascades the change through the file's lifecycle:
  //
  //   1. Patch task_route_stops.status (+ rejection_reason for "Rejected")
  //   2. Append to status_updates audit log
  //   3. Re-read all stops to determine if EVERY stop is now terminal
  //      (Done / Rejected / Received & Closed)
  //   4. Patch tasks.current_status — and if all terminal, also set
  //      is_archived = true, closed_at = now, due_date = today (when empty)
  //   5. Show "Done — Saved" alert when archiving
  //   6. Direct push notification to the file's main assignee (skip self)
  //   7. Broadcast push fan-out via sendActivityNotificationToAll (honors
  //      every recipient's notification_prefs)
  //
  // Offline path: enqueue the change (status_update action) + show
  // optimistic "Saved" alert + refetch (which will hit the local cache
  // until the device comes back online).
  const handleUpdateStopStatus = async (
    stop: TaskRouteStop,
    newStatus: string,
    reason?: string,
  ) => {
    setUpdatingStop(stop.id);
    const oldStatus = stop.status;
    const now = new Date().toISOString();

    if (isOnline) {
      try {
        // 1. Patch the stop status (and rejection_reason iff Rejected)
        const { error } = await supabase
          .from('task_route_stops')
          .update({
            status:           newStatus,
            updated_at:       now,
            updated_by:       teamMember?.id,
            rejection_reason: newStatus === 'Rejected' ? (reason ?? null) : null,
          })
          .eq('id', stop.id);
        if (error) throw error;

        // 2. Audit row in status_updates (drives the activity feed)
        await supabase.from('status_updates').insert({
          task_id:    taskId,
          stop_id:    stop.id,
          updated_by: teamMember?.id,
          old_status: oldStatus,
          new_status: newStatus,
        });

        // 3. Re-read all stops so we can decide if the file should archive.
        //    Note: the row we just updated may not be visible yet via the
        //    local task object (no realtime), so we hit the DB.
        const { data: allStops } = await supabase
          .from('task_route_stops')
          .select('id, status')
          .eq('task_id', taskId);

        const TERMINAL = ['Done', 'Rejected', 'Received & Closed'];
        let newTaskStatus = newStatus;
        let shouldArchive = false;
        if (allStops) {
          // The freshly-read row already reflects newStatus, but be defensive:
          // for the row we just updated, use newStatus directly.
          const allDone = allStops.every((s: { id: string; status: string }, i: number) =>
            (i === allStops.findIndex((x: { id: string }) => x.id === stop.id))
              ? TERMINAL.includes(newStatus)
              : TERMINAL.includes(s.status)
          );
          newTaskStatus = allDone ? 'Done' : newStatus;
          shouldArchive = allDone;
        }

        // 4. Patch the task — archive cascade includes due_date default
        const todayStr = now.slice(0, 10); // YYYY-MM-DD
        await supabase
          .from('tasks')
          .update({
            current_status: newTaskStatus,
            updated_at:     now,
            ...(shouldArchive ? {
              is_archived: true,
              closed_at:   now,
              ...(!task?.due_date ? { due_date: todayStr } : {}),
            } : {}),
          })
          .eq('id', taskId);

        // 5. User-visible confirmation when the file just closed
        if (shouldArchive) {
          Alert.alert(t('done'), `${t('archive')} — ${t('savedSuccess')}`);
        }

        // 6. Direct push to the file's assignee (skip if the actor is the assignee)
        if (task?.assignee?.push_token && task.assignee.id !== teamMember?.id) {
          sendPushNotification(
            task.assignee.push_token,
            'Stage Updated',
            `${task.client?.name} — ${stop.ministry?.name}: ${newStatus}`,
            { taskId },
          );
        }

        // 7. Broadcast — every team member's prefs are honored server-side
        const actorName = teamMember?.name ?? 'Someone';
        sendActivityNotificationToAll(
          supabase,
          teamMember?.id,
          `🔄 ${actorName}`,
          `${task?.client?.name ?? 'File'} · ${stop.ministry?.name ?? 'Stage'} → ${newStatus}`,
          'status',
          { taskId },
        );

        fetchTask();
      } catch (e: unknown) {
        Alert.alert(t('error'), (e as Error).message);
      }
    } else {
      // Offline: queue the change for later. Status updates retry up to
      // MAX_RETRIES (5) before being discarded — see store/offlineQueue.ts.
      await enqueue({
        type: 'status_update',
        payload: {
          stopId:    stop.id,
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

  // ─── Stage CRUD ────────────────────────────────────────────────────────
  // Insert a new ministry from inside the Edit Stages modal. Includes a
  // duplicate-name guard (case-insensitive) using the local allStages cache;
  // on success, adds to allStages + editingStops so the UI updates without a
  // refetch.
  const handleCreateStageInEdit = async () => {
    if (!newStageName.trim()) {
      Alert.alert(t('required'), t('fieldRequired'));
      return;
    }
    const duplicate = allStages.find(
      (m) => m.name.trim().toLowerCase() === newStageName.trim().toLowerCase(),
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

  // Persist the user's edited stage list. The implementation rewrites the
  // task's route_stops entirely:
  //   1. Find or create the FINAL_STAGE ministry for this org (always last)
  //   2. Delete all existing task_route_stops for this task
  //   3. Insert the new ordered list (preserving statuses and city_ids
  //      where possible, using editStageCities for newly added stages)
  // We rewrite rather than diff because the diff logic (insert/delete/
  // reorder/update) gets gnarly with reordering — clean replacement is
  // simpler and safe for a list this size.
  const handleSaveStages = async () => {
    setSavingStages(true);
    try {
      const existingFinal = task?.route_stops?.find(s => s.ministry?.name === FINAL_STAGE_NAME);

      // 1. Ensure the FINAL_STAGE ministry exists in this org
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

      // 2. Wipe + 3. Re-insert in new order with final stage pinned to last
      const { error: delErr } = await supabase
        .from('task_route_stops')
        .delete()
        .eq('task_id', taskId);
      if (delErr) throw delErr;

      const newStops = [
        ...editingStops.map((s, idx) => ({
          task_id:     taskId,
          ministry_id: s.id,
          stop_order:  idx + 1,
          status:      task?.route_stops?.find(r => r.ministry_id === s.id)?.status ?? 'Pending',
          // Preference order for city: explicit override → ministry default → null
          city_id:     editStageCities[s.id]?.cityId ?? s.city_id ?? null,
        })),
        {
          task_id:     taskId,
          ministry_id: finalMinistryId,
          stop_order:  editingStops.length + 1,
          status:      existingFinal?.status ?? 'Pending',
          city_id:     existingFinal?.city_id ?? null,
        },
      ];

      const { error: insErr } = await supabase.from('task_route_stops').insert(newStops);
      if (insErr) throw insErr;

      setShowEditStages(false);
      fetchTask();
    } catch (e: unknown) {
      Alert.alert(t('error'), (e as Error).message);
    } finally {
      setSavingStages(false);
    }
  };

  // Patch a single stop's due_date.
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

  // Rename the underlying ministry. The change propagates to every file
  // that references this ministry — by design, since stages are shared
  // org-wide.
  const handleRenameStopMinistry = async (ministryId: string, newName: string) => {
    if (!newName.trim()) return;
    setSavingStageNameId(ministryId);
    await supabase.from('ministries').update({ name: newName.trim() }).eq('id', ministryId);
    setSavingStageNameId(null);
    setOpenStageNameId(null);
    fetchTask();
  };

  // Patch a single stop's city_id (the stop, not the ministry default).
  const handleSetStopCity = async (stopId: string, cityId: string | null) => {
    setSavingStopField(stopId);
    await supabase.from('task_route_stops').update({ city_id: cityId }).eq('id', stopId);
    setSavingStopField(null);
    setOpenCityStopId(null);
    setStopCitySearch('');
    fetchTask();
  };

  // Patch a single stop's assignee (team member OR external Network contact).
  // If assigning a Network contact AND the stop has no city yet, also auto-fill
  // the city from the contact's saved city — saves the user a tap.
  const handleSetStopAssignee = async (stopId: string, memberId: string | null, extId: string | null) => {
    setSavingStopField(stopId);
    const updates: Record<string, any> = { assigned_to: memberId, ext_assignee_id: extId };
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

  // Create a Network contact (assignees row) AND immediately assign them to
  // the given stop. Used by the inline "+ Create new contact" form in the
  // assignee picker.
  const handleCreateExtAssigneeForStop = async (stopId: string) => {
    if (!newExtName.trim()) { Alert.alert(t('required'), t('fieldRequired')); return; }
    setSavingExtAssignee(true);
    const { data, error } = await supabase
      .from('assignees')
      .insert({
        name:       newExtName.trim(),
        phone:      newExtPhone.trim()      || null,
        reference:  newExtReference.trim()  || null,
        created_by: teamMember?.id,
        org_id:     teamMember?.org_id ?? null,
      })
      .select('*, creator:team_members!created_by(name)')
      .single();
    setSavingExtAssignee(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    setExtAssignees((prev) => [...prev, data as any].sort((a, b) => a.name.localeCompare(b.name)));
    setNewExtName(''); setNewExtPhone(''); setNewExtReference('');
    setShowCreateExtForm(false);
    await handleSetStopAssignee(stopId, null, (data as any).id);
  };

  // Create a city + auto-assign to the given stop. Used by the inline
  // "+ Create new city" form in the per-stop city picker.
  const handleCreateCity = async (stopId: string) => {
    if (!newCityName.trim()) { Alert.alert(t('required'), t('fieldRequired')); return; }
    setSavingCity(true);
    const { data, error } = await supabase
      .from('cities')
      .insert({ name: newCityName.trim(), org_id: teamMember?.org_id ?? null })
      .select()
      .single();
    setSavingCity(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    const created = data as City;
    setAllCities((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setNewCityName('');
    setShowCreateCityForm(false);
    await handleSetStopCity(stopId, created.id);
  };

  // Same as above but used inside the Edit Stages modal — instead of
  // patching the live stop, it writes to editStageCities so the change
  // takes effect when the user clicks Save Stages.
  const handleCreateCityInEditModal = async (stageId: string) => {
    if (!newCityName.trim()) { Alert.alert(t('required'), t('fieldRequired')); return; }
    setSavingCity(true);
    const { data, error } = await supabase
      .from('cities')
      .insert({ name: newCityName.trim(), org_id: teamMember?.org_id ?? null })
      .select()
      .single();
    setSavingCity(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    const created = data as City;
    setAllCities((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setEditStageCities((prev) => ({ ...prev, [stageId]: { cityId: created.id, cityName: created.name } }));
    setNewCityName('');
    setEditCreateCityOpen(false);
    setEditCityPickerMiniId(null);
  };

  // ─── Comments + voice notes ────────────────────────────────────────────
  // Post a text comment. Online: insert + push fan-out to other team
  // members. Offline: enqueue via the offline queue (which retries once
  // connectivity returns).
  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    setPostingComment(true);

    if (isOnline) {
      const { error } = await supabase.from('task_comments').insert({
        task_id:   taskId,
        author_id: teamMember?.id,
        body:      newComment.trim(),
      });
      if (error) {
        Alert.alert(t('error'), error.message);
      } else {
        setNewComment('');
        fetchTask();
        const clientName = task?.client?.name ?? 'a file';
        const actorName  = teamMember?.name    ?? 'Someone';
        sendActivityNotificationToAll(
          supabase,
          teamMember?.id,
          `💬 ${actorName}`,
          `${clientName}: ${newComment.trim()}`,
          'comment',
          { taskId },
        );
      }
    } else {
      await enqueue({
        type: 'comment',
        payload: {
          taskId,
          authorId: teamMember?.id ?? '',
          body:     newComment.trim(),
        },
      });
      setNewComment('');
      Alert.alert(t('saved'), t('savedSuccess'));
    }

    setPostingComment(false);
  };

  // Save the user's edits to an existing comment.
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

  // Delete a comment with confirmation.
  const handleDeleteComment = (commentId: string) => {
    Alert.alert(t('deleteComment'), t('confirmDelete'), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('task_comments').delete().eq('id', commentId);
          fetchTask();
        },
      },
    ]);
  };

  // ── Voice note recording ───────────────────────────────────────────────
  // Start a voice recording. Requests mic permission, prepares an
  // Audio.Recording, and starts a 1Hz duration counter. Note: the timer
  // ref lives in the parent so the parent's unmount cleanup can clear it.
  const handleStartRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { Alert.alert(t('warning'), t('fieldRequired')); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      // Explicit prepare+start (instead of createAsync) for better Expo Go compat
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();

      // Set state AFTER recording is fully started, then start timer separately —
      // the small delay lets React flush the setRecordingObj before the interval fires.
      setIsRecording(true);
      setRecordingDuration(0);
      setRecordingObj(rec);
      setTimeout(() => {
        recordingTimerRef.current = setInterval(() => {
          setRecordingDuration((d) => d + 1);
        }, 1000);
      }, 100);
    } catch (e: unknown) {
      Alert.alert(t('error'), (e as any)?.message ?? String(e) ?? t('somethingWrong'));
    }
  };

  // Stop the active recording. Captures the URI BEFORE stopAndUnloadAsync
  // because the URI becomes inaccessible once the recording is unloaded.
  const handleStopRecording = async () => {
    if (!recordingObj) return;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    try {
      const uri = recordingObj.getURI(); // capture FIRST
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

  // Discard a recorded-but-not-sent voice note.
  const handleDiscardRecording = () => {
    setRecordedUri(null);
    setRecordingDuration(0);
  };

  // Speech-to-text — currently shimmed because the package caused Android
  // Gradle duplicate-class errors. handleTextFromVoice opens an alert
  // explaining the feature is APK-only; handleStopListening tries best-effort
  // to stop a session if one was started.
  const handleTextFromVoice = async () => {
    if (!VoiceModule) {
      Alert.alert('يتطلب بناء APK', 'ميزة تحويل الصوت إلى نص تعمل فقط في نسخة APK، وليس في Expo Go.');
      return;
    }
    handleDiscardRecording();
    try {
      setIsListening(true);
      setVoicePartial('');
      await VoiceModule.start('ar-LB');
    } catch (e: any) {
      setIsListening(false);
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

  // Send a voice note: read the local file as base64 → upload to Supabase
  // Storage → insert a comment with audio_url. Same pattern as handlePickPdf
  // but for audio. We use base64-via-supabase-client (instead of the
  // FileSystem.uploadAsync path) because audio files are smaller and the
  // base64 path is simpler / more proven on Expo Go.
  const handleSendVoiceNote = async () => {
    if (!recordedUri) return;
    setUploadingVoice(true);
    try {
      const timestamp   = Date.now();
      const ext         = recordedUri.split('.').pop()?.toLowerCase() ?? 'm4a';
      const storagePath = `voice-notes/${taskId}/${timestamp}.${ext}`;
      const contentType = ext === 'mp4' ? 'audio/mp4' : 'audio/m4a';

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
        task_id:   taskId,
        author_id: teamMember?.id,
        body:      '🎤 Voice note',
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

  // Toggle play/pause for a voice-note comment. Tapping the same comment's
  // play button while it's playing pauses it. Tapping a different comment
  // unloads the current sound and starts the new one.
  const handlePlayPause = async (commentId: string, audioUrl: string) => {
    if (playingCommentId === commentId) {
      if (soundObj) { await soundObj.pauseAsync(); }
      setPlayingCommentId(null);
      return;
    }
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
        },
      );
      setSoundObj(sound);
    } catch (e: unknown) {
      Alert.alert(t('error'), t('somethingWrong'));
      setPlayingCommentId(null);
    }
  };

  return {
    // File-level
    handlePhonePress,
    handleShareWhatsApp,
    handleShareDocsWhatsApp,
    handleDuplicateTask,
    // Documents
    handleOpenDoc,
    handlePrintDoc,
    handleShareDoc,
    handleRenameDoc,
    handleDeleteDocument,
    handlePickPdf,
    // Transactions / contract price
    handleAddTransaction,
    handleEditTransaction,
    handleDeleteTransaction,
    handleSavePrice,
    // Status update cascade
    handleUpdateStopStatus,
    // Stage CRUD
    handleCreateStageInEdit,
    handleSaveStages,
    handleSetStopDueDate,
    handleRenameStopMinistry,
    handleSetStopCity,
    handleSetStopAssignee,
    handleCreateExtAssigneeForStop,
    handleCreateCity,
    handleCreateCityInEditModal,
    // Comments + voice notes
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
  };
}
