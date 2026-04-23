// src/components/PhoneInput.tsx
// Phone input with country code picker (flag + code + search)

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { theme } from '../theme';

export interface Country {
  code: string;   // e.g. "+961"
  iso: string;    // e.g. "LB"
  name: string;   // e.g. "Lebanon"
  flag: string;   // emoji
}

export const COUNTRIES: Country[] = [
  { code: '+93',  iso: 'AF', name: 'Afghanistan',          flag: '🇦🇫' },
  { code: '+355', iso: 'AL', name: 'Albania',               flag: '🇦🇱' },
  { code: '+213', iso: 'DZ', name: 'Algeria',               flag: '🇩🇿' },
  { code: '+376', iso: 'AD', name: 'Andorra',               flag: '🇦🇩' },
  { code: '+244', iso: 'AO', name: 'Angola',                flag: '🇦🇴' },
  { code: '+54',  iso: 'AR', name: 'Argentina',             flag: '🇦🇷' },
  { code: '+374', iso: 'AM', name: 'Armenia',               flag: '🇦🇲' },
  { code: '+61',  iso: 'AU', name: 'Australia',             flag: '🇦🇺' },
  { code: '+43',  iso: 'AT', name: 'Austria',               flag: '🇦🇹' },
  { code: '+994', iso: 'AZ', name: 'Azerbaijan',            flag: '🇦🇿' },
  { code: '+973', iso: 'BH', name: 'Bahrain',               flag: '🇧🇭' },
  { code: '+880', iso: 'BD', name: 'Bangladesh',            flag: '🇧🇩' },
  { code: '+375', iso: 'BY', name: 'Belarus',               flag: '🇧🇾' },
  { code: '+32',  iso: 'BE', name: 'Belgium',               flag: '🇧🇪' },
  { code: '+229', iso: 'BJ', name: 'Benin',                 flag: '🇧🇯' },
  { code: '+975', iso: 'BT', name: 'Bhutan',                flag: '🇧🇹' },
  { code: '+591', iso: 'BO', name: 'Bolivia',               flag: '🇧🇴' },
  { code: '+387', iso: 'BA', name: 'Bosnia & Herzegovina',  flag: '🇧🇦' },
  { code: '+267', iso: 'BW', name: 'Botswana',              flag: '🇧🇼' },
  { code: '+55',  iso: 'BR', name: 'Brazil',                flag: '🇧🇷' },
  { code: '+673', iso: 'BN', name: 'Brunei',                flag: '🇧🇳' },
  { code: '+359', iso: 'BG', name: 'Bulgaria',              flag: '🇧🇬' },
  { code: '+226', iso: 'BF', name: 'Burkina Faso',          flag: '🇧🇫' },
  { code: '+257', iso: 'BI', name: 'Burundi',               flag: '🇧🇮' },
  { code: '+855', iso: 'KH', name: 'Cambodia',              flag: '🇰🇭' },
  { code: '+237', iso: 'CM', name: 'Cameroon',              flag: '🇨🇲' },
  { code: '+1',   iso: 'CA', name: 'Canada',                flag: '🇨🇦' },
  { code: '+238', iso: 'CV', name: 'Cape Verde',            flag: '🇨🇻' },
  { code: '+236', iso: 'CF', name: 'Central African Rep.',  flag: '🇨🇫' },
  { code: '+235', iso: 'TD', name: 'Chad',                  flag: '🇹🇩' },
  { code: '+56',  iso: 'CL', name: 'Chile',                 flag: '🇨🇱' },
  { code: '+86',  iso: 'CN', name: 'China',                 flag: '🇨🇳' },
  { code: '+57',  iso: 'CO', name: 'Colombia',              flag: '🇨🇴' },
  { code: '+243', iso: 'CD', name: 'Congo (DRC)',           flag: '🇨🇩' },
  { code: '+242', iso: 'CG', name: 'Congo (Rep.)',          flag: '🇨🇬' },
  { code: '+506', iso: 'CR', name: 'Costa Rica',            flag: '🇨🇷' },
  { code: '+225', iso: 'CI', name: "Côte d'Ivoire",         flag: '🇨🇮' },
  { code: '+385', iso: 'HR', name: 'Croatia',               flag: '🇭🇷' },
  { code: '+53',  iso: 'CU', name: 'Cuba',                  flag: '🇨🇺' },
  { code: '+357', iso: 'CY', name: 'Cyprus',                flag: '🇨🇾' },
  { code: '+420', iso: 'CZ', name: 'Czech Republic',        flag: '🇨🇿' },
  { code: '+45',  iso: 'DK', name: 'Denmark',               flag: '🇩🇰' },
  { code: '+253', iso: 'DJ', name: 'Djibouti',              flag: '🇩🇯' },
  { code: '+1',   iso: 'DO', name: 'Dominican Republic',    flag: '🇩🇴' },
  { code: '+593', iso: 'EC', name: 'Ecuador',               flag: '🇪🇨' },
  { code: '+20',  iso: 'EG', name: 'Egypt',                 flag: '🇪🇬' },
  { code: '+503', iso: 'SV', name: 'El Salvador',           flag: '🇸🇻' },
  { code: '+240', iso: 'GQ', name: 'Equatorial Guinea',     flag: '🇬🇶' },
  { code: '+291', iso: 'ER', name: 'Eritrea',               flag: '🇪🇷' },
  { code: '+372', iso: 'EE', name: 'Estonia',               flag: '🇪🇪' },
  { code: '+251', iso: 'ET', name: 'Ethiopia',              flag: '🇪🇹' },
  { code: '+679', iso: 'FJ', name: 'Fiji',                  flag: '🇫🇯' },
  { code: '+358', iso: 'FI', name: 'Finland',               flag: '🇫🇮' },
  { code: '+33',  iso: 'FR', name: 'France',                flag: '🇫🇷' },
  { code: '+241', iso: 'GA', name: 'Gabon',                 flag: '🇬🇦' },
  { code: '+220', iso: 'GM', name: 'Gambia',                flag: '🇬🇲' },
  { code: '+995', iso: 'GE', name: 'Georgia',               flag: '🇬🇪' },
  { code: '+49',  iso: 'DE', name: 'Germany',               flag: '🇩🇪' },
  { code: '+233', iso: 'GH', name: 'Ghana',                 flag: '🇬🇭' },
  { code: '+30',  iso: 'GR', name: 'Greece',                flag: '🇬🇷' },
  { code: '+502', iso: 'GT', name: 'Guatemala',             flag: '🇬🇹' },
  { code: '+224', iso: 'GN', name: 'Guinea',                flag: '🇬🇳' },
  { code: '+245', iso: 'GW', name: 'Guinea-Bissau',         flag: '🇬🇼' },
  { code: '+592', iso: 'GY', name: 'Guyana',                flag: '🇬🇾' },
  { code: '+509', iso: 'HT', name: 'Haiti',                 flag: '🇭🇹' },
  { code: '+504', iso: 'HN', name: 'Honduras',              flag: '🇭🇳' },
  { code: '+36',  iso: 'HU', name: 'Hungary',               flag: '🇭🇺' },
  { code: '+354', iso: 'IS', name: 'Iceland',               flag: '🇮🇸' },
  { code: '+91',  iso: 'IN', name: 'India',                 flag: '🇮🇳' },
  { code: '+62',  iso: 'ID', name: 'Indonesia',             flag: '🇮🇩' },
  { code: '+98',  iso: 'IR', name: 'Iran',                  flag: '🇮🇷' },
  { code: '+964', iso: 'IQ', name: 'Iraq',                  flag: '🇮🇶' },
  { code: '+353', iso: 'IE', name: 'Ireland',               flag: '🇮🇪' },
  { code: '+972', iso: 'IL', name: 'Israel',                flag: '🇮🇱' },
  { code: '+39',  iso: 'IT', name: 'Italy',                 flag: '🇮🇹' },
  { code: '+1',   iso: 'JM', name: 'Jamaica',               flag: '🇯🇲' },
  { code: '+81',  iso: 'JP', name: 'Japan',                 flag: '🇯🇵' },
  { code: '+962', iso: 'JO', name: 'Jordan',                flag: '🇯🇴' },
  { code: '+7',   iso: 'KZ', name: 'Kazakhstan',            flag: '🇰🇿' },
  { code: '+254', iso: 'KE', name: 'Kenya',                 flag: '🇰🇪' },
  { code: '+965', iso: 'KW', name: 'Kuwait',                flag: '🇰🇼' },
  { code: '+996', iso: 'KG', name: 'Kyrgyzstan',            flag: '🇰🇬' },
  { code: '+856', iso: 'LA', name: 'Laos',                  flag: '🇱🇦' },
  { code: '+371', iso: 'LV', name: 'Latvia',                flag: '🇱🇻' },
  { code: '+961', iso: 'LB', name: 'Lebanon',               flag: '🇱🇧' },
  { code: '+266', iso: 'LS', name: 'Lesotho',               flag: '🇱🇸' },
  { code: '+231', iso: 'LR', name: 'Liberia',               flag: '🇱🇷' },
  { code: '+218', iso: 'LY', name: 'Libya',                 flag: '🇱🇾' },
  { code: '+423', iso: 'LI', name: 'Liechtenstein',         flag: '🇱🇮' },
  { code: '+370', iso: 'LT', name: 'Lithuania',             flag: '🇱🇹' },
  { code: '+352', iso: 'LU', name: 'Luxembourg',            flag: '🇱🇺' },
  { code: '+261', iso: 'MG', name: 'Madagascar',            flag: '🇲🇬' },
  { code: '+265', iso: 'MW', name: 'Malawi',                flag: '🇲🇼' },
  { code: '+60',  iso: 'MY', name: 'Malaysia',              flag: '🇲🇾' },
  { code: '+960', iso: 'MV', name: 'Maldives',              flag: '🇲🇻' },
  { code: '+223', iso: 'ML', name: 'Mali',                  flag: '🇲🇱' },
  { code: '+356', iso: 'MT', name: 'Malta',                 flag: '🇲🇹' },
  { code: '+222', iso: 'MR', name: 'Mauritania',            flag: '🇲🇷' },
  { code: '+230', iso: 'MU', name: 'Mauritius',             flag: '🇲🇺' },
  { code: '+52',  iso: 'MX', name: 'Mexico',                flag: '🇲🇽' },
  { code: '+373', iso: 'MD', name: 'Moldova',               flag: '🇲🇩' },
  { code: '+976', iso: 'MN', name: 'Mongolia',              flag: '🇲🇳' },
  { code: '+382', iso: 'ME', name: 'Montenegro',            flag: '🇲🇪' },
  { code: '+212', iso: 'MA', name: 'Morocco',               flag: '🇲🇦' },
  { code: '+258', iso: 'MZ', name: 'Mozambique',            flag: '🇲🇿' },
  { code: '+95',  iso: 'MM', name: 'Myanmar',               flag: '🇲🇲' },
  { code: '+264', iso: 'NA', name: 'Namibia',               flag: '🇳🇦' },
  { code: '+977', iso: 'NP', name: 'Nepal',                 flag: '🇳🇵' },
  { code: '+31',  iso: 'NL', name: 'Netherlands',           flag: '🇳🇱' },
  { code: '+64',  iso: 'NZ', name: 'New Zealand',           flag: '🇳🇿' },
  { code: '+505', iso: 'NI', name: 'Nicaragua',             flag: '🇳🇮' },
  { code: '+227', iso: 'NE', name: 'Niger',                 flag: '🇳🇪' },
  { code: '+234', iso: 'NG', name: 'Nigeria',               flag: '🇳🇬' },
  { code: '+389', iso: 'MK', name: 'North Macedonia',       flag: '🇲🇰' },
  { code: '+47',  iso: 'NO', name: 'Norway',                flag: '🇳🇴' },
  { code: '+968', iso: 'OM', name: 'Oman',                  flag: '🇴🇲' },
  { code: '+92',  iso: 'PK', name: 'Pakistan',              flag: '🇵🇰' },
  { code: '+507', iso: 'PA', name: 'Panama',                flag: '🇵🇦' },
  { code: '+675', iso: 'PG', name: 'Papua New Guinea',      flag: '🇵🇬' },
  { code: '+595', iso: 'PY', name: 'Paraguay',              flag: '🇵🇾' },
  { code: '+51',  iso: 'PE', name: 'Peru',                  flag: '🇵🇪' },
  { code: '+63',  iso: 'PH', name: 'Philippines',           flag: '🇵🇭' },
  { code: '+48',  iso: 'PL', name: 'Poland',                flag: '🇵🇱' },
  { code: '+351', iso: 'PT', name: 'Portugal',              flag: '🇵🇹' },
  { code: '+974', iso: 'QA', name: 'Qatar',                 flag: '🇶🇦' },
  { code: '+40',  iso: 'RO', name: 'Romania',               flag: '🇷🇴' },
  { code: '+7',   iso: 'RU', name: 'Russia',                flag: '🇷🇺' },
  { code: '+250', iso: 'RW', name: 'Rwanda',                flag: '🇷🇼' },
  { code: '+966', iso: 'SA', name: 'Saudi Arabia',          flag: '🇸🇦' },
  { code: '+221', iso: 'SN', name: 'Senegal',               flag: '🇸🇳' },
  { code: '+381', iso: 'RS', name: 'Serbia',                flag: '🇷🇸' },
  { code: '+232', iso: 'SL', name: 'Sierra Leone',          flag: '🇸🇱' },
  { code: '+65',  iso: 'SG', name: 'Singapore',             flag: '🇸🇬' },
  { code: '+421', iso: 'SK', name: 'Slovakia',              flag: '🇸🇰' },
  { code: '+386', iso: 'SI', name: 'Slovenia',              flag: '🇸🇮' },
  { code: '+252', iso: 'SO', name: 'Somalia',               flag: '🇸🇴' },
  { code: '+27',  iso: 'ZA', name: 'South Africa',          flag: '🇿🇦' },
  { code: '+82',  iso: 'KR', name: 'South Korea',           flag: '🇰🇷' },
  { code: '+211', iso: 'SS', name: 'South Sudan',           flag: '🇸🇸' },
  { code: '+34',  iso: 'ES', name: 'Spain',                 flag: '🇪🇸' },
  { code: '+94',  iso: 'LK', name: 'Sri Lanka',             flag: '🇱🇰' },
  { code: '+249', iso: 'SD', name: 'Sudan',                 flag: '🇸🇩' },
  { code: '+46',  iso: 'SE', name: 'Sweden',                flag: '🇸🇪' },
  { code: '+41',  iso: 'CH', name: 'Switzerland',           flag: '🇨🇭' },
  { code: '+963', iso: 'SY', name: 'Syria',                 flag: '🇸🇾' },
  { code: '+886', iso: 'TW', name: 'Taiwan',                flag: '🇹🇼' },
  { code: '+992', iso: 'TJ', name: 'Tajikistan',            flag: '🇹🇯' },
  { code: '+255', iso: 'TZ', name: 'Tanzania',              flag: '🇹🇿' },
  { code: '+66',  iso: 'TH', name: 'Thailand',              flag: '🇹🇭' },
  { code: '+228', iso: 'TG', name: 'Togo',                  flag: '🇹🇬' },
  { code: '+216', iso: 'TN', name: 'Tunisia',               flag: '🇹🇳' },
  { code: '+90',  iso: 'TR', name: 'Turkey',                flag: '🇹🇷' },
  { code: '+993', iso: 'TM', name: 'Turkmenistan',          flag: '🇹🇲' },
  { code: '+256', iso: 'UG', name: 'Uganda',                flag: '🇺🇬' },
  { code: '+380', iso: 'UA', name: 'Ukraine',               flag: '🇺🇦' },
  { code: '+971', iso: 'AE', name: 'United Arab Emirates',  flag: '🇦🇪' },
  { code: '+44',  iso: 'GB', name: 'United Kingdom',        flag: '🇬🇧' },
  { code: '+1',   iso: 'US', name: 'United States',         flag: '🇺🇸' },
  { code: '+598', iso: 'UY', name: 'Uruguay',               flag: '🇺🇾' },
  { code: '+998', iso: 'UZ', name: 'Uzbekistan',            flag: '🇺🇿' },
  { code: '+58',  iso: 'VE', name: 'Venezuela',             flag: '🇻🇪' },
  { code: '+84',  iso: 'VN', name: 'Vietnam',               flag: '🇻🇳' },
  { code: '+967', iso: 'YE', name: 'Yemen',                 flag: '🇾🇪' },
  { code: '+260', iso: 'ZM', name: 'Zambia',                flag: '🇿🇲' },
  { code: '+263', iso: 'ZW', name: 'Zimbabwe',              flag: '🇿🇼' },
];

