// src/lib/i18n.ts
// React Context-based multi-language system — no external library needed
// Supports: ar (Arabic/RTL), en (English), fr (French), + more

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
export type TranslationKey =
  // ── existing keys ──────────────────────────────────────────────────────────
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
  | 'welcomeTo'
  // ── tab labels ─────────────────────────────────────────────────────────────
  | 'tabDashboard' | 'tabCalendar' | 'tabCreate' | 'tabSettings'
  // ── screen titles ──────────────────────────────────────────────────────────
  | 'screenNewFile' | 'screenFileDetail' | 'screenClientProfile' | 'screenEditClient'
  | 'screenFinancialReport' | 'screenSearch' | 'screenMyAccount' | 'screenActivity'
  | 'screenNotifications' | 'screenBack' | 'screenClientFields' | 'screenTeamMemberFields'
  | 'screenServiceStages' | 'screenStageRequirements'
  // ── dashboard ──────────────────────────────────────────────────────────────
  | 'activeTab' | 'archiveTab' | 'manage' | 'clients' | 'services' | 'stages'
  | 'searchPlaceholder' | 'noFilesFound' | 'noFilesMatch'
  | 'quickFinance' | 'expense' | 'revenue' | 'viewFinancials'
  | 'filters' | 'clearFilters' | 'archiveFile' | 'restoreFile' | 'deleteFile' | 'editFile'
  | 'newClient' | 'newService' | 'newStage' | 'network'
  // ── file detail sections ───────────────────────────────────────────────────
  | 'stagesSection' | 'financialsSection' | 'documentsSection' | 'commentsSection'
  | 'addComment' | 'contractPrice' | 'paymentsReceived' | 'outstanding' | 'balance'
  | 'addStage' | 'addDocument' | 'requirementsSection' | 'assignTo' | 'dueDate'
  | 'updateStatus' | 'addRequirement' | 'scanDocument' | 'shareDoc' | 'openDoc'
  // ── settings ───────────────────────────────────────────────────────────────
  | 'general' | 'support' | 'about' | 'rtlMode' | 'appVersion' | 'financialReport' | 'clientFields'
  | 'helpGuide' | 'faq'
  // ── common ─────────────────────────────────────────────────────────────────
  | 'yes' | 'no' | 'required' | 'ok' | 'confirm'
  | 'importBtn' | 'preview'
  | 'noEventsToday' | 'stageDue'
  | 'city' | 'reference' | 'notes' | 'loading' | 'noResults' | 'add' | 'remove'
  // ── duplicate client ───────────────────────────────────────────────────────
  | 'duplicateClient' | 'createAnyway' | 'allDuplicates' | 'skippedDuplicates';

type Translations = Record<TranslationKey, string>;

