// src/components/PlanLockedScreen.tsx
// Full-screen non-dismissible lock shown after the 3-day grace period expires.
// Replaces the entire app UI — no navigation available.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, StatusBar, SafeAreaView } from 'react-native';
import { theme } from '../theme';
import { SUPPORT_WHATSAPP, SUPPORT_EMAIL } from '../lib/config';

interface Props {
  planName: string;
  isOwner: boolean;
  orgName: string;
  ownerEmail: string;
}

export function PlanLockedScreen({ planName, isOwner, orgName, ownerEmail }: Props) {
  const handleUpgrade = () => {
    const msg = encodeURIComponent(
      `Hi, I'd like to upgrade my GovPilot account.\n\nOrganization: ${orgName}\nEmail: ${ownerEmail}\n\n_GovPilot, Powered by KTS_`,
    );
    Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP}?text=${msg}`).catch(() =>
      Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Upgrade GovPilot Plan`),
    );
  };

  const handleContactSupport = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=GovPilot Account Locked`);
  };

  const capitalised = planName.charAt(0).toUpperCase() + planName.slice(1);

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={theme.color.bgBase} />
      <View style={s.content}>

        {/* Branding */}
        <Text style={s.brand}>GovPilot</Text>
        <Text style={s.powered}>Powered by KTS</Text>

        {/* Lock icon */}
        <View style={s.iconWrap}>
          <Text style={s.icon}>🔒</Text>
        </View>

        {/* Title */}
        <Text style={s.title}>Account Locked</Text>

        {/* Body */}
        {isOwner ? (
          <Text style={s.body}>
            Your{' '}
            <Text style={s.bold}>{capitalised}</Text>
            {' '}plan limit was exceeded and the 3-day grace period has ended.{'\n\n'}
            GovPilot is currently locked for your entire organization.{'\n\n'}
            Upgrade your plan to restore access immediately.
          </Text>
        ) : (
          <Text style={s.body}>
            Your organization's{' '}
            <Text style={s.bold}>{capitalised}</Text>
            {' '}plan limit has been exceeded and the grace period has ended.{'\n\n'}
            Please ask your organization owner to upgrade the plan to restore access.
          </Text>
        )}

        {/* CTAs */}
        {isOwner && (
          <TouchableOpacity style={s.upgradeBtn} onPress={handleUpgrade} activeOpacity={0.85}>
            <Text style={s.upgradeBtnText}>Upgrade Now</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[s.supportBtn, !isOwner && s.supportBtnPrimary]}
          onPress={handleContactSupport}
          activeOpacity={0.8}
        >
          <Text style={[s.supportBtnText, !isOwner && s.supportBtnTextPrimary]}>
            Contact Support
          </Text>
        </TouchableOpacity>

        {/* Footer note */}
        <Text style={s.note}>
          Once your plan is upgraded, reopen the app to restore access.
        </Text>

      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.color.bgBase,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.space6,
  },
  brand: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.color.primary,
    marginBottom: 2,
  },
  powered: {
    fontSize: 12,
    color: theme.color.textMuted,
    marginBottom: theme.spacing.space6,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.color.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.space5,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  icon: {
    fontSize: 44,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.color.textPrimary,
    marginBottom: theme.spacing.space4,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: theme.color.textSecondary,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: theme.spacing.space6,
  },
  bold: {
    fontWeight: '700',
    color: theme.color.textPrimary,
  },
  upgradeBtn: {
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: theme.spacing.space3,
  },
  upgradeBtnText: {
    color: theme.color.white,
    fontSize: 16,
    fontWeight: '800',
  },
  supportBtn: {
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: theme.color.border,
    marginBottom: theme.spacing.space5,
  },
  supportBtnPrimary: {
    backgroundColor: theme.color.primary,
    borderColor: theme.color.primary,
  },
  supportBtnText: {
    color: theme.color.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  supportBtnTextPrimary: {
    color: theme.color.white,
    fontWeight: '700',
  },
  note: {
    fontSize: 12,
    color: theme.color.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
