# Settings screen — modular split

Mirror of the `TaskDetail/`, `Create/`, and `NewTask/` splits. The
monolithic `src/screens/SettingsScreen.tsx` (1,580 lines after dead-code
drop) is broken into typed modules in this folder.

## Migration phases

- **Phase 1** (this commit) — drop dead `ModalForm` component (defined
  but never called) + scaffold this folder with README.
- **Phase 2** — extract the 8 inline modals one at a time:
  HelpGuide, FAQ, EditMemberRole, InviteMember (biggest at ~103 lines),
  LanguagePicker, ContactUs, ReportBug, ExchangeRate.
- **Phase 3** — lift handlers into `hooks/useSettingsActions.ts`.
- **Phase 4** — lift the `ss` StyleSheet (~520 lines, biggest single
  block) to `styles/settingsStyles.ts` and inline the small helper
  components (Section, ListItem) at the same time since they depend
  on parent styles.

## Conventions

Same as the other screen splits — typed Props interfaces, state stays
in the parent during early phases, shared styles imported directly
after Phase 4.
