# NewTask screen — modular split

Mirror of the `Create/` and `TaskDetail/` splits. The monolithic
`src/screens/NewTaskScreen.tsx` (~3,129 lines as of session 55) is broken
into typed modules in this folder, then wired back into a slim
orchestrator.

## Migration phases

- **Phase 1** (this commit) — extract the 3 self-contained module-level
  helper components (`PickerModal`, `DynamicFieldInput`, `DatePickerField`)
  + the 4 date helper functions to `utils/dateHelpers.ts`.
- **Phase 2** — extract `RequiredDocsSheet` (~450 lines, biggest single
  JSX block).
- **Phase 3** — extract `NewClientFormModal` + `FieldPickerModal` +
  `FieldTypePickerModal` (the 3 inline `<Modal>` blocks in MODALS section).
- **Phase 4** — extract the 4 visual sections (`ClientSection`,
  `ServiceSection`, `StagesSection`, `ScheduleSection`).
- **Phase 5** — lift handlers into `hooks/useNewTaskActions.ts`.
- **Phase 6** — lift the screen StyleSheet to `styles/newTaskStyles.ts` and
  drop the `s={s}` prop drilling pattern.

Each phase ships a working app and is independently committable.

## Conventions

Same as `Create/`:
- Each component owns a typed `Props` interface listing every state value,
  setter, and callback it needs from the parent.
- State stays in the parent until late phases.
- Module-level helpers (date parsing, etc.) live in `utils/`.
- The shared screen StyleSheet stays in the parent until Phase 6.
