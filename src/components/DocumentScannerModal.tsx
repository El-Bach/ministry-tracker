// src/components/DocumentScannerModal.tsx
// Document scanning:
//   Camera → CameraView with A4 guide frame + expo-image-manipulator crop
//   Library → expo-image-picker
// Preview: A4 proportioned, edge-to-edge (no white bars)
// Filters: Original · Document (B&W crisp) · Grayscale · Enhance
//   Processed via hidden WebView canvas pixel manipulation

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
  KeyboardAvoidingView,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { WebView } from 'react-native-webview';
import supabase from '../lib/supabase';
import { theme } from '../theme';


const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const PREVIEW_W = SCREEN_W - 32;
const PREVIEW_H = PREVIEW_W * (297 / 210); // A4 ratio

// ─── Filter definitions ───────────────────────────────────────────────────────
const FILTERS = [
  { id: 'original',  label: 'Original',  emoji: '🌅' },
  { id: 'document',  label: 'Document',  emoji: '📄' }, // B&W high-contrast — best for text
  { id: 'grayscale', label: 'Grayscale', emoji: '🩶' },
  { id: 'enhance',   label: 'Enhance',   emoji: '✨' }, // contrast + brightness boost
] as const;
type FilterId = typeof FILTERS[number]['id'];

// ─── Hidden WebView HTML — canvas pixel-manipulation processor ────────────────
// Receives: { base64: string, filter: FilterId }  (via postMessage from RN)
// Sends back: { result: dataURL }  (via ReactNativeWebView.postMessage)
const FILTER_HTML = `<!DOCTYPE html><html><body>
<canvas id="c" style="display:none"></canvas>
<script>
function run(msg) {
  var img = new Image();
  img.onload = function() {
    var c = document.getElementById('c');
    c.width = img.width; c.height = img.height;
    var ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    var id = ctx.getImageData(0, 0, c.width, c.height);
    var d = id.data, n = d.length;

    if (msg.filter === 'grayscale') {
      for (var i = 0; i < n; i += 4) {
        var g = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
        d[i] = d[i+1] = d[i+2] = g;
      }

    } else if (msg.filter === 'document') {
      // Pass 1: find average brightness
      var sum = 0;
      for (var i = 0; i < n; i += 4)
        sum += 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
      var avg = sum / (n / 4);
      // Threshold: slightly above average separates background (white) from ink
      var thresh = Math.min(avg * 1.08, 215);
      // Pass 2: background → pure white, ink → near-black
      for (var i = 0; i < n; i += 4) {
        var g = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
        var v = g >= thresh ? 255 : Math.max(0, Math.round(g * 0.35));
        d[i] = d[i+1] = d[i+2] = v;
      }

    } else if (msg.filter === 'enhance') {
      // Contrast stretch + slight brightness lift
      var cont = 1.45, br = 8;
      for (var i = 0; i < n; i += 4) {
        d[i]   = Math.max(0, Math.min(255, (d[i]  -128)*cont+128+br));
        d[i+1] = Math.max(0, Math.min(255, (d[i+1]-128)*cont+128+br));
        d[i+2] = Math.max(0, Math.min(255, (d[i+2]-128)*cont+128+br));
      }
    }

    ctx.putImageData(id, 0, 0);
    var result = c.toDataURL('image/jpeg', 0.92);
    window.ReactNativeWebView.postMessage(JSON.stringify({ result: result }));
  };
  img.onerror = function() {
    window.ReactNativeWebView.postMessage(JSON.stringify({ error: 'load failed' }));
  };
  img.src = 'data:image/jpeg;base64,' + msg.base64;
}
// Android uses document, iOS uses window
document.addEventListener('message', function(e) { try { run(JSON.parse(e.data)); } catch(x){} });
window.addEventListener('message',   function(e) { try { run(JSON.parse(e.data)); } catch(x){} });
</script></body></html>`;

interface ReqItem { id: string; title: string; stopName: string; }

interface Props {
  visible:     boolean;
  taskId:      string;
  uploadedBy?: string;
  startMode?:  'camera' | 'library';
  onClose:    () => void;
  onSuccess:  () => void;
}

type Step = 'launching' | 'camera' | 'preview' | 'processing';

