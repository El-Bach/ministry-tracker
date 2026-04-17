// src/components/DocumentScannerModal.tsx
// Native-first document scanning:
//   Android / iOS native → react-native-document-scanner-plugin (ML Kit / VisionKit)
//     — auto edge detection, perspective correction, auto-crop to document bounds
//   Web (iOS PWA) → expo-camera CameraView capture (manual photo)
//   Library → expo-image-picker (all platforms)
// Preview always shows an A4-proportioned frame filled edge-to-edge (no white bars)

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
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import supabase from '../lib/supabase';
import { theme } from '../theme';

// Native document scanner — ML Kit (Android) / VisionKit (iOS native build)
// Returns null on web; web uses CameraView fallback
const DocumentScanner: any =
  Platform.OS !== 'web'
    ? require('react-native-document-scanner-plugin').default
    : null;

const { width: SCREEN_W } = Dimensions.get('window');

// Preview always rendered at A4 portrait proportions — fills edge-to-edge
const PREVIEW_W = SCREEN_W - 32;
const PREVIEW_H = PREVIEW_W * (297 / 210); // A4 height/width = 1.414…

interface ReqItem { id: string; title: string; stopName: string; }

interface Props {
  visible:     boolean;
  taskId:      string;
  uploadedBy?: string;
  /** 'camera' → document scanner (native) / camera (web)  |  'library' → image picker */
  startMode?: 'camera' | 'library';
  onClose:    () => void;
  onSuccess:  () => void;
}

// 'launching' = native scanner or picker is open (spinner shown)
// 'camera'    = web CameraView (fallback for iOS PWA)
// 'preview'   = image ready — A4 frame + name + requirement + save
// 'processing'= uploading
type Step = 'launching' | 'camera' | 'preview' | 'processing';

