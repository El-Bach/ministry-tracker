// src/components/DocumentScannerModal.tsx
// Document scanner: camera scan OR library upload → preview → rename → upload JPEG

import React, { useState, useRef, useEffect, useCallback } from 'react';
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

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const A4_RATIO = 297 / 210; // height / width — used for preview only

interface ReqItem { id: string; title: string; stopName: string; }

interface Props {
  visible: boolean;
  taskId: string;
  uploadedBy?: string;
  startMode?: 'camera' | 'library'; // which flow to open first
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'camera' | 'preview' | 'processing';

export default function DocumentScannerModal({
  visible, taskId, uploadedBy, startMode = 'camera', onClose, onSuccess,
}: Props) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [step, setStep]                       = useState<Step>('camera');
  const [capturedUri, setCapturedUri]         = useState<string | null>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState(A4_RATIO);
  const [displayName, setDisplayName]         = useState('');
  const [statusText, setStatusText]           = useState('');
  const [capturing, setCapturing]             = useState(false);

  const [requirements, setRequirements]       = useState<ReqItem[]>([]);
  const [selectedReqId, setSelectedReqId]     = useState<string | null>(null);
  const [showReqPicker, setShowReqPicker]     = useState(false);

  // Track whether current capture came from camera or library (for naming)
  const sourceRef = useRef<'camera' | 'library'>('camera');

  const loadRequirements = useCallback(async () => {
    try {
      const { data: stops } = await supabase
        .from('task_route_stops').select('id, ministry:ministries(name)').eq('task_id', taskId);
      if (!stops || stops.length === 0) return;
      const stopIds = stops.map((s: any) => s.id);
      const { data: reqs } = await supabase
        .from('stop_requirements').select('id, title, stop_id')
        .in('stop_id', stopIds).order('sort_order', { ascending: true });
      if (!reqs) return;
      const nameMap: Record<string, string> = {};
      for (const s of stops as any[]) nameMap[s.id] = s.ministry?.name ?? 'Stage';
      setRequirements(reqs.map((r: any) => ({ id: r.id, title: r.title, stopName: nameMap[r.stop_id] ?? 'Stage' })));
    } catch { }
  }, [taskId]);

  useEffect(() => {
    if (visible) {
      loadRequirements();
      if (startMode === 'library') {
        // Small delay so the modal can mount before native picker opens
        const t = setTimeout(() => pickFromLibraryAuto(), 200);
        return () => clearTimeout(t);
      } else {
        setStep('camera');
      }
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  function reset() {
    setCapturedUri(null); setDisplayName(''); setSelectedReqId(null);
    setStatusText(''); setCapturing(false); setStep('camera');
    setImageAspectRatio(A4_RATIO);
  }
  function handleClose() { reset(); onClose(); }

  function autoName(source: 'camera' | 'library') {
    const t   = new Date();
    const dd  = t.getDate().toString().padStart(2, '0');
    const mm  = (t.getMonth() + 1).toString().padStart(2, '0');
    const yy  = t.getFullYear();
    const prefix = source === 'library' ? 'Upload' : 'Scan';
    return `${prefix} ${dd}-${mm}-${yy}`;
  }

  // ─── Camera capture ──────────────────────────────────────────────────────────
  // No cropping: use the full photo as captured to avoid preview/result mismatch.
  // The A4 frame is a visual alignment guide only.
  async function capturePhoto() {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.92,
        skipProcessing: false, // apply EXIF rotation
      });
      if (!photo) return;
      sourceRef.current = 'camera';
      const w = photo.width ?? 0;
      const h = photo.height ?? 0;
      setCapturedUri(photo.uri);
      setImageAspectRatio(w > 0 && h > 0 ? h / w : A4_RATIO);
      setDisplayName(autoName('camera'));
      setStep('preview');
    } catch (e: any) {
      Alert.alert('Capture failed', e.message ?? 'Could not take photo.');
    } finally {
      setCapturing(false);
    }
  }

