// src/screens/Create/components/IdScannerModal.tsx
//
// Camera modal that scans PDF417 / QR / barcodes off ID documents and
// extracts the holder's name + phone (when recognizable). Phase 2a
// extraction from CreateScreen (see ../README.md).
//
// The cooldown ref is kept local — it's purely internal state to debounce
// the rapid-fire onBarcodeScanned callback.

import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, Alert } from 'react-native';
import { CameraView } from 'expo-camera';

interface ParsedBarcode { name: string; phone: string }

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Translation function — passed in so the screen's language settings flow through. */
  t: (key: any) => string;
  /** Called with whatever fields could be parsed (each may be empty string). */
  onScan: (parsed: ParsedBarcode, rawData: string) => void;
}

// Heuristic parser for typical ID barcodes (PDF417 mostly).
// Returns first name-shaped + phone-shaped substrings; both default to ''.
function parseBarcodeData(data: string): ParsedBarcode {
  const normalized = data.replace(/\r/g, '\n').replace(/[\x00-\x08\x0B-\x1F\x7F]/g, ' ');
  const parts      = normalized.split(/[\n|;,]+/).map(p => p.trim()).filter(Boolean);
  const nameCandidates  = parts.filter(p =>
    /^[؀-ۿa-zA-Z][؀-ۿa-zA-Z ]{3,}$/.test(p) && p.includes(' '),
  );
  const phoneCandidates = parts.filter(p => /^[+]?[0-9 ()-]{6,16}$/.test(p));
  return {
    name:  nameCandidates[0] ?? '',
    phone: phoneCandidates[0] ?? '',
  };
}

export function IdScannerModal({ visible, onClose, t, onScan }: Props) {
  const scannerCooldown = useRef(false);

  // Reset the cooldown when the modal closes so the next open scans fresh.
  React.useEffect(() => {
    if (!visible) scannerCooldown.current = false;
  }, [visible]);

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {visible && (
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['pdf417', 'qr', 'code128', 'code39', 'ean13', 'datamatrix'] }}
            onBarcodeScanned={(result) => {
              if (scannerCooldown.current) return;
              scannerCooldown.current = true;
              const parsed = parseBarcodeData(result.data);
              onClose();
              onScan(parsed, result.data);
              if (!parsed.name && !parsed.phone) {
                // Show raw payload so the user can inspect what came back
                Alert.alert(
                  t('scanDoc'),
                  result.data.replace(/[\x00-\x1F\x7F]/g, ' ').trim().slice(0, 300),
                  [{ text: t('ok') }],
                );
              }
            }}
          />
        )}
        {/* Overlay UI */}
        <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          {/* Top bar */}
          <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>📷 Scan ID / QR Code</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          </View>
          {/* Center frame guide */}
          <View pointerEvents="none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 280, height: 160, borderRadius: 12, borderWidth: 2, borderColor: '#6366f1', backgroundColor: 'transparent' }} />
            <Text style={{ color: '#fff', marginTop: 16, fontSize: 13, opacity: 0.85, textAlign: 'center' }}>
              Point at the PDF417 barcode or QR code{'\n'}on the ID document
            </Text>
          </View>
          {/* Bottom info */}
          <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', padding: 20 }}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, textAlign: 'center' }}>
              Supports: PDF417 · QR · Code128 · EAN-13 · DataMatrix
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}
