-- migration_service_stages.sql
-- Adds default stage templates per service

CREATE TABLE IF NOT EXISTS service_default_stages (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id    UUID REFERENCES services(id) ON DELETE CASCADE NOT NULL,
  ministry_id   UUID REFERENCES ministries(id) ON DELETE CASCADE NOT NULL,
  stop_order    INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sds_service ON service_default_stages(service_id);