const ar: Translations = {
  // ── existing ────────────────────────────────────────────────────────────────
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
  // ── tabs ────────────────────────────────────────────────────────────────────
  tabDashboard: 'الرئيسية',
  tabCalendar: 'التقويم',
  tabCreate: 'إنشاء',
  tabSettings: 'الإعدادات',
  // ── screen titles ────────────────────────────────────────────────────────────
  screenNewFile: 'ملف جديد',
  screenFileDetail: 'تفاصيل الملف',
  screenClientProfile: 'ملف العميل',
  screenEditClient: 'تعديل العميل',
  screenFinancialReport: 'التقرير المالي',
  screenSearch: 'البحث',
  screenMyAccount: 'حسابي',
  screenActivity: 'النشاط',
  screenNotifications: 'الإشعارات',
  screenBack: 'رجوع',
  screenClientFields: 'حقول العميل',
  screenTeamMemberFields: 'حقول الفريق',
  screenServiceStages: 'مراحل الخدمة',
  screenStageRequirements: 'متطلبات المرحلة',
  // ── dashboard ────────────────────────────────────────────────────────────────
  activeTab: '📋 نشط',
  archiveTab: '📦 أرشيف',
  manage: 'إدارة',
  clients: 'العملاء',
  services: 'الخدمات',
  stages: 'المراحل',
  searchPlaceholder: 'ابحث عن عميل أو خدمة...',
  noFilesFound: 'لا توجد ملفات',
  noFilesMatch: 'لا توجد ملفات مطابقة',
  quickFinance: 'إضافة مالية سريعة',
  expense: 'مصروف',
  revenue: 'إيراد',
  viewFinancials: 'عرض المالية الكاملة',
  filters: 'فلاتر',
  clearFilters: 'مسح الفلاتر',
  archiveFile: 'أرشفة',
  restoreFile: 'استعادة',
  deleteFile: 'حذف',
  editFile: 'تعديل',
  newClient: '+ عميل جديد',
  newService: '+ خدمة جديدة',
  newStage: '+ مرحلة جديدة',
  network: 'الشبكة',
  // ── file detail ──────────────────────────────────────────────────────────────
  stagesSection: 'المراحل',
  financialsSection: 'المالية',
  documentsSection: 'الوثائق',
  commentsSection: 'التعليقات',
  addComment: 'إضافة تعليق',
  contractPrice: 'السعر التعاقدي',
  paymentsReceived: 'المبالغ المستلمة',
  outstanding: 'المتبقي',
  balance: 'الرصيد',
  addStage: 'إضافة مرحلة',
  addDocument: 'إضافة وثيقة',
  requirementsSection: 'المتطلبات',
  assignTo: 'تعيين إلى',
  dueDate: 'تاريخ الاستحقاق',
  updateStatus: 'تحديث الحالة',
  addRequirement: 'إضافة متطلب',
  scanDocument: 'مسح وثيقة',
  shareDoc: 'مشاركة',
  openDoc: 'فتح',
  // ── settings ─────────────────────────────────────────────────────────────────
  general: 'عام',
  support: 'الدعم',
  about: 'حول',
  rtlMode: 'وضع RTL',
  appVersion: 'إصدار التطبيق',
  financialReport: 'التقرير المالي',
  clientFields: 'حقول العميل',
  helpGuide: 'دليل المساعدة',
  faq: 'الأسئلة الشائعة',
  // ── common ───────────────────────────────────────────────────────────────────
  yes: 'نعم',
  no: 'لا',
  required: 'مطلوب',
  ok: 'موافق',
  confirm: 'تأكيد',
  importBtn: '📥 استيراد',
  preview: 'معاينة',
  noEventsToday: 'لا توجد أحداث اليوم',
  stageDue: 'موعد المرحلة',
  city: 'المدينة',
  reference: 'المرجع',
  notes: 'ملاحظات',
  loading: 'جاري التحميل...',
  noResults: 'لا توجد نتائج',
  add: 'إضافة',
  remove: 'إزالة',
  duplicateClient: 'عميل مكرر',
  createAnyway: 'إنشاء على أي حال',
  allDuplicates: 'كلها مكررة',
  skippedDuplicates: 'تم تخطي المكررات',
};

