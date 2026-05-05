// src/screens/TaskDetail/components/TaskHeader.tsx
//
// Header card for the file-detail screen — extracted from the monolithic
// TaskDetailScreen as Phase 1 of the modular split (see ../README.md).
//
// All state and side-effects stay in the parent for now. This component is
// purely presentational + receives callbacks via props. After all sections
// are extracted we'll migrate the data layer to TanStack Query.
//
// To use from TaskDetailScreen, replace the inline header card JSX with:
//
//   <TaskHeader
//     task={task}
//     derivedStatus={derivedStatus}
//     derivedStatusColor={derivedStatusColor}
//     allMembers={allMembers}
//     showAssigneePicker={showAssigneePicker}
//     setShowAssigneePicker={setShowAssigneePicker}
//     assigneeSearch={assigneeSearch}
//     setAssigneeSearch={setAssigneeSearch}
//     savingAssignee={savingAssignee}
//     onSetAssignee={handleSetFileAssignee}
//     onClientPress={() => navigation.navigate('ClientProfile', { clientId: task.client_id })}
//     onPhonePress={(phone, name) => handlePhonePress(phone, name)}
//     onOpenDocSheet={() => { setShowDocSheet(true); loadServiceDocsForSheet(task.service!.id); }}
//     onToggleDueDateCalendar={() => setShowDueDateCalendar(v => !v)}
//     onEdit={openEditTask}
//     onShareWhatsApp={handleShareWhatsApp}
//     onDuplicate={handleDuplicateTask}
//     duplicating={duplicating}
//     canEdit={permissions.can_edit_file_details}
//     formatDate={formatDate}
//     formatDateOnly={formatDateOnly}
//   />

import React from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { theme } from '../../../theme';
import { useTranslation } from '../../../lib/i18n';
import { Task, TeamMember } from '../../../types';
import { formatPhoneDisplay } from '../../../lib/phone';
import StatusBadge from '../../../components/StatusBadge';

interface Props {
  task: Task;
  derivedStatus: string;
  derivedStatusColor: string;
  /** Reason text shown below the status badge when the file was archived
      via Rejected on its final stage. null otherwise. */
  archivedRejectionReason: string | null;
  allMembers: TeamMember[];
  showAssigneePicker: boolean;
  setShowAssigneePicker: (v: boolean | ((prev: boolean) => boolean)) => void;
  assigneeSearch: string;
  setAssigneeSearch: (v: string) => void;
  savingAssignee: boolean;
  duplicating: boolean;
  canEdit: boolean;
  onSetAssignee: (memberId: string | null) => void;
  onClientPress: () => void;
  onPhonePress: (phone: string, name?: string) => void;
  onOpenDocSheet: () => void;
  onToggleDueDateCalendar: () => void;
  onEdit: () => void;
  onShareWhatsApp: () => void;
  onDuplicate: () => void;
  formatDate: (iso: string) => string;
  formatDateOnly: (iso: string) => string;
}

