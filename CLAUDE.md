# CLAUDE.md — Ministry Tracker Project Memory

> This file is maintained by Claude and updated automatically as the project evolves.
> Last updated: session 11 (design token system: src/theme/tokens.ts + src/theme/index.ts; full migration of all 22 screens/components to theme.* tokens; RTL-safe margins throughout; no hardcoded hex colors remaining)

---

## Project Identity

- **Name:** Ministry Tracker
- **Type:** Internal cross-platform mobile app (iOS + Android)
- **Purpose:** Track client files through government ministry clearing pipelines
- **Users:** Company employees only — no public access
- **Permission model:** Flat — all users equal, no roles, no admin-only features

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React Native (Expo 54.0.33) |
| Language | TypeScript (strict: false) |
| Backend | Supabase (free tier) — DB, Auth, Realtime |
| Auth | Supabase Auth, email/password only |
| Navigation | React Navigation v6 (native stack + bottom tabs) |
| State | Zustand (offline queue only) |
| Offline | AsyncStorage-persisted Zustand queue, syncs on reconnect |
| Push | Expo Notifications + Expo Push API |
| GPS | Expo Location (comments only — removed from status updates) |
| Calendar | react-native-calendars |
| Network | @react-native-community/netinfo |
| Keyboard | react-native-keyboard-aware-scroll-view (replaces KeyboardAvoidingView+ScrollView) |
| Image picker | expo-image-picker |
| Camera | expo-camera ~17.0.10 (CameraView + useCameraPermissions) |
| Image manipulation | expo-image-manipulator (crop to A4 frame region after capture) |
| PDF generation | expo-print ~15.0.8 (printToFileAsync — used in TaskDetailScreen print action only) |
| File system | expo-file-system/legacy ~19.0.21 (SDK 54: downloadAsync + uploadAsync in /legacy subpath) |
| Sharing | expo-sharing (shareAsync — sends actual file from local cache, not URL) |
| Swipe gestures | React Native PanResponder + Animated (no gesture-handler) |
| Design tokens | src/theme/tokens.ts → re-exported as `import { theme } from '../theme'` |

### Confirmed working versions
- expo: 54.0.33
- react: 19.1.0
- react-native: 0.81.4 ← must match Expo Go binary
- babel-preset-expo: ~54.0.10
- expo-camera: ~17.0.10 (SDK 54 compatible)
- expo-print: ~15.0.8 (SDK 54 compatible)
- expo-file-system: ~19.0.21 (SDK 54 compatible)
- NO react-native-gesture-handler (causes PlatformConstants crash)
- NO react-native-reanimated (causes PlatformConstants crash)

---

## File Structure

```
ministry-tracker/
├── App.tsx                              # RTL init + notification handler
├── babel.config.js
├── package.json
├── tsconfig.json
├── CLAUDE.md
├── supabase/
│   ├── schema.sql
│   ├── migration_assignment_history.sql
│   ├── migration_custom_fields.sql
│   ├── migration_financials.sql
│   ├── migration_service_stages.sql
│   ├── migration_push_tokens.sql
│   ├── migration_stop_requirements.sql
│   ├── migration_service_pricing.sql
│   ├── migration_ministry_requirements.sql
│   ├── migration_task_documents.sql
│   └── migration_task_documents_v2.sql  ← NEW session 9 — adds display_name + requirement_id
└── src/
    ├── theme/
    │   ├── tokens.ts                    # All design tokens (colors, spacing, typography, radius, shadow, zIndex, animation)
    │   └── index.ts                     # Re-exports { theme } — import as `import { theme } from '../theme'`
    ├── lib/
    │   ├── supabase.ts
    │   └── notifications.ts
    ├── types/index.ts
    ├── store/offlineQueue.ts
    ├── hooks/
    │   ├── useAuth.ts
    │   └── useRealtime.ts
    ├── navigation/index.tsx
    ├── components/
    │   ├── TaskCard.tsx                 # accent strip; cardStyle prop; urgency pill
    │   ├── StatusBadge.tsx
    │   ├── RouteStop.tsx
    │   ├── OfflineBanner.tsx
    │   ├── ClientFieldsForm.tsx
    │   └── DocumentScannerModal.tsx     # live camera + A4 frame guide + JPEG crop (expo-image-manipulator) + req linking
    └── screens/
        ├── auth/LoginScreen.tsx
        ├── DashboardScreen.tsx          # filters; swipe L/R; manage dropdown+search; quick finance
        ├── NewTaskScreen.tsx
        ├── TaskDetailScreen.tsx         # stages; financials; documents row list; Open ↗ PDF
        ├── CalendarScreen.tsx
        ├── TeamScreen.tsx
        ├── SettingsScreen.tsx           # RTL toggle; CRUD services/ministries/labels/team
        ├── ClientFieldsSettingsScreen.tsx
        ├── ClientProfileScreen.tsx
        ├── EditClientScreen.tsx
        ├── ServiceStagesScreen.tsx
        ├── StageRequirementsScreen.tsx  # 32×32 checkbox; 7 req types; attach docs
        ├── MinistryRequirementsScreen.tsx  ← session 8
        └── FinancialReportScreen.tsx
```

