-- Migration: task_documents
-- Archive of uploaded documents per task (scanned or photos)

CREATE TABLE IF NOT EXISTS task_documents (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id      UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_name    TEXT        NOT NULL,
  file_url     TEXT        NOT NULL,
  file_type    TEXT        NOT NULL DEFAULT 'image/jpeg',
  uploaded_by  UUID        REFERENCES team_members(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE task_documents DISABLE ROW LEVEL SECURITY;
