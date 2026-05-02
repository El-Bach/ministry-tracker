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
  | 'duplicateClient' | 'createAnyway' | 'allDuplicates' | 'skippedDuplicates'
  // ── common buttons & actions ───────────────────────────────────────────────
  | 'update' | 'createBtn' | 'apply' | 'reset' | 'submit' | 'done' | 'next' | 'back' | 'skip'
  | 'retry' | 'refresh' | 'reload' | 'copy' | 'copied' | 'paste' | 'share' | 'open'
  | 'download' | 'upload' | 'attach' | 'detach' | 'select' | 'selectAll' | 'deselect'
  | 'expand' | 'collapse' | 'showMore' | 'showLess' | 'showAll' | 'hide' | 'view'
  | 'duplicate' | 'archive' | 'unarchive' | 'restore' | 'pin' | 'unpin'
  | 'enable' | 'disable' | 'enabled' | 'disabled' | 'on' | 'off'
  // ── form fields & placeholders ─────────────────────────────────────────────
  | 'fullName' | 'fullNameRequired' | 'firstName' | 'lastName'
  | 'phoneNumber' | 'phoneNumberOpt' | 'referenceName' | 'referencePhone' | 'referenceOpt'
  | 'optional' | 'required2'
  | 'address' | 'description' | 'descriptionOpt' | 'title' | 'titleOpt'
  | 'price' | 'amount' | 'amountUSD' | 'amountLBP' | 'currency' | 'date' | 'time'
  | 'searchInput' | 'searchClient' | 'searchService' | 'searchStage' | 'searchCity'
  | 'searchCountry' | 'searchContact' | 'searchMember' | 'searchFile'
  | 'enterName' | 'enterPhone' | 'enterEmail' | 'enterPassword' | 'enterCode'
  | 'enterAmount' | 'enterDescription' | 'enterTitle' | 'enterNotes'
  | 'pickDate' | 'pickCity' | 'pickAssignee' | 'pickService' | 'pickStage' | 'pickClient'
  | 'pickCountry' | 'pickRole'
  // ── client fields ──────────────────────────────────────────────────────────
  | 'clientInfo' | 'clientName' | 'clientPhone' | 'newClientFull' | 'editClient2'
  | 'addClient' | 'addNewClient' | 'createNewClient'
  | 'noClients' | 'noClientsMatch' | 'clientCount'
  // ── files / tasks ──────────────────────────────────────────────────────────
  | 'file' | 'files' | 'fileDetails' | 'fileNotes' | 'fileNumber' | 'opened'
  | 'fileService' | 'fileClient' | 'fileStatus' | 'fileNotFound'
  | 'newFileBtn' | 'createNewFile' | 'addFile'
  | 'archiveTitle' | 'archiveCount'
  // ── stages ─────────────────────────────────────────────────────────────────
  | 'stage' | 'stage2' | 'stageName' | 'stageStatus' | 'stageNotes' | 'stageNumber'
  | 'addNewStage' | 'editStages' | 'editStage' | 'deleteStage' | 'reorderStages'
  | 'setCity' | 'setAssignee' | 'setDueDate' | 'clearDueDate' | 'rejectionReason'
  | 'stageRequirements' | 'noStages' | 'stagesAddedAuto'
  // ── statuses ───────────────────────────────────────────────────────────────
  | 'statusSubmitted' | 'statusInReview' | 'statusPendingSig' | 'statusDone'
  | 'statusRejected' | 'statusReceivedClosed' | 'statusPending' | 'mostUrgent'
  // ── financials ─────────────────────────────────────────────────────────────
  | 'financials' | 'addExpense' | 'addRevenue' | 'addPayment' | 'editTransaction'
  | 'deleteTransaction' | 'transaction' | 'transactions' | 'noTransactions'
  | 'totalExpenses' | 'totalRevenue' | 'netBalance' | 'received' | 'due'
  | 'cvUSD' | 'exchangeRate' | 'editRate' | 'priceHistory'
  | 'linkToStage' | 'clearStage' | 'stageOpt'
  // ── documents ──────────────────────────────────────────────────────────────
  | 'document' | 'documents' | 'noDocuments' | 'documentName' | 'requiredDocs'
  | 'scanDoc' | 'addPDF' | 'addImage' | 'renameDoc' | 'deleteDoc'
  | 'uploadDocument' | 'saveScan' | 'rotate' | 'crop' | 'applyCrop'
  // ── comments ───────────────────────────────────────────────────────────────
  | 'comment' | 'comments' | 'noComments' | 'writeComment' | 'editComment'
  | 'deleteComment' | 'voiceNote' | 'recording' | 'tapToRecord' | 'tapToStop'
  // ── alerts & confirms ──────────────────────────────────────────────────────
  | 'error' | 'success' | 'warning' | 'info'
  | 'confirmDelete' | 'cannotUndo' | 'areYouSure' | 'discardChanges'
  | 'connectionError' | 'tryAgain' | 'somethingWrong' | 'pleaseWait'
  | 'fieldRequired' | 'invalidPhone' | 'invalidEmail' | 'passwordTooShort'
  | 'passwordsMatch' | 'noChanges' | 'saved' | 'savedSuccess' | 'failedToSave'
  // ── auth ───────────────────────────────────────────────────────────────────
  | 'login' | 'loginTitle' | 'loginFailed' | 'forgotPassword' | 'resetPassword'
  | 'sendResetLink' | 'resetSent' | 'noAccount' | 'createAccount' | 'haveAccount'
  | 'inviteCode' | 'enterInviteCode' | 'validateCode' | 'codeNotFound'
  | 'codeDeactivated' | 'phoneLocked' | 'createOrganization' | 'orgName'
  | 'organizationName' | 'newOrgFlow' | 'invitedBy' | 'youInvitedTo'
  | 'showPassword' | 'hidePassword' | 'confirmPassword' | 'changePassword'
  // ── account / settings ─────────────────────────────────────────────────────
  | 'profile' | 'security' | 'preferences' | 'plan' | 'currentPlan'
  | 'upgrade' | 'upgradeNow' | 'planLimits' | 'daysRemaining' | 'planExceeded'
  | 'deleteAccount' | 'deleteAccountWarn' | 'signedOut'
  | 'pickLanguage' | 'darkMode' | 'lightMode' | 'fontSize' | 'fontSmall' | 'fontLarge'
  | 'privacyPolicy' | 'termsOfService' | 'contactSupport'
  // ── network / contacts ─────────────────────────────────────────────────────
  | 'contact' | 'contacts' | 'addContact' | 'editContact' | 'deleteContact'
  | 'noContacts' | 'noContactsMatch' | 'callBtn' | 'whatsappBtn'
  // ── ministry / service ─────────────────────────────────────────────────────
  | 'ministry' | 'ministries' | 'service' | 'addService' | 'editService' | 'deleteService'
  | 'noServices' | 'serviceName' | 'servicePrice' | 'addStageBtn' | 'createStage'
  // ── team / permissions ─────────────────────────────────────────────────────
  | 'team' | 'teamMember' | 'addMember' | 'inviteMember' | 'removeMember'
  | 'permissions' | 'visibility' | 'visibilityPerms'
  | 'roleOwner' | 'roleAdmin' | 'roleMember' | 'roleViewer'
  | 'permFiles' | 'permStages' | 'permFinancials' | 'permDocs' | 'permClients' | 'permComments'
  // ── empty states ───────────────────────────────────────────────────────────
  | 'nothingHere' | 'emptyList' | 'startByAdding' | 'comingSoon'
  // ── time ───────────────────────────────────────────────────────────────────
  | 'today' | 'yesterday' | 'tomorrow' | 'thisWeek' | 'lastWeek' | 'thisMonth'
  | 'justNow' | 'minutesAgo' | 'hoursAgo' | 'daysAgo'
  // ── misc ───────────────────────────────────────────────────────────────────
  | 'all' | 'none' | 'others' | 'count' | 'total' | 'subtotal' | 'summary'
  | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'assignedTo'
  | 'pleaseSignIn' | 'noPermission' | 'accessRestricted'
  | 'close2' | 'minimize' | 'maximize' | 'options';

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
  // ── common buttons & actions ────
  update: 'تحديث', createBtn: 'إنشاء', apply: 'تطبيق', reset: 'إعادة تعيين',
  submit: 'إرسال', done: 'تم', next: 'التالي', back: 'رجوع', skip: 'تخطي',
  retry: 'إعادة المحاولة', refresh: 'تحديث', reload: 'إعادة التحميل',
  copy: 'نسخ', copied: 'تم النسخ', paste: 'لصق', share: 'مشاركة', open: 'فتح',
  download: 'تحميل', upload: 'رفع', attach: 'إرفاق', detach: 'فصل',
  select: 'اختيار', selectAll: 'تحديد الكل', deselect: 'إلغاء التحديد',
  expand: 'توسيع', collapse: 'طي', showMore: 'عرض المزيد', showLess: 'عرض أقل',
  showAll: 'عرض الكل', hide: 'إخفاء', view: 'عرض',
  duplicate: 'تكرار', archive: 'أرشفة', unarchive: 'إلغاء الأرشفة',
  restore: 'استعادة', pin: 'تثبيت', unpin: 'إلغاء التثبيت',
  enable: 'تفعيل', disable: 'تعطيل', enabled: 'مفعّل', disabled: 'معطّل',
  on: 'مفعّل', off: 'معطّل',
  // ── form fields ────
  fullName: 'الاسم الكامل', fullNameRequired: 'الاسم الكامل *',
  firstName: 'الاسم الأول', lastName: 'الاسم الأخير',
  phoneNumber: 'رقم الهاتف', phoneNumberOpt: 'رقم الهاتف (اختياري)',
  referenceName: 'اسم المرجع', referencePhone: 'هاتف المرجع',
  referenceOpt: 'المرجع (اختياري)',
  optional: 'اختياري', required2: 'مطلوب',
  address: 'العنوان', description: 'الوصف', descriptionOpt: 'الوصف (اختياري)',
  title: 'العنوان', titleOpt: 'العنوان (اختياري)',
  price: 'السعر', amount: 'المبلغ', amountUSD: 'المبلغ بالدولار',
  amountLBP: 'المبلغ بالليرة اللبنانية', currency: 'العملة',
  date: 'التاريخ', time: 'الوقت',
  searchInput: 'بحث...', searchClient: 'ابحث عن عميل...',
  searchService: 'ابحث عن خدمة...', searchStage: 'ابحث عن مرحلة...',
  searchCity: 'ابحث عن مدينة...', searchCountry: 'ابحث عن دولة...',
  searchContact: 'ابحث عن جهة اتصال...', searchMember: 'ابحث عن عضو...',
  searchFile: 'ابحث عن ملف...',
  enterName: 'أدخل الاسم', enterPhone: 'أدخل رقم الهاتف',
  enterEmail: 'أدخل البريد الإلكتروني', enterPassword: 'أدخل كلمة المرور',
  enterCode: 'أدخل الرمز', enterAmount: 'أدخل المبلغ',
  enterDescription: 'أدخل الوصف', enterTitle: 'أدخل العنوان',
  enterNotes: 'أدخل ملاحظات',
  pickDate: 'اختر تاريخ', pickCity: 'اختر مدينة', pickAssignee: 'اختر شخصاً',
  pickService: 'اختر خدمة', pickStage: 'اختر مرحلة', pickClient: 'اختر عميلاً',
  pickCountry: 'اختر دولة', pickRole: 'اختر دوراً',
  // ── client ────
  clientInfo: 'معلومات العميل', clientName: 'اسم العميل', clientPhone: 'هاتف العميل',
  newClientFull: 'عميل جديد', editClient2: 'تعديل العميل',
  addClient: 'إضافة عميل', addNewClient: 'إضافة عميل جديد',
  createNewClient: 'إنشاء عميل جديد',
  noClients: 'لا يوجد عملاء بعد', noClientsMatch: 'لا توجد نتائج مطابقة',
  clientCount: 'عدد العملاء',
  // ── files ────
  file: 'ملف', files: 'ملفات', fileDetails: 'تفاصيل الملف',
  fileNotes: 'ملاحظات', fileNumber: 'رقم الملف', opened: 'تاريخ الفتح',
  fileService: 'الخدمة', fileClient: 'العميل', fileStatus: 'الحالة',
  fileNotFound: 'الملف غير موجود',
  newFileBtn: '+ ملف جديد', createNewFile: 'إنشاء ملف جديد', addFile: 'إضافة ملف',
  archiveTitle: '📦 الأرشيف', archiveCount: 'عدد الملفات المؤرشفة',
  // ── stages ────
  stage: 'مرحلة', stage2: 'المرحلة', stageName: 'اسم المرحلة',
  stageStatus: 'حالة المرحلة', stageNotes: 'ملاحظات المرحلة',
  stageNumber: 'رقم المرحلة',
  addNewStage: 'إضافة مرحلة جديدة', editStages: 'تعديل المراحل',
  editStage: 'تعديل المرحلة', deleteStage: 'حذف المرحلة',
  reorderStages: 'إعادة ترتيب المراحل',
  setCity: '📍 تعيين المدينة', setAssignee: '👤 تعيين الشخص',
  setDueDate: '📅 تعيين تاريخ الاستحقاق', clearDueDate: '✕ مسح التاريخ',
  rejectionReason: 'سبب الرفض',
  stageRequirements: 'متطلبات المرحلة', noStages: 'لا توجد مراحل',
  stagesAddedAuto: 'سيتم إضافة المراحل تلقائياً',
  // ── statuses ────
  statusSubmitted: 'مُقدَّم', statusInReview: 'قيد المراجعة',
  statusPendingSig: 'بانتظار التوقيع', statusDone: 'منجز',
  statusRejected: 'مرفوض', statusReceivedClosed: 'مستلَم ومغلق',
  statusPending: 'معلق', mostUrgent: 'الأكثر إلحاحاً',
  // ── financials ────
  financials: 'الشؤون المالية', addExpense: 'إضافة مصروف',
  addRevenue: 'إضافة إيراد', addPayment: 'إضافة دفعة',
  editTransaction: 'تعديل المعاملة', deleteTransaction: 'حذف المعاملة',
  transaction: 'معاملة', transactions: 'المعاملات',
  noTransactions: 'لا توجد معاملات',
  totalExpenses: 'إجمالي المصاريف', totalRevenue: 'إجمالي الإيرادات',
  netBalance: 'الرصيد الصافي', received: 'مستلم', due: 'مستحق',
  cvUSD: 'ما يعادل بالدولار', exchangeRate: 'سعر الصرف',
  editRate: 'تعديل سعر الصرف', priceHistory: 'سجل الأسعار',
  linkToStage: 'ربط بمرحلة', clearStage: 'مسح المرحلة', stageOpt: 'المرحلة (اختياري)',
  // ── documents ────
  document: 'مستند', documents: 'المستندات', noDocuments: 'لا توجد مستندات',
  documentName: 'اسم المستند', requiredDocs: 'المستندات المطلوبة',
  scanDoc: '📷 مسح ضوئي', addPDF: '📄 PDF', addImage: '🖼 صورة',
  renameDoc: '✎ إعادة تسمية', deleteDoc: '✕ حذف',
  uploadDocument: 'رفع مستند', saveScan: 'حفظ المسح',
  rotate: 'تدوير', crop: '✂ قص', applyCrop: '✓ تطبيق القص',
  // ── comments ────
  comment: 'تعليق', comments: 'التعليقات', noComments: 'لا توجد تعليقات',
  writeComment: 'اكتب تعليقاً...', editComment: 'تعديل التعليق',
  deleteComment: 'حذف التعليق', voiceNote: '🎤 ملاحظة صوتية',
  recording: 'جاري التسجيل...', tapToRecord: 'اضغط للتسجيل',
  tapToStop: 'اضغط للإيقاف',
  // ── alerts ────
  error: 'خطأ', success: 'نجاح', warning: 'تحذير', info: 'معلومة',
  confirmDelete: 'تأكيد الحذف', cannotUndo: 'لا يمكن التراجع',
  areYouSure: 'هل أنت متأكد؟', discardChanges: 'تجاهل التغييرات؟',
  connectionError: 'خطأ في الاتصال', tryAgain: 'حاول مرة أخرى',
  somethingWrong: 'حدث خطأ ما', pleaseWait: 'يرجى الانتظار...',
  fieldRequired: 'هذا الحقل مطلوب', invalidPhone: 'رقم هاتف غير صالح',
  invalidEmail: 'بريد إلكتروني غير صالح', passwordTooShort: 'كلمة المرور قصيرة جداً',
  passwordsMatch: 'كلمتا المرور غير متطابقتين', noChanges: 'لا توجد تغييرات',
  saved: 'تم الحفظ', savedSuccess: 'تم الحفظ بنجاح', failedToSave: 'فشل الحفظ',
  // ── auth ────
  login: 'دخول', loginTitle: 'تسجيل الدخول', loginFailed: 'فشل تسجيل الدخول',
  forgotPassword: 'نسيت كلمة المرور؟', resetPassword: 'إعادة تعيين كلمة المرور',
  sendResetLink: 'إرسال رابط الإعادة', resetSent: 'تم إرسال الرابط',
  noAccount: 'ليس لديك حساب؟', createAccount: 'إنشاء حساب',
  haveAccount: 'لديك حساب بالفعل؟',
  inviteCode: 'رمز الدعوة', enterInviteCode: 'أدخل رمز الدعوة',
  validateCode: 'تحقق من الرمز', codeNotFound: 'الرمز غير موجود',
  codeDeactivated: 'تم إلغاء تفعيل الرمز', phoneLocked: 'هذا الرمز مخصص لرقم هاتف آخر',
  createOrganization: 'إنشاء مؤسسة', orgName: 'اسم المؤسسة',
  organizationName: 'اسم المؤسسة', newOrgFlow: 'مؤسسة جديدة',
  invitedBy: 'تمت دعوتك من', youInvitedTo: 'تمت دعوتك إلى',
  showPassword: 'إظهار', hidePassword: 'إخفاء',
  confirmPassword: 'تأكيد كلمة المرور', changePassword: 'تغيير كلمة المرور',
  // ── account / settings ────
  profile: 'الملف الشخصي', security: 'الأمان', preferences: 'التفضيلات',
  plan: 'الباقة', currentPlan: 'الباقة الحالية',
  upgrade: 'ترقية', upgradeNow: 'ترقية الآن',
  planLimits: 'حدود الباقة', daysRemaining: 'الأيام المتبقية',
  planExceeded: 'تم تجاوز حدود الباقة',
  deleteAccount: 'حذف الحساب', deleteAccountWarn: 'سيتم حذف حسابك نهائياً',
  signedOut: 'تم تسجيل الخروج',
  pickLanguage: 'اختر اللغة', darkMode: 'وضع داكن', lightMode: 'وضع فاتح',
  fontSize: 'حجم الخط', fontSmall: 'صغير', fontLarge: 'كبير',
  privacyPolicy: 'سياسة الخصوصية', termsOfService: 'شروط الاستخدام',
  contactSupport: 'تواصل مع الدعم',
  // ── network ────
  contact: 'جهة اتصال', contacts: 'جهات الاتصال', addContact: 'إضافة جهة اتصال',
  editContact: 'تعديل جهة الاتصال', deleteContact: 'حذف جهة الاتصال',
  noContacts: 'لا توجد جهات اتصال', noContactsMatch: 'لا توجد نتائج مطابقة',
  callBtn: '📞 اتصال', whatsappBtn: '💬 واتساب',
  // ── ministry / service ────
  ministry: 'وزارة', ministries: 'الوزارات', service: 'خدمة',
  addService: 'إضافة خدمة', editService: 'تعديل الخدمة', deleteService: 'حذف الخدمة',
  noServices: 'لا توجد خدمات', serviceName: 'اسم الخدمة', servicePrice: 'سعر الخدمة',
  addStageBtn: '+ إضافة مرحلة', createStage: 'إنشاء مرحلة',
  // ── team ────
  team: 'الفريق', teamMember: 'عضو فريق', addMember: 'إضافة عضو',
  inviteMember: 'دعوة عضو', removeMember: 'إزالة عضو',
  permissions: 'الصلاحيات', visibility: 'الظهور',
  visibilityPerms: 'الظهور والصلاحيات',
  roleOwner: 'مالك', roleAdmin: 'مسؤول', roleMember: 'عضو', roleViewer: 'مشاهد',
  permFiles: 'الملفات', permStages: 'المراحل', permFinancials: 'الشؤون المالية',
  permDocs: 'المستندات', permClients: 'العملاء', permComments: 'التعليقات',
  // ── empty ────
  nothingHere: 'لا يوجد شيء هنا', emptyList: 'القائمة فارغة',
  startByAdding: 'ابدأ بإضافة عنصر', comingSoon: 'قريباً',
  // ── time ────
  today: 'اليوم', yesterday: 'أمس', tomorrow: 'غداً',
  thisWeek: 'هذا الأسبوع', lastWeek: 'الأسبوع الماضي', thisMonth: 'هذا الشهر',
  justNow: 'الآن', minutesAgo: 'منذ دقائق', hoursAgo: 'منذ ساعات', daysAgo: 'منذ أيام',
  // ── misc ────
  all: 'الكل', none: 'لا شيء', others: 'آخرون', count: 'العدد',
  total: 'المجموع', subtotal: 'المجموع الفرعي', summary: 'الملخص',
  createdAt: 'تاريخ الإنشاء', updatedAt: 'تاريخ التحديث',
  createdBy: 'بواسطة', updatedBy: 'محدّث بواسطة', assignedTo: 'مُعيّن إلى',
  pleaseSignIn: 'يرجى تسجيل الدخول', noPermission: 'لا تملك صلاحية',
  accessRestricted: 'الوصول مقيّد',
  close2: 'إغلاق', minimize: 'تصغير', maximize: 'تكبير', options: 'خيارات',
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
  // ── common buttons & actions ────
  update: 'Update', createBtn: 'Create', apply: 'Apply', reset: 'Reset',
  submit: 'Submit', done: 'Done', next: 'Next', back: 'Back', skip: 'Skip',
  retry: 'Retry', refresh: 'Refresh', reload: 'Reload',
  copy: 'Copy', copied: 'Copied', paste: 'Paste', share: 'Share', open: 'Open',
  download: 'Download', upload: 'Upload', attach: 'Attach', detach: 'Detach',
  select: 'Select', selectAll: 'Select All', deselect: 'Deselect',
  expand: 'Expand', collapse: 'Collapse', showMore: 'Show More', showLess: 'Show Less',
  showAll: 'Show All', hide: 'Hide', view: 'View',
  duplicate: 'Duplicate', archive: 'Archive', unarchive: 'Unarchive',
  restore: 'Restore', pin: 'Pin', unpin: 'Unpin',
  enable: 'Enable', disable: 'Disable', enabled: 'Enabled', disabled: 'Disabled',
  on: 'On', off: 'Off',
  // ── form fields ────
  fullName: 'Full Name', fullNameRequired: 'Full Name *',
  firstName: 'First Name', lastName: 'Last Name',
  phoneNumber: 'Phone Number', phoneNumberOpt: 'Phone Number (optional)',
  referenceName: 'Reference Name', referencePhone: 'Reference Phone',
  referenceOpt: 'Reference (optional)',
  optional: 'optional', required2: 'required',
  address: 'Address', description: 'Description', descriptionOpt: 'Description (optional)',
  title: 'Title', titleOpt: 'Title (optional)',
  price: 'Price', amount: 'Amount', amountUSD: 'Amount (USD)',
  amountLBP: 'Amount (LBP)', currency: 'Currency',
  date: 'Date', time: 'Time',
  searchInput: 'Search...', searchClient: 'Search client...',
  searchService: 'Search service...', searchStage: 'Search stage...',
  searchCity: 'Search city...', searchCountry: 'Search country...',
  searchContact: 'Search contact...', searchMember: 'Search member...',
  searchFile: 'Search file...',
  enterName: 'Enter name', enterPhone: 'Enter phone',
  enterEmail: 'Enter email', enterPassword: 'Enter password',
  enterCode: 'Enter code', enterAmount: 'Enter amount',
  enterDescription: 'Enter description', enterTitle: 'Enter title',
  enterNotes: 'Enter notes',
  pickDate: 'Pick a date', pickCity: 'Pick a city', pickAssignee: 'Pick a person',
  pickService: 'Pick a service', pickStage: 'Pick a stage', pickClient: 'Pick a client',
  pickCountry: 'Pick a country', pickRole: 'Pick a role',
  // ── client ────
  clientInfo: 'Client Info', clientName: 'Client Name', clientPhone: 'Client Phone',
  newClientFull: 'New Client', editClient2: 'Edit Client',
  addClient: 'Add Client', addNewClient: 'Add New Client',
  createNewClient: 'Create New Client',
  noClients: 'No clients yet', noClientsMatch: 'No matching clients',
  clientCount: 'Client count',
  // ── files ────
  file: 'File', files: 'Files', fileDetails: 'File Details',
  fileNotes: 'Notes', fileNumber: 'File Number', opened: 'Opened',
  fileService: 'Service', fileClient: 'Client', fileStatus: 'Status',
  fileNotFound: 'File not found',
  newFileBtn: '+ New File', createNewFile: 'Create New File', addFile: 'Add File',
  archiveTitle: '📦 Archive', archiveCount: 'Archived count',
  // ── stages ────
  stage: 'Stage', stage2: 'Stage', stageName: 'Stage Name',
  stageStatus: 'Stage Status', stageNotes: 'Stage Notes',
  stageNumber: 'Stage Number',
  addNewStage: 'Add New Stage', editStages: 'Edit Stages',
  editStage: 'Edit Stage', deleteStage: 'Delete Stage',
  reorderStages: 'Reorder Stages',
  setCity: '📍 Set City', setAssignee: '👤 Set Assignee',
  setDueDate: '📅 Set Due Date', clearDueDate: '✕ Clear Date',
  rejectionReason: 'Rejection Reason',
  stageRequirements: 'Stage Requirements', noStages: 'No stages',
  stagesAddedAuto: 'Stages will be added automatically',
  // ── statuses ────
  statusSubmitted: 'Submitted', statusInReview: 'In Review',
  statusPendingSig: 'Pending Signature', statusDone: 'Done',
  statusRejected: 'Rejected', statusReceivedClosed: 'Received & Closed',
  statusPending: 'Pending', mostUrgent: 'Most Urgent',
  // ── financials ────
  financials: 'Financials', addExpense: 'Add Expense',
  addRevenue: 'Add Revenue', addPayment: 'Add Payment',
  editTransaction: 'Edit Transaction', deleteTransaction: 'Delete Transaction',
  transaction: 'Transaction', transactions: 'Transactions',
  noTransactions: 'No transactions',
  totalExpenses: 'Total Expenses', totalRevenue: 'Total Revenue',
  netBalance: 'Net Balance', received: 'Received', due: 'Due',
  cvUSD: 'C/V USD', exchangeRate: 'Exchange Rate',
  editRate: 'Edit Rate', priceHistory: 'Price History',
  linkToStage: 'Link to Stage', clearStage: 'Clear Stage', stageOpt: 'Stage (optional)',
  // ── documents ────
  document: 'Document', documents: 'Documents', noDocuments: 'No documents',
  documentName: 'Document Name', requiredDocs: 'Required Documents',
  scanDoc: '📷 Scan', addPDF: '📄 PDF', addImage: '🖼 Image',
  renameDoc: '✎ Rename', deleteDoc: '✕ Delete',
  uploadDocument: 'Upload Document', saveScan: 'Save Scan',
  rotate: 'Rotate', crop: '✂ Crop', applyCrop: '✓ Apply Crop',
  // ── comments ────
  comment: 'Comment', comments: 'Comments', noComments: 'No comments',
  writeComment: 'Write a comment...', editComment: 'Edit Comment',
  deleteComment: 'Delete Comment', voiceNote: '🎤 Voice Note',
  recording: 'Recording...', tapToRecord: 'Tap to record',
  tapToStop: 'Tap to stop',
  // ── alerts ────
  error: 'Error', success: 'Success', warning: 'Warning', info: 'Info',
  confirmDelete: 'Confirm Delete', cannotUndo: 'This cannot be undone',
  areYouSure: 'Are you sure?', discardChanges: 'Discard changes?',
  connectionError: 'Connection Error', tryAgain: 'Try Again',
  somethingWrong: 'Something went wrong', pleaseWait: 'Please wait...',
  fieldRequired: 'This field is required', invalidPhone: 'Invalid phone number',
  invalidEmail: 'Invalid email', passwordTooShort: 'Password too short',
  passwordsMatch: "Passwords don't match", noChanges: 'No changes',
  saved: 'Saved', savedSuccess: 'Saved successfully', failedToSave: 'Failed to save',
  // ── auth ────
  login: 'Login', loginTitle: 'Sign In', loginFailed: 'Login Failed',
  forgotPassword: 'Forgot Password?', resetPassword: 'Reset Password',
  sendResetLink: 'Send Reset Link', resetSent: 'Reset link sent',
  noAccount: "Don't have an account?", createAccount: 'Create Account',
  haveAccount: 'Already have an account?',
  inviteCode: 'Invite Code', enterInviteCode: 'Enter invite code',
  validateCode: 'Validate Code', codeNotFound: 'Code not found',
  codeDeactivated: 'Code has been deactivated',
  phoneLocked: 'This code is reserved for a different phone number',
  createOrganization: 'Create Organization', orgName: 'Organization Name',
  organizationName: 'Organization Name', newOrgFlow: 'New Organization',
  invitedBy: 'Invited by', youInvitedTo: "You're invited to",
  showPassword: 'Show', hidePassword: 'Hide',
  confirmPassword: 'Confirm Password', changePassword: 'Change Password',
  // ── account / settings ────
  profile: 'Profile', security: 'Security', preferences: 'Preferences',
  plan: 'Plan', currentPlan: 'Current Plan',
  upgrade: 'Upgrade', upgradeNow: 'Upgrade Now',
  planLimits: 'Plan Limits', daysRemaining: 'Days Remaining',
  planExceeded: 'Plan limit exceeded',
  deleteAccount: 'Delete Account',
  deleteAccountWarn: 'Your account will be permanently deleted',
  signedOut: 'Signed out',
  pickLanguage: 'Pick Language', darkMode: 'Dark Mode', lightMode: 'Light Mode',
  fontSize: 'Font Size', fontSmall: 'Small', fontLarge: 'Large',
  privacyPolicy: 'Privacy Policy', termsOfService: 'Terms of Service',
  contactSupport: 'Contact Support',
  // ── network ────
  contact: 'Contact', contacts: 'Contacts', addContact: 'Add Contact',
  editContact: 'Edit Contact', deleteContact: 'Delete Contact',
  noContacts: 'No contacts yet', noContactsMatch: 'No matching contacts',
  callBtn: '📞 Call', whatsappBtn: '💬 WhatsApp',
  // ── ministry / service ────
  ministry: 'Ministry', ministries: 'Ministries', service: 'Service',
  addService: 'Add Service', editService: 'Edit Service', deleteService: 'Delete Service',
  noServices: 'No services', serviceName: 'Service Name', servicePrice: 'Service Price',
  addStageBtn: '+ Add Stage', createStage: 'Create Stage',
  // ── team ────
  team: 'Team', teamMember: 'Team Member', addMember: 'Add Member',
  inviteMember: 'Invite Member', removeMember: 'Remove Member',
  permissions: 'Permissions', visibility: 'Visibility',
  visibilityPerms: 'Visibility & Permissions',
  roleOwner: 'Owner', roleAdmin: 'Admin', roleMember: 'Member', roleViewer: 'Viewer',
  permFiles: 'Files', permStages: 'Stages', permFinancials: 'Financials',
  permDocs: 'Documents', permClients: 'Clients', permComments: 'Comments',
  // ── empty ────
  nothingHere: 'Nothing here yet', emptyList: 'Empty list',
  startByAdding: 'Start by adding an item', comingSoon: 'Coming soon',
  // ── time ────
  today: 'Today', yesterday: 'Yesterday', tomorrow: 'Tomorrow',
  thisWeek: 'This Week', lastWeek: 'Last Week', thisMonth: 'This Month',
  justNow: 'Just now', minutesAgo: 'minutes ago', hoursAgo: 'hours ago', daysAgo: 'days ago',
  // ── misc ────
  all: 'All', none: 'None', others: 'Others', count: 'Count',
  total: 'Total', subtotal: 'Subtotal', summary: 'Summary',
  createdAt: 'Created', updatedAt: 'Updated',
  createdBy: 'by', updatedBy: 'updated by', assignedTo: 'assigned to',
  pleaseSignIn: 'Please sign in', noPermission: "You don't have permission",
  accessRestricted: 'Access restricted',
  close2: 'Close', minimize: 'Minimize', maximize: 'Maximize', options: 'Options',
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
  // ── common buttons & actions ────
  update: 'Mettre à jour', createBtn: 'Créer', apply: 'Appliquer', reset: 'Réinitialiser',
  submit: 'Soumettre', done: 'Terminé', next: 'Suivant', back: 'Retour', skip: 'Passer',
  retry: 'Réessayer', refresh: 'Actualiser', reload: 'Recharger',
  copy: 'Copier', copied: 'Copié', paste: 'Coller', share: 'Partager', open: 'Ouvrir',
  download: 'Télécharger', upload: 'Téléverser', attach: 'Joindre', detach: 'Détacher',
  select: 'Sélectionner', selectAll: 'Tout sélectionner', deselect: 'Désélectionner',
  expand: 'Développer', collapse: 'Réduire', showMore: 'Voir plus', showLess: 'Voir moins',
  showAll: 'Tout afficher', hide: 'Masquer', view: 'Voir',
  duplicate: 'Dupliquer', archive: 'Archiver', unarchive: 'Désarchiver',
  restore: 'Restaurer', pin: 'Épingler', unpin: 'Détacher',
  enable: 'Activer', disable: 'Désactiver', enabled: 'Activé', disabled: 'Désactivé',
  on: 'Activé', off: 'Désactivé',
  // ── form fields ────
  fullName: 'Nom complet', fullNameRequired: 'Nom complet *',
  firstName: 'Prénom', lastName: 'Nom',
  phoneNumber: 'Numéro de téléphone', phoneNumberOpt: 'Téléphone (optionnel)',
  referenceName: 'Nom de référence', referencePhone: 'Téléphone de référence',
  referenceOpt: 'Référence (optionnelle)',
  optional: 'optionnel', required2: 'obligatoire',
  address: 'Adresse', description: 'Description', descriptionOpt: 'Description (optionnelle)',
  title: 'Titre', titleOpt: 'Titre (optionnel)',
  price: 'Prix', amount: 'Montant', amountUSD: 'Montant (USD)',
  amountLBP: 'Montant (LBP)', currency: 'Devise',
  date: 'Date', time: 'Heure',
  searchInput: 'Rechercher...', searchClient: 'Rechercher un client...',
  searchService: 'Rechercher un service...', searchStage: 'Rechercher une étape...',
  searchCity: 'Rechercher une ville...', searchCountry: 'Rechercher un pays...',
  searchContact: 'Rechercher un contact...', searchMember: 'Rechercher un membre...',
  searchFile: 'Rechercher un dossier...',
  enterName: 'Entrez le nom', enterPhone: 'Entrez le téléphone',
  enterEmail: 'Entrez l\'e-mail', enterPassword: 'Entrez le mot de passe',
  enterCode: 'Entrez le code', enterAmount: 'Entrez le montant',
  enterDescription: 'Entrez la description', enterTitle: 'Entrez le titre',
  enterNotes: 'Entrez des notes',
  pickDate: 'Choisir une date', pickCity: 'Choisir une ville',
  pickAssignee: 'Choisir une personne', pickService: 'Choisir un service',
  pickStage: 'Choisir une étape', pickClient: 'Choisir un client',
  pickCountry: 'Choisir un pays', pickRole: 'Choisir un rôle',
  // ── client ────
  clientInfo: 'Infos client', clientName: 'Nom du client', clientPhone: 'Téléphone du client',
  newClientFull: 'Nouveau client', editClient2: 'Modifier client',
  addClient: 'Ajouter un client', addNewClient: 'Ajouter un nouveau client',
  createNewClient: 'Créer un nouveau client',
  noClients: 'Pas encore de clients', noClientsMatch: 'Aucun client correspondant',
  clientCount: 'Nombre de clients',
  // ── files ────
  file: 'Dossier', files: 'Dossiers', fileDetails: 'Détails du dossier',
  fileNotes: 'Notes', fileNumber: 'Numéro de dossier', opened: 'Ouvert le',
  fileService: 'Service', fileClient: 'Client', fileStatus: 'Statut',
  fileNotFound: 'Dossier introuvable',
  newFileBtn: '+ Nouveau dossier', createNewFile: 'Créer un dossier', addFile: 'Ajouter un dossier',
  archiveTitle: '📦 Archives', archiveCount: 'Dossiers archivés',
  // ── stages ────
  stage: 'Étape', stage2: 'Étape', stageName: 'Nom de l\'étape',
  stageStatus: 'Statut de l\'étape', stageNotes: 'Notes de l\'étape',
  stageNumber: 'Numéro d\'étape',
  addNewStage: 'Ajouter une étape', editStages: 'Modifier les étapes',
  editStage: 'Modifier l\'étape', deleteStage: 'Supprimer l\'étape',
  reorderStages: 'Réordonner les étapes',
  setCity: '📍 Définir la ville', setAssignee: '👤 Assigner',
  setDueDate: '📅 Définir l\'échéance', clearDueDate: '✕ Effacer la date',
  rejectionReason: 'Motif du rejet',
  stageRequirements: 'Exigences de l\'étape', noStages: 'Aucune étape',
  stagesAddedAuto: 'Les étapes seront ajoutées automatiquement',
  // ── statuses ────
  statusSubmitted: 'Soumis', statusInReview: 'En examen',
  statusPendingSig: 'En attente de signature', statusDone: 'Terminé',
  statusRejected: 'Rejeté', statusReceivedClosed: 'Reçu et clôturé',
  statusPending: 'En attente', mostUrgent: 'Le plus urgent',
  // ── financials ────
  financials: 'Finances', addExpense: 'Ajouter une dépense',
  addRevenue: 'Ajouter un revenu', addPayment: 'Ajouter un paiement',
  editTransaction: 'Modifier la transaction', deleteTransaction: 'Supprimer',
  transaction: 'Transaction', transactions: 'Transactions',
  noTransactions: 'Aucune transaction',
  totalExpenses: 'Dépenses totales', totalRevenue: 'Revenus totaux',
  netBalance: 'Solde net', received: 'Reçu', due: 'Dû',
  cvUSD: 'C/V USD', exchangeRate: 'Taux de change',
  editRate: 'Modifier le taux', priceHistory: 'Historique des prix',
  linkToStage: 'Lier à une étape', clearStage: 'Effacer l\'étape',
  stageOpt: 'Étape (optionnelle)',
  // ── documents ────
  document: 'Document', documents: 'Documents', noDocuments: 'Aucun document',
  documentName: 'Nom du document', requiredDocs: 'Documents requis',
  scanDoc: '📷 Scanner', addPDF: '📄 PDF', addImage: '🖼 Image',
  renameDoc: '✎ Renommer', deleteDoc: '✕ Supprimer',
  uploadDocument: 'Téléverser un document', saveScan: 'Enregistrer le scan',
  rotate: 'Rotation', crop: '✂ Recadrer', applyCrop: '✓ Appliquer le recadrage',
  // ── comments ────
  comment: 'Commentaire', comments: 'Commentaires', noComments: 'Aucun commentaire',
  writeComment: 'Écrire un commentaire...', editComment: 'Modifier le commentaire',
  deleteComment: 'Supprimer le commentaire', voiceNote: '🎤 Note vocale',
  recording: 'Enregistrement...', tapToRecord: 'Toucher pour enregistrer',
  tapToStop: 'Toucher pour arrêter',
  // ── alerts ────
  error: 'Erreur', success: 'Succès', warning: 'Avertissement', info: 'Info',
  confirmDelete: 'Confirmer la suppression', cannotUndo: 'Cette action est irréversible',
  areYouSure: 'Êtes-vous sûr ?', discardChanges: 'Annuler les modifications ?',
  connectionError: 'Erreur de connexion', tryAgain: 'Réessayer',
  somethingWrong: 'Une erreur est survenue', pleaseWait: 'Veuillez patienter...',
  fieldRequired: 'Ce champ est requis', invalidPhone: 'Numéro de téléphone invalide',
  invalidEmail: 'E-mail invalide', passwordTooShort: 'Mot de passe trop court',
  passwordsMatch: 'Les mots de passe ne correspondent pas', noChanges: 'Aucune modification',
  saved: 'Enregistré', savedSuccess: 'Enregistré avec succès', failedToSave: 'Échec de l\'enregistrement',
  // ── auth ────
  login: 'Connexion', loginTitle: 'Se connecter', loginFailed: 'Échec de la connexion',
  forgotPassword: 'Mot de passe oublié ?', resetPassword: 'Réinitialiser le mot de passe',
  sendResetLink: 'Envoyer le lien', resetSent: 'Lien envoyé',
  noAccount: 'Vous n\'avez pas de compte ?', createAccount: 'Créer un compte',
  haveAccount: 'Vous avez déjà un compte ?',
  inviteCode: 'Code d\'invitation', enterInviteCode: 'Entrez le code',
  validateCode: 'Valider le code', codeNotFound: 'Code introuvable',
  codeDeactivated: 'Le code a été désactivé',
  phoneLocked: 'Ce code est réservé à un autre numéro',
  createOrganization: 'Créer une organisation', orgName: 'Nom de l\'organisation',
  organizationName: 'Nom de l\'organisation', newOrgFlow: 'Nouvelle organisation',
  invitedBy: 'Invité par', youInvitedTo: 'Vous êtes invité à',
  showPassword: 'Afficher', hidePassword: 'Masquer',
  confirmPassword: 'Confirmer le mot de passe', changePassword: 'Changer le mot de passe',
  // ── account / settings ────
  profile: 'Profil', security: 'Sécurité', preferences: 'Préférences',
  plan: 'Forfait', currentPlan: 'Forfait actuel',
  upgrade: 'Mettre à niveau', upgradeNow: 'Mettre à niveau maintenant',
  planLimits: 'Limites du forfait', daysRemaining: 'Jours restants',
  planExceeded: 'Limite du forfait atteinte',
  deleteAccount: 'Supprimer le compte',
  deleteAccountWarn: 'Votre compte sera supprimé définitivement',
  signedOut: 'Déconnecté',
  pickLanguage: 'Choisir la langue', darkMode: 'Mode sombre', lightMode: 'Mode clair',
  fontSize: 'Taille de police', fontSmall: 'Petite', fontLarge: 'Grande',
  privacyPolicy: 'Politique de confidentialité', termsOfService: 'Conditions d\'utilisation',
  contactSupport: 'Contacter le support',
  // ── network ────
  contact: 'Contact', contacts: 'Contacts', addContact: 'Ajouter un contact',
  editContact: 'Modifier le contact', deleteContact: 'Supprimer le contact',
  noContacts: 'Aucun contact', noContactsMatch: 'Aucun contact correspondant',
  callBtn: '📞 Appeler', whatsappBtn: '💬 WhatsApp',
  // ── ministry / service ────
  ministry: 'Ministère', ministries: 'Ministères', service: 'Service',
  addService: 'Ajouter un service', editService: 'Modifier le service',
  deleteService: 'Supprimer le service',
  noServices: 'Aucun service', serviceName: 'Nom du service', servicePrice: 'Prix du service',
  addStageBtn: '+ Ajouter une étape', createStage: 'Créer une étape',
  // ── team ────
  team: 'Équipe', teamMember: 'Membre de l\'équipe', addMember: 'Ajouter un membre',
  inviteMember: 'Inviter un membre', removeMember: 'Retirer un membre',
  permissions: 'Permissions', visibility: 'Visibilité',
  visibilityPerms: 'Visibilité et permissions',
  roleOwner: 'Propriétaire', roleAdmin: 'Admin', roleMember: 'Membre', roleViewer: 'Observateur',
  permFiles: 'Dossiers', permStages: 'Étapes', permFinancials: 'Finances',
  permDocs: 'Documents', permClients: 'Clients', permComments: 'Commentaires',
  // ── empty ────
  nothingHere: 'Rien ici pour le moment', emptyList: 'Liste vide',
  startByAdding: 'Commencez par ajouter un élément', comingSoon: 'Bientôt disponible',
  // ── time ────
  today: 'Aujourd\'hui', yesterday: 'Hier', tomorrow: 'Demain',
  thisWeek: 'Cette semaine', lastWeek: 'Semaine dernière', thisMonth: 'Ce mois-ci',
  justNow: 'À l\'instant', minutesAgo: 'min plus tôt',
  hoursAgo: 'h plus tôt', daysAgo: 'j plus tôt',
  // ── misc ────
  all: 'Tout', none: 'Aucun', others: 'Autres', count: 'Nombre',
  total: 'Total', subtotal: 'Sous-total', summary: 'Résumé',
  createdAt: 'Créé le', updatedAt: 'Mis à jour le',
  createdBy: 'par', updatedBy: 'mis à jour par', assignedTo: 'attribué à',
  pleaseSignIn: 'Veuillez vous connecter',
  noPermission: 'Vous n\'avez pas la permission',
  accessRestricted: 'Accès restreint',
  close2: 'Fermer', minimize: 'Réduire', maximize: 'Agrandir', options: 'Options',
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
