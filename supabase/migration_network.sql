-- migration_network.sql
-- Adds reference_phone + city_id to assignees table (Network feature)

ALTER TABLE assignees
  ADD COLUMN IF NOT EXISTS reference_phone TEXT,
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES cities(id) ON DELETE SET NULL;
