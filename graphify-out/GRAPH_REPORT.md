# Graph Report - .  (2026-04-12)

## Corpus Check
- 37 files · ~106,371 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 259 nodes · 269 edges · 35 communities detected
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Project Docs & Architecture|Project Docs & Architecture]]
- [[_COMMUNITY_Task Detail Screen|Task Detail Screen]]
- [[_COMMUNITY_Data Model & DB Schema Docs|Data Model & DB Schema Docs]]
- [[_COMMUNITY_Dashboard Screen Logic|Dashboard Screen Logic]]
- [[_COMMUNITY_Settings Screen CRUD|Settings Screen CRUD]]
- [[_COMMUNITY_Stage Requirements Screen|Stage Requirements Screen]]
- [[_COMMUNITY_Client Fields Settings|Client Fields Settings]]
- [[_COMMUNITY_Client Profile Screen|Client Profile Screen]]
- [[_COMMUNITY_Ministry Requirements Screen|Ministry Requirements Screen]]
- [[_COMMUNITY_Document Scanner|Document Scanner]]
- [[_COMMUNITY_Service Stages Screen|Service Stages Screen]]
- [[_COMMUNITY_Client Fields Form|Client Fields Form]]
- [[_COMMUNITY_New Task Screen|New Task Screen]]
- [[_COMMUNITY_Financial Report Screen|Financial Report Screen]]
- [[_COMMUNITY_Team Screen|Team Screen]]
- [[_COMMUNITY_Task Card Component|Task Card Component]]
- [[_COMMUNITY_Push Notifications|Push Notifications]]
- [[_COMMUNITY_Edit Client Screen|Edit Client Screen]]
- [[_COMMUNITY_App Entry Point|App Entry Point]]
- [[_COMMUNITY_Offline Banner|Offline Banner]]
- [[_COMMUNITY_Route Stop Component|Route Stop Component]]
- [[_COMMUNITY_Auth Hook|Auth Hook]]
- [[_COMMUNITY_Realtime Hook|Realtime Hook]]
- [[_COMMUNITY_Calendar Screen|Calendar Screen]]
- [[_COMMUNITY_Login Screen|Login Screen]]
- [[_COMMUNITY_Requirements Screens Docs|Requirements Screens Docs]]
- [[_COMMUNITY_Babel Build Config|Babel Build Config]]
- [[_COMMUNITY_Metro Build Config|Metro Build Config]]
- [[_COMMUNITY_Status Badge Component|Status Badge Component]]
- [[_COMMUNITY_Supabase Client|Supabase Client]]
- [[_COMMUNITY_Navigation Stack|Navigation Stack]]
- [[_COMMUNITY_Offline Queue Store|Offline Queue Store]]
- [[_COMMUNITY_Theme Export|Theme Export]]
- [[_COMMUNITY_Type Definitions|Type Definitions]]
- [[_COMMUNITY_README Reference|README Reference]]

