// src/screens/Settings/components/FaqModal.tsx
//
// Full-screen FAQ with 16 expandable Q&A items. Phase 2a of the
// SettingsScreen split. Tap a question to expand the answer.
// Owns its own openFaqId state — purely presentational.

import React, { useState } from 'react';
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

export function FaqModal({ visible, onClose, t, ss }: Props) {
  const [openFaqId, setOpenFaqId] = useState<number | null>(null);

  const items = [
    { q: t('faqQ1'),  a: t('faqA1')  },
    { q: t('faqQ2'),  a: t('faqA2')  },
    { q: t('faqQ3'),  a: t('faqA3')  },
    { q: t('faqQ4'),  a: t('faqA4')  },
    { q: t('faqQ5'),  a: t('faqA5')  },
    { q: t('faqQ6'),  a: t('faqA6')  },
    { q: t('faqQ7'),  a: t('faqA7')  },
    { q: t('faqQ8'),  a: t('faqA8')  },
    { q: t('faqQ9'),  a: t('faqA9')  },
    { q: t('faqQ10'), a: t('faqA10') },
    { q: t('faqQ11'), a: t('faqA11') },
    { q: t('faqQ12'), a: t('faqA12') },
    { q: t('faqQ13'), a: t('faqA13') },
    { q: t('faqQ14'), a: t('faqA14') },
    { q: t('faqQ15'), a: t('faqA15') },
    { q: t('faqQ16'), a: t('faqA16') },
  ];

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={ss.helpOverlay} edges={['top', 'bottom']}>
        <View style={ss.helpSheet}>
          <View style={ss.helpHeader}>
            <Text style={ss.helpTitle}>{t('faqTitle')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={ss.helpClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
            {items.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={[ss.faqItem, openFaqId === i && ss.faqItemOpen]}
                onPress={() => setOpenFaqId(v => v === i ? null : i)}
                activeOpacity={0.75}
              >
                <View style={ss.faqQuestion}>
                  <Text style={ss.faqQ}>{item.q}</Text>
                  <Text style={[ss.faqChevron, openFaqId === i && ss.faqChevronOpen]}>›</Text>
                </View>
                {openFaqId === i && (
                  <Text style={ss.faqA}>{item.a}</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
