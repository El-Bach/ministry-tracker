-- migration_team_member_fields.sql
-- Custom fields system for team members (mirrors client_field_definitions / client_field_values)

CREATE TABLE IF NOT EXISTS team_member_field_definitions (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  label       text NOT NULL,
  field_key   text NOT NULL UNIQUE,
  field_type  text NOT NULL DEFAULT 'text',
  options     text,
  is_required boolean DEFAULT false,
  is_active   boolean DEFAULT true,
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_member_field_values (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_member_id uuid REFERENCES team_members(id) ON DELETE CASCADE,
  field_id       uuid REFERENCES team_member_field_definitions(id) ON DELETE CASCADE,
  value_text     text,
  value_number   numeric,
  value_boolean  boolean,
  value_json     jsonb,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  UNIQUE(team_member_id, field_id)
);