## God Nodes (most connected - your core abstractions)
1. `Ministry Tracker App` - 19 edges
2. `DB Table: tasks` - 9 edges
3. `DocumentScannerModal Component` - 8 edges
4. `DashboardScreen` - 6 edges
5. `Supabase Backend` - 5 edges
6. `DB Table: stop_requirements` - 5 edges
7. `Swipe Gesture Pattern (PanResponder)` - 5 edges
8. `load()` - 4 edges
9. `handleAdd()` - 4 edges
10. `assignToMember()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `EAS Build (preview APK)` --references--> `Ministry Tracker App Icon (Standard)`  [EXTRACTED]
  CLAUDE.md → assets/icon.png
- `EAS Build (preview APK)` --references--> `Ministry Tracker Adaptive Icon (Android)`  [EXTRACTED]
  CLAUDE.md → assets/adaptive-icon.png
- `iOS PWA (ministry-papers.netlify.app)` --references--> `Ministry Tracker App Icon (Full-Bleed PWA)`  [EXTRACTED]
  CLAUDE.md → assets/icon-fullbleed.png
- `Rationale: No adaptiveIcon in app.json` --rationale_for--> `Ministry Tracker App Icon (Standard)`  [EXTRACTED]
  CLAUDE.md → assets/icon.png
- `Rationale: No adaptiveIcon in app.json` --rationale_for--> `Ministry Tracker Adaptive Icon (Android)`  [EXTRACTED]
  CLAUDE.md → assets/adaptive-icon.png

## Communities

### Community 0 - "Project Docs & Architecture"
Cohesion: 0.07
Nodes (37): Ministry Tracker Adaptive Icon (Android), App.tsx (RTL init + notification handler), Design Token System (src/theme), Document Scanner Flow, DocumentScannerModal Component, EAS Build (preview APK), expo-camera ~17.0.10, expo-file-system/legacy ~19.0.21 (+29 more)

### Community 1 - "Task Detail Screen"
Cohesion: 0.07
Nodes (10): assignToMember(), displayToISO(), handleAssignExternal(), handleAssignMe(), handleAssignMember(), handleCreateAssignee(), handleCreateExternalAssignee(), handleSaveEdit() (+2 more)

### Community 2 - "Data Model & DB Schema Docs"
Cohesion: 0.07
Nodes (32): Archive System (is_archived), ClientProfileScreen, Custom Client Fields System (14 types), DashboardScreen, DB Table: assignees (external), DB Table: clients, DB Table: file_transactions, DB Table: ministries (stages) (+24 more)

### Community 3 - "Dashboard Screen Logic"
Cohesion: 0.11
Nodes (0): 

### Community 4 - "Settings Screen CRUD"
Cohesion: 0.13
Nodes (4): confirmDelete(), deleteRecord(), loadSvcStages(), openSvcStages()

### Community 5 - "Stage Requirements Screen"
Cohesion: 0.18
Nodes (3): pickFromCamera(), pickFromLibrary(), uploadAsset()

### Community 6 - "Client Fields Settings"
Cohesion: 0.26
Nodes (7): generateKey(), handleAdd(), handleEdit(), load(), openAdd(), resetForm(), toggleActive()

### Community 7 - "Client Profile Screen"
Cohesion: 0.2
Nodes (0): 

### Community 8 - "Ministry Requirements Screen"
Cohesion: 0.22
Nodes (0): 

### Community 9 - "Document Scanner"
Cohesion: 0.43
Nodes (7): autoName(), capturePhoto(), cropToFrame(), handleClose(), handleSave(), pickFromLibrary(), reset()

### Community 10 - "Service Stages Screen"
Cohesion: 0.25
Nodes (0): 

### Community 11 - "Client Fields Form"
Cohesion: 0.52
Nodes (5): capture(), get(), set(), toggle(), useFieldDefinitions()

### Community 12 - "New Task Screen"
Cohesion: 0.29
Nodes (0): 

### Community 13 - "Financial Report Screen"
Cohesion: 0.33
Nodes (0): 

### Community 14 - "Team Screen"
Cohesion: 0.4
Nodes (0): 

### Community 15 - "Task Card Component"
Cohesion: 0.5
Nodes (0): 

### Community 16 - "Push Notifications"
Cohesion: 0.67
Nodes (0): 

### Community 17 - "Edit Client Screen"
Cohesion: 0.67
Nodes (0): 

### Community 18 - "App Entry Point"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Offline Banner"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Route Stop Component"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Auth Hook"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Realtime Hook"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Calendar Screen"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Login Screen"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Requirements Screens Docs"
Cohesion: 1.0
Nodes (2): MinistryRequirementsScreen, StageRequirementsScreen

### Community 26 - "Babel Build Config"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Metro Build Config"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Status Badge Component"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Supabase Client"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Navigation Stack"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Offline Queue Store"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Theme Export"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Type Definitions"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "README Reference"
Cohesion: 1.0
Nodes (1): Screen Reference Table

## Knowledge Gaps
- **30 isolated node(s):** `React Native (Expo 54.0.33)`, `TypeScript (strict: false)`, `React Navigation v6`, `Expo Notifications + Push API`, `GitHub Backup (El-Bach/ministry-tracker)` (+25 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `App Entry Point`** (2 nodes): `App()`, `App.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Offline Banner`** (2 nodes): `OfflineBanner()`, `OfflineBanner.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Route Stop Component`** (2 nodes): `formatDate()`, `RouteStop.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth Hook`** (2 nodes): `useAuth.ts`, `useAuth()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Realtime Hook`** (2 nodes): `useRealtime.ts`, `useRealtime()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Calendar Screen`** (2 nodes): `getStatusColor()`, `CalendarScreen.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Login Screen`** (2 nodes): `handleLogin()`, `LoginScreen.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Requirements Screens Docs`** (2 nodes): `MinistryRequirementsScreen`, `StageRequirementsScreen`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Babel Build Config`** (1 nodes): `babel.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Metro Build Config`** (1 nodes): `metro.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Status Badge Component`** (1 nodes): `StatusBadge.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supabase Client`** (1 nodes): `supabase.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Navigation Stack`** (1 nodes): `index.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Offline Queue Store`** (1 nodes): `offlineQueue.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Theme Export`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Type Definitions`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `README Reference`** (1 nodes): `Screen Reference Table`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Ministry Tracker App` connect `Project Docs & Architecture` to `Data Model & DB Schema Docs`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `DocumentScannerModal Component` connect `Project Docs & Architecture` to `Data Model & DB Schema Docs`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `React Native (Expo 54.0.33)`, `TypeScript (strict: false)`, `React Navigation v6` to the rest of the system?**
  _30 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Project Docs & Architecture` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Task Detail Screen` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Data Model & DB Schema Docs` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Dashboard Screen Logic` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._