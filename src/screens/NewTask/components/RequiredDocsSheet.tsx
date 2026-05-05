// src/screens/NewTask/components/RequiredDocsSheet.tsx
//
// Bottom-sheet showing the chosen service's required-document checklist
// (with expandable sub-requirements per document) + inline +Add document
// + WhatsApp share. Phase 2 extraction from NewTaskScreen — biggest single
// JSX block in the screen.

import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  Modal, ScrollView, StyleSheet,
} from 'react-native';
import { theme } from '../../../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  t: (key: any) => string;

  // Header
  selectedService: { name: string } | null;

  // Loading + data
  loadingSheetDocs: boolean;
  sheetDocs: any[];
  sheetDocReqs: Record<string, any[]>;
  sheetExpandedId: string | null;
  setSheetExpandedId: (v: string | null) => void;

  // Inline +Add document form
  showAddDocForm: boolean;
  setShowAddDocForm: (v: boolean) => void;
  newDocTitle: string;
  setNewDocTitle: (v: string) => void;
  savingNewDoc: boolean;
  handleAddDocFromSheet: () => void;

  // WhatsApp share footer
  handleShareDocsWhatsApp: () => void;
}

export function RequiredDocsSheet(props: Props) {
  const {
    visible, onClose, t,
    selectedService,
    loadingSheetDocs, sheetDocs, sheetDocReqs,
    sheetExpandedId, setSheetExpandedId,
    showAddDocForm, setShowAddDocForm,
    newDocTitle, setNewDocTitle, savingNewDoc, handleAddDocFromSheet,
    handleShareDocsWhatsApp,
  } = props;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={ds.overlay}>
        <View style={ds.sheet}>
          {/* Header */}
          <View style={ds.header}>
            <View style={{ flex: 1 }}>
              <Text style={ds.title}>📋 {t('requiredDocs')}</Text>
              {selectedService && (
                <Text style={ds.subtitle}>{selectedService.name}</Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text style={ds.close}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Body */}
          {loadingSheetDocs ? (
            <ActivityIndicator color={theme.color.primary} style={{ margin: 32 }} />
          ) : (
            <ScrollView
              contentContainerStyle={{ padding: theme.spacing.space3 }}
              keyboardShouldPersistTaps="handled"
            >
              {sheetDocs.length === 0 ? (
                <Text style={ds.empty}>{t('noDocumentsForService')}</Text>
              ) : (
                sheetDocs.map((doc: any, idx: number) => {
                  const reqs = sheetDocReqs[doc.id] ?? [];
                  const isOpen = sheetExpandedId === doc.id;
                  return (
                    <View key={doc.id} style={ds.docCard}>
                      <TouchableOpacity
                        style={ds.docRow}
                        onPress={() => setSheetExpandedId(isOpen ? null : doc.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={ds.docNum}>{idx + 1}.</Text>
                        <Text style={ds.docTitle} numberOfLines={2}>{doc.title}</Text>
                        {reqs.length > 0 && (
                          <View style={ds.badge}>
                            <Text style={ds.badgeText}>{reqs.length}</Text>
                          </View>
                        )}
                        {reqs.length > 0 && (
                          <Text style={ds.arrow}>{isOpen ? '▼' : '▶'}</Text>
                        )}
                      </TouchableOpacity>
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
                })
              )}

              {/* Add new document — inline button + form */}
              {!showAddDocForm ? (
                <TouchableOpacity
                  style={ds.addDocBtn}
                  onPress={() => setShowAddDocForm(true)}
                >
                  <Text style={ds.addDocBtnText}>＋ {t('addDocument')}</Text>
                </TouchableOpacity>
              ) : (
                <View style={ds.addDocForm}>
                  <TextInput
                    style={ds.addDocInput}
                    value={newDocTitle}
                    onChangeText={setNewDocTitle}
                    placeholder={t('documentName')}
                    placeholderTextColor={theme.color.textMuted}
                    autoFocus
                  />
                  <View style={ds.addDocActions}>
                    <TouchableOpacity
                      style={ds.addDocCancelBtn}
                      onPress={() => { setShowAddDocForm(false); setNewDocTitle(''); }}
                    >
                      <Text style={ds.addDocCancelText}>{t('cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[ds.addDocSaveBtn, savingNewDoc && { opacity: 0.6 }]}
                      disabled={savingNewDoc}
                      onPress={handleAddDocFromSheet}
                    >
                      <Text style={ds.addDocSaveText}>
                        {savingNewDoc ? t('pleaseWait') : t('save')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          )}

          {/* WhatsApp share */}
          {sheetDocs.length > 0 && (
            <TouchableOpacity style={ds.waBtn} onPress={handleShareDocsWhatsApp}>
              <Text style={ds.waBtnText}>{t('whatsappShare')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const ds = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-start', paddingTop: 60 },
  sheet:     { backgroundColor: theme.color.bgSurface, borderBottomLeftRadius: theme.radius.xl, borderBottomRightRadius: theme.radius.xl, maxHeight: '75%', paddingBottom: theme.spacing.space4 },
  header:    { flexDirection: 'row', alignItems: 'flex-start', padding: theme.spacing.space4, borderBottomWidth: 1, borderBottomColor: theme.color.border },
  title:     { color: theme.color.textPrimary, fontSize: 17, fontWeight: '700' },
  subtitle:  { color: theme.color.textSecondary, fontSize: 13, marginTop: 2 },
  close:     { color: theme.color.textSecondary, fontSize: 20, padding: 4 },
  empty:     { color: theme.color.textMuted, padding: theme.spacing.space4, textAlign: 'center' },
  docCard:   { backgroundColor: theme.color.bgBase, borderRadius: theme.radius.md, marginBottom: theme.spacing.space2, borderWidth: 1, borderColor: theme.color.border, overflow: 'hidden' },
  docRow:    { flexDirection: 'row', alignItems: 'center', padding: theme.spacing.space3, gap: 8 },
  docNum:    { color: theme.color.textMuted, fontSize: 13, minWidth: 20, fontWeight: '600' },
  docTitle:  { flex: 1, color: theme.color.textPrimary, fontSize: 14, fontWeight: '600' },
  badge:     { backgroundColor: theme.color.primary + '33', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { color: theme.color.primaryText, fontSize: 10, fontWeight: '700' },
  arrow:     { color: theme.color.textMuted, fontSize: 11 },
  reqList:   { paddingHorizontal: theme.spacing.space3, paddingBottom: theme.spacing.space2, gap: 4 },
  reqRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  reqBullet: { color: theme.color.primary, fontSize: 16, lineHeight: 20 },
  reqTitle:  { flex: 1, color: theme.color.textSecondary, fontSize: 13, lineHeight: 20 },
  waBtn:     { margin: theme.spacing.space3, marginTop: theme.spacing.space2, backgroundColor: '#25D366', borderRadius: theme.radius.lg, paddingVertical: 13, alignItems: 'center' },
  waBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  addDocBtn: {
    marginTop: theme.spacing.space2,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.primary,
    backgroundColor: theme.color.primary + '11',
    alignItems: 'center',
  },
  addDocBtnText: {
    color: theme.color.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  addDocForm: {
    marginTop: theme.spacing.space2,
    padding: theme.spacing.space3,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.primary + '55',
    backgroundColor: theme.color.bgBase,
    gap: theme.spacing.space2,
  },
  addDocInput: {
    backgroundColor: theme.color.bgSurface,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.color.border,
    color: theme.color.textPrimary,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: theme.spacing.space2 + 2,
    fontSize: 14,
  },
  addDocActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.space2,
  },
  addDocCancelBtn: {
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: theme.spacing.space2,
    borderRadius: theme.radius.sm,
  },
  addDocCancelText: {
    color: theme.color.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  addDocSaveBtn: {
    paddingHorizontal: theme.spacing.space4,
    paddingVertical: theme.spacing.space2,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.color.primary,
  },
  addDocSaveText: {
    color: theme.color.white,
    fontSize: 13,
    fontWeight: '700',
  },
});
