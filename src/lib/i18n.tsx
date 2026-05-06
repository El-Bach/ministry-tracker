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
  | 'close2' | 'minimize' | 'maximize' | 'options'
  // ── Phase 3: Welcome wizard (Dashboard) ────────────────────────────────────
  | 'welcomeStep1Title' | 'welcomeStep1Body'
  | 'welcomeStep2Title' | 'welcomeStep2Body'
  | 'welcomeStep3Title' | 'welcomeStep3Body'
  | 'welcomeStep4Title' | 'welcomeStep4Body'
  | 'welcomeStep5Title' | 'welcomeStep5Body'
  | 'welcomeReady' | 'welcomeNeverShow' | 'welcomeIntro'
  // ── Phase 3: Plan taglines + descriptions (AccountScreen) ──────────────────
  | 'planFreeTagline' | 'planStarterTagline' | 'planBusinessTagline'
  | 'planMonthly' | 'planYearly' | 'planSavePercent' | 'planMostPopular'
  | 'planChoosePlan' | 'planContactSales' | 'planCurrentPlanLabel'
  // ── Phase 3: FAQ (SettingsScreen) — top 8 most-asked ────────────────────────
  | 'faqTitle'
  | 'faqQ1' | 'faqA1' | 'faqQ2' | 'faqA2' | 'faqQ3' | 'faqA3' | 'faqQ4' | 'faqA4'
  | 'faqQ5' | 'faqA5' | 'faqQ6' | 'faqA6' | 'faqQ7' | 'faqA7' | 'faqQ8' | 'faqA8'
  // ── Phase 3: Misc descriptions ────────────────────────────────────────────
  | 'helpGuideDesc' | 'faqDesc' | 'reportBugDesc' | 'contactSupportDesc'
  | 'permissionsDesc' | 'visibilityDesc' | 'languageDesc' | 'rtlDesc'
  // ── Phase 4: Help Guide content ────────────────────────────────────────────
  | 'helpGuideTitle'
  | 'help1Title' | 'help1S1' | 'help1S2' | 'help1S3' | 'help1S4'
  | 'help2Title' | 'help2S1' | 'help2S2' | 'help2S3' | 'help2S4' | 'help2S5' | 'help2S6'
  | 'help3Title' | 'help3S1' | 'help3S2' | 'help3S3' | 'help3S4'
  | 'help4Title' | 'help4S1' | 'help4S2' | 'help4S3' | 'help4S4'
  | 'help5Title' | 'help5S1' | 'help5S2' | 'help5S3' | 'help5S4'
  | 'help6Title' | 'help6S1' | 'help6S2' | 'help6S3'
  | 'help7Title' | 'help7S1' | 'help7S2' | 'help7S3'
  | 'help8Title' | 'help8S1' | 'help8S2' | 'help8S3' | 'help8S4'
  | 'help9Title' | 'help9S1' | 'help9S2' | 'help9S3' | 'help9S4'
  // ── Phase 4: Extended FAQ entries (9-14) + new entries (15-16) ─────────────
  | 'faqQ9' | 'faqA9' | 'faqQ10' | 'faqA10' | 'faqQ11' | 'faqA11'
  | 'faqQ12' | 'faqA12' | 'faqQ13' | 'faqA13' | 'faqQ14' | 'faqA14'
  | 'faqQ15' | 'faqA15' | 'faqQ16' | 'faqA16'
  // ── Phase 5: Bug-fix translations for screens still showing English ──
  | 'quickActions' | 'todayBtn' | 'noEvents' | 'itemsCount'
  | 'editProfileSubtitle' | 'membersInviteesCount' | 'visibilityPermsSubtitle'
  | 'exchangeRateLabel' | 'exchangeRateSubtitle' | 'clientFieldsSubtitle'
  | 'teamMemberFieldsSubtitle' | 'financialReportSubtitle'
  | 'tabAdmin' | 'tabMember' | 'tabViewer' | 'adminTabDesc' | 'memberTabDesc' | 'viewerTabDesc'
  | 'fileVisibilitySection' | 'fileVisibilityDesc'
  | 'planLimitReached' | 'planLimitBody' | 'planGraceBody' | 'planLimitChip'
  | 'planUpgradeNow' | 'planRemindLater'
  // Day names for calendar
  | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
  // Activity screen
  | 'unknown' | 'someone' | 'changedStatus' | 'fromStatus' | 'deletedThisFile'
  | 'addTransaction' | 'allDay' | 'today2'
  // Phase 7: more missed strings
  | 'events' | 'noActivity' | 'noActivitySub'
  | 'addField' | 'required' | 'fieldText' | 'fieldPhone' | 'fieldEmail'
  | 'fieldDate' | 'fieldNumber' | 'fieldBoolean' | 'fieldSelect' | 'fieldUrl'
  | 'fieldLocation' | 'fieldImage' | 'fieldIdNumber' | 'fieldCurrency'
  | 'fieldTextarea' | 'fieldMultiselect'
  | 'frStatusLabel' | 'frClosedFilter' | 'frActiveFilter' | 'frAllFilter'
  | 'frAllFiles' | 'frServiceFilter' | 'frStageFilter' | 'frFrom' | 'frTo'
  | 'frPdf' | 'frReceived' | 'frExpenses' | 'frBalance' | 'frResult'
  | 'frFilesContract' | 'frCvUsd' | 'frLbpRate' | 'frTapDetails' | 'frClosed'
  // Phase 8: more missed strings
  | 'enableNotifications' | 'enableNotificationsDesc' | 'notificationTypes'
  | 'commentsNotes' | 'commentsNotesDesc'
  | 'statusChanges' | 'statusChangesDesc'
  | 'newFilesNotif' | 'newFilesNotifDesc'
  | 'receiveFrom' | 'receiveFromDesc' | 'noOtherMembers'
  | 'reportBugTitle' | 'reportBugDesc2' | 'bugTitleLabel' | 'bugDescLabel' | 'submitBug'
  | 'contactUsTitle' | 'contactUsDesc' | 'yourName' | 'yourEmail' | 'subjectLabel' | 'messageLabel' | 'sendMsg'
  | 'inviteCodesTitle' | 'inviteCodesDesc' | 'newInvite'
  | 'roleOwnerBadge' | 'roleAdminBadge' | 'roleMemberBadge' | 'roleViewerBadge'
  | 'usesCount' | 'createdLabel'
  // TaskDetail header section
  | 'viewProfile' | 'removeAssignment' | 'tapToSet'
  | 'whatsappShare' | 'duplicateFile'
  // ── Phase 9: Full Arabic translation pass ──────────────────────────────────
  | 'saveChanges' | 'createField' | 'editFieldTitle' | 'fieldTypeLabel'
  | 'noCustomFieldsYet' | 'tapAddFieldHint' | 'mustFillCreating' | 'mustFillAdding'
  | 'completedStat' | 'noFilesForClient' | 'clearDateBtn' | 'createClientBtn'
  | 'howToImportExcel' | 'setCityOptional' | 'noFieldsYet' | 'saveAndAddField'
  | 'searchEverything' | 'nothingMatchedQuery'
  | 'noRequirementsDefined' | 'addDocsActionsNeeded' | 'requirementTypeLabel'
  | 'tapToAddStagesToRoute' | 'createFileBtn' | 'noDocumentsForService'
  | 'mutedLabel' | 'savePrefsBtn' | 'noStagesAddFirst'
  | 'changeRoleDesc' | 'autoJoinOrgDesc' | 'sendInviteBtn'
  | 'rateModalDesc' | 'saveRateBtn'
  | 'noRequirementsYet' | 'tapAddReqHint' | 'titleAsterisk' | 'typeLabel'
  | 'markAsCompleted' | 'attachmentLabel' | 'attachScanDoc' | 'selectTypeTitle'
  | 'noteOptionalLabel' | 'noStagesAddedYet' | 'saveCityBtn'
  | 'noCitiesMatch' | 'allStagesAlreadyAdded' | 'noStagesMatch' | 'loadingDocument'
  | 'noInviteCodesYet' | 'noCodesMatch' | 'noMembersMatch' | 'forLabel'
  | 'newInviteCodeTitle' | 'fillWhoCode' | 'phoneLockedDesc' | 'sendToInboxDesc'
  | 'generateCodeBtn' | 'noTasksAssigned' | 'dueLabel' | 'editMemberTitle'
  | 'accessRestrictedAdmins' | 'noMembersManage'
  | 'joinOrgDesc' | 'currentCompanyLabel' | 'joinBtn' | 'saveProfileBtn' | 'updatePasswordBtn'
  | 'noStagesForService' | 'fileCreatedLabel' | 'noStagesYetAddBelow'
  | 'pasteExcelClients' | 'refPrefix' | 'noServicesMatch' | 'stageNamePlaceholder'
  | 'noStagesNoMatch' | 'importClientsBtn' | 'importServicesBtn' | 'previewRowsBtn'
  // ── Phase 10: SettingsScreen remaining strings ───────────────────────────────
  | 'inviteSent' | 'revoke' | 'inviteTeamMemberTitle'
  | 'adminRoleDesc' | 'memberRoleDesc' | 'viewerRoleDesc'
  | 'emailLabel' | 'phoneLabel' | 'roleLabel'
  // ── Phase 10: NotificationSettings + misc ──────────────────────────────────
  | 'notifPrefsFootnote' | 'revokedCodesLabel'
  // ── Phase 10: Req types + MinistryRequirementsScreen ────────────────────────
  | 'reqTypeDocument' | 'reqTypeForm' | 'reqTypeSignature' | 'reqTypeApproval'
  | 'reqTypePayment' | 'reqTypeCertificate' | 'reqTypeOther'
  // ── Phase 10: ClientProfileScreen ──────────────────────────────────────────
  | 'totalFilesLabel' | 'fileHistoryLabel' | 'clientDetailsLabel' | 'openedLabel' | 'stagesProgress'
  // ── Phase 10: EditClientScreen / NewTaskScreen / CreateScreen ───────────────
  | 'savedFieldsLabel' | 'requiredFieldLabel' | 'scheduleLabel' | 'teamSectionLabel'
  | 'externalSectionLabel' | 'noDefaultStages'
  // ── Phase 10: AccountScreen strings ─────────────────────────────────────────
  | 'myCompanyTitle' | 'joinCompanyTitle' | 'editProfileCardTitle' | 'securityCardTitle'
  | 'viewPlansBtn' | 'managePlanBtn'
  | 'currentUsageTitle' | 'teamMembersUsage' | 'activeFilesUsage'
  | 'overPlanLimitHint' | 'overPlanBannerMsg'
  | 'freeLabel' | 'billedAnnuallyLabel' | 'perMonthLabel' | 'save33Label'
  | 'currentPlanBadge' | 'ctaCurrentPlan' | 'ctaDowngrade' | 'ctaUpgradeNow'
  | 'phoneHintLogin' | 'phoneHintContact'
  | 'planFootnoteText'
  // ── Phase 11: NewTaskScreen remaining strings ──────────────────────────────
  | 'createAndAdd' | 'createNewContact' | 'fieldNameLabel' | 'optionsSeparated'
  // ── Phase 12: FinancialReport, TaskDetail, StageRequirements, Login ──────────
  | 'filterByService' | 'filterByStage' | 'allServices' | 'allStages' | 'saveAndApply'
  | 'fromDate' | 'toDate' | 'closedLabel' | 'currentStatusLabel'
  | 'cameraScan' | 'photoLibrary' | 'govFileTracking' | 'createNewCity' | 'requirement'
  // ── Phase 13: Remaining screens (Create modals, StagesSection, Onboarding, Visibility) ──
  | 'saveAndSelect' | 'saveAndAssign' | 'saveContact'
  | 'noSubReqYet' | 'noDocsAddedYet' | 'allFieldsAdded' | 'noFieldsMatch' | 'noContactsYet'
  | 'stopAccess' | 'removeForever' | 'yesContinue' | 'noPriceChanges' | 'noTransactionsYet'
  | 'settingUpAccount' | 'setupIncomplete' | 'signOutAndTryAgain' | 'letsGetSetUp'
  | 'yourCompanyTitle' | 'confirmOrgName' | 'yourFirstService' | 'firstServiceDesc'
  | 'inviteTeammate' | 'continueArrow' | 'skipForNow' | 'inviteAndContinue' | 'skipInviteLater'
  | 'chooseLanguage' | 'estimatedDays'
  | 'visFilesTitle' | 'visStagesTitle' | 'visFinancialTitle' | 'visDocumentsTitle'
  | 'visClientsTitle' | 'visCatalogTitle' | 'visActivityTitle'
  // ── Phase 14: missing keys caught by tsc ────────────────────────────────────
  | 'step' | 'client'
  // ── Phase 14: AccountScreen plan features + labels ──────────────────────────
  | 'companyNamePlaceholder' | 'transferOwnershipError'
  | 'planFreeLabel' | 'planBasicLabel' | 'planPremiumLabel'
  | 'planNameFree' | 'planNameBasic' | 'planNamePremium'
  | 'feat3Members' | 'feat10Members' | 'featUnlimitedMembers'
  | 'feat25Files' | 'featUnlimitedFiles'
  | 'featDocScanning' | 'featBasicFinancial' | 'featFullFinancial'
  | 'featStageTracking' | 'featReportsExport' | 'featPDFUpload'
  | 'featPrioritySupport' | 'featPriorityEmailSupport' | 'featDedicatedManager';