  // ─── Library picker (manual — from camera screen Library button) ─────────────
  async function pickFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: 0.95,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      sourceRef.current = 'library';
      const w = asset.width ?? 0;
      const h = asset.height ?? 0;
      setCapturedUri(asset.uri);
      setImageAspectRatio(w > 0 && h > 0 ? h / w : A4_RATIO);
      setDisplayName(autoName('library'));
      setStep('preview');
    }
    // If canceled, stay on camera step
  }

  // ─── Library picker (auto — triggered when startMode='library') ──────────────
  async function pickFromLibraryAuto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photo library.');
      handleClose();
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: 0.95,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      sourceRef.current = 'library';
      const w = asset.width ?? 0;
      const h = asset.height ?? 0;
      setCapturedUri(asset.uri);
      setImageAspectRatio(w > 0 && h > 0 ? h / w : A4_RATIO);
      setDisplayName(autoName('library'));
      await loadRequirements(); // ensure requirements are ready before preview renders
      setStep('preview');
    } else {
      // User cancelled picker — close the modal
      handleClose();
    }
  }

  // ─── Save / upload ───────────────────────────────────────────────────────────
  async function handleSave() {
    if (!capturedUri) return;
    const docName = displayName.trim() || `Document_${Date.now()}`;
    setStep('processing');

    try {
      setStatusText('Uploading...');

      const fileName = `${docName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.jpg`;
      const filePath = `documents/${taskId}/${fileName}`;

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkYnFqemlmamtmZGJ3aGxxbHh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NjY2NzMsImV4cCI6MjA5MTA0MjY3M30.tmxI6cC8mNSYSQPcXIKuoPu8CgAcgdd3jQxEGsyiBKI';
      const uploadUrl = `https://fdbqjzifjkfdbwhlqlxt.supabase.co/storage/v1/object/task-attachments/${filePath}`;

      const uploadResult = await FileSystem.uploadAsync(uploadUrl, capturedUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType: 'image/jpeg',
        headers: {
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${accessToken ?? ANON_KEY}`,
        },
      });
      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        throw new Error(`Upload failed (${uploadResult.status}): ${uploadResult.body}`);
      }

      const { data: urlData } = supabase.storage.from('task-attachments').getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      const { error: dbError } = await supabase.from('task_documents').insert({
        task_id:      taskId,
        file_name:    docName,
        file_url:     publicUrl,
        file_type:    'image/jpeg',
        uploaded_by:  uploadedBy ?? null,
        requirement_id: selectedReqId ?? null,
        display_name: docName,
      });
      if (dbError) throw dbError;

      if (selectedReqId) {
        await supabase.from('stop_requirements')
          .update({ attachment_url: publicUrl, attachment_name: `${docName}.jpg`, updated_at: new Date().toISOString() })
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

  const selectedReq = requirements.find(r => r.id === selectedReqId);

  // ─── Permission screen ───────────────────────────────────────────────────────
  if (visible && startMode === 'camera' && step === 'camera' && !cameraPermission?.granted) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
        <View style={s.permScreen}>
          <Text style={s.permIcon}>📷</Text>
          <Text style={s.permTitle}>Camera Access Needed</Text>
          <Text style={s.permDesc}>Allow camera access to scan documents.</Text>
          <TouchableOpacity style={s.permBtn} onPress={requestCameraPermission}>
            <Text style={s.permBtnText}>Allow Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.permLibBtn} onPress={() => { pickFromLibrary(); }}>
            <Text style={s.permLibBtnText}>Use Photo Library Instead</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClose} style={{ marginTop: 16 }}>
            <Text style={{ color: theme.color.textSecondary, fontSize: theme.typography.body.fontSize }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  // Preview image dimensions
  const previewW = SCREEN_W - 32;
  const previewH = previewW * imageAspectRatio;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>

      {/* ── CAMERA ── */}
      {step === 'camera' && startMode === 'camera' && (
        <View style={s.cameraScreen}>
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

          <View style={s.camTopBar}>
            <TouchableOpacity onPress={handleClose} style={s.camCloseBtn}>
              <Text style={s.camCloseBtnText}>✕</Text>
            </TouchableOpacity>
            <Text style={s.camHint}>Take a photo</Text>
            <TouchableOpacity onPress={pickFromLibrary} style={s.camLibBtn}>
              <Text style={s.camLibBtnText}>Library</Text>
            </TouchableOpacity>
          </View>

          <View style={s.camBottomBar}>
            <TouchableOpacity
              style={[s.captureBtn, capturing && s.captureBtnDisabled]}
              onPress={capturePhoto}
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

      {/* ── LIBRARY LOADING (auto mode, while picker is open) ── */}
      {step === 'camera' && startMode === 'library' && (
        <View style={s.processingScreen}>
          <ActivityIndicator size="large" color={theme.color.primary} />
          <Text style={s.processingText}>Opening library...</Text>
        </View>
      )}

      {/* ── PREVIEW ── */}
      {step === 'preview' && capturedUri && (
        <View style={s.previewScreen}>
          <View style={s.previewHeader}>
            {startMode === 'camera' ? (
              <TouchableOpacity onPress={() => setStep('camera')} style={s.backBtn}>
                <Text style={s.backBtnText}>‹ Retake</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleClose} style={s.backBtn}>
                <Text style={s.backBtnText}>✕ Cancel</Text>
              </TouchableOpacity>
            )}
            <Text style={s.previewHeaderTitle}>
              {startMode === 'camera' ? 'Scan Preview' : 'Upload Preview'}
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

            {/* Image preview — natural aspect ratio, no forced crop */}
            <View style={[s.previewImageWrap, { height: Math.min(previewH, SCREEN_H * 0.55) }]}>
              <Image
                source={{ uri: capturedUri }}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
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
                    {selectedReq ? `${selectedReq.stopName} › ${selectedReq.title}` : 'Select a requirement...'}
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
                {startMode === 'camera' ? 'Save Scan' : 'Upload Document'}
              </Text>
            </TouchableOpacity>
            <View style={{ height: 32 }} />
          </KeyboardAwareScrollView>
        </View>
      )}

      {/* ── PROCESSING ── */}
      {step === 'processing' && (
        <View style={s.processingScreen}>
          <ActivityIndicator size="large" color={theme.color.primary} />
          <Text style={s.processingText}>{statusText || 'Saving...'}</Text>
        </View>
      )}

      {/* ── REQUIREMENT PICKER ── */}
      <Modal visible={showReqPicker} transparent animationType="slide" onRequestClose={() => setShowReqPicker(false)}>
        <TouchableOpacity style={s.reqPickerOverlay} activeOpacity={1} onPress={() => setShowReqPicker(false)}>
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

const s = StyleSheet.create({
  permScreen:     { flex: 1, backgroundColor: theme.color.bgBase, alignItems: 'center', justifyContent: 'center', padding: 32, gap: theme.spacing.space4 },
  permIcon:       { fontSize: 48 },
  permTitle:      { ...theme.typography.heading, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  permDesc:       { ...theme.typography.body, color: theme.color.textSecondary, textAlign: 'center', lineHeight: 20 },
  permBtn:        { backgroundColor: theme.color.primary, borderRadius: theme.radius.lg, paddingVertical: 14, paddingHorizontal: 32, width: '100%', alignItems: 'center' },
  permBtnText:    { color: theme.color.white, fontSize: 15, fontWeight: '700' },
  permLibBtn:     { paddingVertical: theme.spacing.space3 },
  permLibBtnText: { ...theme.typography.body, color: theme.color.primary, fontWeight: '600' },

  cameraScreen: { flex: 1, backgroundColor: '#000000' },

  camTopBar: {
    position: 'absolute', top: Platform.OS === 'ios' ? 56 : theme.spacing.space4, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20,
  },
  camCloseBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  camCloseBtnText: { color: theme.color.white, fontSize: 16, fontWeight: '700' },
  camHint:         { color: theme.color.white, fontSize: theme.typography.label.fontSize, fontWeight: '600', opacity: 0.9, flex: 1, textAlign: 'center' },
  camLibBtn:       { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.space3, paddingVertical: 6 },
  camLibBtnText:   { color: theme.color.white, fontSize: 13, fontWeight: '600' },
  camBottomBar:    { position: 'absolute', bottom: Platform.OS === 'ios' ? 48 : 32, left: 0, right: 0, alignItems: 'center' },
  captureBtn:         { width: 74, height: 74, borderRadius: 37, backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 3, borderColor: theme.color.white, alignItems: 'center', justifyContent: 'center' },
  captureBtnDisabled: { opacity: 0.5 },
  captureBtnInner:    { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.color.white },

  previewScreen: { flex: 1, backgroundColor: theme.color.bgBase },
  previewHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.space4, paddingTop: Platform.OS === 'ios' ? 56 : theme.spacing.space4,
    paddingBottom: theme.spacing.space3, borderBottomWidth: 1, borderBottomColor: theme.color.bgSurface,
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

  fieldLabel:  { ...theme.typography.sectionDivider, marginBottom: 4, marginTop: 2, alignSelf: 'flex-start' },
  optionalTag: { color: theme.color.border, fontWeight: '400' },
  nameInput: {
    backgroundColor: theme.color.bgSurface, color: theme.color.textPrimary,
    borderRadius:    theme.radius.lg, paddingHorizontal: 14, paddingVertical: theme.spacing.space3,
    fontSize:        15, borderWidth: 1, borderColor: theme.color.border, width: '100%',
  },

  reqPickerBtn:             { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.color.bgSurface, borderRadius: theme.radius.lg, padding: theme.spacing.space3, borderWidth: 1, borderColor: theme.color.border, gap: theme.spacing.space2, width: '100%' },
  reqPickerBtnIcon:         { fontSize: 16 },
  reqPickerBtnText:         { flex: 1, color: theme.color.textMuted, fontSize: theme.typography.body.fontSize },
  reqPickerBtnTextSelected: { color: theme.color.textPrimary, fontWeight: '600' },
  reqPickerArrow:           { color: theme.color.textMuted, fontSize: 12 },
  reqClearBtn:              { color: theme.color.danger, fontSize: 14, padding: 2 },
  reqLinkedHint:            { color: theme.color.success, fontSize: theme.typography.label.fontSize, lineHeight: 16, alignSelf: 'flex-start' },

  saveBtn:     { backgroundColor: theme.color.primary, borderRadius: theme.radius.lg, paddingVertical: 15, alignItems: 'center', marginTop: theme.spacing.space2, width: '100%' },
  saveBtnText: { color: theme.color.white, fontSize: 15, fontWeight: '700' },

  processingScreen: { flex: 1, backgroundColor: theme.color.bgBase, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32 },
  processingText:   { ...theme.typography.body, color: theme.color.textPrimary, fontSize: 16, fontWeight: '600' },

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
