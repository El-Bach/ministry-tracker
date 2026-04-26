// src/components/DocumentScannerModal.tsx
// Document scanner: camera scan OR library upload → preview → rename → upload JPEG
// Restored to Session 21 architecture (crop UI, no WebView filters)

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  PanResponder,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
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

  const [step, setStep]                         = useState<Step>('camera');
  const [capturedUri, setCapturedUri]           = useState<string | null>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState(A4_RATIO);
  const [displayName, setDisplayName]           = useState('');
  const [statusText, setStatusText]             = useState('');
  const [capturing, setCapturing]               = useState(false);

  const [requirements, setRequirements]     = useState<ReqItem[]>([]);
  const [selectedReqId, setSelectedReqId]   = useState<string | null>(null);
  const [showReqPicker, setShowReqPicker]   = useState(false);

  // Track whether current capture came from camera or library (for naming)
  const sourceRef = useRef<'camera' | 'library'>('camera');

  // ─── Crop state ──────────────────────────────────────────────────────────────
  interface CropRect { x: number; y: number; w: number; h: number }
  const [cropMode, setCropMode]         = useState(false);
  const [cropRect, setCropRect]         = useState<CropRect>({ x: 0, y: 0, w: 0, h: 0 });
  const [imgNativeDim, setImgNativeDim] = useState<{ w: number; h: number } | null>(null);
  const [applying, setApplying]         = useState(false);
  const cropRectRef = useRef<CropRect>({ x: 0, y: 0, w: 0, h: 0 });

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
      setRequirements(reqs.map((r: any) => ({
        id: r.id, title: r.title, stopName: nameMap[r.stop_id] ?? 'Stage',
      })));
    } catch { /* ignore */ }
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
    setCropMode(false); setImgNativeDim(null); setApplying(false);
    setCropRect({ x: 0, y: 0, w: 0, h: 0 });
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

  // ─── Crop helpers ────────────────────────────────────────────────────────────
  // Compute where the image actually sits inside the previewImageWrap (contain fit)
  const containerW = SCREEN_W - 32;
  const containerH = Math.min(containerW * imageAspectRatio, SCREEN_H * 0.55);
  const imgDisplayW = imageAspectRatio > containerH / containerW
    ? containerH / imageAspectRatio   // height-constrained: scale by height
    : containerW;                      // width-constrained: scale by width
  const imgDisplayH = imgDisplayW * imageAspectRatio;
  const imgOffsetX  = (containerW - imgDisplayW) / 2;
  const imgOffsetY  = (containerH - imgDisplayH) / 2;

  function enterCropMode() {
    if (!capturedUri) return;
    Image.getSize(
      capturedUri,
      (nw, nh) => {
        setImgNativeDim({ w: nw, h: nh });
        const rect = { x: 0, y: 0, w: imgDisplayW, h: imgDisplayH };
        cropRectRef.current = rect;
        setCropRect(rect);
        setCropMode(true);
      },
      () => {
        setImgNativeDim({ w: 1000, h: Math.round(1000 * imageAspectRatio) });
        const rect = { x: 0, y: 0, w: imgDisplayW, h: imgDisplayH };
        cropRectRef.current = rect;
        setCropRect(rect);
        setCropMode(true);
      }
    );
  }

  async function applyCrop() {
    if (!capturedUri || !imgNativeDim) return;
    setApplying(true);
    try {
      const cr = cropRectRef.current;
      const scaleX = imgNativeDim.w / imgDisplayW;
      const scaleY = imgNativeDim.h / imgDisplayH;
      const originX = Math.round(cr.x * scaleX);
      const originY = Math.round(cr.y * scaleY);
      const width   = Math.round(cr.w * scaleX);
      const height  = Math.round(cr.h * scaleY);

      const result = await ImageManipulator.manipulateAsync(
        capturedUri,
        [{ crop: { originX, originY, width, height } }],
        { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG }
      );
      setCapturedUri(result.uri);
      setImageAspectRatio(result.height / result.width);
      setCropMode(false);
    } catch (e: any) {
      Alert.alert('Crop failed', e.message ?? 'Could not crop image.');
    } finally {
      setApplying(false);
    }
  }

  // Create PanResponders for 4 corner handles
  function makeCornerPanResponder(corner: 0 | 1 | 2 | 3) {
    let lastX = 0, lastY = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gs) => { lastX = gs.x0; lastY = gs.y0; },
      onPanResponderMove: (_, gs) => {
        const dx = gs.moveX - lastX;
        const dy = gs.moveY - lastY;
        lastX = gs.moveX;
        lastY = gs.moveY;
        const r = { ...cropRectRef.current };
        const MIN_SIZE = 50;
        if (corner === 0) { // TL
          r.x = Math.max(0, Math.min(r.x + dx, r.x + r.w - MIN_SIZE));
          r.y = Math.max(0, Math.min(r.y + dy, r.y + r.h - MIN_SIZE));
          r.w = Math.max(MIN_SIZE, r.w - dx);
          r.h = Math.max(MIN_SIZE, r.h - dy);
        } else if (corner === 1) { // TR
          r.y = Math.max(0, Math.min(r.y + dy, r.y + r.h - MIN_SIZE));
          r.w = Math.max(MIN_SIZE, Math.min(r.w + dx, imgDisplayW - r.x));
          r.h = Math.max(MIN_SIZE, r.h - dy);
        } else if (corner === 2) { // BL
          r.x = Math.max(0, Math.min(r.x + dx, r.x + r.w - MIN_SIZE));
          r.w = Math.max(MIN_SIZE, r.w - dx);
          r.h = Math.max(MIN_SIZE, Math.min(r.h + dy, imgDisplayH - r.y));
        } else { // BR
          r.w = Math.max(MIN_SIZE, Math.min(r.w + dx, imgDisplayW - r.x));
          r.h = Math.max(MIN_SIZE, Math.min(r.h + dy, imgDisplayH - r.y));
        }
        cropRectRef.current = r;
        setCropRect({ ...r });
      },
    });
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const panTL = useMemo(() => makeCornerPanResponder(0), [imgDisplayW, imgDisplayH]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const panTR = useMemo(() => makeCornerPanResponder(1), [imgDisplayW, imgDisplayH]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const panBL = useMemo(() => makeCornerPanResponder(2), [imgDisplayW, imgDisplayH]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const panBR = useMemo(() => makeCornerPanResponder(3), [imgDisplayW, imgDisplayH]);

  // ─── Save / upload ───────────────────────────────────────────────────────────
  async function handleSave() {
    if (!capturedUri) return;
    const docName = displayName.trim() || `Document_${Date.now()}`;
    setStep('processing');

    try {
      setStatusText('Uploading...');

      const fileName = `${docName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.jpg`;
      const filePath = `documents/${taskId}/${fileName}`;

      if (Platform.OS === 'web') {
        const response = await fetch(capturedUri);
        const blob = await response.blob();
        const { error: uploadError } = await supabase.storage
          .from('task-attachments')
          .upload(filePath, blob, { contentType: 'image/jpeg', upsert: false });
        if (uploadError) throw uploadError;
      } else {
        // Native: use FileSystem.uploadAsync
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
        const uploadUrl = `${supabaseUrl}/storage/v1/object/task-attachments/${filePath}`;
        const uploadResult = await FileSystem.uploadAsync(uploadUrl, capturedUri, {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'file',
          mimeType: 'image/jpeg',
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${accessToken ?? anonKey}`,
          },
        });
        if (uploadResult.status < 200 || uploadResult.status >= 300) {
          throw new Error(`Upload failed (${uploadResult.status}): ${uploadResult.body}`);
        }
      }

      const { data: urlData } = supabase.storage.from('task-attachments').getPublicUrl(filePath);
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

            {/* Image preview with optional crop overlay */}
            <View style={[s.previewImageWrap, { height: containerH }]}>
              <Image
                source={{ uri: capturedUri }}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
              />
              {/* Crop overlay */}
              {cropMode && (
                <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                  {/* Dark mask outside crop rect */}
                  <View style={[s.cropMask, { top: imgOffsetY, left: imgOffsetX, width: imgDisplayW, height: imgDisplayH }]} pointerEvents="none">
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: cropRect.y, backgroundColor: 'rgba(0,0,0,0.5)' }} />
                    <View style={{ position: 'absolute', top: cropRect.y + cropRect.h, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} />
                    <View style={{ position: 'absolute', top: cropRect.y, left: 0, width: cropRect.x, height: cropRect.h, backgroundColor: 'rgba(0,0,0,0.5)' }} />
                    <View style={{ position: 'absolute', top: cropRect.y, left: cropRect.x + cropRect.w, right: 0, height: cropRect.h, backgroundColor: 'rgba(0,0,0,0.5)' }} />
                    <View style={{ position: 'absolute', top: cropRect.y, left: cropRect.x, width: cropRect.w, height: cropRect.h, borderWidth: 1.5, borderColor: '#fff' }} />
                  </View>
                  {/* Corner handles */}
                  {[
                    { pan: panTL, style: { top: imgOffsetY + cropRect.y - 12, left: imgOffsetX + cropRect.x - 12 } },
                    { pan: panTR, style: { top: imgOffsetY + cropRect.y - 12, left: imgOffsetX + cropRect.x + cropRect.w - 12 } },
                    { pan: panBL, style: { top: imgOffsetY + cropRect.y + cropRect.h - 12, left: imgOffsetX + cropRect.x - 12 } },
                    { pan: panBR, style: { top: imgOffsetY + cropRect.y + cropRect.h - 12, left: imgOffsetX + cropRect.x + cropRect.w - 12 } },
                  ].map(({ pan, style }, i) => (
                    <View key={i} style={[s.cropHandle, style]} {...pan.panHandlers} />
                  ))}
                </View>
              )}
            </View>

            {/* Crop controls */}
            {!cropMode ? (
              <TouchableOpacity style={s.cropToggleBtn} onPress={enterCropMode}>
                <Text style={s.cropToggleBtnText}>✂ Crop</Text>
              </TouchableOpacity>
            ) : (
              <View style={s.cropActionsRow}>
                <TouchableOpacity
                  style={[s.cropActionBtn, { borderColor: theme.color.danger }]}
                  onPress={() => setCropMode(false)}
                  disabled={applying}
                >
                  <Text style={[s.cropActionBtnText, { color: theme.color.danger }]}>✕ Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.cropActionBtn, { borderColor: theme.color.success, backgroundColor: theme.color.success + '22' }]}
                  onPress={applyCrop}
                  disabled={applying}
                >
                  {applying
                    ? <ActivityIndicator size="small" color={theme.color.success} />
                    : <Text style={[s.cropActionBtnText, { color: theme.color.success }]}>✓ Apply Crop</Text>}
                </TouchableOpacity>
              </View>
            )}

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

  // Crop UI
  cropMask:   { position: 'absolute', overflow: 'hidden' },
  cropHandle: {
    position:        'absolute',
    width:           24,
    height:          24,
    backgroundColor: '#ffffff',
    borderWidth:     2,
    borderColor:     theme.color.primary,
    borderRadius:    4,
  },
  cropToggleBtn: {
    backgroundColor:   theme.color.bgSurface,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   8,
    borderWidth:       1,
    borderColor:       theme.color.border,
    alignSelf:         'center',
  },
  cropToggleBtnText: { ...theme.typography.label, color: theme.color.textSecondary },
  cropActionsRow: {
    flexDirection: 'row',
    gap:           theme.spacing.space3,
    alignSelf:     'stretch',
  },
  cropActionBtn: {
    flex:            1,
    borderRadius:    theme.radius.md,
    paddingVertical: 8,
    alignItems:      'center',
    borderWidth:     1.5,
  },
  cropActionBtnText: { ...theme.typography.label, fontWeight: '700' },

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
