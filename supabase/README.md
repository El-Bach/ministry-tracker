# Supabase migrations

This folder contains the SQL migration history for GovPilot. There are 50+
ad-hoc files because the project grew incrementally without formal migrations
tooling.

## Migration order

The canonical order is in `CLAUDE.md` → "Migrations to run (in order)". Apply
them top-to-bottom on a fresh database. They are designed to be idempotent —
re-running a migration that already applied is a no-op.

## Conventions

- File name: `migration_<short_description>.sql`
- One concern per file
- `IF NOT EXISTS` / `OR REPLACE` everywhere — re-running must be safe
- RLS-changing migrations note their dependencies in a header comment

## Current status

| Layer | Status |
|---|---|
| Tables, columns, indexes | Defined inline across 50+ migrations |
| RLS policies | Several waves; current set is consolidated by `migration_security_hardening_v2.sql` |
| RPC functions | Each in its own migration (e.g. `migration_join_org_rpc.sql`) |
| Storage policies | `migration_storage_private.sql` |
| Triggers | `migration_plan_enforcement_trigger.sql`, `migration_denormalize_org_id.sql` |

## Going forward

When making schema changes:

1. Create a new file `migration_YYYYMMDD_<description>.sql`
2. Add a header comment with: purpose, dependencies, idempotency notes
3. Use `IF NOT EXISTS` / `OR REPLACE` / `DROP IF EXISTS` to make re-running safe
4. Add the file path to the numbered list in `CLAUDE.md`
5. Run via Supabase Studio SQL Editor (or psql for migrations that touch the
   `auth` schema, which the SQL Editor cannot modify)

## Phase 8 baseline (recommended next step)

Once schema stabilizes, run `pg_dump --schema-only --no-owner --no-acl` against
the production DB and write the output to `supabase/schema.sql`. Move the
existing 50+ migrations into `supabase/migrations/_legacy/`. New migrations
go into `supabase/migrations/YYYYMMDD_*.sql`.

This consolidation isn't done yet — it requires DB access and a fresh
production dump. Track in the recommendations backlog (recommendation #4 of
the senior-engineer review).