---

## Database Schema (18 tables)

| Table | Key fields | Notes |
|---|---|---|
| `team_members` | id, name, role, email, avatar_url, push_token | |
| `clients` | id, name, client_id (auto CLT-timestamp), phone, reference_name, reference_phone | reference fields added session 10 |
| `ministries` | id, name, type (parent/child), parent_id | also used as "stages" in UI |
| `services` | id, name, ministry_id, estimated_duration_days, base_price_usd, base_price_lbp | duration always 0 (unused) |
| `status_labels` | id, label, color (hex), sort_order | user-defined |
| `tasks` | id, client_id, service_id, assigned_to (nullable), current_status, due_date, notes, price_usd, price_lbp, created_at, updated_at | |
| `task_route_stops` | id, task_id, ministry_id, stop_order, status, updated_by | called "stages" in UI; NO GPS |
| `task_comments` | id, task_id, author_id, body, gps_lat, gps_lng | GPS only here |
| `status_updates` | id, task_id, stop_id, updated_by, old_status, new_status | audit log; NO GPS |
| `assignment_history` | id, task_id, assigned_to, assigned_by, created_at | |
| `client_field_definitions` | id, label, field_key, field_type, options (jsonb), is_required, is_active, sort_order | 14 types |
| `client_field_values` | id, client_id, field_id, value_text, value_number, value_boolean, value_json | |
| `file_transactions` | id, task_id, type (expense/revenue), description, amount_usd, amount_lbp, created_by, created_at | |
| `service_default_stages` | id, service_id, ministry_id, stop_order | default stage templates per service |
| `stop_requirements` | id, stop_id, title, req_type, notes, is_completed, attachment_url, attachment_name, sort_order, created_by, updated_at | |
| `task_price_history` | id, task_id, old_price_usd, old_price_lbp, new_price_usd, new_price_lbp, note, changed_by | |
| `ministry_requirements` | id, ministry_id, title, req_type, notes, sort_order, created_at, updated_at | template requirements per stage (no completion state) |
| `task_documents` | id, task_id, file_name, display_name, file_url, file_type, uploaded_by, requirement_id, created_at | display_name + requirement_id added session 9 |

### Migrations to run (in order)
1. `supabase/schema.sql`
2. `supabase/migration_assignment_history.sql`
3. `supabase/migration_custom_fields.sql`
4. `supabase/migration_financials.sql`
5. `supabase/migration_service_stages.sql`
6. `supabase/migration_push_tokens.sql`
7. `supabase/migration_stop_requirements.sql`
8. `supabase/migration_service_pricing.sql`
9. `supabase/migration_ministry_requirements.sql`
10. `supabase/migration_task_documents.sql`
11. `supabase/migration_task_documents_v2.sql`
12. `supabase/migration_client_reference.sql`

### Status labels (current)
Submitted, In Review, Pending Signature, **Done** (was Approved), Rejected, Closed

### Urgency order for dashboard (most critical first)
Rejected → Pending Signature → In Review → Submitted → Pending → Done → Closed

---

## Data Model Rules

