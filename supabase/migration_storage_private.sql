-- migration_storage_private.sql
-- Restrict the `task-attachments` bucket to authenticated users in the same org
-- as the file's parent task. Combined with switching client code from
-- `getPublicUrl()` to `createSignedUrl(path, 3600)`, this ensures that a leaked
-- task UUID (via WhatsApp share, push payload, or URL log) does NOT grant
-- anyone outside the org the ability to download the documents.
--
-- Manual step in Supabase Studio:
--   Storage → Buckets → task-attachments → toggle "Public bucket" OFF
--
-- Then run this migration to install per-org RLS on the storage.objects rows
-- backing that bucket.
--
-- Path convention used by the app:
--   task-attachments/documents/{taskId}/{display_name}_{timestamp}.jpg
-- So `(storage.foldername(name))[2]` is the task UUID.

-- ─── Read policy: authenticated user can SELECT a file only if its parent
-- task belongs to their org. ───────────────────────────────────────────────
DROP POLICY IF EXISTS "task_attachments_read" ON storage.objects;
CREATE POLICY "task_attachments_read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND (
      -- Path layout: documents/{taskId}/...
      (storage.foldername(name))[2]::uuid IN (
        SELECT id FROM tasks WHERE org_id = auth_org_id()
      )
    )
  );

-- ─── Write policy: same condition, plus the user must have upload permission
-- (handled by RLS on `task_documents` table; here we just gate the storage
-- write on org membership). ────────────────────────────────────────────────
DROP POLICY IF EXISTS "task_attachments_write" ON storage.objects;
CREATE POLICY "task_attachments_write"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'task-attachments'
    AND (
      (storage.foldername(name))[2]::uuid IN (
        SELECT id FROM tasks WHERE org_id = auth_org_id()
      )
    )
  );

-- ─── Update policy: same gate ──────────────────────────────────────────────
DROP POLICY IF EXISTS "task_attachments_update" ON storage.objects;
CREATE POLICY "task_attachments_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND (
      (storage.foldername(name))[2]::uuid IN (
        SELECT id FROM tasks WHERE org_id = auth_org_id()
      )
    )
  );

-- ─── Delete policy: same gate ──────────────────────────────────────────────
DROP POLICY IF EXISTS "task_attachments_delete" ON storage.objects;
CREATE POLICY "task_attachments_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND (
      (storage.foldername(name))[2]::uuid IN (
        SELECT id FROM tasks WHERE org_id = auth_org_id()
      )
    )
  );
