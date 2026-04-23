// src/lib/i18n.ts
// Simple multi-language system — no external library needed
// Supports: ar (Arabic/RTL), en (English), fr (French), + more

import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';

export const LANG_KEY = '@app_language';

export interface Language {
  code: string;
  name: string;         // in its own language
  nameEn: string;       // in English
  flag: string;
  rtl: boolean;
}

export const LANGUAGES: Language[] = [
  { code: 'ar', name: 'العربية',    nameEn: 'Arabic',     flag: '🇱🇧', rtl: true  },
  { code: 'en', name: 'English',    nameEn: 'English',    flag: '🇺🇸', rtl: false },
  { code: 'fr', name: 'Français',   nameEn: 'French',     flag: '🇫🇷', rtl: false },
  { code: 'es', name: 'Español',    nameEn: 'Spanish',    flag: '🇪🇸', rtl: false },
  { code: 'de', name: 'Deutsch',    nameEn: 'German',     flag: '🇩🇪', rtl: false },
  { code: 'pt', name: 'Português',  nameEn: 'Portuguese', flag: '🇧🇷', rtl: false },
  { code: 'tr', name: 'Türkçe',     nameEn: 'Turkish',    flag: '🇹🇷', rtl: false },
  { code: 'fa', name: 'فارسی',      nameEn: 'Persian',    flag: '🇮🇷', rtl: true  },
  { code: 'ru', name: 'Русский',    nameEn: 'Russian',    flag: '🇷🇺', rtl: false },
  { code: 'zh', name: '中文',       nameEn: 'Chinese',    flag: '🇨🇳', rtl: false },
  { code: 'ja', name: '日本語',     nameEn: 'Japanese',   flag: '🇯🇵', rtl: false },
  { code: 'ko', name: '한국어',     nameEn: 'Korean',     flag: '🇰🇷', rtl: false },
  { code: 'hi', name: 'हिन्दी',   nameEn: 'Hindi',      flag: '🇮🇳', rtl: false },
  { code: 'ur', name: 'اردو',       nameEn: 'Urdu',       flag: '🇵🇰', rtl: true  },
  { code: 'it', name: 'Italiano',   nameEn: 'Italian',    flag: '🇮🇹', rtl: false },
  { code: 'nl', name: 'Nederlands', nameEn: 'Dutch',      flag: '🇳🇱', rtl: false },
];

// Translation strings
type TranslationKey =
  | 'dashboard' | 'calendar' | 'create' | 'settings'
  | 'newFile' | 'fileDetail' | 'activity' | 'search'
  | 'signOut' | 'signIn' | 'register' | 'language'
  | 'theme' | 'teamMembers' | 'notifications'
  | 'reportBug' | 'contactUs' | 'myAccount'
  | 'active' | 'archived' | 'overdue' | 'allFiles' | 'myFiles'
  | 'delete' | 'edit' | 'save' | 'cancel' | 'close'
  | 'name' | 'email' | 'phone' | 'password' | 'company'
  | 'invite' | 'role' | 'owner' | 'admin' | 'member' | 'viewer'
  | 'sendMessage' | 'subject' | 'message' | 'send'
  | 'poweredBy' | 'selectLanguage' | 'continueBtn'
  | 'welcomeTo';

type Translations = Record<TranslationKey, string>;

const ar: Translations = {
  dashboard: 'لوحة التحكم',
  calendar: 'التقويم',
  create: 'إنشاء',
  settings: 'الإعدادات',
  newFile: 'ملف جديد',
  fileDetail: 'تفاصيل الملف',
  activity: 'النشاط',
  search: 'بحث',
  signOut: 'تسجيل الخروج',
  signIn: 'تسجيل الدخول',
  register: 'إنشاء حساب',
  language: 'اللغة',
  theme: 'المظهر',
  teamMembers: 'أعضاء الفريق',
  notifications: 'الإشعارات',
  reportBug: 'الإبلاغ عن خطأ',
  contactUs: 'اتصل بنا',
  myAccount: 'حسابي',
  active: 'نشط',
  archived: 'مؤرشف',
  overdue: 'متأخر',
  allFiles: '🌐 كل الملفات',
  myFiles: '👤 ملفاتي',
  delete: 'حذف',
  edit: 'تعديل',
  save: 'حفظ',
  cancel: 'إلغاء',
  close: 'إغلاق',
  name: 'الاسم',
  email: 'البريد الإلكتروني',
  phone: 'رقم الهاتف',
  password: 'كلمة المرور',
  company: 'اسم الشركة',
  invite: 'دعوة',
  role: 'الدور',
  owner: 'مالك',
  admin: 'مسؤول',
  member: 'عضو',
  viewer: 'مشاهد',
  sendMessage: 'إرسال رسالة',
  subject: 'الموضوع',
  message: 'الرسالة',
  send: 'إرسال',
  poweredBy: 'مدعوم من KTS',
  selectLanguage: 'اختر لغتك',
  continueBtn: 'متابعة',
  welcomeTo: 'مرحباً بك في',
};

