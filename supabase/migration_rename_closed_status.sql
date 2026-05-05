-- migration_rename_closed_status.sql
--
-- Renames every leftover "Closed" status value to "Received & Closed".
--
-- WHY: the app code (handleUpdateStopStatus in useTaskActions.ts) treats
-- "Received & Closed" as a terminal status that triggers archiving on the
-- final stage. If a tenant's status_labels still has "Closed" (e.g. they
-- joined before migration_financials_v2.sql was run, or that earlier
-- migration only partially applied for them), picking it does NOT archive
-- the file. This migration brings every existing row in line with the code.
--
-- Idempotent: running it more than once is a no-op.

-- 1. Rename the label definition itself
UPDATE status_labels
SET label = 'Received & Closed'
WHERE label = 'Closed';

-- 2. Rename anywhere this value was already saved on a task
UPDATE tasks
SET current_status = 'Received & Closed'
WHERE current_status = 'Closed';

-- 3. Same for per-stage status (task_route_stops)
UPDATE task_route_stops
SET status = 'Received & Closed'
WHERE status = 'Closed';

-- 4. Audit log rows in status_updates may reference both the old and the
--    new value — patch both columns
UPDATE status_updates
SET old_status = 'Received & Closed'
WHERE old_status = 'Closed';

UPDATE status_updates
SET new_status = 'Received & Closed'
WHERE new_status = 'Closed';
