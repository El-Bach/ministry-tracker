-- Migration: Financial v2 — Exchange rate, file closure timestamp, status label rename
-- Run AFTER all previous migrations.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Daily USD/LBP exchange rate stored per organization (editable by owner/admin)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS usd_to_lbp_rate NUMERIC(14,4) DEFAULT 89500;

-- 2. File closure timestamp — set in-app when all stages reach terminal status
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- 3. Backfill closed_at for already-terminal files (use updated_at as best approximation)
UPDATE tasks
SET closed_at = updated_at
WHERE current_status IN ('Done', 'Rejected', 'Closed')
  AND closed_at IS NULL;

-- 4. Rename "Closed" status label to "Received & Closed"
UPDATE status_labels
SET label = 'Received & Closed'
WHERE label = 'Closed';

-- 5. Also update any tasks that had current_status = 'Closed' (backfill)
UPDATE tasks
SET current_status = 'Received & Closed'
WHERE current_status = 'Closed';

-- 6. Also update status_updates audit log
UPDATE status_updates SET old_status = 'Received & Closed' WHERE old_status = 'Closed';
UPDATE status_updates SET new_status = 'Received & Closed' WHERE new_status = 'Closed';
