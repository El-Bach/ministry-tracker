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
| Action handlers — file-level slice | `hooks/useTaskActions.ts` | 🟡 Started (Phase 5, session 52) |
| Action handlers — comments / voice / docs / stages / transactions | `hooks/useTaskActions.ts` | ⏸ Future sessions |
| Realtime + state mgmt | `hooks/useTaskDetail.ts` | ⏸ Future session |

**Phase 5 (in progress)** — `useTaskActions.ts` now owns the file-level
handlers: `handlePhonePress`, `handleShareWhatsApp`,
`handleShareDocsWhatsApp`, `handleDuplicateTask`. These were chosen first
because they have minimal state coupling — they read `task` / `sheetDocs`
and emit side effects (Alert / Linking / a single mutation), nothing more.

`TaskDetailScreen.tsx` now at 3,493 lines (was 3,601 after Phase 4).
Cumulative shrink from the original monolith: 4,828 → 3,493 lines
(-1,335, -28%). All 28 unit tests pass; zero TypeScript errors.

**Why incremental?** Each remaining handler group (comments / voice /
stages / transactions) has 5–10 pieces of state coupled to the parent.
Extracting them needs either a fat options object on the hook or a state
lift first. Doing it in one session would be high-risk; we'd rather get
each group right than rush.

### Next slices to extract (in priority order)

1. **Documents (5 handlers)** — `handleOpenDoc`, `handlePrintDoc`,
   `handleShareDoc`, `handleRenameDoc`, `handleDeleteDocument`,
   `handlePickPdf`. State coupling: `documents`, viewer modal setters.
   Should fit one session.
2. **Transactions (4 handlers)** — `handleAddTransaction`,
   `handleEditTransaction`, `handleDeleteTransaction`, `handleSavePrice`.
   State coupling: `transactions`, contract price + edit form state.
3. **Stage CRUD (8 handlers)** — `handleSetStopDueDate`,
   `handleSetStopCity`, `handleSetStopAssignee`,
   `handleCreateExtAssigneeForStop`, `handleCreateCity`,
   `handleCreateCityInEditModal`, `handleRenameStopMinistry`,
   `handleSaveStages`, `handleCreateStageInEdit`. Highest coupling.
4. **Comments + voice notes (8 handlers)** — `handlePostComment`,
   `handleSaveEditComment`, `handleDeleteComment`,
   `handleStartRecording`, `handleStopRecording`,
   `handleDiscardRecording`, `handleSendVoiceNote`, `handlePlayPause`,
   `handleStopListening`, `handleTextFromVoice`. Tangled with audio +
   recording state — extract last.
5. **Status / archive cascade (1 handler)** — `handleUpdateStopStatus`.
   Touches almost every part of state, but it's a single function so the
   options interface is bounded.

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
