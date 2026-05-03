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

## Status (session 51)

| Section | Module | Status |
|---|---|---|
| Header card | `components/TaskHeader.tsx` | ✅ Extracted (session 50); not yet wired |
| Stages section | `components/StagesSection.tsx` | ✅ Extracted + wired (Phase 3) |
| Financials section | `components/FinancialsSection.tsx` | ✅ Extracted + wired (Phase 3) |
| Documents section | `components/DocumentsSection.tsx` | ✅ Extracted + wired (Phase 3) |
| Comments section | `components/CommentsSection.tsx` | ✅ Extracted + wired (Phase 3) |
| WhatsApp/duplicate handlers | `hooks/useTaskActions.ts` | ⏸ Future session |
| Data fetch | `hooks/useTaskDetail.ts` | ⏸ Future session |

**Phase 3 complete** — all 4 visual sections are extracted AND wired into the
monolith. `TaskDetailScreen.tsx` shrunk from 4,828 → 3,780 lines (-1,048,
-22%). All 28 unit tests pass; zero TypeScript errors.

`StagesSection.tsx` ended up with a fat Props interface (~30 props) because
the inline pickers reference a lot of cross-stop state. Future refactors
should lift state DOWN into the component instead of passing it via props —
but for now, the JSX is out of the monolith, which was the goal.

Phase 4 (next session) will:
- Wire `TaskHeader.tsx` (currently extracted but not wired)
- Lift handlers into `hooks/useTaskActions.ts`
- Lift data fetch into `hooks/useTaskDetail.ts` (or migrate to TanStack Query)

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
