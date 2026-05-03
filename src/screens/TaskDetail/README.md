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
| Action handlers — comments + voice notes | `hooks/useTaskActions.ts` | ✅ Extracted (Phase 5f, session 52) |
| Realtime + state mgmt | `hooks/useTaskDetail.ts` | ⏸ Phase 6+ (TanStack Query) |
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
- **Comments + voice notes** (5f, FINAL): 10 handlers —
  `handlePostComment` (with offline queue path + push fan-out),
  `handleSaveEditComment`, `handleDeleteComment`, the full
  voice-recording lifecycle (`handleStartRecording`, `handleStopRecording`,
  `handleDiscardRecording`, `handleSendVoiceNote` — base64 → storage
  upload → comment with audio_url), `handlePlayPause` (Audio.Sound
  toggle), and the speech-to-text shim (`handleTextFromVoice` /
  `handleStopListening` — no-op since the package is disabled).
  The only audio-state piece that stays in the parent is the
  `recordingTimerRef` (it's a useRef, gets cleared by the parent's
  unmount cleanup useEffect).

**🎉 PHASE 5 COMPLETE.** All 34 action handlers now live in the hook.
The orchestrator (`TaskDetailScreen.tsx`) is a pure JSX wiring layer +
state owner — exactly the architectural boundary we wanted.

`TaskDetailScreen.tsx` final size: **2,801 lines** (was 3,601 after
Phase 4, was 4,828 originally). Cumulative shrink: **-2,027 lines, -42%**.
The hook is 1,483 lines for 34 handlers — readable, well-typed,
self-documenting. All 28 unit tests pass; zero TypeScript errors.

**Why incremental?** Each remaining handler group (comments / voice /
stages / transactions) has 5–10 pieces of state coupled to the parent.
Extracting them needs either a fat options object on the hook or a state
lift first. Doing it in one session would be high-risk; we'd rather get
each group right than rush.

### Phase 6: TanStack Query migration

With Phase 5 complete the data flow is now cleanly separated from UI:

- `fetchTaskData.ts` — read path
- `useTaskActions.ts` — all 34 mutation handlers
- `TaskDetailScreen.tsx` — JSX + local state + setter orchestration only

Phase 6 wraps the read path in `useQuery` and converts the mutation
handlers in `useTaskActions` to `useMutation` calls. The benefits:

1. **Cache + automatic refetch** — replaces the manual `fetchTask()`
   calls scattered through every handler. Mutations invalidate the
   query and TanStack handles the refetch automatically.
2. **Optimistic updates** — comment posting / status changes / etc.
   can render instantly and roll back on error, instead of waiting for
   the server round-trip.
3. **Refetch on focus / reconnect** — TanStack Query's defaults
   already match what users expect for a mobile app (refetch when the
   screen regains focus or the device reconnects).
4. **Realtime subscription dance goes away** — invalidating queries
   from realtime callbacks is more reliable than the current
   `useRealtime` + manual setter dance.

`@tanstack/react-query` is already installed (session 49 added it +
`src/lib/queryClient.ts`); the App is already wrapped in
`<QueryClientProvider>`. Phase 6 work is purely TaskDetail-side.

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
