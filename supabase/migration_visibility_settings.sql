-- migration_visibility_settings.sql
-- Per-org, per-role visibility/permission settings
-- One row per (org_id, role) — upserted by admin/owner

CREATE TABLE IF NOT EXISTS org_visibility_settings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('member', 'viewer')),

  -- ── Files ─────────────────────────────────────────────────────
  can_see_all_files         BOOLEAN NOT NULL DEFAULT true,   -- false = only files assigned to them
  can_create_files          BOOLEAN NOT NULL DEFAULT true,
  can_edit_file_details     BOOLEAN NOT NULL DEFAULT true,   -- client, service, notes, due date
  can_delete_files          BOOLEAN NOT NULL DEFAULT false,

  -- ── Stages ────────────────────────────────────────────────────
  can_update_stage_status   BOOLEAN NOT NULL DEFAULT true,
  can_add_edit_stages       BOOLEAN NOT NULL DEFAULT true,

  -- ── Financial ─────────────────────────────────────────────────
  can_see_contract_price    BOOLEAN NOT NULL DEFAULT true,
  can_see_financial_report  BOOLEAN NOT NULL DEFAULT false,
  can_add_revenue           BOOLEAN NOT NULL DEFAULT true,
  can_add_expenses          BOOLEAN NOT NULL DEFAULT true,
  can_edit_contract_price   BOOLEAN NOT NULL DEFAULT false,
  can_delete_transactions   BOOLEAN NOT NULL DEFAULT false,

  -- ── Documents ─────────────────────────────────────────────────
  can_upload_documents      BOOLEAN NOT NULL DEFAULT true,
  can_delete_documents      BOOLEAN NOT NULL DEFAULT false,

  -- ── Clients ───────────────────────────────────────────────────
  can_manage_clients        BOOLEAN NOT NULL DEFAULT true,   -- create, edit, delete clients

  -- ── Activity ──────────────────────────────────────────────────
  can_add_comments          BOOLEAN NOT NULL DEFAULT true,
  can_delete_comments       BOOLEAN NOT NULL DEFAULT false,

  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),

  UNIQUE (org_id, role)
);

CREATE INDEX IF NOT EXISTS idx_visibility_org_role ON org_visibility_settings(org_id, role);