export default function DocumentScannerModal({
  visible, taskId, uploadedBy, startMode = 'camera', onClose, onSuccess,
}: Props) {
  // Camera (web fallback)
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef  = useRef<CameraView>(null);
  const [capturing, setCapturing] = useState(false);

  // Scan state
  const [step, setStep]               = useState<Step>('launching');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [statusText, setStatusText]   = useState('');
  const sourceRef = useRef<'camera' | 'library'>('camera');

  // Filter state
  const [filterId, setFilterId]     = useState<FilterId>('original');
  const [filteredUri, setFilteredUri] = useState<string | null>(null);
  const [filterBusy, setFilterBusy] = useState(false);
  const webViewRef     = useRef<WebView>(null);
  const webReadyRef    = useRef(false);
  const pendingMsgRef  = useRef<string | null>(null); // queued postMessage

  // Requirements
  const [requirements, setRequirements]   = useState<ReqItem[]>([]);
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const [showReqPicker, setShowReqPicker] = useState(false);

  // ─── Load requirements ─────────────────────────────────────────────────────
  const loadRequirements = useCallback(async () => {
    try {
      const { data: stops } = await supabase
        .from('task_route_stops').select('id, ministry:ministries(name)').eq('task_id', taskId);
      if (!stops?.length) return;
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
    if (!visible) return;
    loadRequirements();
    webReadyRef.current  = false;
    pendingMsgRef.current = null;
    if (startMode === 'camera') {
      setStep('camera');
    } else {
      handlePickLibrary();
    }
  }, [visible]); // eslint-disable-line

  // ─── Reset / close ─────────────────────────────────────────────────────────
  function reset() {
    setCapturedUri(null); setDisplayName(''); setSelectedReqId(null);
    setStatusText(''); setStep('launching'); setCapturing(false);
    setFilterId('original'); setFilteredUri(null); setFilterBusy(false);
    webReadyRef.current = false; pendingMsgRef.current = null;
  }
  function handleClose() { reset(); onClose(); }

  function autoName(src: 'camera' | 'library') {
    const t = new Date();
    const dd = t.getDate().toString().padStart(2, '0');
    const mm = (t.getMonth() + 1).toString().padStart(2, '0');
    return `${src === 'library' ? 'Upload' : 'Scan'} ${dd}-${mm}-${t.getFullYear()}`;
  }

  function goToPreview(uri: string, src: 'camera' | 'library') {
    sourceRef.current = src;
    setCapturedUri(uri);
    setDisplayName(autoName(src));
    setFilterId('original');
    setFilteredUri(null);
    setStep('preview');
  }

  // ─── Camera capture ────────────────────────────────────────────────────────
  async function captureWebPhoto() {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.95, skipProcessing: false });
      if (photo?.uri) goToPreview(photo.uri, 'camera');
    } catch (e: any) {
      Alert.alert('Capture failed', e?.message ?? 'Could not take photo.');
    } finally { setCapturing(false); }
  }

  // ─── Library picker ────────────────────────────────────────────────────────
  async function handlePickLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow library access.'); handleClose(); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, quality: 0.95, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!result.canceled && result.assets.length > 0) {
      goToPreview(result.assets[0].uri, 'library');
    } else { handleClose(); }
  }

  // ─── Filter processing ─────────────────────────────────────────────────────
  async function handleFilterSelect(id: FilterId) {
    if (id === filterId) return;
    setFilterId(id);
    if (id === 'original') { setFilteredUri(null); return; }
    if (!capturedUri) return;
    setFilterBusy(true);
    try {
      // Resize to ≤1400px wide before sending to canvas (performance)
      const resized = await ImageManipulator.manipulateAsync(
        capturedUri,
        [{ resize: { width: 1400 } }],
        { compress: 0.88, format: ImageManipulator.SaveFormat.JPEG },
      );
      // Read as base64
      const base64 = await (FileSystem as any).readAsStringAsync(resized.uri, {
        encoding: 'base64',
      });
      const payload = JSON.stringify({ base64, filter: id });
      if (webReadyRef.current) {
        webViewRef.current?.postMessage(payload);
      } else {
        pendingMsgRef.current = payload; // will be sent on WebView load
      }
    } catch {
      setFilterBusy(false);
    }
  }

  function onWebViewLoad() {
    webReadyRef.current = true;
    if (pendingMsgRef.current) {
      webViewRef.current?.postMessage(pendingMsgRef.current);
      pendingMsgRef.current = null;
    }
  }

  async function handleWebViewMessage(event: any) {
    try {
      const { result, error } = JSON.parse(event.nativeEvent.data);
      if (error || !result) throw new Error(error ?? 'no result');
      const b64 = result.replace(/^data:image\/jpeg;base64,/, '');
      const path = (FileSystem.cacheDirectory ?? '') + `filter_${Date.now()}.jpg`;
      await (FileSystem as any).writeAsStringAsync(path, b64, { encoding: 'base64' });
      setFilteredUri(path);
    } catch { /* filter failed silently — fall back to original */ }
    finally { setFilterBusy(false); }
  }

  // ─── Upload & save ─────────────────────────────────────────────────────────
  async function handleSave() {
    const uploadUri = filteredUri ?? capturedUri;
    if (!uploadUri) return;
    const docName = displayName.trim() || `Document_${Date.now()}`;
    setStep('processing');
    try {
      setStatusText('Uploading…');
      const fileName = `${docName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.jpg`;
      const filePath = `documents/${taskId}/${fileName}`;

      if (Platform.OS === 'web') {
        const blob = await (await fetch(uploadUri)).blob();
        const { error } = await supabase.storage.from('task-attachments')
          .upload(filePath, blob, { contentType: 'image/jpeg', upsert: false });
        if (error) throw error;
      } else {
        const { data: sd } = await supabase.auth.getSession();
        const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkYnFqemlmamtmZGJ3aGxxbHh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NjY2NzMsImV4cCI6MjA5MTA0MjY3M30.tmxI6cC8mNSYSQPcXIKuoPu8CgAcgdd3jQxEGsyiBKI';
        const res = await FileSystem.uploadAsync(
          `https://fdbqjzifjkfdbwhlqlxt.supabase.co/storage/v1/object/task-attachments/${filePath}`,
          uploadUri,
          { httpMethod: 'POST', uploadType: FileSystem.FileSystemUploadType.MULTIPART, fieldName: 'file', mimeType: 'image/jpeg',
            headers: { 'apikey': ANON, 'Authorization': `Bearer ${sd?.session?.access_token ?? ANON}` } },
        );
        if (res.status < 200 || res.status >= 300) throw new Error(`Upload failed (${res.status})`);
      }

      const { data: urlData } = supabase.storage.from('task-attachments').getPublicUrl(filePath);
      const { error: dbErr } = await supabase.from('task_documents').insert({
        task_id: taskId, file_name: docName, file_url: urlData.publicUrl,
        file_type: 'image/jpeg', uploaded_by: uploadedBy ?? null,
        requirement_id: selectedReqId ?? null, display_name: docName,
      });
      if (dbErr) throw dbErr;

      if (selectedReqId) {
        await supabase.from('stop_requirements').update({
          attachment_url: urlData.publicUrl, attachment_name: `${docName}.jpg`,
          updated_at: new Date().toISOString(),
        }).eq('id', selectedReqId);
      }
      reset(); onSuccess();
    } catch (e: any) {
      setStep('preview'); setStatusText('');
      Alert.alert('Upload failed', e?.message ?? 'Could not save document.');
    }
  }

  // ─── Derived ───────────────────────────────────────────────────────────────
  const selectedReq = requirements.find(r => r.id === selectedReqId);
  const previewUri  = filteredUri ?? capturedUri;

  // ─── Camera permission screen (web only) ──────────────────────────────────
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

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>

      {/* ── LAUNCHING ── */}
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

      {/* ── CAMERA (web / Expo Go fallback) ── */}
      {step === 'camera' && cameraPermission?.granted && (
        <View style={s.cameraScreen}>
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
          {/* A4 guide overlay */}
          <View style={s.camOverlay} pointerEvents="none">
            <View style={s.camGuideTop} />
            <View style={s.camGuideMid}>
              <View style={s.camGuideSide} />
              <View style={s.camGuideBox}>
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
              onPress={captureWebPhoto} disabled={capturing} activeOpacity={0.8}
            >
              {capturing ? <ActivityIndicator color="#fff" /> : <View style={s.captureBtnInner} />}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── PREVIEW ── */}
      {step === 'preview' && capturedUri && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
        <View style={s.previewScreen}>
          <View style={s.previewHeader}>
            <TouchableOpacity
              onPress={sourceRef.current === 'camera' && Platform.OS === 'web'
                ? () => setStep('camera') : handleClose}
              style={s.backBtn}
            >
              <Text style={s.backBtnText}>
                {sourceRef.current === 'camera' && Platform.OS === 'web' ? '‹ Retake' : '✕ Cancel'}
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
            enableOnAndroid={true} enableAutomaticScroll={true} extraScrollHeight={80}
          >
            {/* A4 frame — image fills edge-to-edge, no white bars */}
            <View style={s.previewA4}>
              {previewUri && (
                <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              )}
              {/* Filter processing spinner */}
              {filterBusy && (
                <View style={s.filterOverlay}>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={s.filterOverlayText}>Applying filter…</Text>
                </View>
              )}
            </View>

            {/* Filter chips */}
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              style={s.filterRow} contentContainerStyle={s.filterRowContent}
            >
              {FILTERS.map(f => (
                <TouchableOpacity
                  key={f.id}
                  style={[s.filterChip, filterId === f.id && s.filterChipActive]}
                  onPress={() => handleFilterSelect(f.id)}
                  disabled={filterBusy}
                  activeOpacity={0.75}
                >
                  <Text style={s.filterChipEmoji}>{f.emoji}</Text>
                  <Text style={[s.filterChipLabel, filterId === f.id && s.filterChipLabelActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Document name */}
            <Text style={s.fieldLabel}>DOCUMENT NAME</Text>
            <TextInput
              style={s.nameInput} value={displayName} onChangeText={setDisplayName}
              placeholder="Document name" placeholderTextColor={theme.color.textMuted}
              returnKeyType="done"
            />

            {/* Requirement linker */}
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
                  {selectedReqId
                    ? <TouchableOpacity onPress={e => { e.stopPropagation(); setSelectedReqId(null); }} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
                        <Text style={s.reqClearBtn}>✕</Text>
                      </TouchableOpacity>
                    : <Text style={s.reqPickerArrow}>▼</Text>
                  }
                </TouchableOpacity>
                {selectedReq && (
                  <Text style={s.reqLinkedHint}>This document will be attached to the requirement.</Text>
                )}
              </>
            )}

            <TouchableOpacity style={[s.saveBtn, filterBusy && { opacity: 0.6 }]} onPress={handleSave} disabled={filterBusy}>
              <Text style={s.saveBtnText}>
                {sourceRef.current === 'camera' ? 'Save Scan' : 'Upload Document'}
                {filterId !== 'original' ? ` (${FILTERS.find(f => f.id === filterId)?.label})` : ''}
              </Text>
            </TouchableOpacity>
            <View style={{ height: 32 }} />
          </KeyboardAwareScrollView>

          {/* Hidden WebView — canvas pixel processor */}
          <WebView
            ref={webViewRef}
            source={{ html: FILTER_HTML }}
            style={s.hiddenWebView}
            onLoad={onWebViewLoad}
            onMessage={handleWebViewMessage}
            javaScriptEnabled={true}
            scrollEnabled={false}
          />
        </View>
        </KeyboardAvoidingView>
      )}

      {/* ── PROCESSING ── */}
      {step === 'processing' && (
        <View style={s.fullCenter}>
          <ActivityIndicator size="large" color={theme.color.primary} />
          <Text style={s.processingText}>{statusText || 'Saving…'}</Text>
        </View>
      )}

      {/* ── REQUIREMENT PICKER ── */}
      <Modal visible={showReqPicker} transparent animationType="slide" onRequestClose={() => setShowReqPicker(false)}>
        <TouchableOpacity style={s.reqPickerOverlay} activeOpacity={1} onPress={() => setShowReqPicker(false)}>
          <View style={s.reqPickerSheet}>
            <Text style={s.reqPickerTitle}>Link to Requirement</Text>
            <ScrollView>
              {requirements.map(req => (
                <TouchableOpacity key={req.id}
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

// ─── Camera guide dimensions ──────────────────────────────────────────────────
const GUIDE_MH = 20;
const GUIDE_W  = SCREEN_W - GUIDE_MH * 2;
const GUIDE_H  = GUIDE_W * (297 / 210);
const CORNER   = 22;

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  fullCenter: { flex:1, backgroundColor: theme.color.bgBase, alignItems:'center', justifyContent:'center', gap:16, padding:32 },
  processingText: { ...theme.typography.body, color: theme.color.textPrimary, fontSize:16, fontWeight:'600' },

  // Camera
  cameraScreen: { flex:1, backgroundColor:'#000' },
  camOverlay:   { ...StyleSheet.absoluteFillObject },
  camGuideTop:  { height: Math.max(0, (SCREEN_H - GUIDE_H) / 2 - 40), backgroundColor:'rgba(0,0,0,0.55)' },
  camGuideMid:  { flexDirection:'row', height: GUIDE_H },
  camGuideSide: { flex:1, backgroundColor:'rgba(0,0,0,0.55)' },
  camGuideBox:  { width: GUIDE_W, height: GUIDE_H, borderWidth:1, borderColor:'rgba(255,255,255,0.35)', position:'relative' },
  camGuideBottom: { flex:1, backgroundColor:'rgba(0,0,0,0.55)' },
  camCorner:   { position:'absolute', width:CORNER, height:CORNER, borderColor:'#fff' },
  camCornerTL: { top:-1.5, left:-1.5, borderTopWidth:3, borderLeftWidth:3 },
  camCornerTR: { top:-1.5, right:-1.5, borderTopWidth:3, borderRightWidth:3 },
  camCornerBL: { bottom:-1.5, left:-1.5, borderBottomWidth:3, borderLeftWidth:3 },
  camCornerBR: { bottom:-1.5, right:-1.5, borderBottomWidth:3, borderRightWidth:3 },
  camTopBar:    { position:'absolute', top: Platform.OS==='ios'?56:16, left:0, right:0, flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20 },
  camCloseBtn:     { width:36, height:36, borderRadius:18, backgroundColor:'rgba(0,0,0,0.5)', alignItems:'center', justifyContent:'center' },
  camCloseBtnText: { color:'#fff', fontSize:16, fontWeight:'700' },
  camHint:         { color:'#fff', fontSize:13, fontWeight:'600', opacity:0.9, flex:1, textAlign:'center' },
  camLibBtn:       { backgroundColor:'rgba(0,0,0,0.5)', borderRadius:8, paddingHorizontal:12, paddingVertical:6 },
  camLibBtnText:   { color:'#fff', fontSize:13, fontWeight:'600' },
  camBottomBar:    { position:'absolute', bottom: Platform.OS==='ios'?48:32, left:0, right:0, alignItems:'center' },
  captureBtn:         { width:74, height:74, borderRadius:37, backgroundColor:'rgba(255,255,255,0.25)', borderWidth:3, borderColor:'#fff', alignItems:'center', justifyContent:'center' },
  captureBtnDisabled: { opacity:0.5 },
  captureBtnInner:    { width:56, height:56, borderRadius:28, backgroundColor:'#fff' },

  // Permission
  permTitle:   { ...theme.typography.heading, fontSize:20, fontWeight:'700', textAlign:'center' },
  permDesc:    { ...theme.typography.body, color: theme.color.textSecondary, textAlign:'center' },
  permBtn:     { backgroundColor: theme.color.primary, borderRadius: theme.radius.lg, paddingVertical:14, paddingHorizontal:32, alignItems:'center', width:'100%' },
  permBtnText: { color:'#fff', fontSize:15, fontWeight:'700' },

  // Preview
  previewScreen: { flex:1, backgroundColor: theme.color.bgBase },
  previewHeader: {
    flexDirection:'row', alignItems:'center', justifyContent:'space-between',
    paddingHorizontal: theme.spacing.space4,
    paddingTop:    Platform.OS==='ios' ? 56 : theme.spacing.space4,
    paddingBottom: theme.spacing.space3,
    borderBottomWidth:1, borderBottomColor: theme.color.bgSurface,
  },
  backBtn:            { paddingVertical:6, paddingEnd: theme.spacing.space3 },
  backBtnText:        { ...theme.typography.body, color: theme.color.primary, fontSize:16, fontWeight:'600' },
  previewHeaderTitle: { ...theme.typography.heading, color: theme.color.textPrimary },
  previewScroll:      { padding: theme.spacing.space4, gap:14, alignItems:'center' },

  // A4 frame
  previewA4: {
    width:PREVIEW_W, height:PREVIEW_H,
    borderRadius:6, overflow:'hidden',
    backgroundColor:'#111',
  },

  // Filter spinner overlay
  filterOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor:'rgba(0,0,0,0.55)',
    alignItems:'center', justifyContent:'center', gap:10,
  },
  filterOverlayText: { color:'#fff', fontSize:13, fontWeight:'600' },

  // Filter chips row
  filterRow:        { alignSelf:'stretch', marginTop:2 },
  filterRowContent: { gap:8, paddingHorizontal:2, paddingVertical:4 },
  filterChip: {
    alignItems:'center', justifyContent:'center', gap:3,
    paddingHorizontal:14, paddingVertical:8,
    borderRadius: theme.radius.xl ?? 20,
    backgroundColor: theme.color.bgSurface,
    borderWidth:1.5, borderColor: theme.color.border,
    minWidth:72,
  },
  filterChipActive: {
    backgroundColor: theme.color.primary + '20',
    borderColor: theme.color.primary,
  },
  filterChipEmoji: { fontSize:18 },
  filterChipLabel: { ...theme.typography.caption, color: theme.color.textSecondary, fontWeight:'600', fontSize:11 },
  filterChipLabelActive: { color: theme.color.primary },

  // Form
  fieldLabel:  { ...theme.typography.sectionDivider, marginBottom:4, marginTop:2, alignSelf:'flex-start' },
  optionalTag: { color: theme.color.border, fontWeight:'400' },
  nameInput: {
    backgroundColor: theme.color.bgSurface, color: theme.color.textPrimary,
    borderRadius: theme.radius.lg, paddingHorizontal:14, paddingVertical: theme.spacing.space3,
    fontSize:15, borderWidth:1, borderColor: theme.color.border, width:'100%',
  },
  reqPickerBtn:             { flexDirection:'row', alignItems:'center', backgroundColor: theme.color.bgSurface, borderRadius: theme.radius.lg, padding: theme.spacing.space3, borderWidth:1, borderColor: theme.color.border, gap: theme.spacing.space2, width:'100%' },
  reqPickerBtnIcon:         { fontSize:16 },
  reqPickerBtnText:         { flex:1, color: theme.color.textMuted, fontSize: theme.typography.body.fontSize },
  reqPickerBtnTextSelected: { color: theme.color.textPrimary, fontWeight:'600' },
  reqPickerArrow:           { color: theme.color.textMuted, fontSize:12 },
  reqClearBtn:              { color: theme.color.danger, fontSize:14, padding:2 },
  reqLinkedHint:            { color: theme.color.success, fontSize: theme.typography.label.fontSize, lineHeight:16, alignSelf:'flex-start' },
  saveBtn:     { backgroundColor: theme.color.primary, borderRadius: theme.radius.lg, paddingVertical:15, alignItems:'center', marginTop: theme.spacing.space2, width:'100%' },
  saveBtnText: { color:'#fff', fontSize:15, fontWeight:'700' },

  // Hidden WebView
  hiddenWebView: { position:'absolute', width:1, height:1, opacity:0, bottom:0, right:0 },

  // Requirement picker
  reqPickerOverlay: { flex:1, backgroundColor: theme.color.overlayDark, justifyContent:'flex-end' },
  reqPickerSheet:   { backgroundColor: theme.color.bgSurface, borderTopLeftRadius:20, borderTopRightRadius:20, padding:20, maxHeight:'70%', paddingBottom: Platform.OS==='ios'?36:20, ...theme.shadow.modal, zIndex: theme.zIndex.modal },
  reqPickerTitle:   { ...theme.typography.body, color: theme.color.textPrimary, fontSize:16, fontWeight:'700', marginBottom:16, textAlign:'center' },
  reqPickerRow:            { flexDirection:'row', alignItems:'center', paddingVertical:14, paddingHorizontal:4, borderBottomWidth:1, borderBottomColor: theme.color.bgBase },
  reqPickerRowActive:      { backgroundColor: theme.color.primary+'10', borderRadius: theme.radius.md },
  reqPickerStageName:      { ...theme.typography.sectionDivider, color: theme.color.primary, marginBottom:3 },
  reqPickerReqTitle:       { ...theme.typography.body, color: theme.color.textSecondary },
  reqPickerReqTitleActive: { color: theme.color.textPrimary, fontWeight:'600' },
  reqPickerCheck:          { color: theme.color.primary, fontSize:18, fontWeight:'700', marginStart: theme.spacing.space3 },
});
