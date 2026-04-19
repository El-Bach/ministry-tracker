-- migration_service_documents.sql
-- Creates service_documents table for per-service document checklist

CREATE TABLE IF NOT EXISTS service_documents (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id  UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  sort_order  INTEGER DEFAULT 0,
  is_checked  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_svc_docs_service ON service_documents(service_id);
