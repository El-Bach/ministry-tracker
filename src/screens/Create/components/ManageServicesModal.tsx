// src/screens/Create/components/ManageServicesModal.tsx
//
// Manage > Services modal: list with inline add / edit / delete + per-service
// expandable stages panel + Excel import view. Phase 3a extraction.

import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  Modal, ScrollView, KeyboardAvoidingView, Alert,
} from 'react-native';
import { theme } from '../../../theme';
import { Service, Ministry } from '../../../types';

interface SvcImportRow { name: string; priceUSD: string; priceLBP: string }

interface Props {
  visible: boolean;
  onClose: () => void;
  t: (key: any) => string;

  // Data
  services: Service[];
  ministries: Ministry[];

  // Search
  serviceSearch: string;
  setServiceSearch: (v: string) => void;

  // New service form
  newSvcName: string;
  setNewSvcName: (v: string) => void;
  newSvcPriceUSD: string;
  setNewSvcPriceUSD: (v: string) => void;
  newSvcPriceLBP: string;
  setNewSvcPriceLBP: (v: string) => void;
  savingNewSvc: boolean;
  handleCreateService: () => void;

  // Edit service inline
  editSvcId: string | null;
  setEditSvcId: (v: string | null) => void;
  editSvcName: string;
  setEditSvcName: (v: string) => void;
  editSvcPriceUSD: string;
  setEditSvcPriceUSD: (v: string) => void;
  editSvcPriceLBP: string;
  setEditSvcPriceLBP: (v: string) => void;
  savingEditSvc: boolean;
  handleSaveEditService: () => void;
  handleDeleteService: (svc: Service) => void;

  // Inline stages panel (per service)
  expandedSvcId: string | null;
  setExpandedSvcId: (v: string | null) => void;
  svcStages: Record<string, any[]>;
  loadingSvcStages: string | null;
  svcStageNewName: string;
  setSvcStageNewName: (v: string) => void;
  savingNewSvcStage: boolean;
  handleToggleSvcExpand: (svcId: string) => void;
  handleAddSvcStage: (svcId: string) => void;
  handleAddExistingSvcStage: (svcId: string, ministryId: string) => void;
  handleMoveSvcStage: (svcId: string, stageId: string, dir: 'up' | 'down') => void;
  handleRemoveSvcStage: (svcId: string, stageId: string) => void;

  // Excel import
  showSvcImportModal: boolean;
  setShowSvcImportModal: (v: boolean) => void;
  svcImportRaw: string;
  setSvcImportRaw: (v: string) => void;
  svcImportRows: SvcImportRow[];
  setSvcImportRows: (v: SvcImportRow[]) => void;
  importingServices: boolean;
  parseSvcImportText: (raw: string) => SvcImportRow[];
  handleImportServices: () => void;

  // Shared styles
  s: any;
}

