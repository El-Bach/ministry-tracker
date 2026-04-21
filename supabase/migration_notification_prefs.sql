-- migration_notification_prefs.sql
-- Per-user notification preferences: master toggle, type filters, muted members

CREATE TABLE IF NOT EXISTS notification_prefs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_member_id        UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  enabled               BOOLEAN DEFAULT true,
  notify_comments       BOOLEAN DEFAULT true,
  notify_status_changes BOOLEAN DEFAULT true,
  notify_new_files      BOOLEAN DEFAULT true,
  muted_actor_ids       UUID[] DEFAULT '{}',
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_member_id)
);

CREATE INDEX IF NOT EXISTS idx_notif_prefs_member ON notification_prefs(team_member_id);
