# TaskDetailScreen — modular split

The original `src/screens/TaskDetailScreen.tsx` is 4,825 lines and handles:
- Stage timeline + status updates
- Comments + voice notes + audio playback
- Financials (transactions, contract price, P&L, exchange rate)
- Documents (scan, PDF upload, in-app viewer, share)
- File header (client, service, due date, notes)
- WhatsApp share + file duplication
- Stage CRUD (add/edit/remove/reorder)
- Per-stage city + assignee pickers
- Required-documents read-only modal

This folder is the migration target. We're splitting incrementally — one
section per session — without breaking the working monolith.

## Status (session 52)

| Section | Module | Status |
|---|---|---|
| Header card | `components/TaskHeader.tsx` | ✅ Extracted + wired (Phase 4) |
| Stages section | `components/StagesSection.tsx` | ✅ Extracted + wired (Phase 3) |
| Financials section | `components/FinancialsSection.tsx` | ✅ Extracted + wired (Phase 3) |
| Documents section | `components/DocumentsSection.tsx` | ✅ Extracted + wired (Phase 3) |
| Comments section | `components/CommentsSection.tsx` | ✅ Extracted + wired (Phase 3) |
| Data fetch | `fetchTaskData.ts` | ✅ Extracted + wired (Phase 4) |
| Action handlers — file-level slice | `hooks/useTaskActions.ts` | ✅ Extracted (Phase 5a, session 52) |
| Action handlers — documents slice | `hooks/useTaskActions.ts` | ✅ Extracted (Phase 5b, session 52) |
| Action handlers — transactions + contract price | `hooks/useTaskActions.ts` | ✅ Extracted (Phase 5c, session 52) |
| Action handlers — status update cascade | `hooks/useTaskActions.ts` | ✅ Extracted (Phase 5d, session 52) |
| Action handlers — stage CRUD | `hooks/useTaskActions.ts` | ✅ Extracted (Phase 5e, session 52) |
| Action handlers — comments + voice notes | `hooks/useTaskActions.ts` | ⏸ Last future slice |
| Realtime + state mgmt | `hooks/useTaskDetail.ts` | ⏸ Future session |

**Phase 5 (in progress)** — `useTaskActions.ts` now owns:
- **File-level slice** (5a): `handlePhonePress`, `handleShareWhatsApp`,
  `handleShareDocsWhatsApp`, `handleDuplicateTask`.
- **Documents slice** (5b): `handleOpenDoc`, `handlePrintDoc`,
  `handleShareDoc`, `handleRenameDoc`, `handleDeleteDocument`,
  `handlePickPdf` (the latter handles the full DocumentPicker → cache →
  Supabase Storage upload → DB insert chain).
- **Transactions / contract price** (5c): `handleAddTransaction`,
  `handleEditTransaction`, `handleDeleteTransaction` (with delete-audit
  comment), `handleSavePrice` (with price-history append).
- **Status update cascade** (5d): `handleUpdateStopStatus` — patches the
  stop, audits the change, re-reads all stops, archives the file when
  every stop is terminal (with `closed_at` + auto `due_date`), broadcasts
  push notifications, and routes through the offline queue when offline.
- **Stage CRUD** (5e): 9 handlers covering everything related to the
  edit-stages modal and per-stop city/assignee/due-date pickers —
  `handleCreateStageInEdit`, `handleSaveStages` (full route_stops rewrite
  with FINAL_STAGE pinning), `handleSetStopDueDate`,
  `handleRenameStopMinistry`, `handleSetStopCity`, `handleSetStopAssignee`
  (with auto-fill city from Network contact), `handleCreateExtAssigneeForStop`,
  `handleCreateCity`, `handleCreateCityInEditModal`.

24 handlers total now in the hook. Each takes its required state via the
`UseTaskActionsOptions` interface; setters are passed in explicitly so
ownership remains with the orchestrator (TaskDetailScreen).

After 5e, the only handlers still inline in TaskDetailScreen are the
**comments + voice notes** group (`handlePostComment`, `handleSaveEditComment`,
`handleDeleteComment`, voice-recording lifecycle, audio playback). These
are the most coupled — they touch `Audio.Sound` instances, recording
timer refs, and a partially-removed speech-to-text package. Saved for last.

`TaskDetailScreen.tsx` now at 3,007 lines (was 3,601 after Phase 4).
Cumulative shrink from the original monolith: 4,828 → 3,007 lines
(-1,821, -38%). All 28 unit tests pass; zero TypeScript errors.

**Why incremental?** Each remaining handler group (comments / voice /
stages / transactions) has 5–10 pieces of state coupled to the parent.
Extracting them needs either a fat options object on the hook or a state
lift first. Doing it in one session would be high-risk; we'd rather get
each group right than rush.

### Next slices to extract

1. **Comments + voice notes (10 handlers)** — `handlePostComment`,
   `handleSaveEditComment`, `handleDeleteComment`,
   `handleStartRecording`, `handleStopRecording`,
   `handleDiscardRecording`, `handleSendVoiceNote`, `handlePlayPause`,
   `handleStopListening`, `handleTextFromVoice`. Tangled with audio +
   recording state. After this last slice, **all** action handlers will
   live in `useTaskActions.ts` and TaskDetailScreen becomes a pure JSX
   wiring layer ready for Phase 6 (TanStack Query migration).

Future phases:
- Lift action handlers into `hooks/useTaskActions.ts` (~50 handlers)
- Migrate to TanStack Query (`useQuery` for fetchTaskData, `useMutation`
  for handlers) — this kills both the manual setters and the realtime
  subscription dance in one pass
- Once handlers + data are in hooks, `TaskDetailScreen.tsx` should drop
  to ~500 lines (just JSX wiring)

## Approach

1. **Extract one section per session** — never break the working monolith
2. **Keep state management in the parent** for now — extracted components
   receive props for state + callbacks
3. **No behavior changes during extraction** — pure refactor; tests unchanged
4. **TanStack Query migration deferred** — once extracted, we can replace the
   `useState` + `useEffect` data flow with `useQuery` per-section

## Conventions

- Each component takes a typed `Props` interface, no implicit context
- Keep prop drilling minimal — bundle related callbacks (e.g. `onEdit`,
  `onDelete`, `onShare`) into a single `actions` prop
- Styles stay co-located with each component (no shared style sheet yet)
- New strings always use `t()` from i18n
