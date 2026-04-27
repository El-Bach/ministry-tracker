// src/screens/auth/LanguageSelectScreen.tsx
// First-launch language selection — like iPhone setup

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';

import { theme } from '../../theme';
import { LANGUAGES, Language, saveLanguage, isFirstLaunchKey, setCurrentLang } from '../../lib/i18n';

interface Props {
  onDone: () => void;
}

export default function LanguageSelectScreen({ onDone }: Props) {
  const [selected, setSelected] = useState<string>('en');

  const handleContinue = async () => {
    try {
      await saveLanguage(selected);
      await AsyncStorage.setItem(isFirstLaunchKey(), 'true');

      try {
        const lang = LANGUAGES.find(l => l.code === selected);
        const needsRTL = lang?.rtl ?? false;
        if (needsRTL !== I18nManager.isRTL) {
          I18nManager.forceRTL(needsRTL);
          Alert.alert(
            'Restart Required',
            'Please close and reopen the app to apply the language direction.',
            [{ text: 'OK', onPress: onDone }]
          );
          return; // onDone called via Alert callback
        }
      } catch (_) {
        // I18nManager not supported on web — skip RTL, just proceed
      }

      onDone();
    } catch (e) {
      console.warn('[LanguageSelect] continue error:', e);
      onDone(); // Always proceed even if save fails
    }
  };

  const renderItem = ({ item }: { item: Language }) => {
    const isActive = item.code === selected;
    return (
      <TouchableOpacity
        style={[s.langRow, isActive && s.langRowActive]}
        onPress={() => setSelected(item.code)}
        activeOpacity={0.7}
      >
        <Text style={s.langFlag}>{item.flag}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[s.langName, isActive && s.langNameActive]}>{item.name}</Text>
          <Text style={s.langNameEn}>{item.nameEn}</Text>
        </View>
        <View style={[s.radio, isActive && s.radioActive]}>
          {isActive && <View style={s.radioDot} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <Image
          source={require('../../../assets/icon.png')}
          style={s.icon}
          resizeMode="contain"
        />
        <Text style={s.appName}>
          <Text style={{ color: theme.color.primary }}>Gov</Text>
          <Text style={{ color: theme.color.textPrimary }}>Pilot</Text>
        </Text>
        <Text style={s.subtitle}>Choose your language</Text>
        <Text style={s.subtitleSub}>اختر لغتك  •  Choisissez votre langue</Text>
      </View>

      {/* Language list */}
      <FlatList
        data={LANGUAGES}
        keyExtractor={(l) => l.code}
        renderItem={renderItem}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
      />

      {/* Continue button */}
      <View style={s.footer}>
        <TouchableOpacity style={s.continueBtn} onPress={handleContinue} activeOpacity={0.85}>
          <Text style={s.continueBtnText}>
            {selected === 'ar' ? 'متابعة' : selected === 'fr' ? 'Continuer' : 'Continue'}
          </Text>
        </TouchableOpacity>
        <Text style={s.poweredBy}>Powered by KTS</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.bgBase },
  header: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  icon: { width: 72, height: 72, borderRadius: 18, marginBottom: 12 },
  appName: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.textPrimary,
    marginBottom: 4,
  },
  subtitleSub: {
    fontSize: 13,
    color: theme.color.textMuted,
    textAlign: 'center',
  },
  list: { paddingVertical: 8 },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border + '44',
    gap: 14,
  },
  langRowActive: {
    backgroundColor: theme.color.primary + '12',
  },
  langFlag: { fontSize: 28, width: 38 },
  langName: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.color.textPrimary,
  },
  langNameActive: { color: theme.color.primary },
  langNameEn: {
    fontSize: 12,
    color: theme.color.textMuted,
    marginTop: 1,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: theme.color.primary },
  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: theme.color.primary,
  },
  footer: {
    padding: 20,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    gap: 12,
  },
  continueBtn: {
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  poweredBy: {
    textAlign: 'center',
    fontSize: 11,
    color: theme.color.textMuted,
  },
});
