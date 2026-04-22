-- migration_rls_fix.sql
-- Fixes "new row violates row-level security policy" errors on tables
-- that had DISABLE ROW LEVEL SECURITY in their original migrations but
-- got RLS re-enabled (e.g. via the Supabase dashboard).
--
-- This is an internal app — all authenticated users may read/write all rows.
-- We use ENABLE RLS + a permissive policy (same pattern as assignees table).

-- task_documents
ALTER TABLE task_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated" ON task_documents;
CREATE POLICY "Allow all authenticated" ON task_documents
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- stop_requirements (proactive fix — same risk)
ALTER TABLE stop_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated" ON stop_requirements;
CREATE POLICY "Allow all authenticated" ON stop_requirements
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ministry_requirements (proactive fix)
ALTER TABLE ministry_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated" ON ministry_requirements;
CREATE POLICY "Allow all authenticated" ON ministry_requirements
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- task_price_history (proactive fix)
ALTER TABLE task_price_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated" ON task_price_history;
CREATE POLICY "Allow all authenticated" ON task_price_history
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- file_transactions (proactive fix)
ALTER TABLE file_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated" ON file_transactions;
CREATE POLICY "Allow all authenticated" ON file_transactions
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- task_route_stops (proactive fix)
ALTER TABLE task_route_stops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated" ON task_route_stops;
CREATE POLICY "Allow all authenticated" ON task_route_stops
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- task_comments (proactive fix)
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated" ON task_comments;
CREATE POLICY "Allow all authenticated" ON task_comments
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- tasks (proactive fix)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated" ON tasks;
CREATE POLICY "Allow all authenticated" ON tasks
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- clients (proactive fix)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated" ON clients;
CREATE POLICY "Allow all authenticated" ON clients
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ministries (proactive fix)
ALTER TABLE ministries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated" ON ministries;
CREATE POLICY "Allow all authenticated" ON ministries
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- services (proactive fix)
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated" ON services;
CREATE POLICY "Allow all authenticated" ON services
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- team_members (proactive fix)
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated" ON team_members;
CREATE POLICY "Allow all authenticated" ON team_members
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- status_labels (proactive fix)
ALTER TABLE status_labels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated" ON status_labels;
CREATE POLICY "Allow all authenticated" ON status_labels
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- status_updates (proactive fix)
ALTER TABLE status_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated" ON status_updates;
CREATE POLICY "Allow all authenticated" ON status_updates
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- client_field_definitions (proactive fix)
ALTER TABLE client_field_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated" ON client_field_definitions;
CREATE POLICY "Allow all authenticated" ON client_field_definitions
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- client_field_values (proactive fix)
ALTER TABLE client_field_values ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated" ON client_field_values;
CREATE POLICY "Allow all authenticated" ON client_field_values
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- cities (proactive fix)
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated" ON cities;
CREATE POLICY "Allow all authenticated" ON cities
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- service_default_stages (proactive fix)
ALTER TABLE service_default_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated" ON service_default_stages;
CREATE POLICY "Allow all authenticated" ON service_default_stages
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
