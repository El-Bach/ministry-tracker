-- migration_ministry_city.sql
-- Adds a default city to every stage (ministry) definition.
-- When a stage is added to a file, city is auto-populated from this field.
-- The per-file city stored in task_route_stops.city_id can still override it.

ALTER TABLE ministries
  ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES cities(id) ON DELETE SET NULL;