- `ministries` table = stages in UI (same table, type parent/child)
- `task_route_stops` = stages; ordered by `stop_order` (1-indexed)
- `tasks.current_status` = most recently updated stage status. Only "Done" when ALL stages are "Done"
- Status updates: NO GPS — removed intentionally
- GPS only stored on `task_comments`
- `client_id` auto-generated as `CLT-{Date.now()}`
- `assigned_to` is nullable — assignment always optional
- `created_at` on tasks set from device clock (not Supabase server time)
- Deletion of financial transactions logs an audit comment automatically
- `service_default_stages` links services → ministries as ordered default stages
- `estimated_duration_days` always saved as 0 — field is unused in UI
- `task_documents.requirement_id` → when set, the document also updates `stop_requirements.attachment_url`
- `task_documents.display_name` = human-readable name shown in UI (auto-filled as "Scan DD-MM-YYYY")

---

## Navigation Stack (DashboardStackParamList)

| Screen | Route params |
|---|---|
| DashboardHome | — |
| NewTask | `{ preselectedClientId?: string }` |
| TaskDetail | `{ taskId: string }` |
| ClientFieldsSettings | — |
| ClientProfile | `{ clientId: string }` |
| EditClient | `{ clientId: string }` |
| ServiceStages | `{ serviceId: string; serviceName: string }` |
| StageRequirements | `{ stopId: string; stageName: string; taskId: string }` |
| MinistryRequirements | `{ ministryId: string; ministryName: string }` |
| FinancialReport | — |

---

## Screen Responsibilities

| Screen | Key behavior |
|---|---|
| DashboardScreen | Filters (team/status/date/search); swipe-left (Edit/Delete); swipe-right (💰 Quick Finance); manage dropdown (Clients/Services/Stages with search bar each); + New Client modal with custom fields + reference fields; service name tap → ServiceStages; date fields use inline calendar (no nested modal) |
| NewTaskScreen | Client picker (✎ Edit → EditClient, ✕ delete); service picker (✎ Stages → ServiceStages, ✕ delete); create service with inline stage builder; stages auto-load on service select; useFocusEffect refreshes on return |
| TaskDetailScreen | Stages timeline + status update; assignment history; financials + contract price; DOCUMENTS section (row list, in-app viewer, share as file, delete, req tag); comments with GPS |
| CalendarScreen | Multi-dot calendar; day task list |
| TeamScreen | Member cards with workload; expandable task list |
| SettingsScreen | CRUD: ministries, services (✎ Stages modal), status labels, team members; Arabic/RTL toggle |
| ClientFieldsSettingsScreen | Manage custom field definitions: add/edit/reorder/toggle/delete |
| ClientProfileScreen | Avatar + name + ID + phone + ✎ Edit + ✕ Delete; custom fields; stats; file history with swipe-left (Edit/Delete) |
| EditClientScreen | Edit name + phone + custom field values; + Add Field picker with inline field creation |
| ServiceStagesScreen | Ordered stage list (↑↓ ✎ ✕); + Add Stage button → picker (existing ministries + create new) |
| StageRequirementsScreen | Per-stop requirements list; add/edit/remove; 7 req types; notes; 32×32 completion checkbox; document attach |
| MinistryRequirementsScreen | CRUD template requirements per stage (no completion state, no attachment) |
| FinancialReportScreen | All files P&L; filter by service/status/client; RECEIVED · OUTSTANDING · EXPENSES · BALANCE; totals bar shows both USD + LBP separated by thin divider; LBP values colored green/red; tap row → detail sheet |

---

## Document Scanner (DocumentScannerModal)

Component: `src/components/DocumentScannerModal.tsx`

### Flow
1. **Camera step** — full-screen live camera (`CameraView` from expo-camera) with:
   - A4-ratio white-corner frame overlay guiding document alignment
   - Dark overlay outside the frame
   - "Library" button top-right for picking from photos
   - Large capture button at bottom
2. **Preview step** — after capture/pick:
   - Cropped image preview (A4 ratio, `resizeMode="stretch"`)
   - Editable **Document Name** (auto-filled: "Scan DD-MM-YYYY")
   - **Link to Requirement** (optional) — picker of all stop_requirements for this task's stages; when linked, also updates `stop_requirements.attachment_url`
   - Save button — stores as **JPEG** (no PDF)