export default function DocumentScannerModal({
  visible, taskId, uploadedBy, startMode = 'camera', onClose, onSuccess,
}: Props) {
  // Camera (web fallback)
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturing, setCapturing] = useState(false);

  const [step, setStep]             = useState<Step>('launching');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [statusText, setStatusText]   = useState('');

  const [requirements, setRequirements]   = useState<ReqItem[]>([]);
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const [showReqPicker, setShowReqPicker] = useState(false);

  const sourceRef = useRef<'camera' | 'library'>('camera');

  // ─── Load requirements ───────────────────────────────────────────────────────
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
      if (Platform.OS !== 'web') {
        // Native: ML Kit / VisionKit handles everything
        handleScanNative();
      } else {
        // Web (iOS PWA): show CameraView
        setStep('camera');
      }
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
    setCapturing(false);
  }
  function handleClose() { reset(); onClose(); }

  function autoName(source: 'camera' | 'library') {
    const t  = new Date();
    const dd = t.getDate().toString().padStart(2, '0');
    const mm = (t.getMonth() + 1).toString().padStart(2, '0');
    const yy = t.getFullYear();
    return `${source === 'library' ? 'Upload' : 'Scan'} ${dd}-${mm}-${yy}`;
  }

  function goToPreview(uri: string, source: 'camera' | 'library') {
    sourceRef.current = source;
    setCapturedUri(uri);
    setDisplayName(autoName(source));
    setStep('preview');
  }

  // ─── Native scanner: ML Kit (Android) / VisionKit (iOS native) ──────────────
  // Auto edge detection + perspective correction + crop to document bounds
  async function handleScanNative() {
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
      goToPreview(scannedImages[0] as string, 'camera');
    } catch (e: any) {
      Alert.alert(
        'Scanner error',
        'Could not open document scanner.\n' + (e?.message ?? ''),
        [{ text: 'OK', onPress: handleClose }],
      );
    }
  }

  // ─── Web camera capture (iOS PWA fallback) ───────────────────────────────────
  async function captureWebPhoto() {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality:          0.95,
        skipProcessing:   false,
      });
      if (photo?.uri) goToPreview(photo.uri, 'camera');
    } catch (e: any) {
      Alert.alert('Capture failed', e?.message ?? 'Could not take photo.');
    } finally {
      setCapturing(false);
    }
  }

  // ─── Library picker ───────────────────────────────────────────────────────────
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
      goToPreview(result.assets[0].uri, 'library');
    } else {
      handleClose();
    }
  }

  // ─── Upload & save ────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!capturedUri) return;
    const docName = displayName.trim() || `Document_${Date.now()}`;
    setStep('processing');
    try {
      setStatusText('Uploading…');
      const fileName = `${docName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.jpg`;
      const filePath = `documents/${taskId}/${fileName}`;

      if (Platform.OS === 'web') {
        const blob = await (await fetch(capturedUri)).blob();
        const { error } = await supabase.storage
          .from('task-attachments')
          .upload(filePath, blob, { contentType: 'image/jpeg', upsert: false });
        if (error) throw error;
      } else {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkYnFqemlmamtmZGJ3aGxxbHh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NjY2NzMsImV4cCI6MjA5MTA0MjY3M30.tmxI6cC8mNSYSQPcXIKuoPu8CgAcgdd3jQxEGsyiBKI';
        const res = await FileSystem.uploadAsync(
          `https://fdbqjzifjkfdbwhlqlxt.supabase.co/storage/v1/object/task-attachments/${filePath}`,
          capturedUri,
          {
            httpMethod:  'POST',
            uploadType:  FileSystem.FileSystemUploadType.MULTIPART,
            fieldName:   'file',
            mimeType:    'image/jpeg',
            headers: {
              'apikey':        ANON_KEY,
              'Authorization': `Bearer ${accessToken ?? ANON_KEY}`,
            },
          },
        );
        if (res.status < 200 || res.status >= 300) {
          throw new Error(`Upload failed (${res.status}): ${res.body}`);
        }
      }

      const { data: urlData } = supabase.storage
        .from('task-attachments')
        .getPublicUrl(filePath);

      const { error: dbErr } = await supabase.from('task_documents').insert({
        task_id:        taskId,
        file_name:      docName,
        file_url:       urlData.publicUrl,
        file_type:      'image/jpeg',
        uploaded_by:    uploadedBy ?? null,
        requirement_id: selectedReqId ?? null,
        display_name:   docName,
      });
      if (dbErr) throw dbErr;

      if (selectedReqId) {
        await supabase.from('stop_requirements')
          .update({
            attachment_url:  urlData.publicUrl,
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
      Alert.alert('Upload failed', e?.message ?? 'Could not save document.');
    }
  }

  const selectedReq = requirements.find(r => r.id === selectedReqId);

  // ─── Camera permission screen (web only) ─────────────────────────────────────
  if (visible && step === 'camera' && !cameraPermission?.granted) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
        <View style={s.fullCenter}>
          <Text style={{ fontSize: 48 }}>📷</Text>
          <Text style={s.permTitle}>Camera Access Needed</Text>
          <Text style={s.permDesc}>Allow camera to scan documents.</Text>
          <TouchableOpacity style={s.permBtn} onPress={requestCameraPermission}>
            <Text style={s.permBtnText}>Allow Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClose} style={{ marginTop: 12 }}>
            <Text style={{ color: theme.color.textSecondary }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>

      {/* ── LAUNCHING — native scanner or library picker is open ── */}
      {step === 'launching' && (
        <View style={s.fullCenter}>
          <ActivityIndicator size="large" color={theme.color.primary} />
          <Text style={s.processingText}>
            {startMode === 'camera' ? 'Opening scanner…' : 'Opening library…'}
          </Text>
          <TouchableOpacity onPress={handleClose} style={{ marginTop: 24 }}>
            <Text style={{ color: theme.color.textSecondary, fontSize: 15 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── CAMERA — web (iOS PWA) fallback ── */}
      {step === 'camera' && cameraPermission?.granted && (
        <View style={s.cameraScreen}>
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

          {/* A4 crop guide overlay */}
          <View style={s.camOverlay} pointerEvents="none">
            {/* dark strips outside the A4 guide box */}
            <View style={s.camGuideTop} />
            <View style={s.camGuideMid}>
              <View style={s.camGuideSide} />
              <View style={s.camGuideBox}>
                {/* corner brackets */}
                <View style={[s.camCorner, s.camCornerTL]} />
                <View style={[s.camCorner, s.camCornerTR]} />
                <View style={[s.camCorner, s.camCornerBL]} />
                <View style={[s.camCorner, s.camCornerBR]} />
              </View>
              <View style={s.camGuideSide} />
            </View>
            <View style={s.camGuideBottom} />
          </View>

          <View style={s.camTopBar}>
            <TouchableOpacity onPress={handleClose} style={s.camCloseBtn}>
              <Text style={s.camCloseBtnText}>✕</Text>
            </TouchableOpacity>
            <Text style={s.camHint}>Align document within the frame</Text>
            <TouchableOpacity onPress={() => { sourceRef.current = 'library'; handlePickLibrary(); }} style={s.camLibBtn}>
              <Text style={s.camLibBtnText}>Library</Text>
            </TouchableOpacity>
          </View>

          <View style={s.camBottomBar}>
            <TouchableOpacity
              style={[s.captureBtn, capturing && s.captureBtnDisabled]}
              onPress={captureWebPhoto}
              disabled={capturing}
              activeOpacity={0.8}
            >
              {capturing
                ? <ActivityIndicator color={theme.color.white} />
                : <View style={s.captureBtnInner} />}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── PREVIEW — A4 frame, edge-to-edge, no white bars ── */}
      {step === 'preview' && capturedUri && (
        <View style={s.previewScreen}>
          <View style={s.previewHeader}>
            <TouchableOpacity
              onPress={sourceRef.current === 'camera' && Platform.OS === 'web'
                ? () => setStep('camera')
                : handleClose}
              style={s.backBtn}
            >
              <Text style={s.backBtnText}>
                {sourceRef.current === 'camera' && Platform.OS === 'web'
                  ? '‹ Retake'
                  : '✕ Cancel'}
              </Text>
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
            {/*
              A4 proportioned container — image fills edge-to-edge with cover.
              No white/grey bars: the image bleeds to all 4 sides of the frame.
              Native scanner returns a cropped document so it fills perfectly;
              web/library photos are cropped from centre to fill the A4 box.
            */}
            <View style={s.previewA4}>
              <Image
                source={{ uri: capturedUri }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            </View>

            <Text style={s.fieldLabel}>DOCUMENT NAME</Text>
            <TextInput
              style={s.nameInput}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Document name"
              placeholderTextColor={theme.color.textMuted}
              returnKeyType="done"
            />

            {requirements.length > 0 && (
              <>
                <Text style={s.fieldLabel}>
                  LINK TO REQUIREMENT <Text style={s.optionalTag}>(optional)</Text>
                </Text>
                <TouchableOpacity style={s.reqPickerBtn} onPress={() => setShowReqPicker(true)}>
                  <Text style={s.reqPickerBtnIcon}>📋</Text>
                  <Text style={[s.reqPickerBtnText, !!selectedReqId && s.reqPickerBtnTextSelected]} numberOfLines={1}>
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
                  <Text style={s.reqLinkedHint}>This document will be attached to the requirement.</Text>
                )}
              </>
            )}

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

      {/* ── REQUIREMENT PICKER ── */}
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
                  style={[s.reqPickerRow, selectedReqId === req.id && s.reqPickerRowActive]}
                  onPress={() => { setSelectedReqId(req.id); setShowReqPicker(false); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.reqPickerStageName}>{req.stopName}</Text>
                    <Text style={[s.reqPickerReqTitle, selectedReqId === req.id && s.reqPickerReqTitleActive]}>
                      {req.title}
                    </Text>
                  </View>
                  {selectedReqId === req.id && <Text style={s.reqPickerCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

    </Modal>
  );
}

// ─── Guide box dimensions (A4-proportioned crop guide in camera) ───────────────
const GUIDE_MARGIN_H = 20;
const GUIDE_W        = SCREEN_W - GUIDE_MARGIN_H * 2;
const GUIDE_H        = GUIDE_W * (297 / 210);
const CORNER         = 20; // corner bracket length

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  fullCenter: {
    flex: 1, backgroundColor: theme.color.bgBase,
    alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32,
  },
  processingText: { ...theme.typography.body, color: theme.color.textPrimary, fontSize: 16, fontWeight: '600' },

  // ── Camera (web) ────────────────────────────────────────────────────────────
  cameraScreen: { flex: 1, backgroundColor: '#000' },

  // Overlay: dims areas outside the A4 guide
  camOverlay: { ...StyleSheet.absoluteFillObject },
  camGuideTop: {
    height: (Dimensions.get('window').height - GUIDE_H) / 2 - 40,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  camGuideMid: { flexDirection: 'row', height: GUIDE_H },
  camGuideSide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  camGuideBox: {
    width: GUIDE_W, height: GUIDE_H,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
    position: 'relative',
  },
  camGuideBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },

  // Corner brackets
  camCorner:   { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#fff' },
  camCornerTL: { top: -1.5, left: -1.5, borderTopWidth: 3, borderLeftWidth: 3 },
  camCornerTR: { top: -1.5, right: -1.5, borderTopWidth: 3, borderRightWidth: 3 },
  camCornerBL: { bottom: -1.5, left: -1.5, borderBottomWidth: 3, borderLeftWidth: 3 },
  camCornerBR: { bottom: -1.5, right: -1.5, borderBottomWidth: 3, borderRightWidth: 3 },

  camTopBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 16,
    left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  camCloseBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  camCloseBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  camHint:         { color: '#fff', fontSize: 13, fontWeight: '600', opacity: 0.9, flex: 1, textAlign: 'center' },
  camLibBtn:       { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  camLibBtnText:   { color: '#fff', fontSize: 13, fontWeight: '600' },

  camBottomBar: { position: 'absolute', bottom: Platform.OS === 'ios' ? 48 : 32, left: 0, right: 0, alignItems: 'center' },
  captureBtn:         { width: 74, height: 74, borderRadius: 37, backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  captureBtnDisabled: { opacity: 0.5 },
  captureBtnInner:    { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },

  // Permission
  permTitle: { ...theme.typography.heading, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  permDesc:  { ...theme.typography.body, color: theme.color.textSecondary, textAlign: 'center' },
  permBtn:   { backgroundColor: theme.color.primary, borderRadius: theme.radius.lg, paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center', width: '100%' },
  permBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // ── Preview ─────────────────────────────────────────────────────────────────
  previewScreen: { flex: 1, backgroundColor: theme.color.bgBase },
  previewHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.space4,
    paddingTop:    Platform.OS === 'ios' ? 56 : theme.spacing.space4,
    paddingBottom: theme.spacing.space3,
    borderBottomWidth: 1, borderBottomColor: theme.color.bgSurface,
  },
  backBtn:            { paddingVertical: 6, paddingEnd: theme.spacing.space3 },
  backBtnText:        { ...theme.typography.body, color: theme.color.primary, fontSize: 16, fontWeight: '600' },
  previewHeaderTitle: { ...theme.typography.heading, color: theme.color.textPrimary },
  previewScroll:      { padding: theme.spacing.space4, gap: 14, alignItems: 'center' },

  // A4 preview — fixed aspect ratio, image covers edge-to-edge (no white bars)
  previewA4: {
    width:           PREVIEW_W,
    height:          PREVIEW_H,
    borderRadius:    6,
    overflow:        'hidden',
    backgroundColor: '#000', // fallback before image loads
  },

  // Form
  fieldLabel:  { ...theme.typography.sectionDivider, marginBottom: 4, marginTop: 2, alignSelf: 'flex-start' },
  optionalTag: { color: theme.color.border, fontWeight: '400' },
  nameInput: {
    backgroundColor: theme.color.bgSurface, color: theme.color.textPrimary,
    borderRadius: theme.radius.lg, paddingHorizontal: 14, paddingVertical: theme.spacing.space3,
    fontSize: 15, borderWidth: 1, borderColor: theme.color.border, width: '100%',
  },
  reqPickerBtn:             { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.color.bgSurface, borderRadius: theme.radius.lg, padding: theme.spacing.space3, borderWidth: 1, borderColor: theme.color.border, gap: theme.spacing.space2, width: '100%' },
  reqPickerBtnIcon:         { fontSize: 16 },
  reqPickerBtnText:         { flex: 1, color: theme.color.textMuted, fontSize: theme.typography.body.fontSize },
  reqPickerBtnTextSelected: { color: theme.color.textPrimary, fontWeight: '600' },
  reqPickerArrow:           { color: theme.color.textMuted, fontSize: 12 },
  reqClearBtn:              { color: theme.color.danger, fontSize: 14, padding: 2 },
  reqLinkedHint:            { color: theme.color.success, fontSize: theme.typography.label.fontSize, lineHeight: 16, alignSelf: 'flex-start' },
  saveBtn:     { backgroundColor: theme.color.primary, borderRadius: theme.radius.lg, paddingVertical: 15, alignItems: 'center', marginTop: theme.spacing.space2, width: '100%' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Requirement picker sheet
  reqPickerOverlay: { flex: 1, backgroundColor: theme.color.overlayDark, justifyContent: 'flex-end' },
  reqPickerSheet:   { backgroundColor: theme.color.bgSurface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '70%', paddingBottom: Platform.OS === 'ios' ? 36 : 20, ...theme.shadow.modal, zIndex: theme.zIndex.modal },
  reqPickerTitle:   { ...theme.typography.body, color: theme.color.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  reqPickerRow:            { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: theme.color.bgBase },
  reqPickerRowActive:      { backgroundColor: theme.color.primary + '10', borderRadius: theme.radius.md },
  reqPickerStageName:      { ...theme.typography.sectionDivider, color: theme.color.primary, marginBottom: 3 },
  reqPickerReqTitle:       { ...theme.typography.body, color: theme.color.textSecondary },
  reqPickerReqTitleActive: { color: theme.color.textPrimary, fontWeight: '600' },
  reqPickerCheck:          { color: theme.color.primary, fontSize: 18, fontWeight: '700', marginStart: theme.spacing.space3 },
});