const en: Translations = {
  // ── existing ────────────────────────────────────────────────────────────────
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
  // ── tabs ────────────────────────────────────────────────────────────────────
  tabDashboard: 'Dashboard',
  tabCalendar: 'Calendar',
  tabCreate: 'Create',
  tabSettings: 'Settings',
  // ── screen titles ────────────────────────────────────────────────────────────
  screenNewFile: 'New File',
  screenFileDetail: 'File Detail',
  screenClientProfile: 'Client Profile',
  screenEditClient: 'Edit Client',
  screenFinancialReport: 'Financial Report',
  screenSearch: 'Search',
  screenMyAccount: 'My Account',
  screenActivity: 'Activity',
  screenNotifications: 'Notifications',
  screenBack: 'Back',
  screenClientFields: 'Client Fields',
  screenTeamMemberFields: 'Team Member Fields',
  screenServiceStages: 'Service Stages',
  screenStageRequirements: 'Stage Requirements',
  // ── dashboard ────────────────────────────────────────────────────────────────
  activeTab: '📋 Active',
  archiveTab: '📦 Archive',
  manage: 'Manage',
  clients: 'Clients',
  services: 'Services',
  stages: 'Stages',
  searchPlaceholder: 'Search by client or service...',
  noFilesFound: 'No files found',
  noFilesMatch: 'No files match',
  quickFinance: 'Quick Finance',
  expense: 'Expense',
  revenue: 'Revenue',
  viewFinancials: 'View Full Financials',
  filters: 'Filters',
  clearFilters: 'Clear Filters',
  archiveFile: 'Archive',
  restoreFile: 'Restore',
  deleteFile: 'Delete',
  editFile: 'Edit',
  newClient: '+ New Client',
  newService: '+ New Service',
  newStage: '+ New Stage',
  network: 'Network',
  // ── file detail ──────────────────────────────────────────────────────────────
  stagesSection: 'Stages',
  financialsSection: 'Financials',
  documentsSection: 'Documents',
  commentsSection: 'Comments',
  addComment: 'Add Comment',
  contractPrice: 'Contract Price',
  paymentsReceived: 'Payments Received',
  outstanding: 'Outstanding',
  balance: 'Balance',
  addStage: 'Add Stage',
  addDocument: 'Add Document',
  requirementsSection: 'Requirements',
  assignTo: 'Assign To',
  dueDate: 'Due Date',
  updateStatus: 'Update Status',
  addRequirement: 'Add Requirement',
  scanDocument: 'Scan Document',
  shareDoc: 'Share',
  openDoc: 'Open',
  // ── settings ─────────────────────────────────────────────────────────────────
  general: 'General',
  support: 'Support',
  about: 'About',
  rtlMode: 'RTL Mode',
  appVersion: 'App Version',
  financialReport: 'Financial Report',
  clientFields: 'Client Fields',
  helpGuide: 'Help Guide',
  faq: 'FAQ',
  // ── common ───────────────────────────────────────────────────────────────────
  yes: 'Yes',
  no: 'No',
  required: 'Required',
  ok: 'OK',
  confirm: 'Confirm',
  importBtn: '📥 Import',
  preview: 'Preview',
  noEventsToday: 'No events today',
  stageDue: 'Stage Due',
  city: 'City',
  reference: 'Reference',
  notes: 'Notes',
  loading: 'Loading...',
  noResults: 'No results',
  add: 'Add',
  remove: 'Remove',
  duplicateClient: 'Duplicate Client',
  createAnyway: 'Create Anyway',
  allDuplicates: 'All Duplicates',
  skippedDuplicates: 'Duplicates Skipped',
};

