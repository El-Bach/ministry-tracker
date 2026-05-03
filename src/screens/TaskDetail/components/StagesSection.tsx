// src/screens/TaskDetail/components/StagesSection.tsx
//
// Stages route timeline: per-stage rail/dot, 2×2 chip grid (city · due date /
// status · assignee), inline pickers for city + assignee.
// Phase 2 extraction (parallel module — does not yet replace the monolith).
//
// NOTE: This component renders the section view. The complex inline pickers
// (city dropdown, assignee dropdown, due-date calendar, requirements modal,
// rejection-reason modal, edit-stages modal, status picker) remain in the
// parent for now — they reference too much shared state to extract cleanly.
// The parent calls back into them via the `onSetCity`, `onSetAssignee`, etc.
// props.

import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { theme } from '../../../theme';
import { useTranslation } from '../../../lib/i18n';
import { Task, TaskRouteStop, City, OrgPermissions } from '../../../types';

interface Props {
  task: Task;
  permissions: OrgPermissions;

  // Display helpers
  formatDateOnly: (iso: string) => string;
  getStatusColor: (status: string) => string;

  // Callbacks
  onOpenStatusPicker: (stop: TaskRouteStop) => void;
  onOpenCityPicker: (stopId: string) => void;
  onOpenAssigneePicker: (stopId: string) => void;
  onOpenDueDatePicker: (stopId: string) => void;
  onOpenRequirements: (stop: TaskRouteStop) => void;
  onOpenEditStages: () => void;

  // Inline picker state — parent owns these and renders them inside the
  // section via the `renderInlinePickers` prop (to avoid extracting all the
  // picker logic). Returns null if no picker is open for the given stopId.
  renderInlinePickers: (stopId: string) => React.ReactNode;

  savingStage: boolean;
}

export function StagesSection({
  task, permissions,
  formatDateOnly, getStatusColor,
  onOpenStatusPicker, onOpenCityPicker, onOpenAssigneePicker, onOpenDueDatePicker,
  onOpenRequirements, onOpenEditStages,
  renderInlinePickers,
  savingStage,
}: Props) {
  const { t } = useTranslation();

  return (
    <View style={s.section}>
      <View style={s.sectionTitleRow}>
        <Text style={s.sectionTitle}>{t('stagesSection').toUpperCase()}</Text>
        {permissions.can_add_edit_stages && (
          <TouchableOpacity style={s.addStageBtn} onPress={onOpenEditStages}>
            <Text style={s.addStageBtnText}>{t('editStages')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {savingStage && (
        <View style={s.savingBar}>
          <ActivityIndicator size="small" color={theme.color.primary} />
          <Text style={s.savingText}>{t('pleaseWait')}</Text>
        </View>
      )}

      {(!task.route_stops || task.route_stops.length === 0) && (
        <Text style={s.emptyText}>{t('noStages')}</Text>
      )}

      {task.route_stops?.map((stop, idx) => {
        const isLast = idx === (task.route_stops?.length ?? 0) - 1;
        const stopCityName = stop.city?.name;
        const dotColor = getStatusColor(stop.status);

        return (
          <View key={stop.id} style={s.stopRow}>
            {/* Rail */}
            <View style={s.stopRail}>
              <View style={[s.stopDot, { backgroundColor: dotColor }]} />
              {!isLast && <View style={s.stopLine} />}
            </View>

            {/* Content */}
            <View style={s.stopContent}>
              <View style={s.stopHeader}>
                <Text style={s.stopOrder}>{stop.stop_order}.</Text>
                <Text style={s.stopName} numberOfLines={2}>{stop.ministry?.name}</Text>
                {permissions.can_update_stage_status && (
                  <TouchableOpacity onPress={() => onOpenRequirements(stop)} style={s.reqBtn}>
                    <Text style={s.reqBtnText}>📋</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* 2×2 chip grid: city · due date / status · assignee */}
              <View style={s.chipGrid}>
                <View style={s.chipRow}>
                  <TouchableOpacity style={s.chip} onPress={() => onOpenCityPicker(stop.id)}>
                    <Text style={s.chipText} numberOfLines={1}>
                      {stopCityName ? `📍 ${stopCityName}` : t('setCity')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.chip} onPress={() => onOpenDueDatePicker(stop.id)}>
                    <Text style={s.chipText} numberOfLines={1}>
                      {stop.due_date ? `📅 ${formatDateOnly(stop.due_date)}` : t('dueDate')}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={s.chipRow}>
                  <TouchableOpacity
                    style={[s.chip, { backgroundColor: dotColor + '22', borderColor: dotColor + '55' }]}
                    onPress={() => onOpenStatusPicker(stop)}
                    disabled={!permissions.can_update_stage_status}
                  >
                    <Text style={[s.chipText, { color: dotColor, fontWeight: '700' }]} numberOfLines={1}>
                      ● {stop.status}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.chip} onPress={() => onOpenAssigneePicker(stop.id)}>
                    <Text style={s.chipText} numberOfLines={1}>
                      {stop.assignee?.name ?? stop.ext_assignee?.name ?? t('setAssignee')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Rejection reason if present */}
              {stop.rejection_reason && stop.status === 'Rejected' && (
                <View style={s.rejectionBox}>
                  <Text style={s.rejectionLabel}>{t('rejectionReason')}:</Text>
                  <Text style={s.rejectionText}>{stop.rejection_reason}</Text>
                </View>
              )}

              {/* Inline pickers (city, assignee, due-date) — parent renders */}
              {renderInlinePickers(stop.id)}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginHorizontal: theme.spacing.space4, marginBottom: theme.spacing.space4 },
  sectionTitle: { ...theme.typography.label, color: theme.color.textMuted, fontWeight: '700', fontSize: 11, letterSpacing: 0.5 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.space2 },
  addStageBtn: { backgroundColor: theme.color.success, paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.sm },
  addStageBtnText: { color: theme.color.white, fontWeight: '700', fontSize: 12 },
  savingBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, backgroundColor: theme.color.primary + '11', borderRadius: theme.radius.sm, marginBottom: 8 },
  savingText: { color: theme.color.primary, fontSize: 12 },
  emptyText: { ...theme.typography.body, color: theme.color.textMuted, fontStyle: 'italic' },
  stopRow: { flexDirection: 'row', gap: 12 },
  stopRail: { width: 16, alignItems: 'center', paddingTop: 4 },
  stopDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: theme.color.bgSurface },
  stopLine: { flex: 1, width: 2, backgroundColor: theme.color.border, marginVertical: 4 },
  stopContent: { flex: 1, paddingBottom: theme.spacing.space3, gap: 6 },
  stopHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stopOrder: { fontSize: 12, fontWeight: '700', color: theme.color.textMuted },
  stopName: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.color.textPrimary },
  reqBtn: { padding: 4 },
  reqBtnText: { fontSize: 16 },
  chipGrid: { gap: 6 },
  chipRow: { flexDirection: 'row', gap: 6 },
  chip: { flex: 1, backgroundColor: theme.color.bgBase, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontSize: 12, color: theme.color.textPrimary },
  rejectionBox: { backgroundColor: theme.color.danger + '11', padding: 8, borderRadius: theme.radius.sm, borderLeftWidth: 3, borderLeftColor: theme.color.danger },
  rejectionLabel: { fontSize: 11, fontWeight: '700', color: theme.color.danger, marginBottom: 2 },
  rejectionText: { fontSize: 13, color: theme.color.textPrimary, lineHeight: 18 },
});