// Lebanon first (most common for this app), then alphabetical
export const SORTED_COUNTRIES: Country[] = [
  COUNTRIES.find(c => c.iso === 'LB')!,
  ...COUNTRIES.filter(c => c.iso !== 'LB').sort((a, b) => a.name.localeCompare(b.name)),
];

export const DEFAULT_COUNTRY = COUNTRIES.find(c => c.iso === 'LB')!;

interface Props {
  value: string;
  onChangeText: (phone: string) => void;
  countryCode: string;
  onCountryChange: (country: Country) => void;
  placeholder?: string;
  style?: object;
}

export default function PhoneInput({
  value,
  onChangeText,
  countryCode,
  onCountryChange,
  placeholder = '70 123 456',
  style,
}: Props) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [search, setSearch] = useState('');

  const selectedCountry = useMemo(
    () => SORTED_COUNTRIES.find(c => c.code === countryCode) ?? DEFAULT_COUNTRY,
    [countryCode]
  );

  const filtered = useMemo(
    () => search.trim()
      ? SORTED_COUNTRIES.filter(c =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.code.includes(search) ||
          c.iso.toLowerCase().includes(search.toLowerCase()))
      : SORTED_COUNTRIES,
    [search]
  );

  return (
    <View style={[ph.row, style]}>
      {/* Country code button */}
      <TouchableOpacity
        style={ph.codeBtn}
        onPress={() => { setSearch(''); setPickerVisible(true); }}
        activeOpacity={0.7}
      >
        <Text style={ph.flag}>{selectedCountry.flag}</Text>
        <Text style={ph.code}>{selectedCountry.code}</Text>
        <Text style={ph.chevron}>▾</Text>
      </TouchableOpacity>

      {/* Number input */}
      <TextInput
        style={[ph.input, style]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.color.textMuted}
        keyboardType="phone-pad"
        autoCorrect={false}
      />

      {/* Picker modal */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <View style={ph.pickerOverlay}>
            <View style={ph.pickerSheet}>
              <View style={ph.pickerHeader}>
                <Text style={ph.pickerTitle}>Select Country</Text>
                <TouchableOpacity onPress={() => setPickerVisible(false)}>
                  <Text style={ph.pickerClose}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Search */}
              <View style={ph.searchRow}>
                <TextInput
                  style={ph.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search country or code..."
                  placeholderTextColor={theme.color.textMuted}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>

              <FlatList
                data={filtered}
                keyExtractor={(c) => c.iso}
                keyboardShouldPersistTaps="always"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      ph.countryRow,
                      item.iso === selectedCountry.iso && ph.countryRowActive,
                    ]}
                    onPress={() => {
                      onCountryChange(item);
                      setPickerVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={ph.countryFlag}>{item.flag}</Text>
                    <Text style={ph.countryName} numberOfLines={1}>{item.name}</Text>
                    <Text style={ph.countryCode}>{item.code}</Text>
                    {item.iso === selectedCountry.iso && (
                      <Text style={ph.checkMark}>✓</Text>
                    )}
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const ph = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  codeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.bgSurface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 4,
    minWidth: 88,
  },
  flag: { fontSize: 18 },
  code: { ...theme.typography.body, color: theme.color.textPrimary, fontWeight: '600', fontSize: 13 },
  chevron: { color: theme.color.textMuted, fontSize: 10 },
  input: {
    flex: 1,
    backgroundColor: theme.color.bgSurface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: 10,
    color: theme.color.textPrimary,
    ...theme.typography.body,
  },
  // Picker
  pickerOverlay: { flex: 1, backgroundColor: theme.color.overlayDark, justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: theme.color.bgBase,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '60%',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.space4,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  pickerTitle: { ...theme.typography.body, color: theme.color.textPrimary, fontWeight: '700', fontSize: 16 },
  pickerClose: { color: theme.color.textMuted, fontSize: 18, padding: 4 },
  searchRow: {
    paddingHorizontal: theme.spacing.space4,
    paddingVertical: theme.spacing.space2,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  searchInput: {
    backgroundColor: theme.color.bgSurface,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: 10,
    color: theme.color.textPrimary,
    ...theme.typography.body,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.space4,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border + '44',
    gap: 10,
  },
  countryRowActive: { backgroundColor: theme.color.primaryDim ?? (theme.color.primary + '11') },
  countryFlag: { fontSize: 22, width: 32 },
  countryName: { flex: 1, ...theme.typography.body, color: theme.color.textPrimary, fontSize: 14 },
  countryCode: { ...theme.typography.body, color: theme.color.textMuted, fontWeight: '600', fontSize: 13 },
  checkMark: { color: theme.color.primary, fontWeight: '700', fontSize: 16 },
});