3. **Processing** — crops image with `expo-image-manipulator` → uploads JPEG via `FileSystem.uploadAsync` MULTIPART → inserts `task_documents` record

### No filters
Filters removed entirely. Documents stored as plain JPEG crops.

### Crop math (camera)
`coverScale = Math.max(SCREEN_W / photoW, SCREEN_H / photoH)` maps A4 frame coords to image pixel coords.
Library picks: center-crop to A4 ratio.

### Storage path
`task-attachments/documents/{taskId}/{display_name}_{timestamp}.jpg`

### Opening / sharing documents
- **In-app viewer**: `<Image>` + `<ScrollView maximumZoomScale={4}>` for JPEG; `WebView` for PDF
- **Share**: `FileSystem.downloadAsync` to cache → `Sharing.shareAsync` (sends actual file, not URL)
- Import: `import * as FileSystem from 'expo-file-system/legacy'` (SDK 54 moved APIs to `/legacy`)
- NO `Linking.openURL` for documents — replaced with in-app viewer modal in TaskDetailScreen

---

## Dashboard Swipe Gestures

`SwipeableTaskRow` in DashboardScreen — **bidirectional**:

| Direction | Width | Reveals |
|---|---|---|
| Swipe Left | 130px | ✎ Edit (indigo) + ✕ Delete (red) |
| Swipe Right | 80px | 💰 Add (green) → Quick Finance sheet |

### Quick Finance sheet (swipe-right)
- Shows client + service name of the task
- Expense / Revenue toggle
- Description + USD + LBP inputs
- Saves directly to `file_transactions`
- "View full financials →" link navigates to TaskDetail

### Swipe fix (prevents action buttons showing through)
Container must have `overflow: 'hidden'` + `borderRadius: 12` + `marginBottom: 10`.
TaskCard passed `cardStyle={{ marginBottom: 0 }}` from the wrapper.

---

## Manage Modals Search

Each manage section (Clients / Services / Stages) has a search bar below the header:
- `clientSearch`, `serviceSearch`, `stageSearch` state variables
- Cleared when modal closes or section switches
- Subtitle shows `X of Y` count while filtering
- "No X match '...'" empty state shown when no results

---

## PickerModal — Action Buttons Pattern

`PickerModal` in NewTaskScreen supports optional per-row action buttons:
- `onItemAction?: (item) => void` + `itemActionLabel?: string` — shows a styled button (e.g. "✎ Stages", "✎ Edit")
- `onItemDelete?: (item) => void` — shows a red ✕ button

When `onItemAction` fires, the picker closes automatically (`onClose()` is called after).

---

## Service Default Stages

- Defined in `service_default_stages` (service_id, ministry_id, stop_order)
- Managed via `ServiceStagesScreen` — full page: view, add (picker of existing ministries or create new), rename inline, reorder ↑↓, remove
- Also manageable from SettingsScreen (✎ Stages button on each service row)
- When selecting a service in NewTaskScreen, stages auto-populate via `loadServiceDefaultStages()`
- `useFocusEffect` in NewTaskScreen refreshes stages when returning from ServiceStagesScreen
- Creating a new service: name + inline stage builder (type + + button) → saves all as ministries + links

---

## Push Notifications

- `src/lib/notifications.ts`: `registerForPushNotifications()` + `sendPushNotification()`
- Token registered on login via `useAuth`, stored in `team_members.push_token`
- Sent to assignee when: stage status changes, task assigned
- Uses Expo Push API (`https://exp.host/--/push/v2/send`), best-effort (never throws)
- `App.tsx` handler includes `shouldShowBanner` and `shouldShowList` (required by newer Expo SDK)

---

## Arabic / RTL Support

- Toggle in SettingsScreen — `Switch` writes `@rtl_enabled` to AsyncStorage
- `App.tsx` reads `@rtl_enabled` on startup, calls `I18nManager.forceRTL()`, shows `null` until ready
- Requires app restart to apply (user shown `Alert` explaining this)

---

## Client Profile