export function ManageServicesModal(props: Props) {
  const {
    visible, onClose, t,
    services, ministries,
    serviceSearch, setServiceSearch,
    newSvcName, setNewSvcName, newSvcPriceUSD, setNewSvcPriceUSD, newSvcPriceLBP, setNewSvcPriceLBP,
    savingNewSvc, handleCreateService,
    editSvcId, setEditSvcId, editSvcName, setEditSvcName, editSvcPriceUSD, setEditSvcPriceUSD, editSvcPriceLBP, setEditSvcPriceLBP,
    savingEditSvc, handleSaveEditService, handleDeleteService,
    expandedSvcId, setExpandedSvcId, svcStages, loadingSvcStages,
    svcStageNewName, setSvcStageNewName, savingNewSvcStage,
    handleToggleSvcExpand, handleAddSvcStage, handleAddExistingSvcStage, handleMoveSvcStage, handleRemoveSvcStage,
    showSvcImportModal, setShowSvcImportModal,
    svcImportRaw, setSvcImportRaw, svcImportRows, setSvcImportRows,
    importingServices, parseSvcImportText, handleImportServices,
    s,
  } = props;

  // setExpandedSvcId is referenced for symmetry via prop wiring even though
  // we route expand toggling through handleToggleSvcExpand. Reference it so
  // unused-prop warnings don't fire.
  void setExpandedSvcId;

  const filtered = services.filter((sv) =>
    !serviceSearch.trim() || sv.name.toLowerCase().includes(serviceSearch.toLowerCase()),
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => { onClose(); setEditSvcId(null); setServiceSearch(''); setShowSvcImportModal(false); }}
    >
      <View style={s.modalOverlay}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-start', paddingTop: 60 }}>
          <View style={[s.modalSheet, showSvcImportModal ? { height: '90%' } : { maxHeight: '90%' }]}>

            {/* ── HEADER — import view or list view ── */}
            {showSvcImportModal ? (
              <View style={s.modalHeader}>
                <TouchableOpacity onPress={() => setShowSvcImportModal(false)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: theme.color.primary, fontSize: 18 }}>‹</Text>
                  <Text style={{ ...theme.typography.label, color: theme.color.primary }}>Back</Text>
                </TouchableOpacity>
                <Text style={s.modalTitle}>📥 {t('importServicesBtn')}</Text>
                <TouchableOpacity onPress={() => { onClose(); setShowSvcImportModal(false); setServiceSearch(''); }}>
                  <Text style={s.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.modalHeader}>
                <View>
                  <Text style={s.modalTitle}>{t('services')}</Text>
                  <Text style={s.modalSubtitle}>
                    {serviceSearch ? `${filtered.length} of ${services.length}` : `${services.length} total`}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity
                    style={s.modalImportBtn}
                    onPress={() => { setSvcImportRaw(''); setSvcImportRows([]); setShowSvcImportModal(true); }}
                  >
                    <Text style={s.modalImportBtnText}>{t('importBtn')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { onClose(); setEditSvcId(null); setServiceSearch(''); }}>
                    <Text style={s.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {showSvcImportModal ? (
              /* ── IMPORT VIEW body ── */
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
                <View style={s.importInstructions}>
                  <Text style={s.importInstructionsTitle}>{t('howToImportExcel')}</Text>
                  <Text style={s.importInstructionsText}>
                    {'1. Make sure columns are: A = Service Name  |  B = Price USD  |  C = Price LBP\n2. Select all data rows (not the header)\n3. Press Ctrl+C (or Cmd+C on Mac)\n4. Long-press in the box below → Paste'}
                  </Text>
                </View>

                <TextInput
                  style={s.importTextArea}
                  value={svcImportRaw}
                  onChangeText={setSvcImportRaw}
                  placeholder={'Paste Excel data here...\n\nExample:\nPassport Renewal\t150\t225000\nVisa Application\t200\t300000'}
                  placeholderTextColor={theme.color.textMuted}
                  multiline
                  numberOfLines={6}
                  autoCorrect={false}
                  autoCapitalize="none"
                />

                <TouchableOpacity
                  style={s.importPreviewBtn}
                  onPress={() => {
                    const rows = parseSvcImportText(svcImportRaw);
                    if (!rows.length) { Alert.alert(t('noResults'), t('emptyList')); return; }
                    setSvcImportRows(rows);
                  }}
                >
                  <Text style={s.importPreviewBtnText}>Preview ({parseSvcImportText(svcImportRaw).length} rows)</Text>
                </TouchableOpacity>

                {svcImportRows.length > 0 && (
                  <>
                    <Text style={s.importPreviewLabel}>PREVIEW — {svcImportRows.length} SERVICE{svcImportRows.length !== 1 ? 'S' : ''}</Text>
                    {svcImportRows.map((r, i) => (
                      <View key={i} style={s.importPreviewRow}>
                        <View style={s.importRowNum}><Text style={s.importRowNumText}>{i + 1}</Text></View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={s.importRowName}>{r.name}</Text>
                          {r.priceUSD ? <Text style={s.importRowSub}>$ {parseFloat(r.priceUSD).toLocaleString('en-US', { maximumFractionDigits: 0 })}</Text> : null}
                          {r.priceLBP ? <Text style={s.importRowSub}>LBP {parseInt(r.priceLBP, 10).toLocaleString('en-US')}</Text> : null}
                        </View>
                      </View>
                    ))}
                    <TouchableOpacity
                      style={[s.modalSaveBtn, importingServices && s.modalSaveBtnDisabled]}
                      onPress={handleImportServices}
                      disabled={importingServices}
                    >
                      {importingServices
                        ? <ActivityIndicator color={theme.color.white} size="small" />
                        : <Text style={s.modalSaveBtnText}>Import {svcImportRows.length} Service{svcImportRows.length !== 1 ? 's' : ''}</Text>}
                    </TouchableOpacity>
                  </>
                )}
              </ScrollView>
            ) : (
              <>
                <View style={s.mgmtSearchRow}>
                  <TextInput
                    style={s.mgmtSearchInput}
                    value={serviceSearch}
                    onChangeText={setServiceSearch}
                    placeholder={t('searchService')}
                    placeholderTextColor={theme.color.textMuted}
                    clearButtonMode="while-editing"
                    autoCorrect={false}
                  />
                </View>
                <ScrollView contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
                  <View style={s.mgmtAddBlock}>
                    <Text style={s.mgmtAddSectionLabel}>{t('newService').toUpperCase()}</Text>
                    <TextInput style={s.modalInput} value={newSvcName} onChangeText={setNewSvcName} placeholder={`${t('serviceName')} *`} placeholderTextColor={theme.color.textMuted} />
                    <View style={s.mgmtPriceRow}>
                      <TextInput style={[s.modalInput, { flex: 1 }]} value={newSvcPriceUSD} onChangeText={setNewSvcPriceUSD} placeholder={t('amountUSD')} placeholderTextColor={theme.color.textMuted} keyboardType="decimal-pad" />
                      <TextInput style={[s.modalInput, { flex: 1 }]} value={newSvcPriceLBP} onChangeText={(v) => { const d = v.replace(/,/g, ''); if (d === '' || /^\d*$/.test(d)) setNewSvcPriceLBP(d === '' ? '' : parseInt(d, 10).toLocaleString('en-US')); }} placeholder={t('amountLBP')} placeholderTextColor={theme.color.textMuted} keyboardType="number-pad" />
                    </View>
                    <TouchableOpacity style={s.mgmtAddBtn} onPress={handleCreateService} disabled={savingNewSvc}>
                      {savingNewSvc ? <ActivityIndicator color={theme.color.white} size="small" /> : <Text style={s.mgmtAddBtnText}>+ {t('addService')}</Text>}
                    </TouchableOpacity>
                  </View>
                  {filtered.map((sv) => (
                    <View key={sv.id}>
                      {editSvcId === sv.id ? (
                        <View style={[s.mgmtEditRow, { flexDirection: 'column', gap: 8 }]}>
                          <TextInput style={s.modalInput} value={editSvcName} onChangeText={setEditSvcName} placeholder={t('name')} placeholderTextColor={theme.color.textMuted} autoFocus />
                          <View style={s.mgmtPriceRow}>
                            <TextInput style={[s.modalInput, { flex: 1 }]} value={editSvcPriceUSD} onChangeText={setEditSvcPriceUSD} placeholder={t('amountUSD')} placeholderTextColor={theme.color.textMuted} keyboardType="decimal-pad" />
                            <TextInput style={[s.modalInput, { flex: 1 }]} value={editSvcPriceLBP} onChangeText={(v) => { const d = v.replace(/,/g, ''); if (d === '' || /^\d*$/.test(d)) setEditSvcPriceLBP(d === '' ? '' : parseInt(d, 10).toLocaleString('en-US')); }} placeholder={t('amountLBP')} placeholderTextColor={theme.color.textMuted} keyboardType="number-pad" />
                          </View>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity style={[s.mgmtSaveBtn, { flex: 1 }]} onPress={handleSaveEditService} disabled={savingEditSvc}>
                              {savingEditSvc ? <ActivityIndicator color={theme.color.white} size="small" /> : <Text style={s.mgmtSaveBtnText}>{t('save')}</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity style={s.mgmtCancelBtn} onPress={() => setEditSvcId(null)}>
                              <Text style={s.mgmtCancelBtnText}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <View>
                          <View style={s.mgmtItemRow}>
                            <TouchableOpacity style={{ flex: 1 }} onPress={() => handleToggleSvcExpand(sv.id)}>
                              <Text style={[s.mgmtItemName, { color: theme.color.primaryText }]}>
                                {expandedSvcId === sv.id ? '▾ ' : '›  '}{sv.name}
                              </Text>
                              {((sv.base_price_usd ?? 0) > 0 || (sv.base_price_lbp ?? 0) > 0) && (
                                <Text style={s.mgmtItemPrice}>
                                  {(sv.base_price_usd ?? 0) > 0 ? `$${(sv.base_price_usd as number).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : ''}
                                  {(sv.base_price_usd ?? 0) > 0 && (sv.base_price_lbp ?? 0) > 0 ? '  ·  ' : ''}
                                  {(sv.base_price_lbp ?? 0) > 0 ? `LBP ${(sv.base_price_lbp as number).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : ''}
                                </Text>
                              )}
                            </TouchableOpacity>
                            <TouchableOpacity style={s.mgmtEditBtn} onPress={() => { setExpandedSvcId(null); setEditSvcId(sv.id); setEditSvcName(sv.name); setEditSvcPriceUSD((sv.base_price_usd ?? 0) > 0 ? String(sv.base_price_usd) : ''); setEditSvcPriceLBP((sv.base_price_lbp ?? 0) > 0 ? (sv.base_price_lbp as number).toLocaleString('en-US') : ''); }}>
                              <Text style={s.mgmtEditBtnText}>✎</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={s.mgmtDelBtn} onPress={() => handleDeleteService(sv)}>
                              <Text style={s.mgmtDelBtnText}>✕</Text>
                            </TouchableOpacity>
                          </View>
                          {expandedSvcId === sv.id && (
                            <View style={s.inlinePanel}>
                              {loadingSvcStages === sv.id ? (
                                <ActivityIndicator color={theme.color.primary} style={{ margin: 12 }} />
                              ) : (
                                <>
                                  <Text style={s.inlinePanelLabel}>STAGES</Text>
                                  {(svcStages[sv.id] ?? []).length === 0 ? (
                                    <Text style={s.inlinePanelEmpty}>{t('noStagesYetAddBelow')}</Text>
                                  ) : (
                                    (svcStages[sv.id] ?? []).map((stage: any, idx: number) => (
                                      <View key={stage.id} style={s.inlineStageRow}>
                                        <Text style={s.inlineStageOrder}>{stage.stop_order}.</Text>
                                        <Text style={s.inlineStageName}>{stage.ministry?.name ?? '—'}</Text>
                                        <TouchableOpacity onPress={() => handleMoveSvcStage(sv.id, stage.id, 'up')} style={s.inlineStageBtn} disabled={idx === 0}>
                                          <Text style={[s.inlineStageBtnText, idx === 0 && { opacity: 0.25 }]}>↑</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleMoveSvcStage(sv.id, stage.id, 'down')} style={s.inlineStageBtn} disabled={idx === (svcStages[sv.id] ?? []).length - 1}>
                                          <Text style={[s.inlineStageBtnText, idx === (svcStages[sv.id] ?? []).length - 1 && { opacity: 0.25 }]}>↓</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleRemoveSvcStage(sv.id, stage.id)} style={[s.inlineStageBtn, { backgroundColor: theme.color.dangerDim }]}>
                                          <Text style={[s.inlineStageBtnText, { color: theme.color.danger }]}>✕</Text>
                                        </TouchableOpacity>
                                      </View>
                                    ))
                                  )}
                                  <View style={s.inlineAddRow}>
                                    <TextInput
                                      style={[s.mgmtSearchInput, { flex: 1 }]}
                                      value={svcStageNewName}
                                      onChangeText={setSvcStageNewName}
                                      placeholder={t('stageName')}
                                      placeholderTextColor={theme.color.textMuted}
                                    />
                                    <TouchableOpacity style={s.inlineAddBtn} onPress={() => handleAddSvcStage(sv.id)} disabled={savingNewSvcStage}>
                                      {savingNewSvcStage ? <ActivityIndicator color={theme.color.white} size="small" /> : <Text style={s.inlineAddBtnText}>＋</Text>}
                                    </TouchableOpacity>
                                  </View>
                                  {svcStageNewName.trim().length > 0 && ministries.filter((m) => m.name.toLowerCase().includes(svcStageNewName.toLowerCase())).length > 0 && (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
                                      {ministries.filter((m) => m.name.toLowerCase().includes(svcStageNewName.toLowerCase())).map((m) => (
                                        <TouchableOpacity key={m.id} style={s.inlinePill} onPress={() => handleAddExistingSvcStage(sv.id, m.id)}>
                                          <Text style={s.inlinePillText}>{m.name}</Text>
                                        </TouchableOpacity>
                                      ))}
                                    </ScrollView>
                                  )}
                                </>
                              )}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  ))}
                  {serviceSearch.trim() && filtered.length === 0 && (
                    <Text style={s.mgmtEmpty}>{t('noServicesMatch')}: "{serviceSearch}"</Text>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
