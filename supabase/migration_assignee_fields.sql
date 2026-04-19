-- migration_assignee_fields.sql
-- Adds per-assignee custom field values (reuses client_field_definitions)

CREATE TABLE IF NOT EXISTS assignee_field_values (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignee_id   UUID NOT NULL REFERENCES assignees(id) ON DELETE CASCADE,
  field_id      UUID NOT NULL REFERENCES client_field_definitions(id) ON DELETE CASCADE,
  value_text    TEXT,
  value_number  NUMERIC,
  value_boolean BOOLEAN,
  value_json    JSONB,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(assignee_id, field_id)
);

CREATE INDEX IF NOT EXISTS idx_assignee_field_values_assignee ON assignee_field_values(assignee_id);