- Accessible from: Dashboard task card client name, Dashboard search result, TaskDetail client name
- Shows: avatar, name, client_id, phone, ✎ Edit (→ EditClient) + ✕ Delete (confirmation)
- Custom field values grid
- Stats: Total / Active / Completed files
- + New File button (pre-selects client in NewTaskScreen)
- File history list with **swipe-left** → reveals ✎ Edit (→ TaskDetail) and ✕ Delete (confirmation)
- `useFocusEffect` refreshes all data on focus

---

## Swipe Gesture Pattern (no gesture-handler)

```tsx
// PanResponder tracks dx
// Snaps to -SWIPE_ACTION_WIDTH (left open), +FINANCE_ACTION_WIDTH (right open), or 0 (closed)
// Container: overflow:'hidden', borderRadius:12, marginBottom:10
// Action buttons: position:'absolute', left:0 (finance) or right:0 (edit/delete)
// TaskCard passed cardStyle={{ marginBottom: 0 }}
```

- No `react-native-gesture-handler` or `reanimated` needed
- Dashboard: SWIPE_ACTION_WIDTH = 130, FINANCE_ACTION_WIDTH = 80
- ClientProfile: ACTION_WIDTH = 130 (Edit + Delete only, swipe-left only)

---

## Custom Client Fields System

### 14 field types
text, textarea, number, currency, email, phone, url, date, boolean, select, multiselect, image, location, id_number

### How it works
- Fields defined in `client_field_definitions` (shared across all users)
- Values stored in `client_field_values` (per client per field)
- In NewTaskScreen/EditClientScreen: `+ Add Field` picker — choose existing or create new inline
- EditClientScreen loads existing values on mount, upserts/deletes on save

---

## Financials

- Per-file ledger in `file_transactions` table
- Types: `expense` (red) or `revenue` (green) — revenue = actual payments received only
- Currencies: USD and LBP — both stored separately
- **Contract Price** = agreed billing fee, stored on `tasks.price_usd/lbp`. Pre-filled from `services.base_price_usd/lbp`. Editable per file. NOT counted as revenue.
- **Payments Received** = sum of `revenue` type transactions
- **Outstanding** = Contract Price − Payments Received
- **Balance** = Payments Received − Expenses (shown in header + FinancialReport)
- Deleting a transaction auto-logs an audit comment with who deleted it
- Contract price changes logged in `task_price_history` (who + when + note)
- `TaskCard` shows contract price inline next to client name (indigo text, hidden if zero)
- `FinancialReportScreen` shows contract price next to client name; grid: RECEIVED · OUTSTANDING · EXPENSES · BALANCE
- **Quick Finance** available from Dashboard swipe-right on any task card
- All LBP inputs use comma-formatted display (`parseInt.toLocaleString('en-US')`) and `keyboardType="number-pad"`. Parse back with `.replace(/,/g, '')` before saving.
- `fmtUSD` / `fmtLBP` helper functions used throughout for display formatting

---

## Keyboard Behavior (project-wide fix)

### Pattern used everywhere
- Main screens: `KeyboardAwareScrollView` from `react-native-keyboard-aware-scroll-view`
  - `enableOnAndroid={true}`, `enableAutomaticScroll={true}`, `extraScrollHeight={80}`
- Modals with text inputs: `KeyboardAvoidingView` as **direct child of `<Modal>`**
  - `behavior="padding"` on iOS, `behavior="height"` on Android

### Do NOT use
- `KeyboardAvoidingView` wrapping a `ScrollView` on main screens
- `automaticallyAdjustKeyboardInsets` alone

---

## Dashboard Urgency Logic (TaskCard)

```
URGENCY_ORDER = { Rejected: 1, 'Pending Signature': 2, 'In Review': 3, Submitted: 4, Pending: 5, Done: 99, Closed: 100 }
```
- Filters out "Done" stages, finds most urgent remaining stage
- Shows "URGENT STAGE" badge if different from overall status

---

## Key Conventions

