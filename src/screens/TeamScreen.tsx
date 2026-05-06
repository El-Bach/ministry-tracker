// src/screens/TeamScreen.tsx
// Team view: all members, their role, task count, and task list per member

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import supabase from '../lib/supabase';
import { theme } from '../theme';
import { useTranslation, t as tStatic } from '../lib/i18n';
import { useAuth } from '../hooks/useAuth';
import { useRealtime } from '../hooks/useRealtime';
import { TeamMember, Task, StatusLabel, DashboardStackParamList } from '../types';
import StatusBadge from '../components/StatusBadge';
import { formatPhoneDisplay } from '../lib/phone';

function openPhone(phone: string, name?: string) {
  const clean = phone.replace(/[^0-9+]/g, '');
  Alert.alert(name ?? phone, phone, [
    { text: tStatic('callBtn'), onPress: () => Linking.openURL(`tel:${clean}`) },
    { text: tStatic('whatsappBtn'), onPress: () => Linking.openURL(`https://wa.me/${clean.replace(/^\+/, '')}`) },
    { text: tStatic('cancel'), style: 'cancel' },
  ]);
}

type Nav = NativeStackNavigationProp<DashboardStackParamList>;

interface MemberWithTasks extends TeamMember {
  tasks: Task[];
}

export default function TeamScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const { teamMember: currentMember } = useAuth();

  const [members, setMembers] = useState<MemberWithTasks[]>([]);
  const [statusLabels, setStatusLabels] = useState<StatusLabel[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Custom field definitions + values
  interface FieldDef {
    id: string; label: string; field_key: string; field_type: string;
    options?: string; is_active: boolean; sort_order: number;
  }
  interface FieldVal {
    id?: string; team_member_id: string; field_id: string;
    value_text?: string; value_number?: number; value_boolean?: boolean; value_json?: unknown;
  }
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([]);
  const [fieldValuesByMember, setFieldValuesByMember] = useState<Record<string, FieldVal[]>>({});

  // Edit member state
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editFieldValues, setEditFieldValues] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    const [membersRes, tasksRes, labelsRes, defsRes] = await Promise.all([
      supabase.from('team_members').select('*').eq('org_id', currentMember?.org_id ?? '').order('name'),
      supabase
        .from('tasks')
        .select('*, client:clients(*), service:services(*)')
        .eq('org_id', currentMember?.org_id ?? '')
        .not('assigned_to', 'is', null),
      supabase.from('status_labels').select('*').eq('org_id', currentMember?.org_id ?? '').order('sort_order'),
      supabase.from('team_member_field_definitions').select('*').eq('is_active', true).order('sort_order'),
    ]);

    if (membersRes.data && tasksRes.data) {
      const allTasks = tasksRes.data as Task[];
      const combined: MemberWithTasks[] = (membersRes.data as TeamMember[]).map((m) => ({
        ...m,
        tasks: allTasks.filter((t) => t.assigned_to === m.id),
      }));
      setMembers(combined);

      // Load field values for all members
      const memberIds = (membersRes.data as TeamMember[]).map(m => m.id);
      if (memberIds.length > 0) {
        const { data: valData } = await supabase
          .from('team_member_field_values')
          .select('*')
          .in('team_member_id', memberIds);
        if (valData) {
          const byMember: Record<string, FieldVal[]> = {};
          (valData as FieldVal[]).forEach(v => {
            if (!byMember[v.team_member_id]) byMember[v.team_member_id] = [];
            byMember[v.team_member_id].push(v);
          });
          setFieldValuesByMember(byMember);
        }
      }
    }
    if (labelsRes.data) setStatusLabels(labelsRes.data as StatusLabel[]);
    if (defsRes.data) setFieldDefs(defsRes.data as FieldDef[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  useRealtime(useCallback(() => fetchData(), [fetchData]), currentMember?.org_id ?? null);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const openEditMember = (member: TeamMember) => {
    setEditingMember(member);
    setEditName(member.name);
    setEditRole(member.role);
    setEditPhone(member.phone ?? '');
    // Load existing custom field values into edit state
    const vals = fieldValuesByMember[member.id] ?? [];
    const valMap: Record<string, string> = {};
    vals.forEach(v => {
      const def = fieldDefs.find(d => d.id === v.field_id);
      if (!def) return;
      if (def.field_type === 'boolean') valMap[v.field_id] = v.value_boolean ? 'true' : 'false';
      else if (def.field_type === 'number' || def.field_type === 'currency') valMap[v.field_id] = v.value_number != null ? String(v.value_number) : '';
      else valMap[v.field_id] = v.value_text ?? '';
    });
    setEditFieldValues(valMap);
  };

  const handleSaveEditMember = async () => {
    if (!editingMember || !editName.trim()) {
      Alert.alert(t('required'), t('fieldRequired'));
      return;
    }
    setSavingEdit(true);
    // Save core fields
    await supabase
      .from('team_members')
      .update({ name: editName.trim(), role: editRole.trim(), phone: editPhone.trim() || null })
      .eq('id', editingMember.id);

    // Upsert custom field values
    const upserts = Object.entries(editFieldValues)
      .filter(([, val]) => val.trim() !== '')
      .map(([fieldId, val]) => {
        const def = fieldDefs.find(d => d.id === fieldId);
        const base = { team_member_id: editingMember.id, field_id: fieldId };
        if (def?.field_type === 'boolean') return { ...base, value_boolean: val === 'true' };
        if (def?.field_type === 'number' || def?.field_type === 'currency') return { ...base, value_number: parseFloat(val) || 0 };
        return { ...base, value_text: val };
      });
    if (upserts.length > 0) {
      await supabase.from('team_member_field_values').upsert(upserts, { onConflict: 'team_member_id,field_id' });
    }
    // Delete cleared values
    const cleared = Object.entries(editFieldValues)
      .filter(([, val]) => val.trim() === '')
      .map(([fieldId]) => fieldId);
    for (const fieldId of cleared) {
      await supabase.from('team_member_field_values')
        .delete()
        .eq('team_member_id', editingMember.id)
        .eq('field_id', fieldId);
    }

    setSavingEdit(false);
    setEditingMember(null);
    fetchData();
  };

  const getStatusColor = (label: string) =>
    statusLabels.find((s) => s.label === label)?.color ?? '#6366f1';

  const renderFieldDisplayValue = (def: { id: string; field_type: string }, vals: FieldVal[]): string => {
    const v = vals.find(fv => fv.field_id === def.id);
    if (!v) return '—';
    if (def.field_type === 'boolean') return v.value_boolean ? '✓ Yes' : '✗ No';
    if (def.field_type === 'number' || def.field_type === 'currency') return v.value_number != null ? String(v.value_number) : '—';
    return v.value_text || '—';
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const getWorkloadColor = (count: number) => {
    if (count === 0) return '#334155';
    if (count <= 3) return '#10b981';
    if (count <= 7) return '#f59e0b';
    return '#ef4444';
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={theme.color.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Text style={s.title}>{t('team')}</Text>
        <Text style={s.subtitle}>{members.length} {t('teamMembers').toLowerCase()}</Text>
      </View>

      <ScrollView
        contentContainerStyle={s.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.primary} />
        }
      >
        {members.map((member) => {
          const isExpanded = expandedId === member.id;
          const isCurrentUser = member.id === currentMember?.id;
          const activeTasks = member.tasks.filter(
            (t) => t.current_status !== 'Closed' && t.current_status !== 'Rejected'
          );
          const workloadColor = getWorkloadColor(activeTasks.length);

          return (
            <View key={member.id} style={[s.memberCard, isCurrentUser && s.memberCardSelf]}>
              {/* Member header row */}
              <TouchableOpacity
                style={s.memberHeader}
                onPress={() => setExpandedId(isExpanded ? null : member.id)}
                activeOpacity={0.75}
              >
                {/* Avatar */}
                <View style={[s.avatar, { backgroundColor: isCurrentUser ? '#6366f1' : '#334155' }]}>
                  <Text style={s.avatarText}>{getInitials(member.name)}</Text>
                </View>

                {/* Info */}
                <View style={s.memberInfo}>
                  <View style={s.memberNameRow}>
                    <Text style={s.memberName}>{member.name}</Text>
                    {isCurrentUser && <Text style={s.youBadge}>YOU</Text>}
                  </View>
                  <Text style={s.memberRole}>{member.role}</Text>
                  <Text style={s.memberEmail}>{member.email}</Text>
                  {member.phone ? (
                    <TouchableOpacity onPress={() => openPhone(member.phone!, member.name)} activeOpacity={0.7}>
                      <Text style={s.memberPhone}>📞 {formatPhoneDisplay(member.phone)}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Workload indicator */}
                <View style={s.workload}>
                  <View style={[s.workloadBadge, { backgroundColor: workloadColor + '22' }]}>
                    <Text style={[s.workloadCount, { color: workloadColor }]}>
                      {activeTasks.length}
                    </Text>
                  </View>
                  <Text style={s.workloadLabel}>active</Text>
                  <Text style={[s.chevron, isExpanded && s.chevronOpen]}>›</Text>
                </View>
              </TouchableOpacity>

              {/* Edit button */}
              <TouchableOpacity
                style={s.editMemberBtn}
                onPress={() => openEditMember(member)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={s.editMemberBtnText}>✎</Text>
              </TouchableOpacity>

              {/* Progress bar for workload */}
              <View style={s.progressTrack}>
                <View
                  style={[
                    s.progressFill,
                    {
                      width: `${Math.min((activeTasks.length / 10) * 100, 100)}%` as unknown as number,
                      backgroundColor: workloadColor,
                    },
                  ]}
                />
              </View>

              {/* Expanded task list */}
              {isExpanded && (
                <View style={s.taskList}>
                  {member.tasks.length === 0 ? (
                    <Text style={s.noTasks}>{t('noTasksAssigned')}</Text>
                  ) : (
                    member.tasks.map((task) => (
                      <TouchableOpacity
                        key={task.id}
                        style={s.taskRow}
                        onPress={() => navigation.navigate('TaskDetail', { taskId: task.id })}
                        activeOpacity={0.7}
                      >
                        <View style={s.taskRowLeft}>
                          <Text style={s.taskClient} numberOfLines={1}>
                            {task.client?.name ?? '—'}
                          </Text>
                          <Text style={s.taskService} numberOfLines={1}>
                            {task.service?.name ?? '—'}
                          </Text>
                          {task.due_date && (
                            <Text style={s.taskDue}>{t('dueLabel')} {task.due_date}</Text>
                          )}
                        </View>
                        <StatusBadge
                          label={task.current_status}
                          color={getStatusColor(task.current_status)}
                          small
                        />
                      </TouchableOpacity>
                    ))
                  )}

                  {/* Custom fields */}
                  {fieldDefs.length > 0 && (
                    <View style={s.customFieldsSection}>
                      <Text style={s.customFieldsSectionTitle}>{t('clientInfo').toUpperCase()}</Text>
                      <View style={s.customFieldsGrid}>
                        {fieldDefs.map(def => (
                          <View key={def.id} style={s.customFieldItem}>
                            <Text style={s.customFieldLabel}>{def.label}</Text>
                            <Text style={s.customFieldValue}>
                              {renderFieldDisplayValue(def, fieldValuesByMember[member.id] ?? [])}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* ── EDIT MEMBER MODAL ── */}
      <Modal
        visible={!!editingMember}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingMember(null)}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{t('editMemberTitle')}</Text>
              <TouchableOpacity onPress={() => setEditingMember(null)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={s.fieldLabel}>{t('name').toUpperCase()}</Text>
              <TextInput
                style={s.modalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder={t('fullName')}
                placeholderTextColor={theme.color.textMuted}
                autoCorrect={false}
                autoCapitalize="words"
              />
              <Text style={[s.fieldLabel, { marginTop: 12 }]}>{t('role').toUpperCase()}</Text>
              <TextInput
                style={s.modalInput}
                value={editRole}
                onChangeText={setEditRole}
                placeholder={t("title")}
                placeholderTextColor={theme.color.textMuted}
                autoCorrect={false}
                autoCapitalize="words"
              />
              <Text style={[s.fieldLabel, { marginTop: 12 }]}>{t('phone').toUpperCase()}</Text>
              <TextInput
                style={s.modalInput}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder={t("phoneNumber")}
                placeholderTextColor={theme.color.textMuted}
                keyboardType="phone-pad"
                autoCorrect={false}
              />

              {/* Custom fields */}
              {fieldDefs.map(def => (
                <View key={def.id}>
                  <Text style={[s.fieldLabel, { marginTop: 12 }]}>{def.label.toUpperCase()}</Text>
                  {def.field_type === 'boolean' ? (
                    <View style={s.boolRow}>
                      <TouchableOpacity
                        style={[s.boolBtn, editFieldValues[def.id] === 'true' && s.boolBtnActive]}
                        onPress={() => setEditFieldValues(v => ({ ...v, [def.id]: 'true' }))}
                      >
                        <Text style={[s.boolBtnText, editFieldValues[def.id] === 'true' && s.boolBtnTextActive]}>{t('yes')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.boolBtn, editFieldValues[def.id] === 'false' && s.boolBtnActive]}
                        onPress={() => setEditFieldValues(v => ({ ...v, [def.id]: 'false' }))}
                      >
                        <Text style={[s.boolBtnText, editFieldValues[def.id] === 'false' && s.boolBtnTextActive]}>{t('no')}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TextInput
                      style={s.modalInput}
                      value={editFieldValues[def.id] ?? ''}
                      onChangeText={val => setEditFieldValues(v => ({ ...v, [def.id]: val }))}
                      placeholder={def.label}
                      placeholderTextColor={theme.color.textMuted}
                      keyboardType={
                        def.field_type === 'number' || def.field_type === 'currency' ? 'decimal-pad'
                        : def.field_type === 'phone' ? 'phone-pad'
                        : def.field_type === 'email' ? 'email-address'
                        : 'default'
                      }
                      multiline={def.field_type === 'textarea'}
                      autoCorrect={false}
                    />
                  )}
                </View>
              ))}

              <TouchableOpacity
                style={[s.saveBtn, savingEdit && s.saveBtnDisabled]}
                onPress={handleSaveEditMember}
                disabled={savingEdit}
              >
                {savingEdit
                  ? <ActivityIndicator color={theme.color.white} size="small" />
                  : <Text style={s.saveBtnText}>{t('saveChanges')}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: theme.color.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.color.bgBase },
  header: {
    paddingHorizontal: theme.spacing.space4,
    paddingTop:        theme.spacing.space4,
    paddingBottom:     theme.spacing.space3,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgSurface,
    flexDirection:     'row',
    alignItems:        'baseline',
    gap:               10,
  },
  title:    { ...theme.typography.heading, fontSize: 24, fontWeight: '800' },
  subtitle: { ...theme.typography.body, color: theme.color.textMuted, fontWeight: '600' },
  list:     { padding: theme.spacing.space4, gap: 0, paddingBottom: 40 },
  memberCard: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    marginBottom:    theme.spacing.space3,
    borderWidth:     1,
    borderColor:     theme.color.border,
    overflow:        'hidden',
  },
  memberCardSelf: { borderColor: theme.color.primary + '55' },
  memberHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    padding:       14,
    gap:           theme.spacing.space3,
  },
  avatar: {
    width:          46,
    height:         46,
    borderRadius:   23,
    justifyContent: 'center',
    alignItems:     'center',
  },
  avatarText:    { color: theme.color.white, fontSize: 16, fontWeight: '800' },
  memberInfo:    { flex: 1, gap: 2 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.space2 },
  memberName:    { ...theme.typography.body, color: theme.color.textPrimary, fontSize: 15, fontWeight: '700' },
  youBadge: {
    backgroundColor: theme.color.primary + '22',
    color:           theme.color.primaryText,
    fontSize:        theme.typography.sectionDivider.fontSize,
    fontWeight:      '800',
    letterSpacing:   0.8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius:    theme.radius.sm - 2,
    borderWidth:     1,
    borderColor:     theme.color.primary + '55',
  },
  memberRole:  { ...theme.typography.label, color: theme.color.textSecondary, fontWeight: '600' },
  memberEmail: { ...theme.typography.caption, color: theme.color.border },
  memberPhone: { ...theme.typography.caption, color: theme.color.primary, marginTop: 2 },
  workload:    { alignItems: 'center', gap: 2 },
  workloadBadge: {
    width:          40,
    height:         40,
    borderRadius:   20,
    justifyContent: 'center',
    alignItems:     'center',
  },
  workloadCount: { fontSize: 16, fontWeight: '800' },
  workloadLabel: { ...theme.typography.sectionDivider, letterSpacing: 0.5 },
  chevron: {
    color:     theme.color.border,
    fontSize:  20,
    fontWeight: '700',
    marginTop: 2,
    transform: [{ rotate: '0deg' }],
  },
  chevronOpen: {
    transform: [{ rotate: '90deg' }],
    color:     theme.color.primary,
  },
  progressTrack: { height: 2, backgroundColor: theme.color.bgBase, overflow: 'hidden' },
  progressFill:  { height: 2, borderRadius: 1 },
  taskList: {
    borderTopWidth:  1,
    borderTopColor:  theme.color.bgBase,
    paddingHorizontal: 14,
    paddingVertical: theme.spacing.space2,
    gap:             0,
  },
  noTasks: { ...theme.typography.body, color: theme.color.border, textAlign: 'center', paddingVertical: theme.spacing.space3 },
  taskRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingVertical:   10,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgBase,
    gap:               10,
  },
  taskRowLeft: { flex: 1, gap: 2 },
  taskClient:  { ...theme.typography.body, color: theme.color.textSecondary, fontWeight: '700' },
  taskService: { ...theme.typography.label, color: theme.color.textSecondary },
  taskDue:     { ...theme.typography.caption, color: theme.color.textMuted },

  editMemberBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: theme.color.bgBase,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  editMemberBtnText: { color: theme.color.primary, fontSize: 14, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: theme.color.overlayDark, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: theme.color.bgSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.space4,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgBase,
  },
  modalTitle: { ...theme.typography.body, color: theme.color.textPrimary, fontSize: 16, fontWeight: '700' },
  modalClose: { color: theme.color.textMuted, fontSize: 18, padding: 4 },
  modalBody:  { padding: theme.spacing.space4, gap: 4 },
  fieldLabel: { ...theme.typography.sectionDivider, marginBottom: 4 },
  modalInput: {
    backgroundColor: theme.color.bgBase,
    color: theme.color.textPrimary,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: theme.spacing.space3,
    fontSize: 15,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  saveBtn: {
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: theme.spacing.space4,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: theme.color.white, fontSize: 15, fontWeight: '700' },

  // Custom fields — expanded display
  customFieldsSection: {
    marginTop: theme.spacing.space3,
    paddingTop: theme.spacing.space3,
    borderTopWidth: 1,
    borderTopColor: theme.color.bgBase,
  },
  customFieldsSectionTitle: {
    ...theme.typography.sectionDivider,
    marginBottom: theme.spacing.space2,
  },
  customFieldsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  customFieldItem: {
    minWidth: '45%',
    flex: 1,
    backgroundColor: theme.color.bgBase,
    borderRadius: theme.radius.md,
    padding: theme.spacing.space2 + 2,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  customFieldLabel: { ...theme.typography.caption, color: theme.color.textMuted, marginBottom: 2 },
  customFieldValue: { ...theme.typography.body, color: theme.color.textPrimary, fontSize: 13, fontWeight: '600' },

  // Boolean toggle in edit modal
  boolRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  boolBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.bgBase,
  },
  boolBtnActive: { backgroundColor: theme.color.primary, borderColor: theme.color.primary },
  boolBtnText: { ...theme.typography.body, color: theme.color.textMuted, fontWeight: '600' },
  boolBtnTextActive: { color: theme.color.white },
});