type Translations = Record<TranslationKey, string>;

// ─── Number formatter ────────────────────────────────────────────────────────
// Convert Western digits to Arabic-Indic digits when language is Arabic.
// Use this for ANY user-visible numeric display.
const ARABIC_DIGITS = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'] as const;

export function formatNumber(value: number | string, lang: string, opts?: Intl.NumberFormatOptions): string {
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (Number.isNaN(num)) return String(value);
  if (lang === 'ar') {
    // Use ar-LB locale for Arabic-Indic digits + Arabic thousands separator (٬)
    return num.toLocaleString('ar-EG', opts);
  }
  if (lang === 'fr') return num.toLocaleString('fr-FR', opts);
  return num.toLocaleString('en-US', opts);
}

// Convert any string with embedded Western digits to Arabic-Indic when lang === 'ar'.
// Useful for already-formatted strings like "10,000,000 LBP".
export function arabicizeDigits(s: string, lang: string): string {
  if (lang !== 'ar') return s;
  return s.replace(/\d/g, (d) => ARABIC_DIGITS[parseInt(d, 10)]);
}

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
  // ── Welcome wizard ────
  welcomeStep1Title: 'افتح نافذة الإنشاء',
  welcomeStep1Body: 'انقر على زر "إنشاء" في أسفل الصفحة لفتح لوحة الإعداد.',
  welcomeStep2Title: 'أضف عملاءك',
  welcomeStep2Body: 'أدخل العملاء الذين سيتم ربطهم بملفاتك وقضاياك.',
  welcomeStep3Title: 'حدّد الخدمات',
  welcomeStep3Body: 'أضف الخدمات المقدّمة. ستكون متاحة عند إنشاء الملفات على لوحة التحكم.',
  welcomeStep4Title: 'إعداد المراحل والإدخالات الأخرى',
  welcomeStep4Body: 'قم بإعداد مراحل سير العمل وأي إدخالات إضافية مطلوبة لمنظمتك.',
  welcomeStep5Title: 'العودة إلى لوحة التحكم',
  welcomeStep5Body: 'بمجرد اكتمال الإعداد، عُد إلى لوحة التحكم لبدء إنشاء وتعبئة ملفاتك.',
  welcomeReady: '✅ كل شيء جاهز!',
  welcomeNeverShow: 'لا تظهر مرة أخرى',
  welcomeIntro: 'مرحباً بك في GovPilot. اتبع هذه الخطوات للبدء:',
  // ── Plans ────
  planFreeTagline: 'ابدأ مجاناً',
  planStarterTagline: 'للفرق المتنامية',
  planBusinessTagline: 'للعمليات الكبيرة',
  planMonthly: 'شهرياً',
  planYearly: 'سنوياً',
  planSavePercent: 'وفر %',
  planMostPopular: 'الأكثر شعبية',
  planChoosePlan: 'اختر هذه الباقة',
  planContactSales: 'تواصل مع المبيعات',
  planCurrentPlanLabel: 'باقتك الحالية',
  // ── FAQ ────
  faqTitle: '💬 الأسئلة الشائعة',
  faqQ1: 'كيف أُنشئ ملفاً جديداً؟',
  faqA1: 'من لوحة التحكم، اضغط على زر "+ ملف جديد". اختر عميلاً، ثم خدمة (تحمّل المراحل تلقائياً)، حدّد السعر وتاريخ الاستحقاق، ثم اضغط إنشاء.',
  faqQ2: 'كيف أُغيّر حالة ملف؟',
  faqA2: 'افتح الملف، ابحث عن المرحلة التي تريد تحديثها، واضغط على شارة الحالة. ستظهر قائمة بجميع الحالات المتاحة. حالة الملف الإجمالية هي دائماً أكثر مرحلة نشطة إلحاحاً.',
  faqQ3: 'ما الفرق بين المراحل والحالة؟',
  faqA3: 'المراحل هي الخطوات التي يمر بها الملف (مثلاً: تقديم الوثائق ← مراجعة الوزارة ← التوقيع). كل مرحلة لها حالتها الخاصة. الحالة الإجمالية للملف تعكس أكثر مرحلة عاجلة.',
  faqQ4: 'هل يمكنني إسناد ملف لعدة أشخاص؟',
  faqA4: 'كل ملف له شخص مُعيّن رئيسي واحد. ومع ذلك، يمكن أن يكون لكل مرحلة شخص مُعيّن خاص بها — لذا يمكن لأعضاء فريق مختلفين أو جهات اتصال خارجية معالجة مراحل مختلفة من نفس الملف.',
  faqQ5: 'ما الفرق بين أعضاء الفريق والشبكة؟',
  faqA5: 'أعضاء الفريق هم زملاؤك الذين يسجلون الدخول إلى GovPilot. الشبكة (الأشخاص الخارجيون) هم جهات اتصال خارجية كالمحامين والوسطاء — ليس لديهم حسابات في التطبيق ولكن يمكن إسنادهم للمراحل لأغراض المتابعة.',
  faqQ6: 'كيف أتتبّع المدفوعات؟',
  faqA6: 'افتح ملفاً، انتقل إلى قسم المالية. السعر التعاقدي هو الرسوم المتفق عليها. استخدم "+ إضافة" لتسجيل المصاريف أو المدفوعات المستلمة. يُظهر الرصيد (المدفوعات المستلمة − المصاريف).',
  faqQ7: 'متى تتم أرشفة الملف؟',
  faqA7: 'فقط المرحلة النهائية تتحكم بالأرشفة. عند تعيين حالتها إلى منجز أو مرفوض أو مستلم ومغلق، يُؤرشف الملف تلقائياً وينتقل من قائمة النشطة إلى قائمة الأرشيف على لوحة التحكم. يمكن أن تكون المراحل السابقة في أي حالة — فهي فقط لتتبع التقدم.',
  faqQ8: 'هل يمكنني استخدام التطبيق دون اتصال بالإنترنت؟',
  faqA8: 'يتم وضع التعليقات وبعض الإجراءات في قائمة الانتظار وتُزامَن عند عودة الاتصال. لكن تحميل الملفات وتحديث المراحل ورفع المستندات تتطلب اتصالاً بالإنترنت.',
  // ── Misc ────
  helpGuideDesc: 'تعرف كيف يعمل GovPilot',
  faqDesc: 'الأسئلة الشائعة',
  reportBugDesc: 'الإبلاغ عن خطأ في التطبيق',
  contactSupportDesc: 'تواصل مع فريق الدعم',
  permissionsDesc: 'إدارة الصلاحيات حسب الدور',
  visibilityDesc: 'إدارة ما يراه الأعضاء',
  languageDesc: 'لغة واتجاه التطبيق',
  rtlDesc: 'تخطيط من اليمين إلى اليسار للعربية',
  // ── Help Guide ────
  helpGuideTitle: '📖 دليل المساعدة',
  help1Title: 'إنشاء ملف',
  help1S1: 'انتقل إلى لوحة التحكم واضغط "+ ملف جديد".',
  help1S2: 'اختر أو أنشئ عميلاً — أدخل اسمه ورقم هاتفه وجهة الاتصال المرجعية.',
  help1S3: 'اختر خدمة — يقوم النظام بتحميل المراحل الافتراضية تلقائياً.',
  help1S4: 'حدد سعراً تعاقدياً (اختياري) وتاريخ استحقاق، ثم اضغط "إنشاء".',
  help2Title: 'إدارة المراحل',
  help2S1: 'افتح ملفاً ← اضغط "✎ تعديل المراحل" لإضافة أو إزالة أو إعادة ترتيب المراحل.',
  help2S2: 'كل مرحلة لها حالتها الخاصة: معلق ← قيد المراجعة ← منجز (أو مرفوض).',
  help2S3: 'اضغط على شارة الحالة في المرحلة لتحديثها — يمكنك إضافة سبب الرفض.',
  help2S4: 'حدد مدينة 📍 لكل مرحلة لتتبع مكان كل خطوة.',
  help2S5: 'المراحل ذات تواريخ الاستحقاق تظهر في التقويم بنقاط ملونة.',
  help2S6: 'عندما يتم تعيين المرحلة النهائية إلى منجز أو مرفوض أو مستلم ومغلق، يُؤرشف الملف تلقائياً.',
  help3Title: 'إسناد الأشخاص',
  help3S1: 'على مستوى الملف: افتح الملف واضغط على صف المُعيّن لإسناده إلى عضو فريق.',
  help3S2: 'على مستوى المرحلة: كل مرحلة لها شارة المُعيّن الخاصة بها — اضغط 👤 للإسناد.',
  help3S3: 'يمكن إسناد جهات الشبكة (الوكلاء/المحامون الخارجيون) على مستوى المرحلة أيضاً.',
  help3S4: 'يتلقى الأعضاء المُعيّنون إشعاراً عند تحديث مرحلة.',
  help4Title: 'المستندات',
  help4S1: 'داخل ملف، انتقل إلى قسم المستندات واضغط "📷 مسح" أو "🖼 من المعرض".',
  help4S2: 'ضع مستندك داخل إطار A4 الإرشادي والتقطه.',
  help4S3: 'أعطه اسماً واربطه اختيارياً بمتطلب مرحلة.',
  help4S4: 'يمكن عرض المستندات داخل التطبيق أو مشاركتها كملف عبر زر المشاركة.',
  help5Title: 'التتبع المالي',
  help5S1: 'داخل ملف، انتقل إلى قسم المالية لرؤية السعر التعاقدي والرصيد.',
  help5S2: 'اضغط "+ إضافة" لتسجيل مصروف أو دفعة مستلمة.',
  help5S3: 'اسحب يميناً على أي بطاقة في لوحة التحكم لإضافة مالية سريعة.',
  help5S4: 'زُر التقرير المالي (الإعدادات) لرؤية صافي الأرباح/الخسائر عبر جميع الملفات.',
  help6Title: 'التقويم',
  help6S1: 'تبويب التقويم يعرض جميع الملفات ذات تاريخ استحقاق كنقاط ملونة.',
  help6S2: 'المراحل المتأخرة تظهر بالأحمر — اضغط على تاريخ لرؤية مراحل اليوم.',
  help6S3: 'حدد تاريخ استحقاق المرحلة من داخل تفاصيل الملف تحت كل مرحلة.',
  help7Title: 'البحث',
  help7S1: 'اضغط أيقونة 🔍 على لوحة التحكم لفتح البحث الشامل.',
  help7S2: 'ابحث عبر الملفات والعملاء والمراحل والمستندات في وقت واحد.',
  help7S3: 'اضغط أي نتيجة للانتقال مباشرة إلى الملف أو العميل.',
  help8Title: 'الشبكة (جهات الاتصال)',
  help8S1: 'انتقل إلى إنشاء ← 👥 الشبكة لإدارة جهات اتصالك الخارجية.',
  help8S2: 'أضف محامين أو وكلاء أو أي أطراف خارجية مع الاسم والهاتف والمرجع.',
  help8S3: 'استورد عدة جهات اتصال دفعة واحدة باستخدام "📥 استيراد" (لصق من Excel).',
  help8S4: 'يمكن إسناد جهات الاتصال إلى مراحل محددة داخل ملف.',
  help9Title: 'جهات اتصال الوزارة',
  help9S1: 'يمكن لكل وزارة أن يكون لها قائمة جهات الاتصال الخاصة بها (موظفون، رؤساء أقسام). أدِرها من إنشاء ← مراحل بالضغط على 👥 بجانب اسم المرحلة.',
  help9S2: 'أضف جهة اتصال مع الاسم والهاتف والمنصب وأوقات التواجد (مثلاً الإثنين-الجمعة 9-2) والملاحظات.',
  help9S3: 'داخل أي ملف، اضغط 👥 على المرحلة لاختيار جهات الاتصال التي تريد عرضها تحت اسم المرحلة. حدّدها واضغط "تم".',
  help9S4: 'اضغط على أي سطر جهة اتصال للاتصال أو المراسلة عبر واتساب.',
  // ── Extended FAQ ────
  faqQ9: 'كيف أحذف ملفاً؟',
  faqA9: 'اسحب يساراً على أي بطاقة ملف في لوحة التحكم واضغط "✕ حذف". سيُطلب منك التأكيد. أو افتح الملف واستخدم قائمة "⋯" في الرأس.',
  faqQ10: 'كيف أستورد عملاء أو مراحل متعددة دفعة واحدة؟',
  faqA10: 'في تبويب "إنشاء ← العملاء"، اضغط "📥 استيراد" والصق صفوفاً مَنسوخة مباشرة من Excel (الأعمدة: الاسم، الهاتف، اسم المرجع، هاتف المرجع). للمراحل، استخدم نفس زر الاستيراد في نافذة المراحل.',
  faqQ11: 'كيف أحدد مدينة لمرحلة؟',
  faqA11: 'في الملف، كل صف مرحلة له شارة 📍 المدينة. اضغطها لاختيار أو البحث عن مدينة. يمكنك أيضاً تعيين مدينة افتراضية لكل نوع مرحلة في "إنشاء ← المراحل" — الملفات الجديدة ستملأ تلقائياً تلك المدينة.',
  faqQ12: 'كيف أضيف متطلبات إلى مرحلة؟',
  faqA12: 'داخل ملف، كل مرحلة لها زر "📋 المتطلبات". اضغطه لإضافة مستندات أو مهام أو متطلبات توقيع. يمكنك أيضاً تحديد قوالب متطلبات لكل نوع مرحلة في "إنشاء ← المراحل ← 📋 متطلبات".',
  faqQ13: 'كيف أطبع أو أشارك ملخص ملف؟',
  faqA13: 'افتح الملف واضغط أيقونة الطباعة 🖨 في الرأس. يُولّد هذا ملف PDF منسّق يلخص الملف والمراحل والشؤون المالية يمكنك مشاركته أو طباعته.',
  faqQ14: 'كيف أدعو عضو فريق؟',
  faqA14: 'انتقل إلى الإعدادات ← أعضاء الفريق ← "✉️ دعوة". أدخل بريده الإلكتروني أو رقم هاتفه واختر دوره. سيسجل في التطبيق بنفس المُعرّف ويُضاف تلقائياً إلى مؤسستك.',
  faqQ15: 'كيف أضيف جهات اتصال الوزارة إلى مرحلة؟',
  faqA15: 'أولاً، أضف جهات الاتصال إلى الوزارة نفسها: انتقل إلى إنشاء ← مراحل، اضغط 👥 بجانب اسم المرحلة، وأضف جهات الاتصال (اسم، هاتف، منصب، إلخ). ثم داخل أي ملف، اضغط 👥 على تلك المرحلة لاختيار جهات الاتصال التي تريد عرضها تحت اسم المرحلة.',
  faqQ16: 'ماذا يحدث عند استعادة ملف من الأرشيف؟',
  faqA16: 'السحب للاستعادة من قائمة الأرشيف يعيد المرحلة النهائية إلى "معلق" ويمسح تاريخ الأرشفة وتاريخ الاستحقاق. تحتفظ المراحل السابقة بتقدمها. يظهر الملف مجدداً في قائمة النشطة.',
  // ── Phase 5 fixes ────
  quickActions: 'إجراءات سريعة',
  todayBtn: 'اليوم',
  noEvents: 'لا توجد أحداث',
  itemsCount: 'عنصر',
  editProfileSubtitle: 'تعديل الملف الشخصي وكلمة المرور وإعدادات المؤسسة',
  membersInviteesCount: 'عضو، دعوة',
  visibilityPermsSubtitle: 'تحكم بما يراه ويفعله الأعضاء والمشاهدون',
  exchangeRateLabel: 'سعر الصرف',
  exchangeRateSubtitle: 'اضغط للتحديث',
  clientFieldsSubtitle: 'تخصيص المعلومات التي يتم جمعها لكل عميل',
  teamMemberFieldsSubtitle: 'حقول مخصصة لملفات أعضاء الفريق',
  financialReportSubtitle: 'الأرباح والخسائر عبر جميع الملفات — مع فلترة',
  tabAdmin: 'مسؤول',
  tabMember: 'عضو',
  tabViewer: 'مشاهد',
  adminTabDesc: 'يمكن للمسؤولين إدارة إعدادات الفريق ودعوة أعضاء جدد. اضبط وصولهم للملفات والشؤون المالية هنا.',
  memberTabDesc: 'يمكن للأعضاء العمل على الملفات المسندة إليهم. اضبط ما يمكنهم رؤيته وفعله.',
  viewerTabDesc: 'المشاهدون يطّلعون فقط. اضبط ما يمكنهم رؤيته.',
  fileVisibilitySection: 'ظهور الملفات',
  fileVisibilityDesc: 'اضغط على عضو للتحكم بالملفات المحددة التي يمكنه رؤيتها',
  planLimitReached: 'تم بلوغ حدّ الباقة',
  planLimitBody: 'الباقة المجانية تسمح بـ {count} ملف نشط.',
  planGraceBody: 'لديك {days} أيام قبل أن يتوقف GovPilot عن العمل. قم بالترقية الآن للمتابعة دون انقطاع.',
  planLimitChip: 'يوم متبقي',
  planUpgradeNow: 'الترقية الآن',
  planRemindLater: 'ذكّرني لاحقاً',
  mon: 'الإثنين', tue: 'الثلاثاء', wed: 'الأربعاء', thu: 'الخميس',
  fri: 'الجمعة', sat: 'السبت', sun: 'الأحد',
  unknown: 'غير معروف', someone: 'شخص ما',
  changedStatus: 'غيّر الحالة', fromStatus: 'من',
  deletedThisFile: 'حذف هذا الملف',
  addTransaction: 'إضافة معاملة', allDay: 'طوال اليوم', today2: 'اليوم',
  // ── Phase 7 fixes ────
  events: 'حدث', noActivity: 'لا يوجد نشاط بعد',
  noActivitySub: 'تظهر هنا تغييرات الحالة والتعليقات والحذف',
  addField: '+ إضافة حقل',
  fieldText: 'نص', fieldPhone: 'هاتف', fieldEmail: 'بريد إلكتروني',
  fieldDate: 'تاريخ', fieldNumber: 'رقم', fieldBoolean: 'نعم/لا',
  fieldSelect: 'قائمة منسدلة', fieldUrl: 'رابط',
  fieldLocation: 'موقع', fieldImage: 'صورة', fieldIdNumber: 'رقم هوية',
  fieldCurrency: 'عملة', fieldTextarea: 'نص طويل', fieldMultiselect: 'اختيار متعدد',
  frStatusLabel: 'الحالة',
  frClosedFilter: 'مغلق', frActiveFilter: 'نشط', frAllFilter: 'الكل',
  frAllFiles: 'كل الملفات', frServiceFilter: 'الخدمة', frStageFilter: 'المرحلة',
  frFrom: 'من', frTo: 'إلى', frPdf: 'PDF',
  frReceived: 'مستلم', frExpenses: 'مصاريف',
  frBalance: 'الرصيد', frResult: 'الصافي',
  frFilesContract: 'ملف · العقد', frCvUsd: 'ما يعادل بالدولار',
  frLbpRate: 'ل.ل / $1', frTapDetails: 'اضغط للتفاصيل ›', frClosed: 'مغلق',
  // ── Phase 8 ────
  enableNotifications: 'تفعيل الإشعارات',
  enableNotificationsDesc: 'استلام إشعارات على هذا الجهاز',
  notificationTypes: 'أنواع الإشعارات',
  commentsNotes: 'التعليقات والملاحظات',
  commentsNotesDesc: 'عند إضافة أعضاء الفريق تعليقات على الملفات',
  statusChanges: 'تغييرات الحالة',
  statusChangesDesc: 'عند تحديث حالة ملف أو مرحلة',
  newFilesNotif: 'الملفات الجديدة',
  newFilesNotifDesc: 'عند إنشاء ملف عميل جديد',
  receiveFrom: 'استلام من',
  receiveFromDesc: 'الأعضاء غير المُحدَّدين لن يُطلقوا إشعارات لك — حتى عند إضافة تعليقات أو تحديث الحالة.',
  noOtherMembers: 'لا يوجد أعضاء آخرون بعد',
  reportBugTitle: '🐛 الإبلاغ عن خطأ',
  reportBugDesc2: 'صف ما حدث وكيف يمكن إعادة إنتاجه. سنُصلحه في أقرب وقت.',
  bugTitleLabel: 'عنوان الخطأ',
  bugDescLabel: 'الوصف',
  submitBug: 'إرسال البلاغ',
  contactUsTitle: '✉️ تواصل معنا',
  contactUsDesc: 'سيرد فريقنا في management@kts-lb.com في أقرب وقت ممكن.',
  yourName: 'اسمك',
  yourEmail: 'بريدك الإلكتروني',
  subjectLabel: 'الموضوع',
  messageLabel: 'الرسالة',
  sendMsg: 'إرسال الرسالة',
  inviteCodesTitle: '🔑 رموز الدعوة',
  inviteCodesDesc: 'يمنح كل رمز شخصاً واحداً صلاحية الوصول حسب الدور.',
  newInvite: '+ جديد',
  roleOwnerBadge: '👑 مالك',
  roleAdminBadge: '🔑 مسؤول',
  roleMemberBadge: '👤 عضو',
  roleViewerBadge: '👁 مشاهد',
  usesCount: 'استخدام',
  createdLabel: 'أُنشئ',
  viewProfile: 'عرض الملف الشخصي ←',
  removeAssignment: '✕ إزالة التعيين',
  tapToSet: 'اضغط للتحديد',
  whatsappShare: '📤 واتساب',
  duplicateFile: '📋 تكرار',
  // ── Phase 9 ────────────────────────────────────────────────────────────────
  saveChanges: 'حفظ التغييرات',
  createField: 'إنشاء حقل',
  editFieldTitle: 'تعديل الحقل',
  fieldTypeLabel: 'نوع الحقل',
  noCustomFieldsYet: 'لا توجد حقول مخصصة بعد',
  tapAddFieldHint: 'اضغط "+ إضافة حقل" لإنشاء أول حقل',
  mustFillCreating: 'يجب ملؤه عند إنشاء عميل',
  mustFillAdding: 'يجب ملؤه عند إضافة عضو فريق',
  completedStat: 'مكتمل',
  noFilesForClient: 'لا توجد ملفات لهذا العميل',
  clearDateBtn: 'مسح التاريخ',
  createClientBtn: 'إنشاء عميل',
  howToImportExcel: 'كيفية الاستيراد من Excel:',
  setCityOptional: '📍 تعيين المدينة (اختياري)',
  noFieldsYet: 'لا توجد حقول مضافة بعد.',
  saveAndAddField: 'حفظ وإضافة حقل',
  searchEverything: 'البحث في كل شيء',
  nothingMatchedQuery: 'لا يوجد ما يطابق',
  noRequirementsDefined: 'لا توجد متطلبات محددة',
  addDocsActionsNeeded: 'أضف المستندات والإجراءات اللازمة لاستكمال هذه المرحلة',
  requirementTypeLabel: 'نوع المتطلب',
  tapToAddStagesToRoute: 'اضغط لإضافة مراحل إلى المسار',
  createFileBtn: 'إنشاء الملف',
  noDocumentsForService: 'لا توجد مستندات مدرجة لهذه الخدمة.',
  mutedLabel: 'صامت',
  savePrefsBtn: 'حفظ التفضيلات',
  noStagesAddFirst: 'لا توجد مراحل بعد. أضف أول مرحلة أدناه.',
  changeRoleDesc: 'تغيير دور هذا العضو في الفريق.',
  autoJoinOrgDesc: 'سينضمون تلقائياً إلى مؤسستك عند التسجيل.',
  sendInviteBtn: 'إرسال الدعوة',
  rateModalDesc: 'حدد سعر صرف الدولار إلى الليرة اللبنانية لهذا اليوم.',
  saveRateBtn: 'حفظ السعر',
  noRequirementsYet: 'لا توجد متطلبات بعد',
  tapAddReqHint: 'اضغط + إضافة متطلب للبدء',
  titleAsterisk: 'العنوان *',
  typeLabel: 'النوع',
  markAsCompleted: 'وضع علامة كمكتمل',
  attachmentLabel: 'المرفق',
  attachScanDoc: 'إرفاق / مسح مستند',
  selectTypeTitle: 'اختر النوع',
  noteOptionalLabel: 'ملاحظة (اختياري)',
  noStagesAddedYet: 'لا توجد مراحل مضافة بعد',
  saveCityBtn: 'حفظ المدينة',
  noCitiesMatch: 'لا توجد مدن مطابقة',
  allStagesAlreadyAdded: 'جميع المراحل مضافة بالفعل.',
  noStagesMatch: 'لا توجد مراحل مطابقة',
  loadingDocument: 'جاري تحميل المستند...',
  noInviteCodesYet: 'لا توجد رموز دعوة بعد. اضغط ＋ جديد لإنشاء رمز.',
  noCodesMatch: 'لا توجد رموز مطابقة',
  noMembersMatch: 'لا يوجد أعضاء مطابقون',
  forLabel: 'لـ:',
  newInviteCodeTitle: 'رمز دعوة جديد',
  fillWhoCode: 'أدخل من هذا الرمز مخصص له واختر دوره.',
  phoneLockedDesc: 'يمكن للمدعو التسجيل فقط بهذا الرقم.',
  sendToInboxDesc: 'إرسال رمز الدعوة مباشرة إلى بريده الإلكتروني.',
  generateCodeBtn: 'إنشاء الرمز',
  noTasksAssigned: 'لا توجد مهام مسندة',
  dueLabel: 'الاستحقاق:',
  editMemberTitle: 'تعديل العضو',
  accessRestrictedAdmins: 'الوصول مقيد للمالكين والمسؤولين.',
  noMembersManage: 'لا يوجد أعضاء للإدارة',
  joinOrgDesc: 'أدخل الرمز الذي شاركه معك المسؤول للانضمام إلى شركته.',
  currentCompanyLabel: 'الشركة الحالية:',
  joinBtn: 'انضمام',
  saveProfileBtn: 'حفظ الملف الشخصي',
  updatePasswordBtn: 'تحديث كلمة المرور',
  noStagesForService: 'لا توجد مراحل افتراضية لهذه الخدمة. أضف مراحل أدناه.',
  fileCreatedLabel: 'تاريخ الإنشاء',
  noStagesYetAddBelow: 'لا توجد مراحل بعد. أضف مرحلة أدناه.',
  pasteExcelClients: 'الصق من Excel: الاسم | الهاتف | اسم المرجع | هاتف المرجع',
  refPrefix: 'مرجع:',
  noServicesMatch: 'لا توجد خدمات مطابقة',
  stageNamePlaceholder: 'اسم المرحلة',
  noStagesNoMatch: 'لا توجد مراحل مطابقة',
  importClientsBtn: 'استيراد عملاء',
  importServicesBtn: 'استيراد خدمات',
  previewRowsBtn: 'معاينة',
  inviteSent: '✉️ تم إرسال الدعوة',
  revoke: 'إلغاء',
  inviteTeamMemberTitle: '✉️ دعوة عضو فريق',
  adminRoleDesc: 'يمكنه إدارة الإعدادات ودعوة الأعضاء وعرض جميع البيانات',
  memberRoleDesc: 'يمكنه إنشاء وتعديل الملفات وإضافة المراحل والمستندات',
  viewerRoleDesc: 'وصول للقراءة فقط — لا يمكنه إنشاء أو تعديل أي سجلات',
  emailLabel: 'البريد الإلكتروني',
  phoneLabel: 'رقم الهاتف',
  roleLabel: 'الدور',
  notifPrefsFootnote: 'يتم حفظ التفضيلات في حسابك وتُطبّق على جميع أجهزتك.',
  revokedCodesLabel: 'الرموز الملغاة',
  totalFilesLabel: 'إجمالي الملفات', fileHistoryLabel: 'سجل الملفات',
  clientDetailsLabel: 'تفاصيل العميل', openedLabel: 'فُتح', stagesProgress: 'مراحل',
  savedFieldsLabel: 'الحقول المحفوظة',
  requiredFieldLabel: 'حقل إلزامي',
  scheduleLabel: 'الجدول الزمني',
  teamSectionLabel: 'الفريق',
  externalSectionLabel: 'خارجي',
  noDefaultStages: 'لا توجد مراحل افتراضية لهذه الخدمة. أضف مراحل أدناه.',
  reqTypeDocument: 'مستند', reqTypeForm: 'نموذج', reqTypeSignature: 'توقيع',
  reqTypeApproval: 'موافقة', reqTypePayment: 'دفع', reqTypeCertificate: 'شهادة', reqTypeOther: 'أخرى',
  myCompanyTitle: '🏢 شركتي',
  joinCompanyTitle: '🏢 الانضمام إلى شركة',
  editProfileCardTitle: '👤 تعديل الملف الشخصي',
  securityCardTitle: '🔒 الأمان',
  viewPlansBtn: '🚀 عرض الباقات ›',
  managePlanBtn: '⚙ إدارة الباقة ›',
  currentUsageTitle: 'استخدامك الحالي',
  teamMembersUsage: 'أعضاء الفريق',
  activeFilesUsage: 'الملفات النشطة',
  overPlanLimitHint: '⚠️ تجاوزت حد الباقة — قم بالترقية لإضافة المزيد',
  overPlanBannerMsg: 'أنت تستخدم أكثر مما تسمح به باقتك الحالية. يرجى الترقية للاستمرار في استخدام جميع الميزات.',
  freeLabel: 'مجاني',
  billedAnnuallyLabel: '/شهر · يُحسب سنوياً',
  perMonthLabel: '/شهر',
  save33Label: 'وفر 33٪',
  currentPlanBadge: 'الباقة الحالية',
  ctaCurrentPlan: 'باقتك الحالية',
  ctaDowngrade: 'تخفيض',
  ctaUpgradeNow: 'ترقية الآن',
  phoneHintLogin: '📱 هذا هو رقم تسجيل الدخول الخاص بك',
  phoneHintContact: '📱 رقم التواصل المسجل في النظام',
  planFootnoteText: 'جميع الباقات تتضمن تجربة مجانية لمدة 7 أيام. لا يلزم بطاقة ائتمانية للترقية.',
  // Phase 11
  createAndAdd: 'إنشاء وإضافة',
  createNewContact: 'إضافة جهة اتصال جديدة',
  fieldNameLabel: 'اسم الحقل',
  optionsSeparated: 'الخيارات (مفصولة بفاصلة)',
  // Phase 12
  filterByService:    'تصفية حسب الخدمة',
  filterByStage:      'تصفية حسب المرحلة',
  allServices:        'جميع الخدمات',
  allStages:          'جميع المراحل',
  saveAndApply:       'حفظ وتطبيق',
  fromDate:           'من تاريخ',
  toDate:             'إلى تاريخ',
  closedLabel:        'مغلق',
  currentStatusLabel: 'الحالة الحالية',
  cameraScan:         'الكاميرا / مسح',
  photoLibrary:       'مكتبة الصور',
  govFileTracking:    'تتبع الملفات الحكومية',
  createNewCity:      'إنشاء مدينة جديدة',
  requirement:        'متطلب',
  // Phase 13
  saveAndSelect:      'حفظ واختيار',
  saveAndAssign:      'حفظ وتعيين',
  saveContact:        'حفظ جهة الاتصال',
  noSubReqYet:        'لا توجد متطلبات فرعية. أضف أدناه.',
  noDocsAddedYet:     'لم يتم إضافة مستندات بعد.',
  allFieldsAdded:     'جميع الحقول مضافة',
  noFieldsMatch:      'لا توجد حقول مطابقة',
  noContactsYet:      'لا توجد جهات اتصال. اضغط ＋ جديد للإضافة.',
  stopAccess:         'إيقاف الوصول',
  removeForever:      'حذف نهائي',
  yesContinue:        'نعم، تابع',
  noPriceChanges:     'لم يتم تسجيل أي تغييرات بعد.',
  noTransactionsYet:  'لا توجد معاملات بعد.',
  settingUpAccount:   'جارٍ إعداد حسابك…',
  setupIncomplete:    'الإعداد غير مكتمل',
  signOutAndTryAgain: 'تسجيل الخروج وإعادة المحاولة',
  letsGetSetUp:       'لنبدأ الإعداد',
  yourCompanyTitle:   'شركتك',
  confirmOrgName:     'أكّد اسم شركتك أو مكتبك. هذا ما سيراه فريقك.',
  yourFirstService:   'خدمتك الأولى',
  firstServiceDesc:   'أضف نوع الخدمة التي تقدمها ومرحلتها الأولى. يمكنك إضافة المزيد لاحقاً.',
  inviteTeammate:     'دعوة زميل',
  continueArrow:      'متابعة ←',
  skipForNow:         'تخطّ الآن',
  inviteAndContinue:  'دعوة ومتابعة ←',
  skipInviteLater:    'تخطّ — سأدعو لاحقاً',
  chooseLanguage:     'اختر لغتك',
  estimatedDays:      'تقديري: {n} يوم',
  visFilesTitle:      'الملفات',
  visStagesTitle:     'المراحل',
  visFinancialTitle:  'المالية',
  visDocumentsTitle:  'المستندات',
  visClientsTitle:    'العملاء',
  visCatalogTitle:    'الكتالوج',
  visActivityTitle:   'النشاط والتعليقات',
  step:               'الخطوة',
  client:             'عميل',
  // Phase 14: AccountScreen
  companyNamePlaceholder: 'اسم شركتك',
  transferOwnershipError: 'يجب نقل الملكية لمشرف آخر قبل حذف حسابك.',
  planFreeLabel:          'الخطة المجانية',
  planBasicLabel:         'الخطة الأساسية',
  planPremiumLabel:       'الخطة المميزة',
  planNameFree:           'مجاني',
  planNameBasic:          'أساسي',
  planNamePremium:        'مميز',
  feat3Members:           'حتى 3 أعضاء فريق',
  feat10Members:          'حتى 10 أعضاء فريق',
  featUnlimitedMembers:   'أعضاء فريق غير محدودين',
  feat25Files:            'حتى 25 ملفاً نشطاً',
  featUnlimitedFiles:     'ملفات نشطة غير محدودة',
  featDocScanning:        'مسح المستندات ورفعها',
  featBasicFinancial:     'تتبع مالي أساسي',
  featFullFinancial:      'تتبع مالي كامل',
  featStageTracking:      'تتبع المراحل والحالات',
  featReportsExport:      'تقارير مالية وتصدير',
  featPDFUpload:          'رفع مستندات PDF',
  featPrioritySupport:    'دعم ذو أولوية',
  featPriorityEmailSupport: 'دعم بريد إلكتروني ذو أولوية',
  featDedicatedManager:   'مدير حساب مخصص',
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
  // ── Welcome wizard ────
  welcomeStep1Title: 'Open the Create window',
  welcomeStep1Body: 'Click the Create button at the bottom of the page to open the setup panel.',
  welcomeStep2Title: 'Add your clients',
  welcomeStep2Body: 'Insert the clients that will be associated with your files and cases.',
  welcomeStep3Title: 'Define services',
  welcomeStep3Body: 'Add the services offered. These will be available when filling out files on the dashboard.',
  welcomeStep4Title: 'Configure stages & other entries',
  welcomeStep4Body: 'Set up workflow stages and any additional required entries for your organization.',
  welcomeStep5Title: 'Return to the dashboard',
  welcomeStep5Body: 'Once setup is complete, head back to the dashboard to begin creating and filling your files.',
  welcomeReady: "✅ You're ready to go!",
  welcomeNeverShow: "Don't show again",
  welcomeIntro: 'Welcome to GovPilot. Follow these steps to get started:',
  // ── Plans ────
  planFreeTagline: 'Get started at no cost',
  planStarterTagline: 'For growing teams',
  planBusinessTagline: 'For large operations',
  planMonthly: 'Monthly',
  planYearly: 'Yearly',
  planSavePercent: 'Save %',
  planMostPopular: 'Most Popular',
  planChoosePlan: 'Choose this plan',
  planContactSales: 'Contact Sales',
  planCurrentPlanLabel: 'Your current plan',
  // ── FAQ ────
  faqTitle: '💬 Frequently Asked Questions',
  faqQ1: 'How do I create a new file?',
  faqA1: 'From the Dashboard, tap the + New File button. Select a client, choose a service (which loads stages automatically), set a price and due date, then tap Create.',
  faqQ2: "How do I change a file's status?",
  faqA2: "Open the file, find the stage you want to update, and tap its status badge. You'll see a list of all available statuses. The file's overall status is always the most critical active stage.",
  faqQ3: 'What is the difference between stages and status?',
  faqA3: "Stages are the steps a file goes through (e.g. Submit Documents → Ministry Review → Signature). Each stage has its own status. The file's overall status reflects the most urgent stage status.",
  faqQ4: 'Can I assign a file to multiple people?',
  faqA4: 'Each file has one main assignee. However, every individual stage can have its own assigned person — so different team members or external contacts can handle different stages of the same file.',
  faqQ5: 'What is the difference between Team Members and Network?',
  faqA5: "Team Members are your colleagues who log in to GovPilot. Network (external assignees) are outside contacts like lawyers or agents — they don't have app accounts but can be assigned to stages for tracking.",
  faqQ6: 'How do I track payments?',
  faqA6: 'Open a file, scroll to FINANCIALS. The contract price is the agreed fee. Use + Add to record expenses or payments received. The balance shows (payments received − expenses).',
  faqQ7: 'When does a file get archived?',
  faqA7: "Only the FINAL stage controls archiving. When you set its status to Done, Rejected, or Received & Closed, the file is archived automatically and moves from Active to the Archive list on the Dashboard. Earlier stages can be in any state — they just track progress.",
  faqQ8: 'Can I use the app offline?',
  faqA8: 'Comments and some actions are queued offline and sync when your connection returns. However, loading files, updating stages, and uploading documents require an internet connection.',
  // ── Misc ────
  helpGuideDesc: 'Learn how GovPilot works',
  faqDesc: 'Frequently asked questions',
  reportBugDesc: 'Report a bug in the app',
  contactSupportDesc: 'Get in touch with our support team',
  permissionsDesc: 'Manage permissions per role',
  visibilityDesc: 'Manage what members can see',
  languageDesc: 'App language and direction',
  rtlDesc: 'Right-to-left layout for Arabic',
  // ── Help Guide ────
  helpGuideTitle: '📖 Help Guide',
  help1Title: 'Creating a File',
  help1S1: 'Go to the Dashboard and tap + New File.',
  help1S2: 'Select or create a client — enter their name, phone, and reference contact.',
  help1S3: 'Choose a service — this loads its default stages automatically.',
  help1S4: 'Set a contract price (optional) and a due date, then tap Create.',
  help2Title: 'Managing Stages',
  help2S1: 'Open a file → tap ✎ Edit Stages to add, remove, or reorder stages.',
  help2S2: 'Each stage has its own status: Pending → In Review → Done (or Rejected).',
  help2S3: 'Tap the status badge on a stage to update it — you can also add a rejection reason.',
  help2S4: 'Set a city 📍 per stage to track where each step happens.',
  help2S5: 'Stages with due dates appear on the Calendar with color-coded dots.',
  help2S6: 'When the FINAL stage is set to Done, Rejected, or Received & Closed, the file is automatically archived.',
  help3Title: 'Assigning People',
  help3S1: 'File-level: open a file and tap the Assignee row to assign a team member.',
  help3S2: 'Stage-level: each stage has its own assignee chip — tap 👤 to assign.',
  help3S3: 'Network contacts (external agents/lawyers) can be assigned at stage level too.',
  help3S4: 'Assigned members receive a push notification when a stage is updated.',
  help4Title: 'Documents',
  help4S1: 'Inside a file, scroll to DOCUMENTS and tap 📷 Scan or 🖼 Library.',
  help4S2: 'Frame your document inside the A4 guide and capture.',
  help4S3: 'Give it a name and optionally link it to a stage requirement.',
  help4S4: 'Documents can be viewed in-app or shared as a file via the share button.',
  help5Title: 'Financial Tracking',
  help5S1: 'Inside a file, scroll to FINANCIALS to see the contract price and balance.',
  help5S2: 'Tap + Add to record an expense or a payment received.',
  help5S3: 'Swipe right on any Dashboard card for a quick-add finance shortcut.',
  help5S4: 'Visit Financial Report (Settings) for a full P&L across all files.',
  help6Title: 'Calendar',
  help6S1: 'The Calendar tab shows all files with a due date as colored dots.',
  help6S2: "Overdue stages appear in red — tap a date to see the day's stages.",
  help6S3: 'Set a stage due date inside the file detail under each stage row.',
  help7Title: 'Search',
  help7S1: 'Tap the 🔍 icon on the Dashboard to open Global Search.',
  help7S2: 'Search across files, clients, stages, and documents at once.',
  help7S3: 'Tap any result to navigate directly to that file or client.',
  help8Title: 'Network (Contacts)',
  help8S1: 'Go to Create → 👥 Network to manage your external contacts.',
  help8S2: 'Add lawyers, agents, or any external parties with name, phone, and reference.',
  help8S3: 'Import multiple contacts at once using 📥 Import (paste from Excel).',
  help8S4: 'Contacts can be assigned to specific stages inside a file.',
  help9Title: 'Ministry Contacts',
  help9S1: 'Each ministry can have its own list of contacts (officers, clerks, department heads to call). Manage them in Create → Stages by tapping 👥 next to a stage name.',
  help9S2: 'Add a contact with name, phone, position, presence (e.g. Mon–Fri 9am–2pm), and notes.',
  help9S3: "Inside any file, tap 👥 on a stage to pick which contacts to display under that stage's name. Tick them and tap Done.",
  help9S4: 'Tap any contact line to call or message via WhatsApp.',
  // ── Extended FAQ ────
  faqQ9: 'How do I delete a file?',
  faqA9: "Swipe left on any file card on the Dashboard and tap ✕ Delete. You'll be asked to confirm. Alternatively, open the file and use the ⋯ menu in the header.",
  faqQ10: 'How do I import multiple clients or stages at once?',
  faqA10: 'In Create → Clients modal, tap 📥 Import and paste rows copied directly from Excel (columns: Name, Phone, Reference Name, Reference Phone). For stages, use the same import button in the Stages modal.',
  faqQ11: 'How do I set a city for a stage?',
  faqA11: 'In a file, each stage row has a 📍 city chip. Tap it to select or search a city. You can also set a default city per stage type in Create → Stages — new files will auto-fill that city.',
  faqQ12: 'How do I add requirements to a stage?',
  faqA12: 'Inside a file, each stage has a 📋 Requirements button. Tap it to add documents, tasks, or signature requirements. You can also define template requirements per stage type in Create → Stages → 📋 Req.',
  faqQ13: 'How do I print or share a file summary?',
  faqA13: 'Open the file and tap the 🖨 print icon in the header. This generates a formatted PDF summary of the file, stages, and financials which you can share or print.',
  faqQ14: 'How do I invite a team member?',
  faqA14: 'Go to Settings → Team Members → ✉️ Invite. Enter their email or phone number and choose their role. They register in the app with that same identifier and are automatically added to your organization.',
  faqQ15: 'How do I add ministry contacts to a stage?',
  faqA15: 'First add the contacts to the ministry itself: go to Create → Stages, tap 👥 next to a stage name, and add contacts (name, phone, position, etc). Then inside any file, tap 👥 on that stage to pick which contacts to display under the stage name.',
  faqQ16: 'What happens when I restore a file from the archive?',
  faqA16: 'Swipe-restore from the Archive list resets the final stage back to Pending and clears the archive date and due date. Earlier stages keep their progress. The file appears again in the Active list.',
  // ── Phase 5 fixes ────
  quickActions: 'Quick Actions',
  todayBtn: 'Today',
  noEvents: 'No events',
  itemsCount: 'items',
  editProfileSubtitle: 'Edit profile, change password, org settings',
  membersInviteesCount: 'members, invitees',
  visibilityPermsSubtitle: 'Control what members and viewers can see and do',
  exchangeRateLabel: 'Exchange Rate',
  exchangeRateSubtitle: 'tap to update',
  clientFieldsSubtitle: 'Customize what info to collect per client',
  teamMemberFieldsSubtitle: 'Custom fields for team member profiles',
  financialReportSubtitle: 'P&L across all files — filter by client or service',
  tabAdmin: 'Admin',
  tabMember: 'Member',
  tabViewer: 'Viewer',
  adminTabDesc: 'Admins can manage team settings and invite new members. Configure their file & financial access here.',
  memberTabDesc: 'Members can work on files assigned to them. Configure what they can see and do.',
  viewerTabDesc: 'Viewers are read-only. Configure what they can see.',
  fileVisibilitySection: 'File Visibility',
  fileVisibilityDesc: 'Tap a member to control which specific files they can see',
  planLimitReached: 'Plan Limit Reached',
  planLimitBody: 'Your Free plan allows {count} active files.',
  planGraceBody: 'You have {days} days before GovPilot stops working. Upgrade now to continue without interruption.',
  planLimitChip: 'days remaining',
  planUpgradeNow: 'Upgrade Now',
  planRemindLater: 'Remind Me Later',
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu',
  fri: 'Fri', sat: 'Sat', sun: 'Sun',
  unknown: 'Unknown', someone: 'Someone',
  changedStatus: 'changed status', fromStatus: 'from',
  deletedThisFile: 'deleted this file',
  addTransaction: 'Add Transaction', allDay: 'All day', today2: 'Today',
  // ── Phase 7 fixes ────
  events: 'events', noActivity: 'No activity yet',
  noActivitySub: 'Status changes, comments, and deletions will appear here',
  addField: '+ Add Field',
  fieldText: 'Text', fieldPhone: 'Phone', fieldEmail: 'Email',
  fieldDate: 'Date', fieldNumber: 'Number', fieldBoolean: 'Yes/No',
  fieldSelect: 'Dropdown', fieldUrl: 'URL',
  fieldLocation: 'Location', fieldImage: 'Image', fieldIdNumber: 'ID Number',
  fieldCurrency: 'Currency', fieldTextarea: 'Long Text', fieldMultiselect: 'Multi-select',
  frStatusLabel: 'STATUS',
  frClosedFilter: '✓ Closed', frActiveFilter: '⏳ Active', frAllFilter: '📋 All',
  frAllFiles: 'All Files', frServiceFilter: 'Service', frStageFilter: 'Stage',
  frFrom: 'From', frTo: 'To', frPdf: 'PDF',
  frReceived: 'RECEIVED', frExpenses: 'EXPENSES',
  frBalance: 'BALANCE', frResult: 'RESULT',
  frFilesContract: 'FILES · CONTRACT', frCvUsd: 'C/V USD',
  frLbpRate: 'LBP / $1', frTapDetails: 'Tap for details ›', frClosed: 'Closed',
  // ── Phase 8 ────
  enableNotifications: 'Enable Notifications',
  enableNotificationsDesc: 'Receive push notifications on this device',
  notificationTypes: 'NOTIFICATION TYPES',
  commentsNotes: 'Comments & Notes',
  commentsNotesDesc: 'When team members add comments to files',
  statusChanges: 'Status Changes',
  statusChangesDesc: 'When file or stage statuses are updated',
  newFilesNotif: 'New Files',
  newFilesNotifDesc: 'When a new client file is created',
  receiveFrom: 'RECEIVE FROM',
  receiveFromDesc: "Unchecked members won't trigger notifications for you — even when they post comments or update statuses.",
  noOtherMembers: 'No other team members yet',
  reportBugTitle: '🐛 Report a Bug',
  reportBugDesc2: "Describe what happened and how to reproduce it. We'll fix it ASAP.",
  bugTitleLabel: 'BUG TITLE',
  bugDescLabel: 'DESCRIPTION',
  submitBug: 'Submit Bug Report',
  contactUsTitle: '✉️ Contact Us',
  contactUsDesc: 'Our team at management@kts-lb.com will respond as soon as possible.',
  yourName: 'YOUR NAME',
  yourEmail: 'YOUR EMAIL',
  subjectLabel: 'SUBJECT',
  messageLabel: 'MESSAGE',
  sendMsg: 'Send Message',
  inviteCodesTitle: '🔑 Invite Codes',
  inviteCodesDesc: 'Each code gives one person access with a specific role',
  newInvite: '+ New',
  roleOwnerBadge: '👑 Owner',
  roleAdminBadge: '🔑 Admin',
  roleMemberBadge: '👤 Member',
  roleViewerBadge: '👁 Viewer',
  usesCount: 'use',
  createdLabel: 'Created',
  viewProfile: 'View profile →',
  removeAssignment: '✕ Remove assignment',
  tapToSet: 'Tap to set',
  whatsappShare: '📤 WhatsApp',
  duplicateFile: '📋 Duplicate',
  // ── Phase 9 ────────────────────────────────────────────────────────────────
  saveChanges: 'Save Changes',
  createField: 'Create Field',
  editFieldTitle: 'Edit Field',
  fieldTypeLabel: 'Field Type',
  noCustomFieldsYet: 'No custom fields yet',
  tapAddFieldHint: 'Tap "+ Add Field" to create your first field',
  mustFillCreating: 'Must be filled when creating a client',
  mustFillAdding: 'Must be filled when adding a team member',
  completedStat: 'Completed',
  noFilesForClient: 'No files for this client',
  clearDateBtn: 'Clear Date',
  createClientBtn: 'Create Client',
  howToImportExcel: 'How to import from Excel:',
  setCityOptional: '📍 Set city (optional)',
  noFieldsYet: 'No fields added yet.',
  saveAndAddField: 'Save & Add Field',
  searchEverything: 'Search Everything',
  nothingMatchedQuery: 'Nothing matched',
  noRequirementsDefined: 'No requirements defined',
  addDocsActionsNeeded: 'Add the documents and actions needed to complete this stage',
  requirementTypeLabel: 'Requirement Type',
  tapToAddStagesToRoute: 'Tap to add stages to the route',
  createFileBtn: 'Create File',
  noDocumentsForService: 'No documents listed for this service.',
  mutedLabel: 'Muted',
  savePrefsBtn: 'Save Preferences',
  noStagesAddFirst: 'No stages yet. Add the first one below.',
  changeRoleDesc: "Change this team member's role.",
  autoJoinOrgDesc: 'They will automatically join your organization when they register.',
  sendInviteBtn: 'Send Invite',
  rateModalDesc: 'Set today\'s USD → LBP rate. Used for C/V calculations throughout the app.',
  saveRateBtn: 'Save Rate',
  noRequirementsYet: 'No requirements yet',
  tapAddReqHint: 'Tap + Add Requirement to get started',
  titleAsterisk: 'Title *',
  typeLabel: 'Type',
  markAsCompleted: 'Mark as completed',
  attachmentLabel: 'Attachment',
  attachScanDoc: 'Attach / Scan Document',
  selectTypeTitle: 'Select Type',
  noteOptionalLabel: 'Note (optional)',
  noStagesAddedYet: 'No stages added yet',
  saveCityBtn: 'Save City',
  noCitiesMatch: 'No cities match',
  allStagesAlreadyAdded: 'All stages are already added.',
  noStagesMatch: 'No stages match',
  loadingDocument: 'Loading document...',
  noInviteCodesYet: 'No invite codes yet. Tap ＋ New to create one.',
  noCodesMatch: 'No codes match',
  noMembersMatch: 'No members match',
  forLabel: 'For:',
  newInviteCodeTitle: 'New Invite Code',
  fillWhoCode: 'Fill in who this code is for and choose their role.',
  phoneLockedDesc: 'The invitee can only register with this phone number.',
  sendToInboxDesc: 'Send the invite code directly to their inbox.',
  generateCodeBtn: 'Generate Code',
  noTasksAssigned: 'No tasks assigned',
  dueLabel: 'Due:',
  editMemberTitle: 'Edit Member',
  accessRestrictedAdmins: 'Access restricted to owners and admins.',
  noMembersManage: 'No members to manage',
  joinOrgDesc: 'Enter the code your admin shared with you to join their company.',
  currentCompanyLabel: 'Current company:',
  joinBtn: 'Join',
  saveProfileBtn: 'Save Profile',
  updatePasswordBtn: 'Update Password',
  noStagesForService: 'No default stages for this service. Add stages below.',
  fileCreatedLabel: 'File Created',
  noStagesYetAddBelow: 'No stages yet. Add one below.',
  pasteExcelClients: 'Paste from Excel: Name | Phone | Ref Name | Ref Phone',
  refPrefix: 'Ref:',
  noServicesMatch: 'No services match',
  stageNamePlaceholder: 'Stage name',
  noStagesNoMatch: 'No stages match',
  importClientsBtn: 'Import clients',
  importServicesBtn: 'Import services',
  previewRowsBtn: 'Preview',
  inviteSent: '✉️ Invite Sent',
  revoke: 'Revoke',
  inviteTeamMemberTitle: '✉️ Invite Team Member',
  adminRoleDesc: 'Can manage settings, invite members, view all data',
  memberRoleDesc: 'Can create and edit files, add stages and documents',
  viewerRoleDesc: 'Read-only access — cannot create or edit any records',
  emailLabel: 'Email Address',
  phoneLabel: 'Phone Number',
  roleLabel: 'Role',
  notifPrefsFootnote: 'Preferences are stored in your account and apply across all devices you sign in to.',
  revokedCodesLabel: 'REVOKED CODES',
  totalFilesLabel: 'TOTAL FILES', fileHistoryLabel: 'FILE HISTORY',
  clientDetailsLabel: 'CLIENT DETAILS', openedLabel: 'Opened', stagesProgress: 'stages',
  savedFieldsLabel: 'SAVED FIELDS',
  requiredFieldLabel: 'REQUIRED FIELD',
  scheduleLabel: 'SCHEDULE',
  teamSectionLabel: 'TEAM',
  externalSectionLabel: 'EXTERNAL',
  noDefaultStages: 'No default stages for this service. Add stages below.',
  reqTypeDocument: 'Document', reqTypeForm: 'Form', reqTypeSignature: 'Signature',
  reqTypeApproval: 'Approval', reqTypePayment: 'Payment', reqTypeCertificate: 'Certificate', reqTypeOther: 'Other',
  myCompanyTitle: '🏢 My Company',
  joinCompanyTitle: '🏢 Join a Company',
  editProfileCardTitle: '👤 Edit Profile',
  securityCardTitle: '🔒 Security',
  viewPlansBtn: '🚀 View Plans ›',
  managePlanBtn: '⚙ Manage Plan ›',
  currentUsageTitle: 'YOUR CURRENT USAGE',
  teamMembersUsage: 'Team Members',
  activeFilesUsage: 'Active Files',
  overPlanLimitHint: '⚠️ Over plan limit — upgrade to add more',
  overPlanBannerMsg: 'You are using more than your current plan allows. Please upgrade to keep using all features.',
  freeLabel: 'Free',
  billedAnnuallyLabel: '/mo · billed annually',
  perMonthLabel: '/month',
  save33Label: 'Save 33%',
  currentPlanBadge: 'CURRENT PLAN',
  ctaCurrentPlan: 'Current Plan',
  ctaDowngrade: 'Downgrade',
  ctaUpgradeNow: 'Upgrade Now',
  phoneHintLogin: '📱 This is your registered login number',
  phoneHintContact: '📱 Your contact number as registered in the system',
  planFootnoteText: 'All plans include a 7-day free trial. No credit card required to upgrade.',
  // Phase 11
  createAndAdd: 'Create & Add',
  createNewContact: 'Create new contact',
  fieldNameLabel: 'Field Name',
  optionsSeparated: 'Options (comma-separated)',
  // Phase 12
  filterByService:    'Filter by Service',
  filterByStage:      'Filter by Stage',
  allServices:        'All Services',
  allStages:          'All Stages',
  saveAndApply:       'Save & Apply',
  fromDate:           'From Date',
  toDate:             'To Date',
  closedLabel:        'Closed',
  currentStatusLabel: 'Current',
  cameraScan:         'Camera / Scan',
  photoLibrary:       'Photo Library',
  govFileTracking:    'Government File Tracking',
  createNewCity:      'Create New City',
  requirement:        'Requirement',
  // Phase 13
  saveAndSelect:      'Save & Select',
  saveAndAssign:      'Save & Assign',
  saveContact:        'Save Contact',
  noSubReqYet:        'No sub-requirements yet. Add below.',
  noDocsAddedYet:     'No documents added yet.',
  allFieldsAdded:     'All fields already added',
  noFieldsMatch:      'No fields match',
  noContactsYet:      'No contacts yet. Tap ＋ New to add one.',
  stopAccess:         'Stop Access',
  removeForever:      'Remove Forever',
  yesContinue:        'Yes, Continue',
  noPriceChanges:     'No changes recorded yet.',
  noTransactionsYet:  'No transactions yet.',
  settingUpAccount:   'Setting up your account…',
  setupIncomplete:    'Setup Incomplete',
  signOutAndTryAgain: 'Sign Out & Try Again',
  letsGetSetUp:       "Let's get you set up",
  yourCompanyTitle:   'Your Company',
  confirmOrgName:     'Confirm your company or office name. This is what your team will see.',
  yourFirstService:   'Your First Service',
  firstServiceDesc:   'Add the type of service you handle and its first stage. You can add more later in the app.',
  inviteTeammate:     'Invite a Teammate',
  continueArrow:      'Continue →',
  skipForNow:         'Skip for now',
  inviteAndContinue:  'Invite & Continue →',
  skipInviteLater:    "Skip — I'll invite later",
  chooseLanguage:     'Choose your language',
  estimatedDays:      'Est. {n} days',
  visFilesTitle:      'Files',
  visStagesTitle:     'Stages',
  visFinancialTitle:  'Financial',
  visDocumentsTitle:  'Documents',
  visClientsTitle:    'Clients',
  visCatalogTitle:    'Catalog',
  visActivityTitle:   'Activity & Comments',
  step:               'Step',
  client:             'Client',
  // Phase 14: AccountScreen
  companyNamePlaceholder: 'Your company name',
  transferOwnershipError: 'You must transfer ownership to another admin before deleting your account.',
  planFreeLabel:          'Free Plan',
  planBasicLabel:         'Basic Plan',
  planPremiumLabel:       'Premium Plan',
  planNameFree:           'Free',
  planNameBasic:          'Basic',
  planNamePremium:        'Premium',
  feat3Members:           'Up to 3 team members',
  feat10Members:          'Up to 10 team members',
  featUnlimitedMembers:   'Unlimited team members',
  feat25Files:            'Up to 25 active files',
  featUnlimitedFiles:     'Unlimited active files',
  featDocScanning:        'Document scanning & upload',
  featBasicFinancial:     'Basic financial tracking',
  featFullFinancial:      'Full financial tracking',
  featStageTracking:      'Stage & status tracking',
  featReportsExport:      'Financial reports & export',
  featPDFUpload:          'PDF document upload',
  featPrioritySupport:    'Priority support',
  featPriorityEmailSupport: 'Priority email support',
  featDedicatedManager:   'Dedicated account manager',
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
  // ── Welcome wizard ────
  welcomeStep1Title: 'Ouvrez la fenêtre de création',
  welcomeStep1Body: "Cliquez sur le bouton Créer en bas de la page pour ouvrir le panneau de configuration.",
  welcomeStep2Title: 'Ajoutez vos clients',
  welcomeStep2Body: 'Insérez les clients qui seront associés à vos dossiers et cas.',
  welcomeStep3Title: 'Définissez les services',
  welcomeStep3Body: "Ajoutez les services offerts. Ils seront disponibles lors de la création des dossiers sur le tableau de bord.",
  welcomeStep4Title: 'Configurez les étapes et autres entrées',
  welcomeStep4Body: "Configurez les étapes du flux de travail et toute entrée supplémentaire requise pour votre organisation.",
  welcomeStep5Title: 'Retour au tableau de bord',
  welcomeStep5Body: "Une fois la configuration terminée, retournez au tableau de bord pour commencer à créer et remplir vos dossiers.",
  welcomeReady: '✅ Vous êtes prêt !',
  welcomeNeverShow: 'Ne plus afficher',
  welcomeIntro: 'Bienvenue sur GovPilot. Suivez ces étapes pour commencer :',
  // ── Plans ────
  planFreeTagline: 'Commencez sans frais',
  planStarterTagline: 'Pour les équipes en croissance',
  planBusinessTagline: 'Pour les grandes opérations',
  planMonthly: 'Mensuel',
  planYearly: 'Annuel',
  planSavePercent: 'Économisez %',
  planMostPopular: 'Le plus populaire',
  planChoosePlan: 'Choisir ce forfait',
  planContactSales: 'Contacter les ventes',
  planCurrentPlanLabel: 'Votre forfait actuel',
  // ── FAQ ────
  faqTitle: '💬 Questions fréquentes',
  faqQ1: 'Comment créer un nouveau dossier ?',
  faqA1: "Depuis le tableau de bord, appuyez sur + Nouveau dossier. Sélectionnez un client, choisissez un service (qui charge automatiquement les étapes), définissez un prix et une échéance, puis appuyez sur Créer.",
  faqQ2: "Comment changer le statut d'un dossier ?",
  faqA2: "Ouvrez le dossier, trouvez l'étape à mettre à jour, et appuyez sur son badge de statut. Vous verrez la liste de tous les statuts disponibles. Le statut global du dossier est toujours l'étape active la plus critique.",
  faqQ3: 'Quelle est la différence entre étapes et statut ?',
  faqA3: "Les étapes sont les étapes d'un dossier (ex. Soumettre les documents → Examen ministériel → Signature). Chaque étape a son propre statut. Le statut global du dossier reflète l'étape la plus urgente.",
  faqQ4: 'Puis-je assigner un dossier à plusieurs personnes ?',
  faqA4: "Chaque dossier a un assigné principal. Cependant, chaque étape peut avoir son propre assigné — différents membres de l'équipe ou contacts externes peuvent gérer différentes étapes du même dossier.",
  faqQ5: 'Quelle est la différence entre Membres de l\'équipe et Réseau ?',
  faqA5: "Les Membres de l'équipe sont vos collègues qui se connectent à GovPilot. Le Réseau (assignés externes) sont des contacts externes comme avocats ou agents — ils n'ont pas de compte mais peuvent être assignés aux étapes pour le suivi.",
  faqQ6: 'Comment suivre les paiements ?',
  faqA6: 'Ouvrez un dossier, faites défiler jusqu\'à FINANCES. Le prix contractuel est le tarif convenu. Utilisez + Ajouter pour enregistrer les dépenses ou paiements reçus. Le solde affiche (paiements reçus − dépenses).',
  faqQ7: 'Quand un dossier est-il archivé ?',
  faqA7: "Seule l'étape FINALE contrôle l'archivage. Quand vous définissez son statut sur Terminé, Rejeté ou Reçu et Fermé, le dossier est archivé automatiquement et passe d'Actifs à la liste Archives sur le tableau de bord. Les étapes précédentes peuvent être dans n'importe quel état — elles ne servent qu'à suivre la progression.",
  faqQ8: "Puis-je utiliser l'application hors ligne ?",
  faqA8: "Les commentaires et certaines actions sont mis en file d'attente hors ligne et synchronisés à la reconnexion. Cependant, charger les dossiers, mettre à jour les étapes et téléverser des documents nécessitent une connexion Internet.",
  // ── Misc ────
  helpGuideDesc: 'Apprenez comment GovPilot fonctionne',
  faqDesc: 'Questions fréquentes',
  reportBugDesc: "Signaler un bug dans l'application",
  contactSupportDesc: "Contactez notre équipe de support",
  permissionsDesc: 'Gérer les permissions par rôle',
  visibilityDesc: 'Gérer ce que voient les membres',
  languageDesc: "Langue et direction de l'application",
  rtlDesc: "Mise en page de droite à gauche pour l'arabe",
  // ── Help Guide ────
  helpGuideTitle: '📖 Guide d\'aide',
  help1Title: "Créer un dossier",
  help1S1: "Allez au tableau de bord et appuyez sur + Nouveau dossier.",
  help1S2: 'Sélectionnez ou créez un client — entrez son nom, téléphone et contact de référence.',
  help1S3: "Choisissez un service — il charge automatiquement ses étapes par défaut.",
  help1S4: "Définissez un prix contractuel (optionnel) et une échéance, puis appuyez sur Créer.",
  help2Title: 'Gérer les étapes',
  help2S1: "Ouvrez un dossier → appuyez sur ✎ Modifier les étapes pour ajouter, supprimer ou réorganiser.",
  help2S2: "Chaque étape a son propre statut : En attente → En examen → Terminé (ou Rejeté).",
  help2S3: "Appuyez sur le badge de statut d'une étape pour le mettre à jour — vous pouvez ajouter un motif de rejet.",
  help2S4: "Définissez une ville 📍 par étape pour suivre où chaque étape a lieu.",
  help2S5: "Les étapes avec échéances apparaissent dans le calendrier avec des points colorés.",
  help2S6: "Quand l'étape FINALE est définie sur Terminé, Rejeté ou Reçu et Fermé, le dossier est automatiquement archivé.",
  help3Title: 'Assigner des personnes',
  help3S1: "Niveau dossier : ouvrez un dossier et appuyez sur la rangée Assigné pour assigner un membre.",
  help3S2: "Niveau étape : chaque étape a son propre badge d'assigné — appuyez sur 👤 pour assigner.",
  help3S3: "Les contacts du réseau (agents/avocats externes) peuvent aussi être assignés au niveau étape.",
  help3S4: "Les membres assignés reçoivent une notification push lors de la mise à jour d'une étape.",
  help4Title: 'Documents',
  help4S1: "Dans un dossier, faites défiler jusqu'à DOCUMENTS et appuyez 📷 Scanner ou 🖼 Bibliothèque.",
  help4S2: "Cadrez votre document dans le guide A4 et capturez.",
  help4S3: "Donnez-lui un nom et liez-le optionnellement à une exigence d'étape.",
  help4S4: "Les documents peuvent être consultés dans l'app ou partagés comme fichier via le bouton de partage.",
  help5Title: 'Suivi financier',
  help5S1: "Dans un dossier, faites défiler jusqu'à FINANCES pour voir le prix contractuel et le solde.",
  help5S2: "Appuyez + Ajouter pour enregistrer une dépense ou un paiement reçu.",
  help5S3: "Glissez à droite sur n'importe quelle carte du tableau de bord pour un raccourci finance rapide.",
  help5S4: "Consultez le Rapport financier (Paramètres) pour un P&L complet sur tous les dossiers.",
  help6Title: 'Calendrier',
  help6S1: "L'onglet Calendrier affiche tous les dossiers avec une échéance comme points colorés.",
  help6S2: "Les étapes en retard apparaissent en rouge — appuyez sur une date pour voir les étapes du jour.",
  help6S3: "Définissez une échéance d'étape dans le détail du dossier sous chaque rangée d'étape.",
  help7Title: 'Recherche',
  help7S1: "Appuyez sur l'icône 🔍 du tableau de bord pour ouvrir la recherche globale.",
  help7S2: "Recherchez à travers les dossiers, clients, étapes et documents simultanément.",
  help7S3: "Appuyez sur tout résultat pour naviguer directement vers ce dossier ou client.",
  help8Title: 'Réseau (Contacts)',
  help8S1: 'Allez à Créer → 👥 Réseau pour gérer vos contacts externes.',
  help8S2: 'Ajoutez avocats, agents ou toute partie externe avec nom, téléphone et référence.',
  help8S3: 'Importez plusieurs contacts à la fois avec 📥 Importer (coller depuis Excel).',
  help8S4: 'Les contacts peuvent être assignés à des étapes spécifiques dans un dossier.',
  help9Title: 'Contacts du ministère',
  help9S1: 'Chaque ministère peut avoir sa propre liste de contacts (agents, chefs de service à appeler). Gérez-les dans Créer → Étapes en touchant 👥 à côté du nom de l\'étape.',
  help9S2: 'Ajoutez un contact avec nom, téléphone, poste, présence (par ex. lun-ven 9h-14h), et notes.',
  help9S3: "Dans n'importe quel dossier, touchez 👥 sur une étape pour choisir les contacts à afficher sous le nom de l'étape. Cochez-les et touchez Terminer.",
  help9S4: "Touchez n'importe quelle ligne de contact pour appeler ou envoyer un message via WhatsApp.",
  // ── Extended FAQ ────
  faqQ9: 'Comment supprimer un dossier ?',
  faqA9: "Glissez à gauche sur toute carte de dossier dans le tableau de bord et appuyez ✕ Supprimer. Une confirmation vous sera demandée. Ou ouvrez le dossier et utilisez le menu ⋯ en haut.",
  faqQ10: 'Comment importer plusieurs clients ou étapes à la fois ?',
  faqA10: "Dans Créer → fenêtre Clients, appuyez 📥 Importer et collez des lignes copiées directement depuis Excel (colonnes : Nom, Téléphone, Nom de référence, Téléphone de référence). Pour les étapes, utilisez le même bouton dans la fenêtre Étapes.",
  faqQ11: 'Comment définir une ville pour une étape ?',
  faqA11: "Dans un dossier, chaque rangée d'étape a un badge 📍 ville. Appuyez pour sélectionner ou rechercher une ville. Vous pouvez aussi définir une ville par défaut par type d'étape dans Créer → Étapes — les nouveaux dossiers la rempliront automatiquement.",
  faqQ12: 'Comment ajouter des exigences à une étape ?',
  faqA12: "Dans un dossier, chaque étape a un bouton 📋 Exigences. Appuyez pour ajouter documents, tâches ou exigences de signature. Vous pouvez aussi définir des modèles d'exigences par type d'étape dans Créer → Étapes → 📋 Req.",
  faqQ13: 'Comment imprimer ou partager un résumé de dossier ?',
  faqA13: "Ouvrez le dossier et appuyez sur l'icône d'impression 🖨 en haut. Cela génère un PDF formaté résumant le dossier, les étapes et les finances que vous pouvez partager ou imprimer.",
  faqQ14: 'Comment inviter un membre d\'équipe ?',
  faqA14: "Allez à Paramètres → Membres de l'équipe → ✉️ Inviter. Entrez son email ou téléphone et choisissez son rôle. Il s'inscrit dans l'app avec le même identifiant et est automatiquement ajouté à votre organisation.",
  faqQ15: 'Comment ajouter des contacts du ministère à une étape ?',
  faqA15: "D'abord, ajoutez les contacts au ministère lui-même : allez dans Créer → Étapes, touchez 👥 à côté du nom de l'étape, et ajoutez des contacts (nom, téléphone, poste, etc.). Puis dans n'importe quel dossier, touchez 👥 sur cette étape pour choisir les contacts à afficher sous le nom de l'étape.",
  faqQ16: 'Que se passe-t-il quand je restaure un dossier depuis les archives ?',
  faqA16: "Le balayer-restaurer depuis la liste Archives remet l'étape finale à En attente et efface la date d'archivage et la date d'échéance. Les étapes précédentes conservent leur progression. Le dossier réapparaît dans la liste Active.",
  // ── Phase 5 fixes ────
  quickActions: 'Actions rapides',
  todayBtn: "Aujourd'hui",
  noEvents: 'Aucun événement',
  itemsCount: 'éléments',
  editProfileSubtitle: "Modifier le profil, le mot de passe, les paramètres de l'organisation",
  membersInviteesCount: 'membres, invités',
  visibilityPermsSubtitle: 'Contrôlez ce que les membres et observateurs peuvent voir et faire',
  exchangeRateLabel: 'Taux de change',
  exchangeRateSubtitle: 'appuyez pour mettre à jour',
  clientFieldsSubtitle: "Personnaliser les informations collectées par client",
  teamMemberFieldsSubtitle: "Champs personnalisés pour les profils des membres",
  financialReportSubtitle: 'P&L sur tous les dossiers — filtrer par client ou service',
  tabAdmin: 'Admin',
  tabMember: 'Membre',
  tabViewer: 'Observateur',
  adminTabDesc: "Les admins peuvent gérer les paramètres de l'équipe et inviter de nouveaux membres. Configurez ici leur accès aux dossiers et finances.",
  memberTabDesc: 'Les membres peuvent travailler sur les dossiers qui leur sont assignés. Configurez ce qu\'ils peuvent voir et faire.',
  viewerTabDesc: 'Les observateurs sont en lecture seule. Configurez ce qu\'ils peuvent voir.',
  fileVisibilitySection: 'Visibilité des dossiers',
  fileVisibilityDesc: 'Appuyez sur un membre pour contrôler quels dossiers spécifiques il peut voir',
  planLimitReached: 'Limite du forfait atteinte',
  planLimitBody: 'Votre forfait Gratuit autorise {count} dossiers actifs.',
  planGraceBody: 'Il vous reste {days} jours avant que GovPilot cesse de fonctionner. Mettez à niveau maintenant pour continuer sans interruption.',
  planLimitChip: 'jours restants',
  planUpgradeNow: 'Mettre à niveau',
  planRemindLater: 'Me rappeler plus tard',
  mon: 'Lun', tue: 'Mar', wed: 'Mer', thu: 'Jeu',
  fri: 'Ven', sat: 'Sam', sun: 'Dim',
  unknown: 'Inconnu', someone: 'Quelqu\'un',
  changedStatus: 'a changé le statut', fromStatus: 'de',
  deletedThisFile: 'a supprimé ce dossier',
  addTransaction: 'Ajouter une transaction', allDay: 'Toute la journée', today2: "Aujourd'hui",
  // ── Phase 7 fixes ────
  events: 'événements', noActivity: 'Aucune activité',
  noActivitySub: 'Changements de statut, commentaires et suppressions apparaîtront ici',
  addField: '+ Ajouter un champ',
  fieldText: 'Texte', fieldPhone: 'Téléphone', fieldEmail: 'E-mail',
  fieldDate: 'Date', fieldNumber: 'Nombre', fieldBoolean: 'Oui/Non',
  fieldSelect: 'Liste déroulante', fieldUrl: 'URL',
  fieldLocation: 'Lieu', fieldImage: 'Image', fieldIdNumber: 'Numéro ID',
  fieldCurrency: 'Devise', fieldTextarea: 'Texte long', fieldMultiselect: 'Sélection multiple',
  frStatusLabel: 'STATUT',
  frClosedFilter: '✓ Clos', frActiveFilter: '⏳ Actif', frAllFilter: '📋 Tous',
  frAllFiles: 'Tous les dossiers', frServiceFilter: 'Service', frStageFilter: 'Étape',
  frFrom: 'Du', frTo: 'Au', frPdf: 'PDF',
  frReceived: 'REÇU', frExpenses: 'DÉPENSES',
  frBalance: 'SOLDE', frResult: 'RÉSULTAT',
  frFilesContract: 'DOSSIERS · CONTRAT', frCvUsd: 'C/V USD',
  frLbpRate: 'LBP / $1', frTapDetails: 'Toucher pour détails ›', frClosed: 'Clos',
  // ── Phase 8 ────
  enableNotifications: 'Activer les notifications',
  enableNotificationsDesc: 'Recevoir des notifications push sur cet appareil',
  notificationTypes: 'TYPES DE NOTIFICATION',
  commentsNotes: 'Commentaires et notes',
  commentsNotesDesc: "Quand des membres ajoutent des commentaires aux dossiers",
  statusChanges: 'Changements de statut',
  statusChangesDesc: "Quand le statut d'un dossier ou d'une étape est mis à jour",
  newFilesNotif: 'Nouveaux dossiers',
  newFilesNotifDesc: 'Quand un nouveau dossier client est créé',
  receiveFrom: 'RECEVOIR DE',
  receiveFromDesc: "Les membres non cochés ne déclenchent pas de notifications pour vous — même quand ils commentent ou mettent à jour les statuts.",
  noOtherMembers: "Aucun autre membre d'équipe pour l'instant",
  reportBugTitle: '🐛 Signaler un bug',
  reportBugDesc2: "Décrivez ce qui s'est passé et comment le reproduire. Nous le corrigerons rapidement.",
  bugTitleLabel: 'TITRE DU BUG',
  bugDescLabel: 'DESCRIPTION',
  submitBug: 'Soumettre le rapport',
  contactUsTitle: '✉️ Nous contacter',
  contactUsDesc: 'Notre équipe à management@kts-lb.com vous répondra dès que possible.',
  yourName: 'VOTRE NOM',
  yourEmail: 'VOTRE E-MAIL',
  subjectLabel: 'SUJET',
  messageLabel: 'MESSAGE',
  sendMsg: 'Envoyer le message',
  inviteCodesTitle: "🔑 Codes d'invitation",
  inviteCodesDesc: "Chaque code donne accès à une personne avec un rôle spécifique",
  newInvite: '+ Nouveau',
  roleOwnerBadge: '👑 Propriétaire',
  roleAdminBadge: '🔑 Admin',
  roleMemberBadge: '👤 Membre',
  roleViewerBadge: '👁 Observateur',
  usesCount: 'utilisation',
  createdLabel: 'Créé',
  viewProfile: 'Voir le profil →',
  removeAssignment: "✕ Retirer l'attribution",
  tapToSet: 'Toucher pour définir',
  whatsappShare: '📤 WhatsApp',
  duplicateFile: '📋 Dupliquer',
  // ── Phase 9 ────────────────────────────────────────────────────────────────
  saveChanges: 'Enregistrer les modifications',
  createField: 'Créer un champ',
  editFieldTitle: 'Modifier le champ',
  fieldTypeLabel: 'Type de champ',
  noCustomFieldsYet: 'Aucun champ personnalisé',
  tapAddFieldHint: 'Appuyez sur "+ Ajouter un champ" pour créer votre premier champ',
  mustFillCreating: 'Doit être rempli lors de la création du client',
  mustFillAdding: "Doit être rempli lors de l'ajout d'un membre",
  completedStat: 'Terminé',
  noFilesForClient: 'Aucun dossier pour ce client',
  clearDateBtn: 'Effacer la date',
  createClientBtn: 'Créer le client',
  howToImportExcel: 'Comment importer depuis Excel :',
  setCityOptional: '📍 Définir la ville (optionnel)',
  noFieldsYet: 'Aucun champ ajouté.',
  saveAndAddField: 'Enregistrer et ajouter un champ',
  searchEverything: 'Tout rechercher',
  nothingMatchedQuery: 'Aucun résultat',
  noRequirementsDefined: 'Aucune exigence définie',
  addDocsActionsNeeded: "Ajoutez les documents et actions nécessaires pour compléter cette étape",
  requirementTypeLabel: "Type d'exigence",
  tapToAddStagesToRoute: "Appuyez pour ajouter des étapes à l'itinéraire",
  createFileBtn: 'Créer le dossier',
  noDocumentsForService: 'Aucun document répertorié pour ce service.',
  mutedLabel: 'Silencieux',
  savePrefsBtn: 'Enregistrer les préférences',
  noStagesAddFirst: 'Aucune étape. Ajoutez la première ci-dessous.',
  changeRoleDesc: "Modifier le rôle de ce membre de l'équipe.",
  autoJoinOrgDesc: "Ils rejoindront automatiquement votre organisation lors de leur inscription.",
  sendInviteBtn: "Envoyer l'invitation",
  rateModalDesc: "Définissez le taux USD → LBP d'aujourd'hui pour les calculs C/V.",
  saveRateBtn: 'Enregistrer le taux',
  noRequirementsYet: 'Aucune exigence',
  tapAddReqHint: 'Appuyez sur + Ajouter une exigence pour commencer',
  titleAsterisk: 'Titre *',
  typeLabel: 'Type',
  markAsCompleted: 'Marquer comme terminé',
  attachmentLabel: 'Pièce jointe',
  attachScanDoc: 'Joindre / Scanner un document',
  selectTypeTitle: 'Sélectionner le type',
  noteOptionalLabel: 'Note (optionnel)',
  noStagesAddedYet: 'Aucune étape ajoutée',
  saveCityBtn: 'Enregistrer la ville',
  noCitiesMatch: 'Aucune ville correspondante',
  allStagesAlreadyAdded: 'Toutes les étapes sont déjà ajoutées.',
  noStagesMatch: 'Aucune étape correspondante',
  loadingDocument: 'Chargement du document...',
  noInviteCodesYet: 'Aucun code. Appuyez ＋ Nouveau pour en créer un.',
  noCodesMatch: 'Aucun code correspondant',
  noMembersMatch: 'Aucun membre correspondant',
  forLabel: 'Pour :',
  newInviteCodeTitle: "Nouveau code d'invitation",
  fillWhoCode: "Indiquez à qui ce code est destiné et choisissez son rôle.",
  phoneLockedDesc: "L'invité ne peut s'inscrire qu'avec ce numéro de téléphone.",
  sendToInboxDesc: "Envoyer le code directement dans sa boîte mail.",
  generateCodeBtn: 'Générer le code',
  noTasksAssigned: 'Aucune tâche assignée',
  dueLabel: 'Échéance :',
  editMemberTitle: 'Modifier le membre',
  accessRestrictedAdmins: 'Accès restreint aux propriétaires et admins.',
  noMembersManage: 'Aucun membre à gérer',
  joinOrgDesc: "Entrez le code partagé par votre admin pour rejoindre l'organisation.",
  currentCompanyLabel: 'Entreprise actuelle :',
  joinBtn: 'Rejoindre',
  saveProfileBtn: 'Enregistrer le profil',
  updatePasswordBtn: 'Mettre à jour le mot de passe',
  noStagesForService: 'Aucune étape par défaut pour ce service. Ajoutez des étapes ci-dessous.',
  fileCreatedLabel: 'Dossier créé',
  noStagesYetAddBelow: 'Aucune étape. Ajoutez-en une ci-dessous.',
  pasteExcelClients: 'Coller depuis Excel : Nom | Tél | Nom réf | Tél réf',
  refPrefix: 'Réf :',
  noServicesMatch: 'Aucun service correspondant',
  stageNamePlaceholder: "Nom de l'étape",
  noStagesNoMatch: 'Aucune étape correspondante',
  importClientsBtn: 'Importer des clients',
  importServicesBtn: 'Importer des services',
  previewRowsBtn: 'Aperçu',
  inviteSent: '✉️ Invitation envoyée',
  revoke: 'Révoquer',
  inviteTeamMemberTitle: '✉️ Inviter un membre',
  adminRoleDesc: 'Peut gérer les paramètres, inviter des membres, voir toutes les données',
  memberRoleDesc: 'Peut créer et modifier des dossiers, ajouter des étapes et des documents',
  viewerRoleDesc: 'Accès lecture seule — ne peut pas créer ni modifier les enregistrements',
  emailLabel: 'Adresse e-mail',
  phoneLabel: 'Numéro de téléphone',
  roleLabel: 'Rôle',
  notifPrefsFootnote: 'Les préférences sont enregistrées et s\'appliquent sur tous vos appareils.',
  revokedCodesLabel: 'CODES RÉVOQUÉS',
  totalFilesLabel: 'TOTAL DOSSIERS', fileHistoryLabel: 'HISTORIQUE',
  clientDetailsLabel: 'DÉTAILS CLIENT', openedLabel: 'Ouvert', stagesProgress: 'étapes',
  savedFieldsLabel: 'CHAMPS ENREGISTRÉS',
  requiredFieldLabel: 'CHAMP OBLIGATOIRE',
  scheduleLabel: 'CALENDRIER',
  teamSectionLabel: 'ÉQUIPE',
  externalSectionLabel: 'EXTERNE',
  noDefaultStages: 'Aucune étape par défaut pour ce service. Ajoutez des étapes ci-dessous.',
  reqTypeDocument: 'Document', reqTypeForm: 'Formulaire', reqTypeSignature: 'Signature',
  reqTypeApproval: 'Approbation', reqTypePayment: 'Paiement', reqTypeCertificate: 'Certificat', reqTypeOther: 'Autre',
  myCompanyTitle: '🏢 Ma société',
  joinCompanyTitle: '🏢 Rejoindre une société',
  editProfileCardTitle: '👤 Modifier le profil',
  securityCardTitle: '🔒 Sécurité',
  viewPlansBtn: '🚀 Voir les plans ›',
  managePlanBtn: '⚙ Gérer le plan ›',
  currentUsageTitle: 'UTILISATION ACTUELLE',
  teamMembersUsage: 'Membres',
  activeFilesUsage: 'Dossiers actifs',
  overPlanLimitHint: '⚠️ Limite du plan dépassée — mettez à niveau',
  overPlanBannerMsg: 'Vous dépassez les limites de votre plan. Veuillez mettre à niveau pour continuer à utiliser toutes les fonctionnalités.',
  freeLabel: 'Gratuit',
  billedAnnuallyLabel: '/mois · facturé annuellement',
  perMonthLabel: '/mois',
  save33Label: 'Économisez 33%',
  currentPlanBadge: 'PLAN ACTUEL',
  ctaCurrentPlan: 'Plan actuel',
  ctaDowngrade: 'Rétrograder',
  ctaUpgradeNow: 'Mettre à niveau',
  phoneHintLogin: '📱 C\'est votre numéro de connexion enregistré',
  phoneHintContact: '📱 Votre numéro de contact enregistré dans le système',
  planFootnoteText: 'Tous les plans incluent un essai gratuit de 7 jours. Aucune carte de crédit requise.',
  // Phase 11
  createAndAdd: 'Créer et ajouter',
  createNewContact: 'Créer un nouveau contact',
  fieldNameLabel: 'Nom du champ',
  optionsSeparated: 'Options (séparées par virgule)',
  // Phase 12
  filterByService:    'Filtrer par service',
  filterByStage:      'Filtrer par étape',
  allServices:        'Tous les services',
  allStages:          'Toutes les étapes',
  saveAndApply:       'Enregistrer et appliquer',
  fromDate:           'Date de début',
  toDate:             'Date de fin',
  closedLabel:        'Fermé',
  currentStatusLabel: 'Actuel',
  cameraScan:         'Caméra / Scan',
  photoLibrary:       'Bibliothèque de photos',
  govFileTracking:    'Suivi des dossiers gouvernementaux',
  createNewCity:      'Créer une nouvelle ville',
  requirement:        'Exigence',
  // Phase 13
  saveAndSelect:      'Enregistrer et sélectionner',
  saveAndAssign:      'Enregistrer et assigner',
  saveContact:        'Enregistrer le contact',
  noSubReqYet:        'Aucune sous-exigence. Ajoutez ci-dessous.',
  noDocsAddedYet:     'Aucun document ajouté.',
  allFieldsAdded:     'Tous les champs sont déjà ajoutés',
  noFieldsMatch:      'Aucun champ correspondant',
  noContactsYet:      'Aucun contact. Appuyez ＋ Nouveau pour en ajouter.',
  stopAccess:         'Bloquer l\'accès',
  removeForever:      'Supprimer définitivement',
  yesContinue:        'Oui, continuer',
  noPriceChanges:     'Aucune modification enregistrée.',
  noTransactionsYet:  'Aucune transaction.',
  settingUpAccount:   'Configuration de votre compte…',
  setupIncomplete:    'Configuration incomplète',
  signOutAndTryAgain: 'Se déconnecter et réessayer',
  letsGetSetUp:       'Commençons la configuration',
  yourCompanyTitle:   'Votre entreprise',
  confirmOrgName:     'Confirmez le nom de votre entreprise ou bureau. C\'est ce que verra votre équipe.',
  yourFirstService:   'Votre premier service',
  firstServiceDesc:   'Ajoutez le type de service que vous gérez et sa première étape. Vous pouvez en ajouter plus tard.',
  inviteTeammate:     'Inviter un collègue',
  continueArrow:      'Continuer →',
  skipForNow:         'Passer pour l\'instant',
  inviteAndContinue:  'Inviter et continuer →',
  skipInviteLater:    'Passer — J\'inviterai plus tard',
  chooseLanguage:     'Choisissez votre langue',
  estimatedDays:      'Est. {n} jours',
  visFilesTitle:      'Dossiers',
  visStagesTitle:     'Étapes',
  visFinancialTitle:  'Finances',
  visDocumentsTitle:  'Documents',
  visClientsTitle:    'Clients',
  visCatalogTitle:    'Catalogue',
  visActivityTitle:   'Activité & Commentaires',
  step:               'Étape',
  client:             'Client',
  // Phase 14: AccountScreen
  companyNamePlaceholder: 'Nom de votre société',
  transferOwnershipError: 'Vous devez transférer la propriété à un autre administrateur avant de supprimer votre compte.',
  planFreeLabel:          'Forfait Gratuit',
  planBasicLabel:         'Forfait Basique',
  planPremiumLabel:       'Forfait Premium',
  planNameFree:           'Gratuit',
  planNameBasic:          'Basique',
  planNamePremium:        'Premium',
  feat3Members:           "Jusqu'à 3 membres d'équipe",
  feat10Members:          "Jusqu'à 10 membres d'équipe",
  featUnlimitedMembers:   "Membres d'équipe illimités",
  feat25Files:            "Jusqu'à 25 dossiers actifs",
  featUnlimitedFiles:     'Dossiers actifs illimités',
  featDocScanning:        'Scan & téléchargement de documents',
  featBasicFinancial:     'Suivi financier basique',
  featFullFinancial:      'Suivi financier complet',
  featStageTracking:      'Suivi des étapes & statuts',
  featReportsExport:      'Rapports financiers & export',
  featPDFUpload:          'Téléchargement PDF',
  featPrioritySupport:    'Support prioritaire',
  featPriorityEmailSupport: 'Support email prioritaire',
  featDedicatedManager:   'Gestionnaire de compte dédié',
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