const fr: Translations = {
  // ── existing ────────────────────────────────────────────────────────────────
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
  // ── tabs ────────────────────────────────────────────────────────────────────
  tabDashboard: 'Accueil',
  tabCalendar: 'Calendrier',
  tabCreate: 'Créer',
  tabSettings: 'Paramètres',
  // ── screen titles ────────────────────────────────────────────────────────────
  screenNewFile: 'Nouveau dossier',
  screenFileDetail: 'Détail du dossier',
  screenClientProfile: 'Profil client',
  screenEditClient: 'Modifier client',
  screenFinancialReport: 'Rapport financier',
  screenSearch: 'Rechercher',
  screenMyAccount: 'Mon compte',
  screenActivity: 'Activité',
  screenNotifications: 'Notifications',
  screenBack: 'Retour',
  screenClientFields: 'Champs client',
  screenTeamMemberFields: 'Champs équipe',
  screenServiceStages: 'Étapes du service',
  screenStageRequirements: 'Exigences de l\'étape',
  // ── dashboard ────────────────────────────────────────────────────────────────
  activeTab: '📋 Actif',
  archiveTab: '📦 Archives',
  manage: 'Gérer',
  clients: 'Clients',
  services: 'Services',
  stages: 'Étapes',
  searchPlaceholder: 'Rechercher par client ou service...',
  noFilesFound: 'Aucun dossier trouvé',
  noFilesMatch: 'Aucun dossier correspondant',
  quickFinance: 'Finance rapide',
  expense: 'Dépense',
  revenue: 'Revenu',
  viewFinancials: 'Voir les finances complètes',
  filters: 'Filtres',
  clearFilters: 'Effacer les filtres',
  archiveFile: 'Archiver',
  restoreFile: 'Restaurer',
  deleteFile: 'Supprimer',
  editFile: 'Modifier',
  newClient: '+ Nouveau client',
  newService: '+ Nouveau service',
  newStage: '+ Nouvelle étape',
  network: 'Réseau',
  // ── file detail ──────────────────────────────────────────────────────────────
  stagesSection: 'Étapes',
  financialsSection: 'Finances',
  documentsSection: 'Documents',
  commentsSection: 'Commentaires',
  addComment: 'Ajouter un commentaire',
  contractPrice: 'Prix contractuel',
  paymentsReceived: 'Paiements reçus',
  outstanding: 'Solde dû',
  balance: 'Solde',
  addStage: 'Ajouter une étape',
  addDocument: 'Ajouter un document',
  requirementsSection: 'Exigences',
  assignTo: 'Assigner à',
  dueDate: 'Date d\'échéance',
  updateStatus: 'Mettre à jour le statut',
  addRequirement: 'Ajouter une exigence',
  scanDocument: 'Scanner un document',
  shareDoc: 'Partager',
  openDoc: 'Ouvrir',
  // ── settings ─────────────────────────────────────────────────────────────────
  general: 'Général',
  support: 'Support',
  about: 'À propos',
  rtlMode: 'Mode RTL',
  appVersion: 'Version de l\'application',
  financialReport: 'Rapport financier',
  clientFields: 'Champs client',
  helpGuide: 'Guide d\'aide',
  faq: 'FAQ',
  // ── common ───────────────────────────────────────────────────────────────────
  yes: 'Oui',
  no: 'Non',
  required: 'Requis',
  ok: 'OK',
  confirm: 'Confirmer',
  importBtn: '📥 Importer',
  preview: 'Aperçu',
  noEventsToday: 'Aucun événement aujourd\'hui',
  stageDue: 'Échéance de l\'étape',
  city: 'Ville',
  reference: 'Référence',
  notes: 'Notes',
  loading: 'Chargement...',
  noResults: 'Aucun résultat',
  add: 'Ajouter',
  remove: 'Supprimer',
  duplicateClient: 'Client en double',
  createAnyway: 'Créer quand même',
  allDuplicates: 'Tous en double',
  skippedDuplicates: 'Doublons ignorés',
};

// Fallback: use English for all other languages
const TRANSLATIONS: Record<string, Translations> = { ar, en, fr };

// ─── Legacy module-level API (non-reactive) ──────────────────────────────────
// These remain for backward compatibility with code that imports t() directly.
// For reactive updates, use useTranslation() instead.

let currentLang = 'en';

export function setCurrentLang(code: string) {
  currentLang = code;
}

export function getCurrentLang(): string {
  return currentLang;
}

export function t(key: TranslationKey): string {
  const dict = TRANSLATIONS[currentLang] ?? TRANSLATIONS['en'];
  return (dict as any)[key] ?? (TRANSLATIONS['en'] as any)[key] ?? key;
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
  const lang = LANGUAGES.find(l => l.code === code);
  if (lang?.rtl !== I18nManager.isRTL) {
    I18nManager.forceRTL(lang?.rtl ?? false);
  }
}

export function isFirstLaunchKey(): string {
  return '@language_selected';
}

// ─── React Context ───────────────────────────────────────────────────────────

interface LanguageContextType {
  lang: string;
  setLang: (code: string) => Promise<void>;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  setLang: async () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState('en');

  useEffect(() => {
    loadLanguage().then((code) => setLangState(code));
  }, []);

  const setLang = useCallback(async (code: string) => {
    await saveLanguage(code);
    setLangState(code);
  }, []);

  const tFn = useCallback(
    (key: TranslationKey): string => {
      const dict = TRANSLATIONS[lang] ?? TRANSLATIONS['en'];
      return (dict as any)[key] ?? (TRANSLATIONS['en'] as any)[key] ?? key;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: tFn }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
