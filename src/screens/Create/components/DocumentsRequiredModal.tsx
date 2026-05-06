// src/screens/Create/components/DocumentsRequiredModal.tsx
//
// Manage > Documents Required modal: per-service expandable card showing the
// document checklist + per-document expandable sub-requirements panel +
// Excel-paste import + WhatsApp share. Phase 4 extraction — biggest single
// modal lift in the CreateScreen split.

import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  Modal, ScrollView,
} from 'react-native';
import { theme } from '../../../theme';
import { s } from '../styles/createStyles';
import { Service, ServiceDocument } from '../../../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  t: (key: any) => string;

  // Data
  services: Service[];
  serviceDocs: Record<string, ServiceDocument[]>;
  docReqs: Record<string, any[]>;

  // Search
  docSearch: string;
  setDocSearch: (v: string) => void;

  // Service-card expand
  expandedDocSvcId: string | null;
  setExpandedDocSvcId: (v: string | null) => void;
  handleToggleDocExpand: (serviceId: string) => void;

  // Add document inline
  newDocTitle: string;
  setNewDocTitle: (v: string) => void;
  savingDoc: boolean;
  handleAddDoc: (serviceId: string) => void;
  handleToggleDocCheck: (doc: ServiceDocument) => void;
  handleDeleteDoc: (doc: ServiceDocument) => void;
  handleResetChecks: (serviceId: string) => void;
  handleShareServiceDocsWhatsApp: (svcName: string, docs: any[]) => void;

  // Sub-requirements
  expandedDocReqId: string | null;
  loadingDocReqs: string | null;
  docReqNewTitle: string;
  setDocReqNewTitle: (v: string) => void;
  savingDocReq: boolean;
  handleToggleDocReqExpand: (docId: string) => void;
  handleAddDocReq: (docId: string) => void;
  handleDeleteDocReq: (docId: string, reqId: string) => void;

  // Excel import (per-service)
  docImportSvcId: string | null;
  setDocImportSvcId: (v: string | null) => void;
  docImportRaw: string;
  setDocImportRaw: (v: string) => void;
  docImportTitles: string[];
  setDocImportTitles: (v: string[]) => void;
  importingDocs: boolean;
  parseDocImport: (raw: string) => string[];
  handleImportDocs: () => void;

}

