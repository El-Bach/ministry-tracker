-- migration_ministry_fields.sql
-- Custom fields system for ministries (mirrors client_field_definitions /
-- client_field_values shape, with org_id from the start).
--
-- Definitions are org-wide (one set of field types per organization);
-- values are per-ministry (each stage holds its own value for each defined field).

CREATE TABLE IF NOT EXISTS ministry_field_definitions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  label        TEXT        NOT NULL,
  field_key    TEXT        NOT NULL,
  field_type   TEXT        NOT NULL DEFAULT 'text',
  options      TEXT,
  is_required  BOOLEAN     DEFAULT false,
  is_active    BOOLEAN     DEFAULT true,
  sort_order   INTEGER     DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, field_key)
);

CREATE INDEX IF NOT EXISTS ix_ministry_field_definitions_org ON ministry_field_definitions(org_id);

CREATE TABLE IF NOT EXISTS ministry_field_values (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id   UUID        NOT NULL REFERENCES ministries(id)               ON DELETE CASCADE,
  field_id      UUID        NOT NULL REFERENCES ministry_field_definitions(id) ON DELETE CASCADE,
  org_id        UUID        NOT NULL REFERENCES organizations(id)            ON DELETE CASCADE,
  value_text    TEXT,
  value_number  NUMERIC,
  value_boolean BOOLEAN,
  value_json    JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ministry_id, field_id)
);

CREATE INDEX IF NOT EXISTS ix_ministry_field_values_ministry ON ministry_field_values(ministry_id);
CREATE INDEX IF NOT EXISTS ix_ministry_field_values_field    ON ministry_field_values(field_id);
CREATE INDEX IF NOT EXISTS ix_ministry_field_values_org      ON ministry_field_values(org_id);

ALTER TABLE ministry_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ministry_field_values      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_isolation" ON ministry_field_definitions;
CREATE POLICY "org_isolation" ON ministry_field_definitions
  FOR ALL TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

DROP POLICY IF EXISTS "org_isolation" ON ministry_field_values;
CREATE POLICY "org_isolation" ON ministry_field_values
  FOR ALL TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

ALTER PUBLICATION supabase_realtime ADD TABLE ministry_field_definitions;
ALTER PUBLICATION supabase_realtime ADD TABLE ministry_field_values;
