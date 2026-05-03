// src/screens/TaskDetail/components/CommentsSection.tsx
//
// Comments + voice-notes section for the file-detail screen.
// Phase 2 extraction (parallel module — does not yet replace the monolith).

import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { theme } from '../../../theme';
import { useTranslation } from '../../../lib/i18n';
import { TaskComment, OrgPermissions } from '../../../types';

interface Props {
  comments: TaskComment[];
  permissions: OrgPermissions;
  newComment: string;
  setNewComment: (v: string) => void;
  postingComment: boolean;
  onPostComment: () => void;

  // Edit / delete
  editingCommentId: string | null;
  setEditingCommentId: (v: string | null) => void;
  editingCommentBody: string;
  setEditingCommentBody: (v: string) => void;
  savingEditComment: boolean;
  onSaveEditComment: () => void;
  onDeleteComment: (id: string) => void;

  // Voice notes
  isRecording: boolean;
  recordingDuration: number;
  recordedUri: string | null;
  uploadingVoice: boolean;
  isListening: boolean;
  voicePartial: string;
  playingCommentId: string | null;
  playbackPosition: number;
  playbackDuration: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onSendVoiceNote: () => void;
  onDiscardRecording: () => void;
  onStopListening: () => void;
  onPlayPause: (commentId: string, audioUrl: string) => void;

  // Helpers from parent
  formatDate: (iso: string) => string;
  fmtDuration: (seconds: number) => string;
}

