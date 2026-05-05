# Create screen — modular split

Mirror of the `TaskDetail/` split that landed in sessions 50–52.

The monolithic `src/screens/CreateScreen.tsx` (~3,381 lines as of session 54)
holds 7 modal blocks, ~130 lines of state, and ~625 lines of handlers. Each
modal is self-contained UX — extracting them one at a time gives smaller
files, faster mental load, and lets future work (e.g. lifting handlers into
a shared hook) happen incrementally.

Files in this folder are **parallel modules** until they're wired into
`CreateScreen.tsx`. The orchestrator imports each module and passes state +
callbacks via typed Props (same pattern as `TaskHeader`/`StagesSection`/etc.
in TaskDetail).

## Migration phases

- **Phase 1** (this commit) — extract `NetworkModal` as proof of concept;
  the remaining 6 modals stay inline in `CreateScreen.tsx`.
- **Phase 2** — extract `IdScannerModal`, `ManageClientsModal`, `NewClientForm`.
- **Phase 3** — extract `ManageServicesModal`, `ManageStagesModal`.
- **Phase 4** — extract `DocumentsRequiredModal` (the biggest, ~775 lines).
- **Phase 5** — lift handlers into `hooks/useCreateActions.ts`.
- **Phase 6** — drop dead state mirrors / consolidate styles.

Each phase ships a working app and is independently committable.

## Conventions

- Each modal owns its JSX + a typed `Props` interface listing every state
  value, setter, and callback it needs from the parent. State stays in
  `CreateScreen` until Phase 5/6 — minimum-risk extraction.
- Styles are passed in via a `styles` prop for now (most are shared with
  other modals). Phase 6 deduplicates and moves modal-specific styles into
  each module.
- Module-level helpers like `openPhone` (the call/WhatsApp Alert) are
  duplicated locally so each component is self-contained.