export function TaskHeader({
  task,
  derivedStatus,
  derivedStatusColor,
  archivedRejectionReason,
  allMembers,
  showAssigneePicker,
  setShowAssigneePicker,
  assigneeSearch,
  setAssigneeSearch,
  savingAssignee,
  duplicating,
  canEdit,
  onSetAssignee,
  onClientPress,
  onPhonePress,
  onOpenDocSheet,
  onToggleDueDateCalendar,
  onEdit,
  onShareWhatsApp,
  onDuplicate,
  formatDate,
  formatDateOnly,
}: Props) {
  const { t } = useTranslation();

  return (
    <View style={s.headerCard}>
      <View style={s.headerTop}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity onPress={onClientPress} activeOpacity={0.7}>
            <Text style={s.clientName}>{task.client?.name}</Text>
            <Text style={s.clientProfileHint}>{t('viewProfile')}</Text>
          </TouchableOpacity>
          {task.client?.phone && (
            <TouchableOpacity onPress={() => onPhonePress(task.client!.phone!, task.client?.name)}>
              <Text style={[s.clientSub, { color: theme.color.primary }]}>{formatPhoneDisplay(task.client.phone)}</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <StatusBadge label={derivedStatus} color={derivedStatusColor} />
          {archivedRejectionReason && (
            <View style={s.headerRejectionBox}>
              <Text style={s.headerRejectionText}>⚠ {archivedRejectionReason}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Assignee row */}
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
              <TouchableOpacity style={s.assigneePickerItem} onPress={() => onSetAssignee(null)}>
                <Text style={[s.assigneePickerItemText, { color: theme.color.danger }]}>{t('removeAssignment')}</Text>
              </TouchableOpacity>
            )}
            {allMembers
              .filter(m => !assigneeSearch.trim() || m.name.toLowerCase().includes(assigneeSearch.toLowerCase()))
              .slice(0, 15)
              .map(m => (
                <TouchableOpacity
                  key={m.id}
                  style={[s.assigneePickerItem, task.assigned_to === m.id && s.assigneePickerItemActive]}
                  onPress={() => onSetAssignee(m.id)}
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

      {/* Service + Documents row */}
      <View style={s.metaGrid}>
        <View style={s.metaCell}>
          <Text style={s.metaLabel}>{t('service').toUpperCase()}</Text>
          <Text style={s.metaValue} numberOfLines={2}>{task.service?.name}</Text>
        </View>
        <View style={s.metaCell}>
          <Text style={s.metaLabel}>{t('documents').toUpperCase()}</Text>
          {task.service?.id ? (
            <TouchableOpacity onPress={onOpenDocSheet} activeOpacity={0.75} style={s.docChip}>
              <Text style={s.docChipText}>📋 {t('requiredDocs')}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[s.metaValue, { color: theme.color.textMuted }]}>—</Text>
          )}
        </View>
      </View>

      {/* Opened + Due/Closed date row. Archived files show the archive date
          (closed_at) in place of the editable due date. */}
      <View style={s.metaGrid}>
        <View style={s.metaCell}>
          <Text style={s.metaLabel}>{t('opened').toUpperCase()}</Text>
          <Text style={s.metaValue}>{formatDate(task.created_at)}</Text>
        </View>
        {task.is_archived ? (
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>{t('archived').toUpperCase()}</Text>
            <Text style={s.metaValue}>
              {formatDate(task.closed_at ?? task.updated_at ?? task.created_at)}
            </Text>
          </View>
        ) : (
          <TouchableOpacity style={s.metaCell} onPress={onToggleDueDateCalendar} activeOpacity={0.7}>
            <Text style={s.metaLabel}>{t('dueDate').toUpperCase()} ✎</Text>
            <Text style={[s.metaValue, !task.due_date && { color: theme.color.textMuted }]}>
              {task.due_date ? formatDateOnly(task.due_date) : t('tapToSet')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {task.notes ? (
        <View style={s.notesBlock}>
          <Text style={s.metaLabel}>{t('notes').toUpperCase()}</Text>
          <Text style={s.notesText}>{task.notes}</Text>
        </View>
      ) : null}

      <View style={s.headerActionsRow}>
        {canEdit && (
          <TouchableOpacity style={s.editTaskBtn} onPress={onEdit}>
            <Text style={s.editTaskBtnText}>✎ {t('edit')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={s.shareWhatsAppBtn} onPress={onShareWhatsApp}>
          <Text style={s.shareWhatsAppBtnText}>{t('whatsappShare')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.duplicateBtn, duplicating && { opacity: 0.6 }]} onPress={onDuplicate} disabled={duplicating}>
          {duplicating
            ? <ActivityIndicator size="small" color={theme.color.white} />
            : <Text style={s.duplicateBtnText}>{t('duplicateFile')}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  headerCard: {
    backgroundColor: theme.color.bgSurface,
    margin: theme.spacing.space4,
    padding: theme.spacing.space4,
    borderRadius: theme.radius.lg,
    gap: theme.spacing.space3,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerRejectionBox: { marginTop: 6, maxWidth: 220, backgroundColor: theme.color.danger + '18', borderLeftWidth: 3, borderLeftColor: theme.color.danger, paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.sm },
  headerRejectionText: { color: theme.color.danger, fontSize: 12, fontWeight: '500', lineHeight: 16, textAlign: 'right' },
  clientName: { ...theme.typography.heading, fontSize: 18, fontWeight: '700', color: theme.color.textPrimary },
  clientProfileHint: { ...theme.typography.caption, color: theme.color.primary, marginTop: 2 },
  clientSub: { ...theme.typography.body, marginTop: 4 },
  assigneeRow: { paddingVertical: theme.spacing.space2 },
  metaLabel: { ...theme.typography.label, color: theme.color.textMuted, fontWeight: '700', fontSize: 10, letterSpacing: 0.5 },
  assigneeValue: { ...theme.typography.body, color: theme.color.textPrimary, marginTop: 2 },
  assigneePickerPanel: { backgroundColor: theme.color.bgBase, borderRadius: theme.radius.md, padding: theme.spacing.space2 },
  assigneeSearchInput: { backgroundColor: theme.color.bgSurface, padding: theme.spacing.space2, borderRadius: theme.radius.sm, color: theme.color.textPrimary, marginBottom: 6 },
  assigneePickerItem: { padding: theme.spacing.space2, borderRadius: theme.radius.sm },
  assigneePickerItemActive: { backgroundColor: theme.color.primary + '11' },
  assigneePickerItemText: { ...theme.typography.body, color: theme.color.textSecondary },
  assigneePickerItemRole: { ...theme.typography.caption, color: theme.color.textMuted, fontSize: 11 },
  metaGrid: { flexDirection: 'row', gap: 14 },
  metaCell: { flex: 1, gap: 3 },
  metaValue: { ...theme.typography.body, color: theme.color.textPrimary, fontWeight: '600' },
  docChip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: theme.color.primary + '18' },
  docChipText: { ...theme.typography.caption, color: theme.color.primary, fontWeight: '700', fontSize: 12 },
  notesBlock: { gap: 4 },
  notesText: { ...theme.typography.body, color: theme.color.textSecondary, lineHeight: 20 },
  headerActionsRow: { flexDirection: 'row', gap: theme.spacing.space2 },
  editTaskBtn: { paddingHorizontal: theme.spacing.space3, paddingVertical: theme.spacing.space2, borderRadius: theme.radius.sm, backgroundColor: theme.color.primary + '18' },
  editTaskBtnText: { color: theme.color.primary, fontSize: 13, fontWeight: '700' },
  shareWhatsAppBtn: { paddingHorizontal: theme.spacing.space3, paddingVertical: theme.spacing.space2, borderRadius: theme.radius.sm, backgroundColor: '#25d36622' },
  shareWhatsAppBtnText: { color: '#25d366', fontSize: 13, fontWeight: '700' },
  duplicateBtn: { paddingHorizontal: theme.spacing.space3, paddingVertical: theme.spacing.space2, borderRadius: theme.radius.sm, backgroundColor: theme.color.primary, marginStart: 'auto' },
  duplicateBtnText: { color: theme.color.white, fontSize: 13, fontWeight: '700' },
});