const en: Translations = {
  dashboard: 'Dashboard',
  calendar: 'Calendar',
  create: 'Create',
  settings: 'Settings',
  newFile: 'New File',
  fileDetail: 'File Detail',
  activity: 'Activity',
  search: 'Search',
  signOut: 'Sign Out',
  signIn: 'Sign In',
  register: 'Create Account',
  language: 'Language',
  theme: 'Theme',
  teamMembers: 'Team Members',
  notifications: 'Notifications',
  reportBug: 'Report a Bug',
  contactUs: 'Contact Us',
  myAccount: 'My Account',
  active: 'Active',
  archived: 'Archived',
  overdue: 'Overdue',
  allFiles: '🌐 All Files',
  myFiles: '👤 My Files',
  delete: 'Delete',
  edit: 'Edit',
  save: 'Save',
  cancel: 'Cancel',
  close: 'Close',
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  password: 'Password',
  company: 'Company',
  invite: 'Invite',
  role: 'Role',
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
  sendMessage: 'Send Message',
  subject: 'Subject',
  message: 'Message',
  send: 'Send',
  poweredBy: 'Powered by KTS',
  selectLanguage: 'Choose your language',
  continueBtn: 'Continue',
  welcomeTo: 'Welcome to',
};

const fr: Translations = {
  dashboard: 'Tableau de bord',
  calendar: 'Calendrier',
  create: 'Créer',
  settings: 'Paramètres',
  newFile: 'Nouveau dossier',
  fileDetail: 'Détail du dossier',
  activity: 'Activité',
  search: 'Recherche',
  signOut: 'Déconnexion',
  signIn: 'Connexion',
  register: 'Créer un compte',
  language: 'Langue',
  theme: 'Thème',
  teamMembers: 'Membres de l\'équipe',
  notifications: 'Notifications',
  reportBug: 'Signaler un bug',
  contactUs: 'Contactez-nous',
  myAccount: 'Mon compte',
  active: 'Actif',
  archived: 'Archivé',
  overdue: 'En retard',
  allFiles: '🌐 Tous les dossiers',
  myFiles: '👤 Mes dossiers',
  delete: 'Supprimer',
  edit: 'Modifier',
  save: 'Enregistrer',
  cancel: 'Annuler',
  close: 'Fermer',
  name: 'Nom',
  email: 'E-mail',
  phone: 'Téléphone',
  password: 'Mot de passe',
  company: 'Entreprise',
  invite: 'Inviter',
  role: 'Rôle',
  owner: 'Propriétaire',
  admin: 'Admin',
  member: 'Membre',
  viewer: 'Observateur',
  sendMessage: 'Envoyer un message',
  subject: 'Sujet',
  message: 'Message',
  send: 'Envoyer',
  poweredBy: 'Propulsé par KTS',
  selectLanguage: 'Choisissez votre langue',
  continueBtn: 'Continuer',
  welcomeTo: 'Bienvenue sur',
};

// Fallback: use English for all other languages
const TRANSLATIONS: Record<string, Translations> = { ar, en, fr };

let currentLang = 'en';

export function setCurrentLang(code: string) {
  currentLang = code;
}

export function getCurrentLang(): string {
  return currentLang;
}

export function t(key: TranslationKey): string {
  const dict = TRANSLATIONS[currentLang] ?? TRANSLATIONS['en'];
  return dict[key] ?? TRANSLATIONS['en'][key] ?? key;
}

export async function loadLanguage(): Promise<string> {
  const saved = await AsyncStorage.getItem(LANG_KEY);
  const code = saved ?? 'en';
  setCurrentLang(code);
  const lang = LANGUAGES.find(l => l.code === code);
  if (lang?.rtl !== I18nManager.isRTL) {
    I18nManager.forceRTL(lang?.rtl ?? false);
  }
  return code;
}

export async function saveLanguage(code: string): Promise<void> {
  await AsyncStorage.setItem(LANG_KEY, code);
  setCurrentLang(code);
}

export function isFirstLaunchKey(): string {
  return '@language_selected';
}
