// src/components/DocumentScannerModal.tsx
// Native-first document scanner: VisionKit (iOS) · ML Kit (Android)
// Library picker fallback for all platforms (🖼 Image button)

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
  TextInput,
  ScrollView,
  Dimensions,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import supabase from '../lib/supabase';
import { theme } from '../theme';

// Load native document scanner only on native platforms (VisionKit / ML Kit)
// On web, scanner is unavailable — library picker is still functional
const DocumentScanner: any =
  Platform.OS !== 'web'
    ? require('react-native-document-scanner-plugin').default
    : null;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const A4_RATIO = 297 / 210; // height / width

interface ReqItem { id: string; title: string; stopName: string; }

interface Props {
  visible:    boolean;
  taskId:     string;
  uploadedBy?: string;
  /** 'camera' → native document scanner  |  'library' → image picker */
  startMode?: 'camera' | 'library';
  onClose:   () => void;
  onSuccess: () => void;
}

type Step = 'launching' | 'preview' | 'processing';

export default function DocumentScannerModal({
  visible, taskId, uploadedBy, startMode = 'camera', onClose, onSuccess,
}: Props) {
  const [step, setStep]                       = useState<Step>('launching');
  const [capturedUri, setCapturedUri]         = useState<string | null>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState(A4_RATIO);
  const [displayName, setDisplayName]         = useState('');
  const [statusText, setStatusText]           = useState('');

  const [requirements, setRequirements]       = useState<ReqItem[]>([]);
  const [selectedReqId, setSelectedReqId]     = useState<string | null>(null);
  const [showReqPicker, setShowReqPicker]     = useState(false);

  const sourceRef = useRef<'camera' | 'library'>('camera');

  // ─── Requirements loader ─────────────────────────────────────────────────────
  const loadRequirements = useCallback(async () => {
    try {
      const { data: stops } = await supabase
        .from('task_route_stops')
        .select('id, ministry:ministries(name)')
        .eq('task_id', taskId);
      if (!stops?.length) return;
      const stopIds = stops.map((s: any) => s.id);
      const { data: reqs } = await supabase
        .from('stop_requirements')
        .select('id, title, stop_id')
        .in('stop_id', stopIds)
        .order('sort_order', { ascending: true });
      if (!reqs) return;
      const nameMap: Record<string, string> = {};
      for (const s of stops as any[]) nameMap[s.id] = s.ministry?.name ?? 'Stage';
      setRequirements(reqs.map((r: any) => ({
        id: r.id, title: r.title, stopName: nameMap[r.stop_id] ?? 'Stage',
      })));
    } catch { /* ignore */ }
  }, [taskId]);

  useEffect(() => {
    if (!visible) return;
    loadRequirements();
    if (startMode === 'camera') {
      handleScanNative();
    } else {
      handlePickLibrary();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Reset / close ───────────────────────────────────────────────────────────
  function reset() {
    setCapturedUri(null);
    setDisplayName('');
    setSelectedReqId(null);
    setStatusText('');
    setStep('launching');
    setImageAspectRatio(A4_RATIO);
  }
  function handleClose() { reset(); onClose(); }

  function autoName(source: 'camera' | 'library') {
    const t  = new Date();
    const dd = t.getDate().toString().padStart(2, '0');
    const mm = (t.getMonth() + 1).toString().padStart(2, '0');
    const yy = t.getFullYear();
    return `${source === 'library' ? 'Upload' : 'Scan'} ${dd}-${mm}-${yy}`;
  }

  // ─── Native document scanner (VisionKit / ML Kit) ───────────────────────────
  // iOS:     VNDocumentCameraViewController — auto edge detection, perspective warp
  // Android: Google ML Kit Document Scanner (play-services-mlkit-document-scanner)
  async function handleScanNative() {
    if (!DocumentScanner) {
      // Web: no native scanner available
      Alert.alert(
        'Scanner unavailable',
        'Document scanning requires the mobile app.\nUse "🖼 Image" to upload a photo instead.',
        [{ text: 'OK', onPress: handleClose }],
      );
      return;
    }
    try {
      const { scannedImages, status } = await DocumentScanner.scanDocument({
        croppedImageQuality: 100,
        maxNumDocuments:     1,
        responseType:        'imageFilePath',
      });

      if (status === 'cancel' || !scannedImages?.length) {
        handleClose();
        return;
      }

      const uri = scannedImages[0] as string;
      sourceRef.current = 'camera';

      // Compute aspect ratio from the returned image
      await new Promise<void>((resolve) => {
        Image.getSize(
          uri,
          (w, h) => { setImageAspectRatio(w > 0 && h > 0 ? h / w : A4_RATIO); resolve(); },
          ()      => { resolve(); },
        );
      });

      setCapturedUri(uri);
      setDisplayName(autoName('camera'));
      setStep('preview');
    } catch (e: any) {
      // Module not linked or other native error
      Alert.alert(
        'Scanner error',
        'Could not open document scanner. ' + (e?.message ?? ''),
        [{ text: 'OK', onPress: handleClose }],
      );
    }
  }

  // ─── Library picker (all platforms) ─────────────────────────────────────────
  async function handlePickLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photo library.');
      handleClose();
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality:       0.95,
      mediaTypes:    ImagePicker.MediaTypeOptions.Images,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      sourceRef.current = 'library';
      setCapturedUri(asset.uri);
      setImageAspectRatio(asset.width > 0 && asset.height > 0
        ? asset.height / asset.width
        : A4_RATIO);
      setDisplayName(autoName('library'));
      setStep('preview');
    } else {
      handleClose();
    }
  }

  // ─── Upload + save ───────────────────────────────────────────────────────────
  async function handleSave() {
    if (!capturedUri) return;
    const docName = displayName.trim() || `Document_${Date.now()}`;
    setStep('processing');

    try {
      setStatusText('Uploading...');
      const fileName  = `${docName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.jpg`;
      const filePath  = `documents/${taskId}/${fileName}`;

      if (Platform.OS === 'web') {
        const response = await fetch(capturedUri);
        const blob     = await response.blob();
        const { error: uploadError } = await supabase.storage
          .from('task-attachments')
          .upload(filePath, blob, { contentType: 'image/jpeg', upsert: false });
        if (uploadError) throw uploadError;
      } else {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkYnFqemlmamtmZGJ3aGxxbHh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NjY2NzMsImV4cCI6MjA5MTA0MjY3M30.tmxI6cC8mNSYSQPcXIKuoPu8CgAcgdd3jQxEGsyiBKI';
        const uploadUrl = `https://fdbqjzifjkfdbwhlqlxt.supabase.co/storage/v1/object/task-attachments/${filePath}`;
        const uploadResult = await FileSystem.uploadAsync(uploadUrl, capturedUri, {
          httpMethod:  'POST',
          uploadType:  FileSystem.FileSystemUploadType.MULTIPART,
          fieldName:   'file',
          mimeType:    'image/jpeg',
          headers: {
            'apikey':        ANON_KEY,
            'Authorization': `Bearer ${accessToken ?? ANON_KEY}`,
          },
        });
        if (uploadResult.status < 200 || uploadResult.status >= 300) {
          throw new Error(`Upload failed (${uploadResult.status}): ${uploadResult.body}`);
        }
      }

      const { data: urlData } = supabase.storage
        .from('task-attachments')
        .getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      const { error: dbError } = await supabase.from('task_documents').insert({
        task_id:        taskId,
        file_name:      docName,
        file_url:       publicUrl,
        file_type:      'image/jpeg',
        uploaded_by:    uploadedBy ?? null,
        requirement_id: selectedReqId ?? null,
        display_name:   docName,
      });
      if (dbError) throw dbError;

      if (selectedReqId) {
        await supabase.from('stop_requirements')
          .update({
            attachment_url:  publicUrl,
            attachment_name: `${docName}.jpg`,
            updated_at:      new Date().toISOString(),
          })
          .eq('id', selectedReqId);
      }

      reset();
      onSuccess();
    } catch (e: any) {
      setStep('preview');
      setStatusText('');
      Alert.alert('Failed', e.message ?? 'Could not save document.');
    }
  }

  // ─── Derived ─────────────────────────────────────────────────────────────────
  const selectedReq  = requirements.find(r => r.id === selectedReqId);
  const containerW   = SCREEN_W - 32;
  const containerH   = Math.min(containerW * imageAspectRatio, SCREEN_H * 0.55);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>

      {/* ── LAUNCHING — shown while native scanner / picker is open ── */}
      {step === 'launching' && (
        <View style={s.fullCenter}>
          <ActivityIndicator size="large" color={theme.color.primary} />
          <Text style={s.processingText}>
            {startMode === 'camera' ? 'Opening scanner…' : 'Opening library…'}
          </Text>
          <TouchableOpacity onPress={handleClose} style={{ marginTop: 24 }}>
            <Text style={{ color: theme.color.textSecondary, fontSize: theme.typography.body.fontSize }}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── PREVIEW ── */}
      {step === 'preview' && capturedUri && (
        <View style={s.previewScreen}>
          {/* Header */}
          <View style={s.previewHeader}>
            <TouchableOpacity onPress={handleClose} style={s.backBtn}>
              <Text style={s.backBtnText}>✕ Cancel</Text>
            </TouchableOpacity>
            <Text style={s.previewHeaderTitle}>
              {sourceRef.current === 'camera' ? 'Scan Preview' : 'Upload Preview'}
            </Text>
            <View style={{ width: 80 }} />
          </View>

          <KeyboardAwareScrollView
            contentContainerStyle={s.previewScroll}
            keyboardShouldPersistTaps="handled"
            enableOnAndroid={true}
            enableAutomaticScroll={true}
            extraScrollHeight={80}
          >
            {/* Image */}
            <View style={[s.previewImageWrap, { height: containerH }]}>
              <Image
                source={{ uri: capturedUri }}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
              />
            </View>

            {/* Document name */}
            <Text style={s.fieldLabel}>DOCUMENT NAME</Text>
            <TextInput
              style={s.nameInput}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Document name"
              placeholderTextColor={theme.color.textMuted}
              returnKeyType="done"
            />

            {/* Requirement linker */}
            {requirements.length > 0 && (
              <>
                <Text style={s.fieldLabel}>
                  LINK TO REQUIREMENT <Text style={s.optionalTag}>(optional)</Text>
                </Text>
                <TouchableOpacity
                  style={s.reqPickerBtn}
                  onPress={() => setShowReqPicker(true)}
                >
                  <Text style={s.reqPickerBtnIcon}>📋</Text>
                  <Text
                    style={[s.reqPickerBtnText, !!selectedReqId && s.reqPickerBtnTextSelected]}
                    numberOfLines={1}
                  >
                    {selectedReq
                      ? `${selectedReq.stopName} › ${selectedReq.title}`
                      : 'Select a requirement...'}
                  </Text>
                  {selectedReqId ? (
                    <TouchableOpacity
                      onPress={(e) => { e.stopPropagation(); setSelectedReqId(null); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={s.reqClearBtn}>✕</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={s.reqPickerArrow}>▼</Text>
                  )}
                </TouchableOpacity>
                {selectedReq && (
                  <Text style={s.reqLinkedHint}>
                    This document will be attached to the requirement.
                  </Text>
                )}
              </>
            )}

            {/* Save */}
            <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
              <Text style={s.saveBtnText}>
                {sourceRef.current === 'camera' ? 'Save Scan' : 'Upload Document'}
              </Text>
            </TouchableOpacity>
            <View style={{ height: 32 }} />
          </KeyboardAwareScrollView>
        </View>
      )}

      {/* ── PROCESSING ── */}
      {step === 'processing' && (
        <View style={s.fullCenter}>
          <ActivityIndicator size="large" color={theme.color.primary} />
          <Text style={s.processingText}>{statusText || 'Saving…'}</Text>
        </View>
      )}

      {/* ── REQUIREMENT PICKER SHEET ── */}
      <Modal
        visible={showReqPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReqPicker(false)}
      >
        <TouchableOpacity
          style={s.reqPickerOverlay}
          activeOpacity={1}
          onPress={() => setShowReqPicker(false)}
        >
          <View style={s.reqPickerSheet}>
            <Text style={s.reqPickerTitle}>Link to Requirement</Text>
            <ScrollView>
              {requirements.map((req) => (
                <TouchableOpacity
                  key={req.id}
                  style={[
                    s.reqPickerRow,
                    selectedReqId === req.id && s.reqPickerRowActive,
                  ]}
                  onPress={() => { setSelectedReqId(req.id); setShowReqPicker(false); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.reqPickerStageName}>{req.stopName}</Text>
                    <Text style={[
                      s.reqPickerReqTitle,
                      selectedReqId === req.id && s.reqPickerReqTitleActive,
                    ]}>
                      {req.title}
                    </Text>
                  </View>
                  {selectedReqId === req.id && (
                    <Text style={s.reqPickerCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  fullCenter: {
    flex: 1,
    backgroundColor: theme.color.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    padding: 32,
  },
  processingText: {
    ...theme.typography.body,
    color: theme.color.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },

  // Preview
  previewScreen: { flex: 1, backgroundColor: theme.color.bgBase },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.space4,
    paddingTop:        Platform.OS === 'ios' ? 56 : theme.spacing.space4,
    paddingBottom:     theme.spacing.space3,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgSurface,
  },
  backBtn:            { paddingVertical: 6, paddingEnd: theme.spacing.space3 },
  backBtnText:        { ...theme.typography.body, color: theme.color.primary, fontSize: 16, fontWeight: '600' },
  previewHeaderTitle: { ...theme.typography.heading, color: theme.color.textPrimary },
  previewScroll:      { padding: theme.spacing.space4, gap: 14, alignItems: 'center' },
  previewImageWrap: {
    width:           SCREEN_W - 32,
    borderRadius:    6,
    overflow:        'hidden',
    borderWidth:     1,
    borderColor:     theme.color.border,
    backgroundColor: theme.color.bgSurface,
  },

  // Form
  fieldLabel:  { ...theme.typography.sectionDivider, marginBottom: 4, marginTop: 2, alignSelf: 'flex-start' },
  optionalTag: { color: theme.color.border, fontWeight: '400' },
  nameInput: {
    backgroundColor: theme.color.bgSurface,
    color:           theme.color.textPrimary,
    borderRadius:    theme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical:   theme.spacing.space3,
    fontSize:          15,
    borderWidth:       1,
    borderColor:       theme.color.border,
    width:             '100%',
  },

  // Requirement picker trigger
  reqPickerBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    padding:         theme.spacing.space3,
    borderWidth:     1,
    borderColor:     theme.color.border,
    gap:             theme.spacing.space2,
    width:           '100%',
  },
  reqPickerBtnIcon:         { fontSize: 16 },
  reqPickerBtnText:         { flex: 1, color: theme.color.textMuted, fontSize: theme.typography.body.fontSize },
  reqPickerBtnTextSelected: { color: theme.color.textPrimary, fontWeight: '600' },
  reqPickerArrow:           { color: theme.color.textMuted, fontSize: 12 },
  reqClearBtn:              { color: theme.color.danger, fontSize: 14, padding: 2 },
  reqLinkedHint: {
    color:       theme.color.success,
    fontSize:    theme.typography.label.fontSize,
    lineHeight:  16,
    alignSelf:   'flex-start',
  },

  // Save button
  saveBtn:     { backgroundColor: theme.color.primary, borderRadius: theme.radius.lg, paddingVertical: 15, alignItems: 'center', marginTop: theme.spacing.space2, width: '100%' },
  saveBtnText: { color: theme.color.white, fontSize: 15, fontWeight: '700' },

  // Requirement picker sheet
  reqPickerOverlay: {
    flex:            1,
    backgroundColor: theme.color.overlayDark,
    justifyContent:  'flex-end',
  },
  reqPickerSheet: {
    backgroundColor:     theme.color.bgSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding:     20,
    maxHeight:   '70%',
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    ...theme.shadow.modal,
    zIndex: theme.zIndex.modal,
  },
  reqPickerTitle: {
    ...theme.typography.body,
    color:        theme.color.textPrimary,
    fontSize:     16,
    fontWeight:   '700',
    marginBottom: 16,
    textAlign:    'center',
  },
  reqPickerRow:            { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: theme.color.bgBase },
  reqPickerRowActive:      { backgroundColor: theme.color.primary + '10', borderRadius: theme.radius.md },
  reqPickerStageName:      { ...theme.typography.sectionDivider, color: theme.color.primary, marginBottom: 3 },
  reqPickerReqTitle:       { ...theme.typography.body, color: theme.color.textSecondary },
  reqPickerReqTitleActive: { color: theme.color.textPrimary, fontWeight: '600' },
  reqPickerCheck:          { color: theme.color.primary, fontSize: 18, fontWeight: '700', marginStart: theme.spacing.space3 },
});
