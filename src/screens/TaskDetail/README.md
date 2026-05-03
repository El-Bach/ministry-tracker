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
| Read path → useQuery | TaskDetailScreen.tsx (Phase 6a, session 52) | ✅ Wrapped |
| Drop read-only mirrors | TaskDetailScreen.tsx (Phase 6c, session 52) | ✅ 9 mirrors removed |
| Mutations → useMutation | future polish (Phase 6b deferred) | ⏸ Cosmetic — current handlers already invalidate via fetchTask |
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

#### 6a — Read path wrapped in useQuery (session 52, ✅ DONE)

The single `fetchTaskData(...)` call is now backed by `useQuery` with the
key `['task', taskId, orgId]`. Behavior preserved exactly:

- `fetchTask()` (called by every handler) is now a thin wrapper around
  `queryClient.invalidateQueries({ queryKey: ['task', taskId, orgId] })`
- A `useEffect` copies `query.data` into the existing local `useState`
  setters so the rest of the JSX/handler code works unchanged
- Realtime events still call `fetchTask()`, which now triggers
  invalidation (TanStack dedups concurrent invalidations automatically)

What we now get for free:

- **Cache** — revisiting the same task within `staleTime` returns
  instantly (then refetches in background)
- **Refetch on screen focus** — defaults from `queryClient.ts`
- **Retry on transient failure** — 1 retry per query, configurable
- **Dedup** — concurrent invalidations from realtime + a handler
  collapse into a single network call

#### 6c — Drop read-only state mirrors (session 52, ✅ DONE)

The 9 local `useState` mirrors that were pure copies of `queryData` are
now gone. Reads come straight from the query data via derived consts:

```ts
const task          = queryData?.task          ?? null;
const comments      = queryData?.comments      ?? [];
const statusLabels  = queryData?.statusLabels  ?? [];
const allMembers    = queryData?.allMembers    ?? [];
const stopHistories = queryData?.stopHistories ?? {};
const transactions  = queryData?.transactions  ?? [];
const priceHistory  = queryData?.priceHistory  ?? [];
const documents     = queryData?.documents     ?? [];
const allServices   = queryData?.allServices   ?? [];
```

The remaining four "writeable mirrors" stay as local state because
handlers actively mutate them for instant create-new UX:
- `allCities` — written by `handleCreateCity*`
- `extAssignees` — written by `handleCreateExtAssigneeForStop`
- `allStages` — written by `handleCreateStageInEdit`
- `contractPriceUSD/LBP` — written by `handleSavePrice`

These get seeded from `queryData` on every refetch via a small
`useEffect`, then handlers can layer their optimistic updates on top.

#### 6b — Mutations → useMutation (deferred, low priority)

Converting each handler in `useTaskActions.ts` from raw async functions
to `useMutation` calls would give:

- **Optimistic updates** — comment posting / status changes render
  instantly and roll back on error
- **Per-mutation `isPending` state** — could replace the current
  `setSaving…(true/false)` setters
- **Cleaner error boundary integration**

Deferred because the current pattern already works correctly:

- Every handler ends with `fetchTask()` which invalidates the query →
  TanStack handles the refetch with caching, dedup, and retry
- The `setSaving…` setters work fine and consumers expect them; replacing
  them with `mutation.isPending` requires touching the consumer side too
- Optimistic updates aren't currently in any spec — they'd be a "nice to
  have" rather than a fix for an actual problem

If a future feature needs optimistic updates (e.g. comment posting that
must feel instant on slow networks), convert that specific handler then.
The pattern is well-established in the React Query docs; no big-bang
migration needed.

`@tanstack/react-query` is already installed (session 49 added it +
`src/lib/queryClient.ts`); the App is already wrapped in
`<QueryClientProvider>`. Phase 6 (read path) is now complete.

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
