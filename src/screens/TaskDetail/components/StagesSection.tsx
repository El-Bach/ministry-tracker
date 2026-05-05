// src/screens/TaskDetail/components/StagesSection.tsx
//
// Stages route timeline + per-stage chip grid + inline pickers (city, assignee,
// name-edit, status history). This is a faithful 1:1 extraction of the
// monolith's stages section.
//
// Note: this component takes a wide Props interface because the inline pickers
// reference a lot of cross-stop state. State + handlers stay in the parent
// (TaskDetailScreen). Future refactors can lift state down into the component.

import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet,
  Alert, Linking,
} from 'react-native';
import { theme } from '../../../theme';
import { useTranslation } from '../../../lib/i18n';
import { Task, TaskRouteStop, OrgPermissions } from '../../../types';

interface StopHistoryEntry {
  id: string;
  old_status?: string | null;
  new_status: string;
  updater?: { name: string };
  created_at: string;
}

interface CityLite { id: string; name: string }
interface MemberLite { id: string; name: string; role?: string }
interface ExtAssigneeLite {
  id: string;
  name: string;
  phone?: string;
  reference?: string;
  reference_phone?: string;
  city?: { id: string; name: string };
}

interface Props {
  task: Task;
  permissions: OrgPermissions;

  // Inline name-edit state
  openStageNameId: string | null;
  setOpenStageNameId: (v: string | null | ((prev: string | null) => string | null)) => void;
  stageNameEdit: string;
  setStageNameEdit: (v: string) => void;
  savingStageNameId: string | null;
  onRenameStopMinistry: (ministryId: string, name: string) => void;

  // City picker state
  openCityStopId: string | null;
  setOpenCityStopId: (v: string | null | ((prev: string | null) => string | null)) => void;
  stopCitySearch: string;
  setStopCitySearch: (v: string) => void;
  showCreateCityForm: boolean;
  setShowCreateCityForm: (v: boolean | ((prev: boolean) => boolean)) => void;
  newCityName: string;
  setNewCityName: (v: string) => void;
  savingCity: boolean;
  onCreateCity: (stopId: string) => void;
  onSetStopCity: (stopId: string, cityId: string | null) => void;
  pinnedCityIds: string[];
  togglePinCity: (cityId: string) => void;
  allCities: CityLite[];

  // Assignee picker state
  openAssigneeStopId: string | null;
  setOpenAssigneeStopId: (v: string | null | ((prev: string | null) => string | null)) => void;
  stopAssigneeSearch: string;
  setStopAssigneeSearch: (v: string) => void;
  showCreateExtForm: boolean;
  setShowCreateExtForm: (v: boolean | ((prev: boolean) => boolean)) => void;
  newExtName: string;
  setNewExtName: (v: string) => void;
  newExtPhone: string;
  setNewExtPhone: (v: string) => void;
  newExtReference: string;
  setNewExtReference: (v: string) => void;
  savingExtAssignee: boolean;
  onCreateExtAssigneeForStop: (stopId: string) => void;
  onSetStopAssignee: (stopId: string, memberId: string | null, extId: string | null) => void;
  allMembers: MemberLite[];
  extAssignees: ExtAssigneeLite[];
  formatPhoneDisplay: (phone: string) => string;

  // Due date picker
  setStopDueDatePickerStopId: (stopId: string) => void;
  savingStopDueDate: string | null;

  // Status picker
  setSelectedStop: (stop: TaskRouteStop) => void;
  setShowStatusPicker: (v: boolean) => void;
  updatingStop: string | null;

  // History
  stopHistories: Record<string, StopHistoryEntry[]>;
  expandedStopHistory: string | null;
  setExpandedStopHistory: (v: string | null) => void;
  savingStopField: string | null;

  // Edit stages modal trigger
  onOpenEditStages: () => void;

  // Open ministry contacts picker for this stage. Parent decides whether the
  // sheet opens in pick or browse mode; this callback just signals "open it
  // for THIS stop / ministry".
  onOpenContacts: (stopId: string, ministryId: string, ministryName: string) => void;

