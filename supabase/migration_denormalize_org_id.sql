-- migration_denormalize_org_id.sql
-- Adds denormalized org_id columns to child tables so Realtime subscriptions
-- can filter by org_id at the channel level.
--
-- Without this, every UPDATE on task_route_stops/task_comments/etc. fires a
-- websocket message to every connected client across every tenant. RLS hides
-- the row content but the websocket bandwidth and dispatch cost grow O(N×M).
--
-- Each child row's org_id mirrors its parent task's org_id. A trigger keeps
-- it in sync if a task is ever moved between orgs (which shouldn't happen,
-- but the trigger is the safety net).

-- ─── task_route_stops ──────────────────────────────────────────────────────
ALTER TABLE task_route_stops
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE task_route_stops trs
   SET org_id = t.org_id
  FROM tasks t
 WHERE trs.task_id = t.id
   AND trs.org_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_task_route_stops_org_id ON task_route_stops(org_id);

-- ─── task_comments ─────────────────────────────────────────────────────────
ALTER TABLE task_comments
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE task_comments tc
   SET org_id = t.org_id
  FROM tasks t
 WHERE tc.task_id = t.id
   AND tc.org_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_task_comments_org_id ON task_comments(org_id);

-- ─── Trigger: auto-populate org_id from parent task on INSERT ──────────────
CREATE OR REPLACE FUNCTION populate_child_org_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.org_id IS NULL AND NEW.task_id IS NOT NULL THEN
    SELECT org_id INTO NEW.org_id FROM tasks WHERE id = NEW.task_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trs_populate_org_id ON task_route_stops;
CREATE TRIGGER trg_trs_populate_org_id
  BEFORE INSERT ON task_route_stops
  FOR EACH ROW EXECUTE FUNCTION populate_child_org_id();

DROP TRIGGER IF EXISTS trg_tc_populate_org_id ON task_comments;
CREATE TRIGGER trg_tc_populate_org_id
  BEFORE INSERT ON task_comments
  FOR EACH ROW EXECUTE FUNCTION populate_child_org_id();
