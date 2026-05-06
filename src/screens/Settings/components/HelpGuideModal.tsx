// src/screens/Settings/components/HelpGuideModal.tsx
//
// Full-screen help guide with 9 sections (Creating a File, Managing Stages,
// Assigning People, Documents, Financial Tracking, Calendar, Search,
// Network, Ministry Contacts), each with numbered steps. Phase 2a of the
// SettingsScreen split. Shared `ss` styles passed in until Phase 4 dedup.

import React from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Props {
  visible: boolean;
  onClose: () => void;
  t: (key: any) => string;
  ss: any;
}

export function HelpGuideModal({ visible, onClose, t, ss }: Props) {
  const sections = [
    { icon: '📁', title: t('help1Title'), steps: [t('help1S1'), t('help1S2'), t('help1S3'), t('help1S4')] },
    { icon: '🗂', title: t('help2Title'), steps: [t('help2S1'), t('help2S2'), t('help2S3'), t('help2S4'), t('help2S5'), t('help2S6')] },
    { icon: '👥', title: t('help3Title'), steps: [t('help3S1'), t('help3S2'), t('help3S3'), t('help3S4')] },
    { icon: '📄', title: t('help4Title'), steps: [t('help4S1'), t('help4S2'), t('help4S3'), t('help4S4')] },
    { icon: '💰', title: t('help5Title'), steps: [t('help5S1'), t('help5S2'), t('help5S3'), t('help5S4')] },
    { icon: '📅', title: t('help6Title'), steps: [t('help6S1'), t('help6S2'), t('help6S3')] },
    { icon: '🔍', title: t('help7Title'), steps: [t('help7S1'), t('help7S2'), t('help7S3')] },
    { icon: '🌐', title: t('help8Title'), steps: [t('help8S1'), t('help8S2'), t('help8S3'), t('help8S4')] },
    { icon: '🏛', title: t('help9Title'), steps: [t('help9S1'), t('help9S2'), t('help9S3'), t('help9S4')] },
  ];

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={ss.helpOverlay} edges={['top', 'bottom']}>
        <View style={ss.helpSheet}>
          <View style={ss.helpHeader}>
            <Text style={ss.helpTitle}>{t('helpGuideTitle')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={ss.helpClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
            {sections.map((section, i) => (
              <View key={i} style={ss.helpSection}>
                <View style={ss.helpSectionHeader}>
                  <Text style={ss.helpSectionIcon}>{section.icon}</Text>
                  <Text style={ss.helpSectionTitle}>{section.title}</Text>
                </View>
                {section.steps.map((step, j) => (
                  <View key={j} style={ss.helpStep}>
                    <View style={ss.helpStepDot} />
                    <Text style={ss.helpStepText}>{step}</Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
