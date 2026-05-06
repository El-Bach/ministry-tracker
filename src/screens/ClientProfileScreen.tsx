// src/screens/ClientProfileScreen.tsx
// Client profile: info, custom fields, and full task history

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  PanResponder,
  Linking,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import supabase from '../lib/supabase';
import { formatPhoneDisplay } from '../lib/phone';
import { theme } from '../theme';
import { useTranslation } from '../lib/i18n';
import { Client, Task, StatusLabel, DashboardStackParamList } from '../types';
import { useAuth } from '../hooks/useAuth';
import StatusBadge from '../components/StatusBadge';

type ProfileRoute = RouteProp<DashboardStackParamList, 'ClientProfile'>;
type Nav = NativeStackNavigationProp<DashboardStackParamList>;

interface FieldValue {
  id: string;
  field_id: string;
  value_text?: string;
  value_number?: number;
  value_boolean?: boolean;
  value_json?: unknown;
  definition?: {
    label: string;
    field_type: string;
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function renderFieldValue(fv: FieldValue): string {
  const type = fv.definition?.field_type ?? 'text';
  if (type === 'boolean') return fv.value_boolean ? 'Yes' : 'No';
  if (type === 'number' || type === 'currency') {
    return fv.value_number != null ? String(fv.value_number) : '—';
  }
  if (type === 'multiselect' || type === 'select') {
    if (Array.isArray(fv.value_json)) return (fv.value_json as string[]).join(', ');
    if (fv.value_json) return String(fv.value_json);
  }
  return fv.value_text ?? '—';
}

const ACTION_WIDTH = 130;

function SwipeableRow({
  children,
  onEdit,
  onDelete,
  isLast,
}: {
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  isLast: boolean;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const close = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
    isOpen.current = false;
  };

  const open = () => {
    Animated.spring(translateX, { toValue: -ACTION_WIDTH, useNativeDriver: true, tension: 80, friction: 10 }).start();
    isOpen.current = true;
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        const base = isOpen.current ? -ACTION_WIDTH : 0;
        const next = Math.min(0, Math.max(-ACTION_WIDTH, base + g.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const base = isOpen.current ? -ACTION_WIDTH : 0;
        const moved = base + g.dx;
        if (moved < -ACTION_WIDTH / 2) {
          open();
        } else {
          close();
        }
      },
      onPanResponderTerminate: () => close(),
    })
  ).current;

  return (
    <View style={[sw.row, !isLast && sw.rowBorder]}>
      {/* Action buttons revealed behind */}
      <View style={sw.actions}>
        <TouchableOpacity style={sw.editAction} onPress={() => { close(); onEdit(); }}>
          <Text style={sw.editActionText}>✎{'\n'}Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={sw.deleteAction} onPress={() => { close(); onDelete(); }}>
          <Text style={sw.deleteActionText}>✕{'\n'}Delete</Text>
        </TouchableOpacity>
      </View>
      {/* Swipeable content */}
      <Animated.View
        style={[sw.content, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

export default function ClientProfileScreen() {
  const route = useRoute<ProfileRoute>();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { clientId } = route.params;
  const { permissions, teamMember } = useAuth();

  const [client, setClient] = useState<Client | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statusLabels, setStatusLabels] = useState<StatusLabel[]>([]);
  const [fieldValues, setFieldValues] = useState<FieldValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingStatement, setGeneratingStatement] = useState(false);

  const fetchData = useCallback(async () => {
    const [clientRes, tasksRes, labelsRes, fieldsRes, blocksRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).single(),
      supabase
        .from('tasks')
        .select('*, service:services(*), assignee:team_members!assigned_to(*), route_stops:task_route_stops(*)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }),
      supabase.from('status_labels').select('*').eq('org_id', teamMember?.org_id ?? '').order('sort_order'),
      supabase
        .from('client_field_values')
        .select('*, definition:client_field_definitions(label, field_type)')
        .eq('client_id', clientId),
      // Fetch files hidden from this member by an admin
      teamMember?.id
        ? supabase.from('file_visibility_blocks').select('task_id').eq('team_member_id', teamMember.id)
        : Promise.resolve({ data: [] }),
    ]);

    if (clientRes.data) setClient(clientRes.data as Client);
    if (tasksRes.data) {
      let allTasks = tasksRes.data as Task[];
      // Permission: if viewer can only see assigned files, filter accordingly
      if (!permissions.can_see_all_files && teamMember?.id) {
        allTasks = allTasks.filter((t) =>
          t.assigned_to === teamMember.id ||
          (t.route_stops ?? []).some((s: any) => s.assigned_to === teamMember.id)
        );
      }
      // File visibility blocks: remove files an owner/admin has hidden from this member
      if (blocksRes.data && (blocksRes.data as any[]).length > 0) {
        const blockedIds = new Set((blocksRes.data as any[]).map((b: any) => b.task_id));
        allTasks = allTasks.filter((t) => !blockedIds.has(t.id));
      }
      setTasks(allTasks);
    }
    if (labelsRes.data) setStatusLabels(labelsRes.data as StatusLabel[]);
    if (fieldsRes.data) setFieldValues(fieldsRes.data as FieldValue[]);
    setLoading(false);
  }, [clientId, permissions.can_see_all_files, teamMember?.id, teamMember?.org_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const getStatusColor = (label: string) =>
    statusLabels.find((s) => s.label === label)?.color ?? '#6366f1';

  const handlePhonePress = (phone: string, name?: string) => {
    const clean = phone.replace(/[^0-9+]/g, '');
    Alert.alert(name ?? phone, phone, [
      { text: t('callBtn'), onPress: () => Linking.openURL(`tel:${clean}`) },
      { text: t('whatsappBtn'), onPress: () => Linking.openURL(`https://wa.me/${clean.replace(/^\+/, '')}`) },
      { text: t('cancel'), style: 'cancel' },
    ]);
  };

  if (loading || !client) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={theme.color.primary} size="large" />
      </View>
    );
  }

  const goNewFile = () =>
    navigation.navigate('NewTask', { preselectedClientId: clientId });

  const handleDeleteTask = (task: Task) => {
    Alert.alert(t('deleteFile'), `${t('confirmDelete')} — "${task.service?.name ?? t('file')}"`, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive',
        onPress: async () => {
          await supabase.from('tasks').delete().eq('id', task.id);
          setTasks((prev) => prev.filter((t) => t.id !== task.id));
        },
      },
    ]);
  };