### Design Tokens (session 11+)
- All colors, spacing, typography, radius, shadow, zIndex via `import { theme } from '../theme'`
- Token reference: `theme.color.bgBase/bgSurface/border/textPrimary/textSecondary/textMuted/primary/primaryText/success/danger/white/overlayDark`
- Spacing: `theme.spacing.space1`(4) `space2`(8) `space3`(12) `space4`(16) `space5`(20) `space6`(24)
- Typography spreads: `...theme.typography.heading/body/label/caption/sectionDivider`
- Radius: `theme.radius.sm`(6) `md`(8) `lg`(12) `xl`(16)
- RTL margins: always `marginStart`/`marginEnd`, never `marginLeft`/`marginRight`
- Subdirectory screens (auth/): import as `../../theme`
- Semantic/data colors (user-chosen status hex values stored in DB) are left as string literals — not style tokens
- Camera viewfinder background stays `#000000` (pure black required, not bgBase)

- Dark theme: `#0f172a` bg, `#1e293b` card, `#334155` border
- Accent: `#6366f1`, success: `#10b981`, error: `#ef4444`
- No GPS on status updates — GPS only on comments
- No hardcoded dropdowns — all from DB
- No `e.g.` in any placeholder text
- `useRealtime` uses unique channel counter to prevent double-subscribe
- `letterSpacing` NOT allowed in `headerTitleStyle` or `tabBarLabelStyle` (RN Navigation type restriction)
- `keyboardType="decimal-pad"` instead of `"numbers-and-punctuation"` (not valid in RN types)
- `shouldShowBanner` and `shouldShowList` required in Expo Notifications handler
- Documents viewed in-app (Image/WebView viewer modal in TaskDetailScreen); shared as actual files via `expo-sharing`
- `expo-file-system` APIs (`downloadAsync`, `uploadAsync`) imported from `expo-file-system/legacy` in SDK 54
- React Native does NOT support two `Modal` components open simultaneously — use inline rendering instead (e.g. inline calendar inside existing modal)
- LBP inputs: `keyboardType="number-pad"` (no decimals); strip commas before parsing: `.replace(/,/g, '')`

---

## Users

| Name | Email | Role |
|---|---|---|
| Bechara Abdelmassih | becharaabdelmassih@gmail.com | Founder |

---

## Setup Checklist

- [ ] Run all 12 SQL migration files in Supabase SQL Editor (in order)
- [ ] Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `src/lib/supabase.ts`
- [ ] Create Supabase Storage bucket `task-attachments` (public)
- [ ] Create auth users in Supabase dashboard
- [ ] Insert matching rows in `team_members`
- [ ] `npm install --legacy-peer-deps`
- [ ] `npx expo start --clear`

---

## Known Issues Fixed

| Issue | Fix |
|---|---|
| `scr` folder typo | `rename scr src` |
| SDK mismatch | Expo 54.0.33, RN 0.81.4 |
| PlatformConstants crash | Removed gesture-handler + reanimated |
| Double realtime subscribe | useRealtime unique channel counter |
| Keyboard covers inputs | KeyboardAwareScrollView on screens, KAV as Modal direct child |
| Approved → Done | SQL UPDATE on status_labels |
| GPS on status updates | Removed intentionally |
| `letterSpacing` in tabBarLabelStyle/headerTitleStyle | Removed (not in allowed type) |
| `numbers-and-punctuation` keyboardType | Changed to `decimal-pad` |
| `shouldShowBanner`/`shouldShowList` missing | Added to App.tsx notification handler |
| `allStops` query missing `id` field | Changed `.select('status')` → `.select('id, status')` |
| ✎ Stages button not showing | Replaced `gap` style with `marginRight` in svcItem |
| Swipe action buttons visible through card gap | Container `overflow:'hidden'` + moved `marginBottom` to container |
| Clients modal anchoring at top | Added `justifyContent:'flex-end'` to overlay |
| PDF documents not opening | Changed to `Linking.openURL(doc.file_url)` + row layout with Open ↗ button |
| CSS filter not working in PDF | Replaced with canvas pixel-manipulation JS in HTML |
| Scanner 2-page PDF + aggressive filter | Removed PDF entirely — scanner stores JPEG via expo-image-manipulator crop + FileSystem.uploadAsync |
| Share sends URL instead of file | Replaced Share.share with expo-sharing + FileSystem.downloadAsync to cache |
| `downloadAsync`/`uploadAsync` deprecated warning | Import from `expo-file-system/legacy` (SDK 54 moved APIs) |
| Calendar modal freezes dashboard | React Native can't stack two Modals — replaced date picker Modal with inline Calendar inside existing modal |
| Service manage row had no tap-to-stages | Service name tappable (indigo, ›) → navigates to ServiceStages; ✎ still edits name/price |

