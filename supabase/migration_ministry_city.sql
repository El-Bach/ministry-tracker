-- migration_ministry_city.sql
-- Add default city to the ministries (stages) table.
-- When a stage is added to a task, its city is auto-filled from this default.

ALTER TABLE ministries
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES cities(id) ON DELETE SET NULL;
