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

## Status (session 50)

| Section | Lines (in monolith) | Module | Status |
|---|---|---|---|
| Header card | ~150 | `components/TaskHeader.tsx` | ✅ Extracted (this session) |
| Stages section | ~1,500 | `components/StagesSection.tsx` | ⏸ Future session |
| Financials section | ~600 | `components/FinancialsSection.tsx` | ⏸ Future session |
| Documents section | ~800 | `components/DocumentsSection.tsx` | ⏸ Future session |
| Comments section | ~400 | `components/CommentsSection.tsx` | ⏸ Future session |
| WhatsApp/duplicate handlers | ~150 | `hooks/useTaskActions.ts` | ⏸ Future session |
| Data fetch | inline | `hooks/useTaskDetail.ts` | ⏸ Future session |

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
