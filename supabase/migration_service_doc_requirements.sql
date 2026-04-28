-- migration_service_doc_requirements.sql
-- Sub-requirements (papers/items) nested under each service_document row.
-- Run AFTER migration_service_documents.sql

CREATE TABLE IF NOT EXISTS service_document_requirements (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  doc_id     UUID        NOT NULL REFERENCES service_documents(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  org_id     UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdr_doc   ON service_document_requirements(doc_id);
CREATE INDEX IF NOT EXISTS idx_sdr_org   ON service_document_requirements(org_id);

ALTER TABLE service_document_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_isolation" ON service_document_requirements;
CREATE POLICY "org_isolation" ON service_document_requirements
  FOR ALL USING (
    doc_id IN (SELECT id FROM service_documents WHERE org_id = auth_org_id())
  );