---

## Change Log

| Session | Changes |
|---|---|
| 11 | Design token system: `src/theme/tokens.ts` (colors, spacing, typography, radius, shadow, zIndex, animation) + `src/theme/index.ts`; full migration of all 22 screens/components — zero hardcoded hex colors remaining; RTL-safe margins (`marginStart`/`marginEnd`) throughout; all `placeholderTextColor`, `ActivityIndicator color`, and `Switch trackColor/thumbColor` use tokens |
| 1 | Initial full build |
| 2 | SDK upgrade, folder fix, assignment history, stage editing, date picker, urgency status, GPS removed |
| 3 | Financials (USD+LBP ledger), custom client fields (14 types), inline field creation, keyboard fix project-wide, Bechara as Founder |
| 4 | TypeScript fixes; push notifications; ClientProfileScreen; EditClientScreen; ServiceStagesScreen; service default stages; PickerModal action buttons; client search in dashboard; swipe-left on ClientProfile; client profile Edit + Delete; create service stage builder |
| 5 | Stage requirements system: `stop_requirements` table + migration; `StageRequirementsScreen` (CRUD, 7 req types, completion toggle, document attach); 📋 Requirements button on each stage row in TaskDetailScreen |
| 6 | Service base price; task contract price; `task_price_history`; price edit with history; `FinancialReportScreen`; Financial Report nav in Settings; RLS fix |
| 7 | Dashboard management menu (Clients/Services/Stages CRUD modals); contract price financial model fix; payment + price history detail sheet in FinancialReport; contract price on TaskCard + FinancialReport header |
| 8 | Arabic RTL toggle; swipe-left fix on Dashboard; dashboard manage dropdown button; full client create form (custom fields); stages modal 📋 Req → MinistryRequirements; `MinistryRequirementsScreen`; `ministry_requirements` table; DOCUMENTS section in TaskDetailScreen; `task_documents` table; 32×32 checkbox in StageRequirementsScreen |
| 9 | Document scanner rewrite: live `CameraView` + A4 frame overlay + canvas pixel-manipulation PDF filters (Color/Grayscale/Document); editable document name; optional link to stage requirement (also updates stop_requirements.attachment_url); `task_documents` v2 (display_name + requirement_id); document list → row layout with Open ↗ button + requirement tag; swipe-right on dashboard → 💰 Quick Finance sheet; search bars in Clients/Services/Stages manage modals; `expo-camera` added |
| 10 | Client reference fields (reference_name + reference_phone) on clients table + shown on TaskCard/ClientProfile/EditClient/Dashboard new client form; scanner rewritten to JPEG-only with expo-image-manipulator crop (no PDF, no filters); share as actual file via expo-sharing; expo-file-system/legacy fix; comma separators on all LBP inputs (Dashboard/Settings/TaskDetail) + keyboardType=number-pad; FinancialReport totals bar now includes LBP totals; LBP values colored green/red; USD/LBP thin divider in totals bar and row cells; calendar freeze fix — inline Calendar inside new client modal (no nested Modal); service name in manage modal tappable → ServiceStages |

---

## Suggested Next Improvements (pre-evaluated)

| # | Feature | Effort | Value |
|---|---|---|---|
| 1 | Dashboard summary bar (active files, overdue count, outstanding balance) | Low | High |
| 2 | Export Financial Report as PDF (expo-print already installed) | Low | High |
| 3 | WhatsApp share button in TaskDetail (status summary as text) | Low | High |
| 4 | Quick status update from dashboard (long-press or 2nd swipe) | Medium | High |
| 5 | Global search across clients, files, stages, requirements | Medium | Medium |
| 6 | Document rename after upload | Low | Medium |
| 7 | Due date push notification (on-open overdue check) | Medium | Medium |
| 8 | Notifications inbox / activity feed tab | High | High |
| 9 | File duplication (same client + service + stages) | Medium | Medium |
| 10 | Offline status updates queue (currently only comments queue) | High | Medium |
