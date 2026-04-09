// src/components/DocumentScannerModal.tsx
// Document scanner: live camera → crop to A4 frame → upload JPEG directly (no PDF)

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
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import supabase from '../lib/supabase';
import { theme } from '../theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const A4_RATIO  = 297 / 210; // height / width
const FRAME_W   = SCREEN_W * 0.84;
const FRAME_H   = FRAME_W * A4_RATIO;
const FRAME_TOP  = (SCREEN_H - FRAME_H) / 2 - 40;
const FRAME_LEFT = (SCREEN_W - FRAME_W) / 2;

interface ReqItem { id: string; title: string; stopName: string; }

interface Props {
  visible: boolean;
  taskId: string;
  uploadedBy?: string;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'camera' | 'preview' | 'processing';

export default function DocumentScannerModal({ visible, taskId, uploadedBy, onClose, onSuccess }: Props) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [step, setStep]               = useState<Step>('camera');
  const [croppedUri, setCroppedUri]   = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [statusText, setStatusText]   = useState('');
  const [capturing, setCapturing]     = useState(false);

  const [requirements, setRequirements]   = useState<ReqItem[]>([]);
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const [showReqPicker, setShowReqPicker] = useState(false);

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
    if (visible) { loadRequirements(); setStep('camera'); }
  }, [visible, loadRequirements]);

  function reset() {
    setCroppedUri(null); setDisplayName(''); setSelectedReqId(null);
    setStatusText(''); setCapturing(false); setStep('camera');
  }
  function handleClose() { reset(); onClose(); }

  function autoName() {
    const t = new Date();
    return `Scan ${t.getDate().toString().padStart(2,'0')}-${(t.getMonth()+1).toString().padStart(2,'0')}-${t.getFullYear()}`;
  }

  // Crop photo to the exact frame region (cover-scale math)
  async function cropToFrame(uri: string, photoW: number, photoH: number): Promise<string> {
    const coverScale = Math.max(SCREEN_W / photoW, SCREEN_H / photoH);
    const imgLeft    = (SCREEN_W - photoW * coverScale) / 2;
    const imgTop     = (SCREEN_H - photoH * coverScale) / 2;

    const originX = Math.max(0, Math.round((FRAME_LEFT - imgLeft) / coverScale));
    const originY = Math.max(0, Math.round((FRAME_TOP  - imgTop)  / coverScale));
    const cropW   = Math.min(Math.round(FRAME_W / coverScale), photoW - originX);
    const cropH   = Math.min(Math.round(FRAME_H / coverScale), photoH - originY);

    const r = await ImageManipulator.manipulateAsync(
      uri,
      [{ crop: { originX, originY, width: cropW, height: cropH } }],
      { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
    );
    return r.uri;
  }

  async function capturePhoto() {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.95, skipProcessing: false });
      if (!photo) return;
      const w = photo.width ?? 0, h = photo.height ?? 0;
      const uri = (w > 0 && h > 0) ? await cropToFrame(photo.uri, w, h) : photo.uri;
      setCroppedUri(uri);
      setDisplayName(autoName());
      setStep('preview');
    } catch (e: any) {
      Alert.alert('Capture failed', e.message ?? 'Could not take photo.');
    } finally {
      setCapturing(false);
    }
  }

  async function pickFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow access to your photo library.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false, quality: 0.95, mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const w = asset.width ?? 0, h = asset.height ?? 0;
      let uri = asset.uri;
      if (w > 0 && h > 0) {
        // Center-crop to A4 ratio
        const imageRatio = h / w;
        let cropW = w, cropH = h, originX = 0, originY = 0;
        if (imageRatio > A4_RATIO) {
          cropH   = Math.round(w * A4_RATIO);
          originY = Math.round((h - cropH) / 2);
        } else {
          cropW   = Math.round(h / A4_RATIO);
          originX = Math.round((w - cropW) / 2);
        }
        const r = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ crop: { originX, originY, width: cropW, height: cropH } }],
          { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
        );
        uri = r.uri;
      }
      setCroppedUri(uri);
      setDisplayName(autoName());
      setStep('preview');
    }
  }

  async function handleSave() {
    if (!croppedUri) return;
    const docName = displayName.trim() || `Document_${Date.now()}`;
    setStep('processing');

    try {
      setStatusText('Uploading...');

      // Upload JPEG directly — no PDF generation at all
      const fileName = `${docName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.jpg`;
      const filePath = `documents/${taskId}/${fileName}`;

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkYnFqemlmamtmZGJ3aGxxbHh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NjY2NzMsImV4cCI6MjA5MTA0MjY3M30.tmxI6cC8mNSYSQPcXIKuoPu8CgAcgdd3jQxEGsyiBKI';
      const uploadUrl = `https://fdbqjzifjkfdbwhlqlxt.supabase.co/storage/v1/object/task-attachments/${filePath}`;

      const uploadResult = await FileSystem.uploadAsync(uploadUrl, croppedUri, {
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
        task_id: taskId,
        file_name: docName,
        file_url: publicUrl,
        file_type: 'image/jpeg',
        uploaded_by: uploadedBy ?? null,
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

  // Permission screen
  if (visible && step === 'camera' && !cameraPermission?.granted) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
        <View style={s.permScreen}>
          <Text style={s.permIcon}>📷</Text>
          <Text style={s.permTitle}>Camera Access Needed</Text>
          <Text style={s.permDesc}>Allow camera access to scan documents.</Text>
          <TouchableOpacity style={s.permBtn} onPress={requestCameraPermission}>
            <Text style={s.permBtnText}>Allow Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.permLibBtn} onPress={pickFromLibrary}>
            <Text style={s.permLibBtnText}>Use Photo Library Instead</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClose} style={{ marginTop: 16 }}>
            <Text style={{ color: theme.color.textSecondary, fontSize: theme.typography.body.fontSize }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>

      {/* ── CAMERA ── */}
      {step === 'camera' && (
        <View style={s.cameraScreen}>
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

          {/* Dark overlay outside frame */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={[s.overlay, { height: FRAME_TOP }]} />
            <View style={{ height: FRAME_H, flexDirection: 'row' }}>
              <View style={[s.overlay, { flex: 1 }]} />
              <View style={{ width: FRAME_W, height: FRAME_H }}>
                <View style={[s.corner, s.cornerTL]} />
                <View style={[s.corner, s.cornerTR]} />
                <View style={[s.corner, s.cornerBL]} />
                <View style={[s.corner, s.cornerBR]} />
              </View>
              <View style={[s.overlay, { flex: 1 }]} />
            </View>
            <View style={[s.overlay, { flex: 1 }]} />
          </View>

          {/* A4 label */}
          <View pointerEvents="none" style={[s.frameLabel, { top: FRAME_TOP + 8, left: FRAME_LEFT + 10 }]}>
            <Text style={s.frameLabelText}>A4</Text>
          </View>

          <View style={s.camTopBar}>
            <TouchableOpacity onPress={handleClose} style={s.camCloseBtn}>
              <Text style={s.camCloseBtnText}>✕</Text>
            </TouchableOpacity>
            <Text style={s.camHint}>Place document inside the frame</Text>
            <TouchableOpacity onPress={pickFromLibrary} style={s.camLibBtn}>
              <Text style={s.camLibBtnText}>Library</Text>
            </TouchableOpacity>
          </View>

          <View style={s.camBottomBar}>
            <TouchableOpacity
              style={[s.captureBtn, capturing && s.captureBtnDisabled]}
              onPress={capturePhoto} disabled={capturing} activeOpacity={0.8}
            >
              {capturing ? <ActivityIndicator color={theme.color.white} /> : <View style={s.captureBtnInner} />}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── PREVIEW ── */}
      {step === 'preview' && croppedUri && (
        <View style={s.previewScreen}>
          <View style={s.previewHeader}>
            <TouchableOpacity onPress={() => setStep('camera')} style={s.backBtn}>
              <Text style={s.backBtnText}>‹ Retake</Text>
            </TouchableOpacity>
            <Text style={s.previewHeaderTitle}>Preview</Text>
            <View style={{ width: 70 }} />
          </View>

          <ScrollView contentContainerStyle={s.previewScroll} keyboardShouldPersistTaps="handled">

            {/* A4-ratio preview — exactly what will be saved */}
            <View style={s.previewImageWrap}>
              <Image
                source={{ uri: croppedUri }}
                style={StyleSheet.absoluteFill}
                resizeMode="stretch"
              />
            </View>

            <Text style={s.fieldLabel}>DOCUMENT NAME</Text>
            <TextInput
              style={s.nameInput}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Scan 01-01-2025"
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
                    <TouchableOpacity onPress={(e) => { e.stopPropagation(); setSelectedReqId(null); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={s.reqClearBtn}>✕</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={s.reqPickerArrow}>▼</Text>
                  )}
                </TouchableOpacity>
                {selectedReq && <Text style={s.reqLinkedHint}>This document will be attached to the requirement.</Text>}
              </>
            )}

            <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
              <Text style={s.saveBtnText}>Save Document</Text>
            </TouchableOpacity>
            <View style={{ height: 32 }} />
          </ScrollView>
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
                    <Text style={[s.reqPickerReqTitle, selectedReqId === req.id && s.reqPickerReqTitleActive]}>{req.title}</Text>
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

const CORNER = 24;
const THICK  = 3;

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
  overlay:      { backgroundColor: 'rgba(0,0,0,0.65)' },
  corner:       { position: 'absolute', width: CORNER, height: CORNER, borderColor: theme.color.white },
  cornerTL:     { top: 0, left: 0, borderTopWidth: THICK, borderLeftWidth: THICK },
  cornerTR:     { top: 0, right: 0, borderTopWidth: THICK, borderRightWidth: THICK },
  cornerBL:     { bottom: 0, left: 0, borderBottomWidth: THICK, borderLeftWidth: THICK },
  cornerBR:     { bottom: 0, right: 0, borderBottomWidth: THICK, borderRightWidth: THICK },
  frameLabel:     { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: theme.radius.sm - 2, paddingHorizontal: 7, paddingVertical: 2 },
  frameLabelText: { color: theme.color.white, fontSize: theme.typography.sectionDivider.fontSize, fontWeight: '800' },

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
  captureBtn:      { width: 74, height: 74, borderRadius: 37, backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 3, borderColor: theme.color.white, alignItems: 'center', justifyContent: 'center' },
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
    height:          (SCREEN_W - 32) * A4_RATIO,
    borderRadius:    6,
    overflow:        'hidden',
    borderWidth:     1,
    borderColor:     theme.color.border,
    backgroundColor: theme.color.white,
  },

  fieldLabel:  { ...theme.typography.sectionDivider, marginBottom: 4, marginTop: 2, alignSelf: 'flex-start' },
  optionalTag: { color: theme.color.border, fontWeight: '400' },
  nameInput: {
    backgroundColor: theme.color.bgSurface, color: theme.color.textPrimary,
    borderRadius:    theme.radius.lg, paddingHorizontal: 14, paddingVertical: theme.spacing.space3,
    fontSize:        15, borderWidth: 1, borderColor: theme.color.border, width: '100%',
  },

  reqPickerBtn:              { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.color.bgSurface, borderRadius: theme.radius.lg, padding: theme.spacing.space3, borderWidth: 1, borderColor: theme.color.border, gap: theme.spacing.space2, width: '100%' },
  reqPickerBtnIcon:          { fontSize: 16 },
  reqPickerBtnText:          { flex: 1, color: theme.color.textMuted, fontSize: theme.typography.body.fontSize },
  reqPickerBtnTextSelected:  { color: theme.color.textPrimary, fontWeight: '600' },
  reqPickerArrow:            { color: theme.color.textMuted, fontSize: 12 },
  reqClearBtn:               { color: theme.color.danger, fontSize: 14, padding: 2 },
  reqLinkedHint:             { color: theme.color.success, fontSize: theme.typography.label.fontSize, lineHeight: 16, alignSelf: 'flex-start' },

  saveBtn:     { backgroundColor: theme.color.primary, borderRadius: theme.radius.lg, paddingVertical: 15, alignItems: 'center', marginTop: theme.spacing.space2, width: '100%' },
  saveBtnText: { color: theme.color.white, fontSize: 15, fontWeight: '700' },

  processingScreen: { flex: 1, backgroundColor: theme.color.bgBase, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32 },
  processingText:   { ...theme.typography.body, color: theme.color.textPrimary, fontSize: 16, fontWeight: '600' },

  reqPickerOverlay: { flex: 1, backgroundColor: theme.color.overlayDark, justifyContent: 'flex-end' },
  reqPickerSheet:   { backgroundColor: theme.color.bgSurface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '70%', paddingBottom: Platform.OS === 'ios' ? 36 : 20, ...theme.shadow.modal, zIndex: theme.zIndex.modal },
  reqPickerTitle:   { ...theme.typography.body, color: theme.color.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  reqPickerRow:              { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: theme.color.bgBase },
  reqPickerRowActive:        { backgroundColor: theme.color.primary + '10', borderRadius: theme.radius.md },
  reqPickerStageName:        { ...theme.typography.sectionDivider, color: theme.color.primary, marginBottom: 3 },
  reqPickerReqTitle:         { ...theme.typography.body, color: theme.color.textSecondary },
  reqPickerReqTitleActive:   { color: theme.color.textPrimary, fontWeight: '600' },
  reqPickerCheck:            { color: theme.color.primary, fontSize: 18, fontWeight: '700', marginStart: theme.spacing.space3 },
});
