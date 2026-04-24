-- migration_join_codes.sql
-- Company join codes — admins generate a code; team members paste it to join

CREATE TABLE IF NOT EXISTS org_join_codes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code        TEXT NOT NULL UNIQUE,
  created_by  UUID REFERENCES team_members(id) ON DELETE SET NULL,
  is_active   BOOLEAN DEFAULT true,
  use_count   INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_join_codes_code ON org_join_codes(code);
CREATE INDEX IF NOT EXISTS idx_join_codes_org  ON org_join_codes(org_id);