  const handleGenerateStatement = async () => {
    if (!client) return;
    setGeneratingStatement(true);
    try {
      const taskIds = tasks.map((t) => t.id);
      const { data: txData } = taskIds.length > 0
        ? await supabase.from('file_transactions').select('*').in('task_id', taskIds)
        : { data: [] };
      const txList = (txData ?? []) as Array<{ task_id: string; type: string; amount_usd: number; amount_lbp: number }>;

      const fmtUSD = (n: number) => n > 0 ? `$${Math.round(n).toLocaleString('en-US')}` : '—';
      const fmtLBP = (n: number) => n > 0 ? `LBP ${Math.round(n).toLocaleString('en-US')}` : '—';

      let totalContractUSD = 0, totalReceivedUSD = 0, totalContractLBP = 0, totalReceivedLBP = 0;

      const rows = tasks.map((task) => {
        const taskTx = txList.filter((tx) => tx.task_id === task.id);
        const recUSD = taskTx.filter((tx) => tx.type === 'revenue').reduce((s, tx) => s + tx.amount_usd, 0);
        const recLBP = taskTx.filter((tx) => tx.type === 'revenue').reduce((s, tx) => s + tx.amount_lbp, 0);
        const conUSD = task.price_usd ?? 0;
        const conLBP = task.price_lbp ?? 0;
        const balUSD = recUSD - conUSD;
        const balLBP = recLBP - conLBP;
        totalContractUSD += conUSD; totalReceivedUSD += recUSD;
        totalContractLBP += conLBP; totalReceivedLBP += recLBP;
        const balClass = balUSD >= 0 ? 'pos' : 'neg';
        return `<tr>
          <td>${task.service?.name ?? '—'}</td>
          <td><span class="badge">${task.current_status}</span></td>
          <td>${task.due_date ?? '—'}</td>
          <td>${fmtUSD(conUSD)}<br/><small>${fmtLBP(conLBP)}</small></td>
          <td>${fmtUSD(recUSD)}<br/><small>${fmtLBP(recLBP)}</small></td>
          <td class="${balClass}">${fmtUSD(Math.abs(balUSD))}<br/><small>${fmtLBP(Math.abs(balLBP))}</small></td>
        </tr>`;
      }).join('');

      const totalBalUSD = totalReceivedUSD - totalContractUSD;
      const totalBalLBP = totalReceivedLBP - totalContractLBP;
      const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;padding:24px;color:#1e293b;background:#fff}
  h1{font-size:22px;color:#1e293b;margin-bottom:4px}
  .meta{color:#64748b;font-size:13px;margin-bottom:20px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:#0f172a;color:#fff;padding:9px 7px;text-align:left}
  td{padding:8px 7px;border-bottom:1px solid #e2e8f0;vertical-align:top}
  tr:nth-child(even) td{background:#f8fafc}
  .badge{background:#e0e7ff;color:#4338ca;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:bold}
  .total td{background:#0f172a;color:#fff;font-weight:bold;padding:9px 7px}
  .pos{color:#10b981}.neg{color:#ef4444}
  small{color:#94a3b8;font-size:10px}
  .footer{margin-top:16px;color:#94a3b8;font-size:10px}
</style></head><body>
<h1>${client.name}</h1>
<div class="meta">ID: ${client.client_id}${client.phone ? ' · ' + formatPhoneDisplay(client.phone) : ''}${client.reference_name ? ' · via ' + client.reference_name : ''}</div>
<table><thead><tr><th>Service</th><th>Status</th><th>Due</th><th>Contract</th><th>Received</th><th>Balance</th></tr></thead>
<tbody>${rows}
<tr class="total"><td colspan="3">TOTAL (${tasks.length} file${tasks.length !== 1 ? 's' : ''})</td>
<td>${fmtUSD(totalContractUSD)}</td><td>${fmtUSD(totalReceivedUSD)}</td>
<td class="${totalBalUSD >= 0 ? 'pos' : 'neg'}">${fmtUSD(Math.abs(totalBalUSD))}</td></tr>
</tbody></table>
<div class="footer">Generated ${today} · Ministry Tracker</div>
</body></html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Statement — ${client.name}` });
    } catch {
      Alert.alert(t('error'), t('somethingWrong'));
    } finally {
      setGeneratingStatement(false);
    }
  };

  const goEdit = () =>
    navigation.navigate('EditClient', { clientId });

  const handleDelete = () => {
    Alert.alert(
      `${t('delete')} ${t('client')}`,
      `${t('delete')} "${client.name}"?`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'), style: 'destructive',
          onPress: async () => {
            await supabase.from('clients').delete().eq('id', clientId);
            navigation.goBack();
          },
        },
      ]
    );
  };

  // A file is Complete only when its last stage (highest stop_order) is Done.
  // A file is Rejected when its last stage is Rejected.
  // Everything else is Active.
  const getFileOutcome = (task: Task): 'completed' | 'rejected' | 'active' => {
    const stops = task.route_stops ?? [];
    if (stops.length === 0) return 'active';
    const lastStop = [...stops].sort((a, b) => b.stop_order - a.stop_order)[0];
    if (lastStop.status === 'Done')     return 'completed';
    if (lastStop.status === 'Rejected') return 'rejected';
    return 'active';
  };

  const completedCount = tasks.filter((t) => getFileOutcome(t) === 'completed').length;
  const rejectedCount  = tasks.filter((t) => getFileOutcome(t) === 'rejected').length;
  const activeCount    = tasks.filter((t) => getFileOutcome(t) === 'active').length;

  const visibleFields = fieldValues.filter(
    (fv) => fv.definition && (fv.value_text || fv.value_number != null || fv.value_boolean != null || fv.value_json)
  );

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.container}>

        {/* ── CLIENT INFO ── */}
        <View style={s.card}>
          <View style={s.clientHeader}>
            <View style={s.clientAvatar}>
              <Text style={s.clientAvatarText}>{client.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={s.clientName}>{client.name}</Text>
              {!!client.reference_name && (
                <Text style={s.clientReference}>
                  via {client.reference_name}
                  {client.reference_phone ? (
                    <Text
                      style={s.clientPhoneLink}
                      onPress={() => handlePhonePress(client.reference_phone!, client.reference_name ?? undefined)}
                    >{` · ${formatPhoneDisplay(client.reference_phone)}`}</Text>
                  ) : null}
                </Text>
              )}
              <Text style={s.clientId}>{client.client_id}</Text>
              {client.phone ? (
                <TouchableOpacity onPress={() => handlePhonePress(client.phone!, client.name)}>
                  <Text style={s.clientPhone}>{formatPhoneDisplay(client.phone)}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={s.headerActions}>
              {permissions.can_edit_delete_clients && (
                <TouchableOpacity style={s.editBtn} onPress={goEdit} activeOpacity={0.7}>
                  <Text style={s.editBtnText}>✎ Edit</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={s.statementBtn}
                onPress={handleGenerateStatement}
                disabled={generatingStatement}
                activeOpacity={0.7}
              >
                {generatingStatement
                  ? <ActivityIndicator color={theme.color.success} size="small" style={{ width: 20 }} />
                  : <Text style={s.statementBtnText}>📄</Text>}
              </TouchableOpacity>
              {permissions.can_edit_delete_clients && (
                <TouchableOpacity style={s.deleteBtn} onPress={handleDelete} activeOpacity={0.7}>
                  <Text style={s.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Custom field values */}
          {visibleFields.length > 0 && (
            <View style={s.fieldsBlock}>
              <Text style={s.sectionLabel}>{t('clientDetailsLabel')}</Text>
              <View style={s.fieldsGrid}>
                {visibleFields.map((fv) => (
                  <View key={fv.id} style={s.fieldCell}>
                    <Text style={s.fieldLabel}>{fv.definition?.label.toUpperCase()}</Text>
                    <Text style={s.fieldValue}>{renderFieldValue(fv)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* ── NEW FILE ── */}
        {permissions.can_create_files && (
          <TouchableOpacity style={s.newFileBtn} onPress={goNewFile} activeOpacity={0.8}>
            <Text style={s.newFileBtnText}>+ {t('newFile')} — {client.name}</Text>
          </TouchableOpacity>
        )}

        {/* ── STATS ── */}
        <View style={s.statsBlock}>
          {/* Total — full width on top */}
          <View style={[s.statBox, s.statBoxTotal]}>
            <Text style={[s.statNumber, s.statNumberTotal]}>{tasks.length}</Text>
            <Text style={[s.statLabel, s.statLabelTotal]}>{t('totalFilesLabel')}</Text>
          </View>
          {/* Active / Completed / Rejected — equal thirds below */}
          <View style={s.statsRow}>
            <View style={s.statBox}>
              <Text style={[s.statNumber, { color: theme.color.primary }]}>{activeCount}</Text>
              <Text style={s.statLabel}>{t('active')}</Text>
            </View>
            <View style={s.statBox}>
              <Text style={[s.statNumber, { color: theme.color.success }]}>{completedCount}</Text>
              <Text style={s.statLabel}>{t('completedStat')}</Text>
            </View>
            <View style={[s.statBox, { borderColor: rejectedCount > 0 ? theme.color.danger + '55' : theme.color.border }]}>
              <Text style={[s.statNumber, { color: rejectedCount > 0 ? theme.color.danger : theme.color.textMuted }]}>
                {rejectedCount}
              </Text>
              <Text style={[s.statLabel, { color: rejectedCount > 0 ? theme.color.danger : theme.color.textMuted }]}>
                {t('statusRejected')}
              </Text>
            </View>
          </View>
        </View>

        {/* ── TASK HISTORY ── */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>{t('fileHistoryLabel')}</Text>
          {tasks.length === 0 ? (
            <Text style={s.emptyText}>{t('noFilesForClient')}</Text>
          ) : (
            tasks.map((task, idx) => {
              const totalStops = task.route_stops?.length ?? 0;
              const doneStops = task.route_stops?.filter((r) => r.status === 'Done').length ?? 0;
              const outcome = getFileOutcome(task);
              // Status shown on the card: use last-stage outcome, else most urgent active stage
              const URGENCY: Record<string, number> = { Rejected: 1, 'Pending Signature': 2, 'In Review': 3, Submitted: 4, Pending: 5, Done: 99, Closed: 100 };
              const derivedStatus = outcome === 'completed'
                ? 'Done'
                : outcome === 'rejected'
                  ? 'Rejected'
                  : (() => {
                      const nonTerminal = (task.route_stops ?? [])
                        .filter((s) => s.status !== 'Done' && s.status !== 'Rejected')
                        .map((s) => s.status);
                      return nonTerminal.length > 0
                        ? nonTerminal.reduce((a, b) => (URGENCY[a] ?? 50) <= (URGENCY[b] ?? 50) ? a : b)
                        : task.current_status;
                    })();
              const statusColor = getStatusColor(derivedStatus);
              return (
                <SwipeableRow
                  key={task.id}
                  isLast={idx === tasks.length - 1}
                  onEdit={() => navigation.navigate('TaskDetail', { taskId: task.id })}
                  onDelete={() => handleDeleteTask(task)}
                >
                  <TouchableOpacity
                    style={s.taskRow}
                    onPress={() => navigation.navigate('TaskDetail', { taskId: task.id })}
                    activeOpacity={0.7}
                  >
                    <View style={s.taskRowTop}>
                      <Text style={s.taskService} numberOfLines={1}>{task.service?.name ?? '—'}</Text>
                      <StatusBadge label={derivedStatus} color={statusColor} />
                    </View>
                    <View style={s.taskRowMeta}>
                      <Text style={s.taskMetaText}>{t('openedLabel')} {formatDate(task.created_at)}</Text>
                      {task.due_date ? <Text style={s.taskMetaText}>{t('dueLabel')} {task.due_date}</Text> : null}
                      {task.assignee ? <Text style={s.taskMetaText}>→ {task.assignee.name}</Text> : null}
                    </View>
                    {totalStops > 0 && (
                      <View style={s.progressRow}>
                        <View style={s.progressBar}>
                          <View style={[s.progressFill, { width: `${(doneStops / totalStops) * 100}%` as any, backgroundColor: derivedStatus === 'Done' ? theme.color.success : statusColor }]} />
                        </View>
                        <Text style={s.progressText}>{doneStops}/{totalStops} {t('stagesProgress')}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </SwipeableRow>
              );
            })
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: theme.color.bgBase },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.color.bgBase },
  container: { padding: theme.spacing.space4, gap: theme.spacing.space3, paddingBottom: 40 },

  card: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    padding:         theme.spacing.space4,
    gap:             14,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },

  // Client header
  clientHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.space2, marginTop: 2 },
  editBtn: {
    backgroundColor: theme.color.primary + '22',
    borderRadius:    theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth:     1,
    borderColor:     theme.color.primary + '55',
  },
  editBtnText: { ...theme.typography.label, color: theme.color.primaryText, fontWeight: '700' },
  statementBtn: {
    backgroundColor: theme.color.success + '22',
    borderRadius:    theme.radius.sm,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth:     1,
    borderColor:     theme.color.success + '55',
    minWidth:        34,
    alignItems:      'center',
    justifyContent:  'center',
  },
  statementBtnText: { fontSize: 16 },
  deleteBtn: {
    backgroundColor: theme.color.danger + '20',
    borderRadius:    theme.radius.sm,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth:     1,
    borderColor:     theme.color.danger + '40',
  },
  deleteBtnText: { ...theme.typography.body, color: theme.color.danger, fontWeight: '700' },
  clientAvatar: {
    width:           52,
    height:          52,
    borderRadius:    26,
    backgroundColor: theme.color.primary + '22',
    borderWidth:     1,
    borderColor:     theme.color.primary + '55',
    justifyContent:  'center',
    alignItems:      'center',
  },
  clientAvatarText: { color: theme.color.primaryText, fontSize: 22, fontWeight: '800' },
  clientName:       { ...theme.typography.heading, fontSize: 20, fontWeight: '800' },
  clientReference:  { ...theme.typography.body, color: theme.color.textSecondary, fontStyle: 'italic' },
  clientId:         { ...theme.typography.label, color: theme.color.textMuted, fontWeight: '600' },
  clientPhone:      { ...theme.typography.body, color: theme.color.primary },
  clientPhoneLink:  { ...theme.typography.body, color: theme.color.primary },

  // Custom fields
  fieldsBlock:  { gap: theme.spacing.space2, borderTopWidth: 1, borderTopColor: theme.color.border, paddingTop: 14 },
  sectionLabel: { ...theme.typography.sectionDivider },
  fieldsGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.space3 },
  fieldCell:    { width: '45%', gap: 3 },
  fieldLabel:   { ...theme.typography.sectionDivider, color: theme.color.border },
  fieldValue:   { ...theme.typography.body, color: theme.color.textSecondary, fontWeight: '600' },

  // New file button
  newFileBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.lg,
    paddingVertical: 14,
    alignItems:      'center',
  },
  newFileBtnText: { color: theme.color.white, fontSize: 15, fontWeight: '700' },

  // Stats
  statsBlock: { gap: 8 },
  statsRow:   { flexDirection: 'row', gap: 8 },
  statBox: {
    flex:            1,
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    padding:         14,
    alignItems:      'center',
    gap:             theme.spacing.space1,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  statBoxTotal: {
    flex:            0,
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   12,
    backgroundColor: theme.color.primary + '14',
    borderColor:     theme.color.primary + '33',
  },
  statNumber:      { color: theme.color.textPrimary, fontSize: 24, fontWeight: '800' },
  statNumberTotal: { fontSize: 32, color: theme.color.primary },
  statLabel:       { ...theme.typography.sectionDivider },
  statLabelTotal:  { ...theme.typography.sectionDivider, color: theme.color.primary, letterSpacing: 1 },

  // Task list
  emptyText:   { ...theme.typography.body, color: theme.color.textMuted, textAlign: 'center', paddingVertical: theme.spacing.space3 },
  taskRow:     { paddingVertical: 14, gap: theme.spacing.space2, backgroundColor: theme.color.bgSurface },
  taskRowTop:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  taskService: { ...theme.typography.body, color: theme.color.textPrimary, fontSize: 15, fontWeight: '700', flex: 1 },
  taskRowMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.space2 },
  taskMetaText: { ...theme.typography.label, color: theme.color.textMuted },

  // Progress bar
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.space2 },
  progressBar: {
    flex:            1,
    height:          4,
    backgroundColor: theme.color.border,
    borderRadius:    2,
    overflow:        'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },
  progressText: { ...theme.typography.caption, color: theme.color.textMuted, minWidth: 54 },
});

const sw = StyleSheet.create({
  row: {
    overflow:        'hidden',
    backgroundColor: theme.color.bgSurface,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: theme.color.border },
  actions: {
    position:      'absolute',
    right:         0,
    top:           0,
    bottom:        0,
    width:         ACTION_WIDTH,
    flexDirection: 'row',
  },
  editAction: {
    flex:            1,
    backgroundColor: theme.color.primary,
    justifyContent:  'center',
    alignItems:      'center',
  },
  editActionText:   { color: theme.color.white, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  deleteAction: {
    flex:            1,
    backgroundColor: theme.color.danger,
    justifyContent:  'center',
    alignItems:      'center',
  },
  deleteActionText: { color: theme.color.white, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  content: {
    backgroundColor: theme.color.bgSurface,
  },
});