export function CommentsSection({
  comments,
  permissions,
  newComment, setNewComment,
  postingComment, onPostComment,
  editingCommentId, setEditingCommentId,
  editingCommentBody, setEditingCommentBody,
  savingEditComment, onSaveEditComment,
  onDeleteComment,
  isRecording, recordingDuration, recordedUri, uploadingVoice,
  isListening, voicePartial,
  playingCommentId, playbackPosition, playbackDuration,
  onStartRecording, onStopRecording, onSendVoiceNote, onDiscardRecording,
  onStopListening, onPlayPause,
  formatDate, fmtDuration,
}: Props) {
  const { t } = useTranslation();

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{t('commentsSection').toUpperCase()}</Text>
      {comments.length === 0 && <Text style={s.emptyText}>{t('noComments')}</Text>}

      {comments.map((c) => (
        <View key={c.id} style={s.commentRow}>
          <View style={s.commentAvatar}>
            <Text style={s.commentAvatarText}>{(c.author?.name ?? '?').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <View style={s.commentHeader}>
              <Text style={s.commentAuthor}>{c.author?.name ?? t('unknown')}</Text>
              <Text style={s.commentTime}>{formatDate(c.created_at)}</Text>
              {editingCommentId !== c.id && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {permissions.can_add_comments && (
                    <TouchableOpacity onPress={() => { setEditingCommentId(c.id); setEditingCommentBody(c.body); }}>
                      <Text style={s.commentEditBtn}>✎</Text>
                    </TouchableOpacity>
                  )}
                  {permissions.can_delete_comments && (
                    <TouchableOpacity onPress={() => onDeleteComment(c.id)}>
                      <Text style={s.commentDeleteBtn}>🗑</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
            {editingCommentId === c.id ? (
              <View style={s.commentEditRow}>
                <TextInput
                  style={s.commentEditInput}
                  value={editingCommentBody}
                  onChangeText={setEditingCommentBody}
                  multiline
                  autoFocus
                  placeholderTextColor={theme.color.textMuted}
                />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  <TouchableOpacity style={s.commentSaveBtn} onPress={onSaveEditComment} disabled={savingEditComment}>
                    {savingEditComment
                      ? <ActivityIndicator size="small" color={theme.color.white} />
                      : <Text style={s.commentSaveBtnText}>{t('save')}</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={s.commentCancelBtn} onPress={() => { setEditingCommentId(null); setEditingCommentBody(''); }}>
                    <Text style={s.commentCancelBtnText}>{t('cancel')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : c.audio_url ? (
              <View style={s.voiceNotePlayer}>
                <TouchableOpacity style={s.voiceNotePlayBtn} onPress={() => onPlayPause(c.id, c.audio_url!)}>
                  <Text style={s.voiceNotePlayBtnText}>{playingCommentId === c.id ? '⏸' : '▶'}</Text>
                </TouchableOpacity>
                <View style={s.voiceNoteInfo}>
                  <View style={s.voiceNoteBar}>
                    {playingCommentId === c.id && playbackDuration > 0 ? (
                      <View style={[s.voiceNoteProgress, { width: `${(playbackPosition / playbackDuration) * 100}%` as any }]} />
                    ) : (
                      <View style={[s.voiceNoteProgress, { width: '0%' as any }]} />
                    )}
                  </View>
                  <Text style={s.voiceNoteDuration}>
                    {playingCommentId === c.id && playbackDuration > 0
                      ? `${fmtDuration(Math.floor(playbackPosition / 1000))} / ${fmtDuration(Math.floor(playbackDuration / 1000))}`
                      : t('voiceNote')}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={s.commentBody}>{c.body}</Text>
            )}
          </View>
        </View>
      ))}

      {isRecording && (
        <View style={s.recordingBar}>
          <View style={s.recordingDot} />
          <Text style={s.recordingText}>{t('recording')} {fmtDuration(recordingDuration)}</Text>
          <TouchableOpacity style={s.recordingStopBtn} onPress={onStopRecording}>
            <Text style={s.recordingStopBtnText}>⏹</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isRecording && !isListening && recordedUri && (
        <View style={s.voicePreviewBar}>
          <Text style={s.voicePreviewLabel}>🎤 {fmtDuration(recordingDuration)}</Text>
          <TouchableOpacity
            style={[s.commentSendBtn, { backgroundColor: theme.color.success }]}
            onPress={onSendVoiceNote} disabled={uploadingVoice}
          >
            {uploadingVoice
              ? <ActivityIndicator color={theme.color.white} size="small" />
              : <Text style={s.commentSendBtnText}>{t('save')}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={s.voiceDiscardBtn} onPress={onDiscardRecording} disabled={uploadingVoice}>
            <Text style={s.voiceDiscardBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {isListening && (
        <View style={s.voicePreviewBar}>
          <ActivityIndicator color={theme.color.primary} size="small" />
          <Text style={[s.voicePreviewLabel, { flex: 1 }]}>
            {voicePartial || `🎤 ${t('recording')}`}
          </Text>
          <TouchableOpacity style={s.voiceDiscardBtn} onPress={onStopListening}>
            <Text style={s.voiceDiscardBtnText}>⏹</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isRecording && !recordedUri && !isListening && permissions.can_add_comments && (
        <View style={s.commentInput}>
          <TextInput
            style={s.commentTextInput}
            value={newComment}
            onChangeText={setNewComment}
            placeholder={t('addComment')}
            placeholderTextColor={theme.color.textMuted}
            multiline
          />
          <TouchableOpacity style={s.micBtn} onPress={onStartRecording}>
            <Text style={s.micBtnText}>🎙</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.commentSendBtn, postingComment && s.disabledBtn]}
            onPress={onPostComment} disabled={postingComment}
          >
            {postingComment
              ? <ActivityIndicator color={theme.color.white} size="small" />
              : <Text style={s.commentSendBtnText}>{t('send')}</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginHorizontal: theme.spacing.space4, marginBottom: theme.spacing.space4 },
  sectionTitle: { ...theme.typography.label, color: theme.color.textMuted, fontWeight: '700', fontSize: 11, letterSpacing: 0.5, marginBottom: theme.spacing.space2 },
  emptyText: { ...theme.typography.body, color: theme.color.textMuted, fontStyle: 'italic' },
  commentRow: { flexDirection: 'row', gap: 10, paddingVertical: theme.spacing.space2 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.color.primary, alignItems: 'center', justifyContent: 'center' },
  commentAvatarText: { color: theme.color.white, fontWeight: '700', fontSize: 13 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentAuthor: { fontWeight: '700', fontSize: 13, color: theme.color.textPrimary },
  commentTime: { fontSize: 11, color: theme.color.textMuted, flex: 1 },
  commentEditBtn: { fontSize: 14, color: theme.color.primary },
  commentDeleteBtn: { fontSize: 14, color: theme.color.danger },
  commentBody: { ...theme.typography.body, color: theme.color.textSecondary, lineHeight: 20 },
  commentEditRow: { gap: 4 },
  commentEditInput: { borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.sm, padding: 8, color: theme.color.textPrimary, minHeight: 60 },
  commentSaveBtn: { backgroundColor: theme.color.primary, paddingHorizontal: 14, paddingVertical: 6, borderRadius: theme.radius.sm },
  commentSaveBtnText: { color: theme.color.white, fontWeight: '700', fontSize: 13 },
  commentCancelBtn: { paddingHorizontal: 14, paddingVertical: 6 },
  commentCancelBtnText: { color: theme.color.textMuted, fontSize: 13 },
  voiceNotePlayer: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, backgroundColor: theme.color.bgBase, borderRadius: theme.radius.sm },
  voiceNotePlayBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.color.primary, alignItems: 'center', justifyContent: 'center' },
  voiceNotePlayBtnText: { color: theme.color.white, fontSize: 14 },
  voiceNoteInfo: { flex: 1, gap: 4 },
  voiceNoteBar: { height: 4, backgroundColor: theme.color.border, borderRadius: 2, overflow: 'hidden' },
  voiceNoteProgress: { height: 4, backgroundColor: theme.color.primary },
  voiceNoteDuration: { fontSize: 11, color: theme.color.textMuted },
  recordingBar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, backgroundColor: theme.color.danger + '11', borderRadius: theme.radius.sm },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.color.danger },
  recordingText: { color: theme.color.danger, fontWeight: '700', fontSize: 13, flex: 1 },
  recordingStopBtn: { paddingHorizontal: 10 },
  recordingStopBtnText: { color: theme.color.danger, fontWeight: '700' },
  voicePreviewBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, backgroundColor: theme.color.bgBase, borderRadius: theme.radius.sm },
  voicePreviewLabel: { color: theme.color.textPrimary, fontSize: 13 },
  voiceDiscardBtn: { paddingHorizontal: 8 },
  voiceDiscardBtnText: { color: theme.color.danger, fontSize: 16 },
  commentInput: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: theme.spacing.space2 },
  commentTextInput: { flex: 1, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.sm, paddingHorizontal: 10, paddingVertical: 8, color: theme.color.textPrimary, maxHeight: 80 },
  micBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.color.bgBase, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.color.border },
  micBtnText: { fontSize: 16 },
  commentSendBtn: { backgroundColor: theme.color.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.sm },
  commentSendBtnText: { color: theme.color.white, fontWeight: '700', fontSize: 13 },
  disabledBtn: { opacity: 0.5 },
});