  // Display helpers
  formatDate: (iso: string) => string;
  formatDateOnly: (iso: string) => string;
  getStatusColor: (status: string) => string;
}

export function StagesSection(props: Props) {
  const { t } = useTranslation();
  const {
    task, permissions,
    openStageNameId, setOpenStageNameId, stageNameEdit, setStageNameEdit,
    savingStageNameId, onRenameStopMinistry,
    openCityStopId, setOpenCityStopId, stopCitySearch, setStopCitySearch,
    showCreateCityForm, setShowCreateCityForm, newCityName, setNewCityName,
    savingCity, onCreateCity, onSetStopCity,
    pinnedCityIds, togglePinCity, allCities,
    openAssigneeStopId, setOpenAssigneeStopId, stopAssigneeSearch, setStopAssigneeSearch,
    showCreateExtForm, setShowCreateExtForm,
    newExtName, setNewExtName, newExtPhone, setNewExtPhone, newExtReference, setNewExtReference,
    savingExtAssignee, onCreateExtAssigneeForStop, onSetStopAssignee,
    allMembers, extAssignees, formatPhoneDisplay,
    setStopDueDatePickerStopId, savingStopDueDate,
    setSelectedStop, setShowStatusPicker, updatingStop,
    stopHistories, expandedStopHistory, setExpandedStopHistory, savingStopField,
    onOpenEditStages, onOpenContacts,
    formatDate, formatDateOnly, getStatusColor,
  } = props;

  return (
    <View style={s.section}>
      <View style={s.sectionTitleRow}>
        <Text style={s.sectionTitle}>{t('stagesSection').toUpperCase()}</Text>
        {permissions.can_add_edit_stages && (
          <>
            <TouchableOpacity style={s.addStageBtn} onPress={onOpenEditStages}>
              <Text style={s.addStageBtnText}>+ {t('addStage')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.editStagesBtn} onPress={onOpenEditStages}>
              <Text style={s.editStagesBtnText}>✎ {t('edit')}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={s.routeContainer}>
        {task.route_stops?.map((stop, idx) => {
          const stopHistory = stopHistories[stop.id] ?? [];
          const isHistoryExpanded = expandedStopHistory === stop.id;
          const stopCityName = stop.city?.name ?? allCities.find(c => c.id === stop.city_id)?.name ?? null;
          const isLast = idx === (task.route_stops?.length ?? 0) - 1;

          return (
            <View key={stop.id} style={s.stageRow}>
              {/* Rail */}
              <View style={s.stageRail}>
                <View style={[s.stageDot, { backgroundColor: getStatusColor(stop.status) }]} />
                {!isLast && <View style={s.stageLine} />}
              </View>

              {/* Content */}
              <View style={s.stageContent}>
                {/* Header — read-only on TaskDetail. Stage name is edited from
                    Manage > Stages, so no inline rename trigger here. */}
                <View style={s.stageHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.stageMinistryName} numberOfLines={2}>
                      {stop.ministry?.name ?? 'Unknown Ministry'}
                    </Text>
                  </View>
                  {stop.ministry_id && (
                    <TouchableOpacity
                      onPress={() => onOpenContacts(stop.id, stop.ministry_id!, stop.ministry?.name ?? '')}
                      style={s.contactsBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={s.contactsBtnText}>👥</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Selected ministry contacts — one line each, tap phone → call/WhatsApp */}
                {stop.selected_contacts && stop.selected_contacts.length > 0 && (
                  <View style={s.selectedContactsList}>
                    {stop.selected_contacts.map(c => {
                      const onPress = c.phone
                        ? () => {
                            const clean = c.phone!.replace(/[^0-9+]/g, '');
                            Alert.alert(c.name, c.phone!, [
                              { text: '📞 Phone Call', onPress: () => Linking.openURL(`tel:${clean}`) },
                              { text: '💬 WhatsApp', onPress: () => Linking.openURL(`https://wa.me/${clean.replace(/^\+/, '')}`) },
                              { text: t('cancel'), style: 'cancel' },
                            ]);
                          }
                        : undefined;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          activeOpacity={onPress ? 0.6 : 1}
                          onPress={onPress}
                          style={s.selectedContactRow}
                        >
                          <Text style={s.selectedContactText} numberOfLines={1}>
                            <Text style={s.selectedContactName}>{c.name}</Text>
                            {c.position ? <Text style={s.selectedContactMeta}> · {c.position}</Text> : null}
                            {c.phone ? <Text style={s.selectedContactPhone}>  📞 {c.phone}</Text> : null}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* 2×2 chip grid */}
                <View style={s.stageChipGrid}>
                  <View style={s.stageChipRow}>
                    {/* City chip */}
                    <TouchableOpacity
                      style={[s.stageChip, {
                        borderColor: stop.city_id ? theme.color.primary + '70' : theme.color.border,
                        backgroundColor: stop.city_id ? theme.color.primary + '18' : theme.color.bgBase,
                        alignItems: 'flex-start',
                      }]}
                      onPress={() => { setOpenCityStopId(v => v === stop.id ? null : stop.id); setStopCitySearch(''); setShowCreateCityForm(false); setNewCityName(''); }}
                      activeOpacity={0.7}
                    >
                      <Text style={s.stageChipIcon}>📍</Text>
                      <Text style={[s.stageChipLabel, { color: stop.city_id ? theme.color.primary : theme.color.textMuted, flexWrap: 'wrap' }]}>
                        {stopCityName ?? t('setCity')}
                      </Text>
                      <Text style={[s.stageChipArrow, { color: stop.city_id ? theme.color.primary + 'BB' : theme.color.border }]}>▾</Text>
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
                            {stop.due_date ? formatDateOnly(stop.due_date) : t('dueDate')}
                          </Text>
                          <Text style={[s.stageChipArrow, { color: stop.due_date ? theme.color.warning + 'BB' : theme.color.border }]}>▾</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Rejection reason */}
                  {stop.status === 'Rejected' && stop.rejection_reason ? (
                    <View style={s.rejectionReasonRow}>
                      <Text style={s.rejectionReasonText}>⚠ {stop.rejection_reason}</Text>
                    </View>
                  ) : null}

                  {/* Row 2: Status + Assignee */}
                  <View style={s.stageChipRow}>
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

                    <TouchableOpacity
                      style={[s.stageChip, {
                        borderColor: (stop.assignee || stop.ext_assignee) ? theme.color.success + '70' : theme.color.border,
                        backgroundColor: (stop.assignee || stop.ext_assignee) ? theme.color.success + '18' : theme.color.bgBase,
                      }]}
                      onPress={() => { setOpenAssigneeStopId(v => v === stop.id ? null : stop.id); setShowCreateExtForm(false); setNewExtName(''); setNewExtPhone(''); setNewExtReference(''); setStopAssigneeSearch(''); }}
                      activeOpacity={0.7}
                    >
                      <Text style={s.stageChipIcon}>👤</Text>
                      <Text style={[s.stageChipLabel, { color: (stop.assignee || stop.ext_assignee) ? theme.color.success : theme.color.textMuted }]} numberOfLines={1}>
                        {stop.assignee?.name ?? stop.ext_assignee?.name ?? t('setAssignee')}
                      </Text>
                      <Text style={[s.stageChipArrow, { color: (stop.assignee || stop.ext_assignee) ? theme.color.success + 'BB' : theme.color.border }]}>▾</Text>
                    </TouchableOpacity>
                  </View>
                </View>

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
                          onPress={() => onCreateCity(stop.id)}
                          disabled={savingCity}
                        >
                          {savingCity
                            ? <ActivityIndicator color={theme.color.white} size="small" />
                            : <Text style={s.newMemberSaveBtnText}>Save & Select</Text>}
                        </TouchableOpacity>
                      </View>
                    )}
                    <View>
                      {stop.city_id && (
                        <TouchableOpacity style={s.cityDropdownItem} onPress={() => onSetStopCity(stop.id, null)}>
                          <Text style={{ color: theme.color.danger, fontSize: 13, padding: theme.spacing.space2 }}>✕ Remove city</Text>
                        </TouchableOpacity>
                      )}
                      {pinnedCityIds.length > 0 && !stopCitySearch.trim() && (
                        <View style={{ backgroundColor: theme.color.bgBase, paddingHorizontal: theme.spacing.space3, paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: theme.color.border }}>
                          <Text style={{ ...theme.typography.caption, color: theme.color.textMuted, fontWeight: '700' }}>PINNED</Text>
                        </View>
                      )}
                      {allCities.filter(c => pinnedCityIds.includes(c.id) && (!stopCitySearch.trim() || c.name.toLowerCase().includes(stopCitySearch.trim().toLowerCase()))).map(city => (
                        <View key={city.id} style={[s.cityDropdownItem, stop.city_id === city.id && s.cityDropdownItemActive]}>
                          <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                            onPress={() => onSetStopCity(stop.id, city.id)}>
                            <Text style={[s.cityDropdownItemText, stop.city_id === city.id && { fontWeight: '600' }]}>{city.name}</Text>
                            {stop.city_id === city.id && <Text style={s.checkmark}>✓</Text>}
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => togglePinCity(city.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Text style={{ fontSize: 14 }}>📌</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                      {stopCitySearch.trim() ? (
                        allCities.filter(c => !pinnedCityIds.includes(c.id) && c.name.toLowerCase().includes(stopCitySearch.trim().toLowerCase())).length === 0
                        && pinnedCityIds.filter(id => allCities.find(c => c.id === id)?.name.toLowerCase().includes(stopCitySearch.trim().toLowerCase())).length === 0
                          ? <Text style={{ color: theme.color.textMuted, fontSize: 13, padding: theme.spacing.space3 }}>No cities match "{stopCitySearch}"</Text>
                          : allCities.filter(c => !pinnedCityIds.includes(c.id) && c.name.toLowerCase().includes(stopCitySearch.trim().toLowerCase())).map(city => (
                            <View key={city.id} style={[s.cityDropdownItem, stop.city_id === city.id && s.cityDropdownItemActive]}>
                              <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                                onPress={() => onSetStopCity(stop.id, city.id)}>
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
                        <TouchableOpacity style={s.cityDropdownItem} onPress={() => onSetStopAssignee(stop.id, null, null)}>
                          <Text style={{ color: theme.color.danger, fontSize: 13, padding: theme.spacing.space2 }}>✕ Remove assignee</Text>
                        </TouchableOpacity>
                      )}
                      {allMembers
                        .filter(m => !stopAssigneeSearch.trim() || m.name.toLowerCase().includes(stopAssigneeSearch.toLowerCase()) || m.role?.toLowerCase().includes(stopAssigneeSearch.toLowerCase()))
                        .slice(0, 15)
                        .map(m => (
                          <TouchableOpacity key={m.id}
                            style={[s.cityDropdownItem, stop.assigned_to === m.id && s.cityDropdownItemActive]}
                            onPress={() => onSetStopAssignee(stop.id, m.id, null)}>
                            <View style={{ flex: 1 }}>
                              <Text style={s.cityDropdownItemText}>{m.name}</Text>
                              {m.role ? <Text style={{ fontSize: 11, color: theme.color.textMuted }}>{m.role}</Text> : null}
                            </View>
                            {stop.assigned_to === m.id && <Text style={s.checkmark}>✓</Text>}
                          </TouchableOpacity>
                        ))}
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
                        .map((a) => (
                          <TouchableOpacity key={a.id}
                            style={[s.cityDropdownItem, stop.ext_assignee_id === a.id && s.cityDropdownItemActive]}
                            onPress={() => onSetStopAssignee(stop.id, null, a.id)}>
                            <View style={{ flex: 1 }}>
                              <Text style={s.cityDropdownItemText}>{a.name}</Text>
                              {a.phone ? <Text style={{ fontSize: 11, color: theme.color.textMuted }}>📞 {formatPhoneDisplay(a.phone)}</Text> : null}
                              {a.reference ? <Text style={{ fontSize: 11, color: theme.color.textMuted }}>عبر {a.reference}</Text> : null}
                              {a.city?.name ? <Text style={{ fontSize: 11, color: theme.color.textMuted }}>📍 {a.city.name}</Text> : null}
                            </View>
                            {stop.ext_assignee_id === a.id && <Text style={s.checkmark}>✓</Text>}
                          </TouchableOpacity>
                        ))}
                      {stopAssigneeSearch.trim() &&
                        allMembers.filter(m => m.name.toLowerCase().includes(stopAssigneeSearch.toLowerCase())).length === 0 &&
                        extAssignees.filter(a => a.name?.toLowerCase().includes(stopAssigneeSearch.toLowerCase()) || a.phone?.toLowerCase().includes(stopAssigneeSearch.toLowerCase()) || a.reference?.toLowerCase().includes(stopAssigneeSearch.toLowerCase())).length === 0 && (
                          <Text style={{ padding: theme.spacing.space3, color: theme.color.textMuted, fontSize: 13 }}>No contacts match "{stopAssigneeSearch}"</Text>
                        )}
                      {!stopAssigneeSearch.trim() && (
                        <TouchableOpacity style={s.cityDropdownItem}
                          onPress={() => setShowCreateExtForm(v => !v)}>
                          <Text style={{ color: theme.color.primary, fontSize: 13, fontWeight: '600', padding: theme.spacing.space2 }}>
                            {showCreateExtForm ? '− Cancel' : '+ Create New Contact'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
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
                          onPress={() => onCreateExtAssigneeForStop(stop.id)}
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

                {/* History */}
                {isHistoryExpanded && stopHistory.length > 0 && (
                  <View style={s.stopHistoryBlock}>
                    {stopHistory.map((h) => (
                      <View key={h.id} style={s.stopHistoryRow}>
                        <View style={s.stopHistoryDot} />
                        <View style={{ flex: 1 }}>
                          <View style={s.stopHistoryTextRow}>
                            {h.old_status && <Text style={s.stopHistoryOld}>{h.old_status}</Text>}
                            {h.old_status && <Text style={s.stopHistoryArrow}> → </Text>}
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
  );
}

const s = StyleSheet.create({
  section: { backgroundColor: theme.color.bgSurface, borderRadius: theme.radius.lg, padding: theme.spacing.space4, marginHorizontal: theme.spacing.space4, marginTop: theme.spacing.space4 },
  sectionTitle: { ...theme.typography.sectionDivider },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.space3, gap: theme.spacing.space2 },
  routeContainer: { gap: theme.spacing.space1 },

  addStageBtn: { backgroundColor: theme.color.success, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.space3, paddingVertical: 5 },
  addStageBtnText: { color: theme.color.white, fontSize: 12, fontWeight: '700' },
  editStagesBtn: { backgroundColor: theme.color.primary + '22', borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.space3, paddingVertical: 5 },
  editStagesBtnText: { ...theme.typography.label, color: theme.color.primaryText, fontWeight: '600' },

  stageRow: { flexDirection: 'row', gap: theme.spacing.space3 },
  stageRail: { alignItems: 'center', width: theme.spacing.space5 },
  stageDot: { width: 12, height: 12, borderRadius: 6, marginTop: theme.spacing.space1 },
  stageLine: { width: 2, flex: 1, backgroundColor: theme.color.border, marginTop: theme.spacing.space1 },
  stageContent: { flex: 1, paddingBottom: theme.spacing.space5, gap: theme.spacing.space2 },
  stageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stageMinistryName: { ...theme.typography.body, fontWeight: '700', flex: 1 },
  stageOrder: { ...theme.typography.caption, fontWeight: '600' },
  contactsBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  contactsBtnText: { fontSize: 16 },
  selectedContactsList: { marginTop: theme.spacing.space2, gap: 4, paddingStart: 2 },
  selectedContactRow:   { paddingVertical: 2 },
  selectedContactText:  { fontSize: 12 },
  selectedContactName:  { color: theme.color.textPrimary, fontWeight: '600' },
  selectedContactMeta:  { color: theme.color.textSecondary },
  selectedContactPhone: { color: theme.color.primary, fontWeight: '600' },

  stageNamePanel: { backgroundColor: theme.color.bgBase, borderRadius: theme.radius.md, padding: theme.spacing.space3, borderWidth: 1, borderColor: theme.color.border },
  stageNameInput: { ...theme.typography.body, color: theme.color.textPrimary, backgroundColor: theme.color.bgSurface, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.space3, paddingVertical: 8, borderWidth: 1, borderColor: theme.color.border },
  stageNameBtn: { paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.md },
  stageNameBtnText: { ...theme.typography.label, fontWeight: '700' },

  stageChipGrid: { gap: 6 },
  stageChipRow: { flexDirection: 'row', gap: 6 },
  stageChip: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderRadius: theme.radius.md },
  stageChipDot: { width: 8, height: 8, borderRadius: 4 },
  stageChipIcon: { fontSize: 13 },
  stageChipLabel: { fontSize: 12, fontWeight: '600', flex: 1 },
  stageChipArrow: { fontSize: 10 },

  rejectionReasonRow: { backgroundColor: theme.color.danger + '18', borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.space3, paddingVertical: 6, borderLeftWidth: 3, borderLeftColor: theme.color.danger, marginTop: 2 },
  rejectionReasonText: { color: theme.color.danger, fontSize: 12, fontWeight: '500', lineHeight: 17 },

  stopMetaChip: { backgroundColor: theme.color.bgBase, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.space3, paddingVertical: 5, borderWidth: 1, borderColor: theme.color.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0, maxWidth: 200 },
  stopMetaChipText: { fontSize: 12, color: theme.color.textSecondary, flexWrap: 'wrap' },
  stopDropdown: { backgroundColor: theme.color.bgSurface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.border, marginTop: theme.spacing.space1, overflow: 'hidden' },
  stopAssigneeSearch: { margin: theme.spacing.space2, paddingHorizontal: theme.spacing.space3, paddingVertical: 8, backgroundColor: theme.color.bgBase, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.border, color: theme.color.textPrimary, fontSize: 13 },
  citySearchInner: { margin: theme.spacing.space2, paddingHorizontal: theme.spacing.space3, paddingVertical: 8, backgroundColor: theme.color.bgBase, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.border, color: theme.color.textPrimary, fontSize: 13 },
  cityDropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.space3, paddingVertical: 4 },
  cityDropdownItemActive: { backgroundColor: theme.color.primary + '15' },
  cityDropdownItemText: { ...theme.typography.body, color: theme.color.textPrimary },

  newMemberInput: { backgroundColor: theme.color.bgBase, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.space3, paddingVertical: 8, borderWidth: 1, borderColor: theme.color.border, color: theme.color.textPrimary, fontSize: 14 },
  newMemberSaveBtn: { backgroundColor: theme.color.primary, borderRadius: theme.radius.md, paddingVertical: 9, alignItems: 'center' },
  newMemberSaveBtnText: { ...theme.typography.body, color: theme.color.white, fontWeight: '700' },
  disabledBtn: { opacity: 0.5 },
  checkmark: { color: theme.color.success, fontSize: 18 },

  historyToggleBtn: { paddingHorizontal: theme.spacing.space2, paddingVertical: 4, borderRadius: theme.radius.sm, backgroundColor: theme.color.bgBase, alignSelf: 'flex-start' },
  historyToggleBtnText: { ...theme.typography.caption, color: theme.color.textSecondary, fontWeight: '600' },
  stopHistoryBlock: { backgroundColor: theme.color.bgBase, borderRadius: theme.radius.md, padding: theme.spacing.space3, gap: 6, marginTop: theme.spacing.space1 },
  stopHistoryRow: { flexDirection: 'row', gap: 8 },
  stopHistoryDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.color.primary, marginTop: 6 },
  stopHistoryTextRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  stopHistoryOld: { color: theme.color.textMuted, fontSize: theme.typography.label.fontSize, textDecorationLine: 'line-through' },
  stopHistoryArrow: { color: theme.color.textMuted, fontSize: theme.typography.label.fontSize },
  stopHistoryNew: { color: theme.color.success, fontSize: theme.typography.label.fontSize, fontWeight: '700' },
  stopHistoryMeta: { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 2 },
});
