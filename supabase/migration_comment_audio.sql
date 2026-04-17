-- migration_comment_audio.sql
-- Adds audio_url column to task_comments for voice notes

ALTER TABLE task_comments
  ADD COLUMN IF NOT EXISTS audio_url TEXT;
