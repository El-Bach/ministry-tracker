// src/screens/TaskDetail/components/DocumentsSection.tsx
//
// Documents list + scan/library/PDF buttons + per-row rename/delete.
// Phase 2 extraction (parallel module).

import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { theme } from '../../../theme';
import { useTranslation } from '../../../lib/i18n';
import { OrgPermissions } from '../../../types';

export interface TaskDocumentLite {
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

interface Props {
  documents: TaskDocumentLite[];
  permissions: OrgPermissions;
  uploadingPdf: boolean;
  deletingDocId: string | null;
  onScanCamera: () => void;
  onScanLibrary: () => void;
  onPickPdf: () => void;
  onOpenDoc: (doc: TaskDocumentLite) => void;
  onRenameDoc: (doc: TaskDocumentLite) => void;
  onDeleteDoc: (doc: TaskDocumentLite) => void;
  formatDate: (iso: string) => string;
}

export function DocumentsSection({
  documents, permissions,
  uploadingPdf, deletingDocId,
  onScanCamera, onScanLibrary, onPickPdf,
  onOpenDoc, onRenameDoc, onDeleteDoc,
  formatDate,
}: Props) {
  const { t } = useTranslation();

  const renderActionButtons = () => (
    <View style={s.docBtnRow}>
      <TouchableOpacity style={s.scanDocBtn} onPress={onScanCamera}>
        <Text style={s.scanDocBtnText}>{t('scanDoc')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.addDocBtn} onPress={onScanLibrary}>
        <Text style={s.addDocBtnText}>{t('addImage')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.pdfDocBtn} onPress={onPickPdf} disabled={uploadingPdf}>
        {uploadingPdf
          ? <ActivityIndicator size="small" color={theme.color.white} />
          : <Text style={s.pdfDocBtnText}>{t('addPDF')}</Text>}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={s.section}>
      <View style={s.sectionTitleRow}>
        <Text style={s.sectionTitle}>{t('documentsSection').toUpperCase()} ({documents.length})</Text>
        {permissions.can_upload_documents && renderActionButtons()}
      </View>

      {documents.length === 0 ? (
        <View style={s.docEmpty}>
          <Text style={s.docEmptyIcon}>📄</Text>
          <Text style={s.docEmptyText}>{t('noDocuments')}</Text>
        </View>
      ) : (
        documents.map((doc) => {
          const isPDF   = /application\/pdf/i.test(doc.file_type) || /\.pdf$/i.test(doc.file_url);
          const isImage = /image\//i.test(doc.file_type) || /\.(jpg|jpeg|png)$/i.test(doc.file_url);
          const label   = doc.display_name || doc.file_name;
          return (
            <View key={doc.id} style={s.docRow}>
              <View style={s.docRowIcon}>
                <Text style={s.docRowIconText}>{isPDF ? '📄' : '🖼'}</Text>
              </View>

              <TouchableOpacity style={{ flex: 1, gap: 3 }} onPress={() => onOpenDoc(doc)} activeOpacity={0.7}>
                <Text style={[s.docRowName, s.docRowNameTappable]} numberOfLines={1}>{label}</Text>
                {doc.requirement?.title && (
                  <View style={s.docReqTag}>
                    <Text style={s.docReqTagText}>📋 {doc.requirement.title}</Text>
                  </View>
                )}
                <Text style={s.docRowMeta}>
                  {isPDF ? 'PDF' : isImage ? t('document') : t('document')}
                  {doc.uploader?.name ? `  ·  ${doc.uploader.name}` : ''}
                  {`  ·  ${formatDate(doc.created_at)}`}
                </Text>
              </TouchableOpacity>

              <View style={s.docActionBtns}>
                {permissions.can_upload_documents && (
                  <TouchableOpacity
                    onPress={() => onRenameDoc(doc)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={s.docRenameBtn}
                  >
                    <Text style={s.docRenameBtnText}>✎</Text>
                  </TouchableOpacity>
                )}
                {permissions.can_delete_documents && (deletingDocId === doc.id ? (
                  <ActivityIndicator size="small" color={theme.color.danger} />
                ) : (
                  <TouchableOpacity
                    onPress={() => onDeleteDoc(doc)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={s.docDeleteBtn}
                  >
                    <Text style={s.docDeleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginHorizontal: theme.spacing.space4, marginBottom: theme.spacing.space4 },
  sectionTitle: { ...theme.typography.label, color: theme.color.textMuted, fontWeight: '700', fontSize: 11, letterSpacing: 0.5 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.space2 },
  docBtnRow: { flexDirection: 'row', gap: 6 },
  scanDocBtn: { backgroundColor: theme.color.primary + '22', paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.sm },
  scanDocBtnText: { color: theme.color.primary, fontSize: 12, fontWeight: '700' },
  addDocBtn: { backgroundColor: theme.color.bgBase, paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.color.border },
  addDocBtnText: { color: theme.color.textPrimary, fontSize: 12, fontWeight: '600' },
  pdfDocBtn: { backgroundColor: theme.color.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.sm },
  pdfDocBtnText: { color: theme.color.white, fontSize: 12, fontWeight: '700' },
  docEmpty: { alignItems: 'center', padding: theme.spacing.space5, gap: 8 },
  docEmptyIcon: { fontSize: 36, opacity: 0.5 },
  docEmptyText: { color: theme.color.textMuted, fontSize: 14 },
  docEmptyBtnRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, backgroundColor: theme.color.bgBase, borderRadius: theme.radius.sm, marginBottom: 6 },
  docRowIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  docRowIconText: { fontSize: 18 },
  docRowName: { ...theme.typography.body, color: theme.color.textPrimary, fontWeight: '600' },
  docRowNameTappable: { color: theme.color.primary },
  docReqTag: { alignSelf: 'flex-start', backgroundColor: theme.color.primary + '11', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  docReqTagText: { color: theme.color.primary, fontSize: 11, fontWeight: '600' },
  docRowMeta: { fontSize: 11, color: theme.color.textMuted },
  docActionBtns: { flexDirection: 'row', gap: 8 },
  docRenameBtn: { padding: 4 },
  docRenameBtnText: { fontSize: 16, color: theme.color.primary },
  docDeleteBtn: { padding: 4 },
  docDeleteBtnText: { fontSize: 16 },
});
