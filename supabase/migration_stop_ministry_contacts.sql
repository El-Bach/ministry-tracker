-- migration_stop_ministry_contacts.sql
--
-- Per-stage selection of ministry contacts.
--
-- Each task_route_stop (a "stage" in UI) can pin one or more ministry_contacts
-- to display inline under the stage name in TaskDetail. The full pool of
-- contacts for the ministry is unchanged (managed in Manage > Stages); this
-- table just records WHICH ones the file owner picked for THIS stage.
--
-- ON DELETE CASCADE on both FKs: removing a stop or a contact removes the
-- link automatically. RLS scopes through the parent stop's org_id (denormalised
-- in session 49 — see migration_denormalize_org_id.sql).

CREATE TABLE IF NOT EXISTS stop_ministry_contacts (
  stop_id              UUID        NOT NULL REFERENCES task_route_stops(id) ON DELETE CASCADE,
  ministry_contact_id  UUID        NOT NULL REFERENCES ministry_contacts(id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (stop_id, ministry_contact_id)
);

CREATE INDEX IF NOT EXISTS ix_stop_ministry_contacts_stop    ON stop_ministry_contacts(stop_id);
CREATE INDEX IF NOT EXISTS ix_stop_ministry_contacts_contact ON stop_ministry_contacts(ministry_contact_id);

ALTER TABLE stop_ministry_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_isolation" ON stop_ministry_contacts;
CREATE POLICY "org_isolation" ON stop_ministry_contacts
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM task_route_stops s
    WHERE s.id = stop_id AND s.org_id = auth_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM task_route_stops s
    WHERE s.id = stop_id AND s.org_id = auth_org_id()
  ));

ALTER PUBLICATION supabase_realtime ADD TABLE stop_ministry_contacts;
