-- Migration: add invitee_email to org_join_codes
-- Allows the owner to record the invitee's email address on the code card
-- and send the invite code directly to their inbox via the mail app.

ALTER TABLE org_join_codes
  ADD COLUMN IF NOT EXISTS invitee_email TEXT;