export function DocumentsRequiredModal(props: Props) {
  const {
    visible, onClose, t,
    services, serviceDocs, docReqs,
    docSearch, setDocSearch,
    expandedDocSvcId, setExpandedDocSvcId, handleToggleDocExpand,
    newDocTitle, setNewDocTitle, savingDoc,
    handleAddDoc, handleToggleDocCheck, handleDeleteDoc, handleResetChecks,
    handleShareServiceDocsWhatsApp,
    expandedDocReqId, loadingDocReqs,
    docReqNewTitle, setDocReqNewTitle, savingDocReq,
    handleToggleDocReqExpand, handleAddDocReq, handleDeleteDocReq,
    docImportSvcId, setDocImportSvcId,
    docImportRaw, setDocImportRaw,
    docImportTitles, setDocImportTitles,
    importingDocs, parseDocImport, handleImportDocs,
  } = props;

  const visibleServices = services.filter((sv) =>
    !docSearch.trim() || sv.name.toLowerCase().includes(docSearch.toLowerCase()),
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => { onClose(); setExpandedDocSvcId(null); setDocSearch(''); }}
    >
      <View style={s.modalOverlay}>
        <View style={[s.modalSheet, { flex: 1, marginTop: 60 }]}>
          <View style={s.modalHeader}>
            <View>
              <Text style={s.modalTitle}>📋 {t('requiredDocs')}</Text>
              <Text style={s.modalSubtitle}>
                {docSearch.trim()
                  ? `${visibleServices.length} of ${services.length} services`
                  : `${services.length} services`}
              </Text>
            </View>
            <TouchableOpacity onPress={() => { onClose(); setExpandedDocSvcId(null); setDocSearch(''); }}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={s.mgmtSearchRow}>
            <TextInput
              style={s.mgmtSearchInput}
              value={docSearch}
              onChangeText={setDocSearch}
              placeholder={t('searchService')}
              placeholderTextColor={theme.color.textMuted}
              clearButtonMode="while-editing"
              autoCorrect={false}
            />
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: theme.spacing.space3 }} keyboardShouldPersistTaps="handled">
            {services.length === 0 && <Text style={s.mgmtEmpty}>{t('noServices')}</Text>}
            {docSearch.trim() && visibleServices.length === 0 && (
              <Text style={s.mgmtEmpty}>{t('noServicesMatch')}: "{docSearch}"</Text>
            )}
            {visibleServices.map((svc) => {
              const docs = serviceDocs[svc.id] ?? [];
              const checkedCount = docs.filter((d: ServiceDocument) => d.is_checked).length;
              const isExpanded = expandedDocSvcId === svc.id;
              return (
                <View key={svc.id} style={s.docSvcCard}>
                  {/* Service header row */}
                  <TouchableOpacity style={s.docSvcRow} onPress={() => handleToggleDocExpand(svc.id)} activeOpacity={0.7}>
                    <Text style={s.docSvcName}>{svc.name}</Text>
                    {docs.length > 0 && (
                      <Text style={s.docSvcBadge}>{checkedCount}/{docs.length} ✓</Text>
                    )}
                    <Text style={s.docSvcArrow}>{isExpanded ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                  {/* Expanded document list */}
                  {isExpanded && (
                    <View style={s.docListPanel}>
                      {docs.length === 0 && <Text style={s.docEmpty}>{t('noDocsAddedYet')}</Text>}
                      {docs.map((doc, idx) => {
                        const subreqs = docReqs[doc.id] ?? [];
                        const isReqOpen = expandedDocReqId === doc.id;
                        return (
                          <View key={doc.id}>
                            {/* ── Main document row ── */}
                            <View style={s.docRow}>
                              <Text style={s.docNumber}>{idx + 1}.</Text>
                              <TouchableOpacity onPress={() => handleToggleDocCheck(doc)} activeOpacity={0.7}>
                                <Text style={[s.docCheck, doc.is_checked && s.docCheckDone]}>
                                  {doc.is_checked ? '☑' : '☐'}
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={{ flex: 1 }} onPress={() => handleToggleDocCheck(doc)} activeOpacity={0.7}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <Text style={[s.docTitle, doc.is_checked && s.docTitleDone]} numberOfLines={2}>
                                    {doc.title}
                                  </Text>
                                  {subreqs.length > 0 && (
                                    <View style={s.docReqBadge}>
                                      <Text style={s.docReqBadgeText}>{subreqs.length}</Text>
                                    </View>
                                  )}
                                </View>
                              </TouchableOpacity>
                              {/* Expand toggle for sub-requirements */}
                              <TouchableOpacity
                                onPress={() => handleToggleDocReqExpand(doc.id)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={{ paddingHorizontal: 4 }}
                              >
                                <Text style={{ color: theme.color.textMuted, fontSize: 11 }}>
                                  {isReqOpen ? '▼' : '▶'}
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => handleDeleteDoc(doc)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Text style={s.docDelete}>✕</Text>
                              </TouchableOpacity>
                            </View>
                            {/* ── Sub-requirements panel ── */}
                            {isReqOpen && (
                              <View style={s.docReqPanel}>
                                {loadingDocReqs === doc.id ? (
                                  <ActivityIndicator color={theme.color.primary} style={{ margin: 8 }} />
                                ) : (
                                  <>
                                    {subreqs.length === 0 && (
                                      <Text style={s.docReqEmpty}>{t('noSubReqYet')}</Text>
                                    )}
                                    {subreqs.map((req: any) => (
                                      <View key={req.id} style={s.docSubReqRow}>
                                        <Text style={s.docSubReqBullet}>•</Text>
                                        <Text style={s.docSubReqTitle}>{req.title}</Text>
                                        <TouchableOpacity
                                          onPress={() => handleDeleteDocReq(doc.id, req.id)}
                                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                          <Text style={s.docDelete}>✕</Text>
                                        </TouchableOpacity>
                                      </View>
                                    ))}
                                    {/* Add sub-req input */}
                                    <View style={s.docAddRow}>
                                      <TextInput
                                        style={s.docAddInput}
                                        value={isReqOpen ? docReqNewTitle : ''}
                                        onChangeText={setDocReqNewTitle}
                                        placeholder={t('addRequirement')}
                                        placeholderTextColor={theme.color.textMuted}
                                        returnKeyType="done"
                                        onSubmitEditing={() => handleAddDocReq(doc.id)}
                                      />
                                      <TouchableOpacity
                                        style={[s.docAddBtn, (!docReqNewTitle.trim() || savingDocReq) && { opacity: 0.5 }]}
                                        onPress={() => handleAddDocReq(doc.id)}
                                        disabled={savingDocReq || !docReqNewTitle.trim()}
                                      >
                                        {savingDocReq
                                          ? <ActivityIndicator size="small" color={theme.color.white} />
                                          : <Text style={s.docAddBtnText}>＋</Text>}
                                      </TouchableOpacity>
                                    </View>
                                  </>
                                )}
                              </View>
                            )}
                          </View>
                        );
                      })}
                      {/* Add document inline */}
                      <View style={s.docAddRow}>
                        <TextInput
                          style={s.docAddInput}
                          value={expandedDocSvcId === svc.id ? newDocTitle : ''}
                          onChangeText={setNewDocTitle}
                          placeholder={t('addDocument')}
                          placeholderTextColor={theme.color.textMuted}
                        />
                        <TouchableOpacity style={s.docAddBtn} onPress={() => handleAddDoc(svc.id)} disabled={savingDoc || !newDocTitle.trim()}>
                          {savingDoc ? <ActivityIndicator size="small" color={theme.color.white} /> : <Text style={s.docAddBtnText}>＋</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={s.docImportToggleBtn}
                          onPress={() => {
                            if (docImportSvcId === svc.id) {
                              setDocImportSvcId(null); setDocImportRaw(''); setDocImportTitles([]);
                            } else {
                              setDocImportSvcId(svc.id); setDocImportRaw(''); setDocImportTitles([]);
                            }
                          }}
                        >
                          <Text style={s.docImportToggleBtnText}>📥</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.docImportToggleBtn, { backgroundColor: '#25D366' }]}
                          onPress={() => handleShareServiceDocsWhatsApp(svc.name, docs)}
                          disabled={docs.length === 0}
                        >
                          <Text style={s.docImportToggleBtnText}>💬</Text>
                        </TouchableOpacity>
                      </View>
                      {/* Excel import panel */}
                      {docImportSvcId === svc.id && (
                        <View style={s.docImportPanel}>
                          <Text style={s.docImportLabel}>{t('importBtn')} ({t('documentName')})</Text>
                          <TextInput
                            style={s.docImportTextArea}
                            value={docImportRaw}
                            onChangeText={(txt) => { setDocImportRaw(txt); setDocImportTitles([]); }}
                            placeholder={t('paste')}
                            placeholderTextColor={theme.color.textMuted}
                            multiline
                            textAlignVertical="top"
                          />
                          {docImportTitles.length === 0 ? (
                            <TouchableOpacity
                              style={s.docImportPreviewBtn}
                              onPress={() => setDocImportTitles(parseDocImport(docImportRaw))}
                              disabled={!docImportRaw.trim()}
                            >
                              <Text style={s.docImportPreviewBtnText}>{t('preview')}</Text>
                            </TouchableOpacity>
                          ) : (
                            <>
                              {docImportTitles.map((title, i) => (
                                <View key={i} style={s.docImportPreviewRow}>
                                  <Text style={s.docCheck}>☐</Text>
                                  <Text style={s.docImportPreviewTitle} numberOfLines={1}>{title}</Text>
                                </View>
                              ))}
                              <TouchableOpacity
                                style={s.docImportConfirmBtn}
                                onPress={handleImportDocs}
                                disabled={importingDocs}
                              >
                                {importingDocs
                                  ? <ActivityIndicator size="small" color={theme.color.white} />
                                  : <Text style={s.docImportConfirmBtnText}>{t('importBtn')} {docImportTitles.length} {t('document')}{docImportTitles.length !== 1 ? 's' : ''}</Text>}
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                      )}
                      {/* Reset checks */}
                      {checkedCount > 0 && (
                        <TouchableOpacity style={s.docResetBtn} onPress={() => handleResetChecks(svc.id)}>
                          <Text style={s.docResetBtnText}>↺ Reset all checks</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
