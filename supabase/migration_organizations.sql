-- Migration: Multi-tenancy Organizations
-- Session 26 — Phase 1 commercialization
-- Run this AFTER all previous migrations

-- ─────────────────────────────────────────────────
-- 1. Organizations table
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL,
  slug        text UNIQUE,
  plan        text NOT NULL DEFAULT 'free',  -- 'free' | 'starter' | 'business'
  created_at  timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────
-- 2. Add org_id + auth_id to team_members
-- ─────────────────────────────────────────────────
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS org_id   uuid REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS auth_id  uuid UNIQUE,   -- matches auth.users.id
  ADD COLUMN IF NOT EXISTS role     text NOT NULL DEFAULT 'member';
  -- role: 'owner' | 'admin' | 'member' | 'viewer'

-- ─────────────────────────────────────────────────
-- 3. Add org_id to all top-level tables
-- ─────────────────────────────────────────────────
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE ministries
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE status_labels
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE assignees
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE cities
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE client_field_definitions
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE service_documents
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

-- ─────────────────────────────────────────────────
-- 4. Helper function: get current user's org_id from team_members
-- ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auth_org_id() RETURNS uuid AS $$
  SELECT org_id FROM team_members WHERE auth_id = auth.uid() LIMIT 1
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ─────────────────────────────────────────────────
-- 5. Enable Row Level Security on all tables
-- ─────────────────────────────────────────────────
ALTER TABLE organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ministries           ENABLE ROW LEVEL SECURITY;
ALTER TABLE services             ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_labels        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignees            ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities               ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_documents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_route_stops     ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE stop_requirements    ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_updates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_price_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_field_values  ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_default_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ministry_requirements ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────
-- 6. RLS Policies — organization isolation
-- ─────────────────────────────────────────────────

-- organizations: members can read their own org
DROP POLICY IF EXISTS "org_read_own" ON organizations;
CREATE POLICY "org_read_own" ON organizations
  FOR ALL USING (id = auth_org_id());

-- team_members: see only members of same org
DROP POLICY IF EXISTS "org_isolation" ON team_members;
CREATE POLICY "org_isolation" ON team_members
  FOR ALL USING (org_id = auth_org_id());

-- clients
DROP POLICY IF EXISTS "org_isolation" ON clients;
CREATE POLICY "org_isolation" ON clients
  FOR ALL USING (org_id = auth_org_id());

-- ministries (stages)
DROP POLICY IF EXISTS "org_isolation" ON ministries;
CREATE POLICY "org_isolation" ON ministries
  FOR ALL USING (org_id = auth_org_id());

-- services
DROP POLICY IF EXISTS "org_isolation" ON services;
CREATE POLICY "org_isolation" ON services
  FOR ALL USING (org_id = auth_org_id());

-- status_labels
DROP POLICY IF EXISTS "org_isolation" ON status_labels;
CREATE POLICY "org_isolation" ON status_labels
  FOR ALL USING (org_id = auth_org_id());

-- tasks
DROP POLICY IF EXISTS "org_isolation" ON tasks;
CREATE POLICY "org_isolation" ON tasks
  FOR ALL USING (org_id = auth_org_id());

-- assignees (network contacts)
DROP POLICY IF EXISTS "org_isolation" ON assignees;
CREATE POLICY "org_isolation" ON assignees
  FOR ALL USING (org_id = auth_org_id());

-- cities
DROP POLICY IF EXISTS "org_isolation" ON cities;
CREATE POLICY "org_isolation" ON cities
  FOR ALL USING (org_id = auth_org_id());

-- client_field_definitions
DROP POLICY IF EXISTS "org_isolation" ON client_field_definitions;
CREATE POLICY "org_isolation" ON client_field_definitions
  FOR ALL USING (org_id = auth_org_id());

-- service_documents
DROP POLICY IF EXISTS "org_isolation" ON service_documents;
CREATE POLICY "org_isolation" ON service_documents
  FOR ALL USING (org_id = auth_org_id());

-- task_route_stops: inherit isolation via task_id
DROP POLICY IF EXISTS "org_isolation" ON task_route_stops;
CREATE POLICY "org_isolation" ON task_route_stops
  FOR ALL USING (
    task_id IN (SELECT id FROM tasks WHERE org_id = auth_org_id())
  );

-- task_comments: inherit via task_id
DROP POLICY IF EXISTS "org_isolation" ON task_comments;
CREATE POLICY "org_isolation" ON task_comments
  FOR ALL USING (
    task_id IN (SELECT id FROM tasks WHERE org_id = auth_org_id())
  );

-- file_transactions: inherit via task_id
DROP POLICY IF EXISTS "org_isolation" ON file_transactions;
CREATE POLICY "org_isolation" ON file_transactions
  FOR ALL USING (
    task_id IN (SELECT id FROM tasks WHERE org_id = auth_org_id())
  );

-- stop_requirements: inherit via stop_id → task_route_stops → tasks
DROP POLICY IF EXISTS "org_isolation" ON stop_requirements;
CREATE POLICY "org_isolation" ON stop_requirements
  FOR ALL USING (
    stop_id IN (
      SELECT trs.id FROM task_route_stops trs
      JOIN tasks t ON t.id = trs.task_id
      WHERE t.org_id = auth_org_id()
    )
  );

-- task_documents: inherit via task_id
DROP POLICY IF EXISTS "org_isolation" ON task_documents;
CREATE POLICY "org_isolation" ON task_documents
  FOR ALL USING (
    task_id IN (SELECT id FROM tasks WHERE org_id = auth_org_id())
  );

-- status_updates: inherit via task_id
DROP POLICY IF EXISTS "org_isolation" ON status_updates;
CREATE POLICY "org_isolation" ON status_updates
  FOR ALL USING (
    task_id IN (SELECT id FROM tasks WHERE org_id = auth_org_id())
  );

-- assignment_history: inherit via task_id
DROP POLICY IF EXISTS "org_isolation" ON assignment_history;
CREATE POLICY "org_isolation" ON assignment_history
  FOR ALL USING (
    task_id IN (SELECT id FROM tasks WHERE org_id = auth_org_id())
  );

-- task_price_history: inherit via task_id
DROP POLICY IF EXISTS "org_isolation" ON task_price_history;
CREATE POLICY "org_isolation" ON task_price_history
  FOR ALL USING (
    task_id IN (SELECT id FROM tasks WHERE org_id = auth_org_id())
  );

-- client_field_values: inherit via client_id
DROP POLICY IF EXISTS "org_isolation" ON client_field_values;
CREATE POLICY "org_isolation" ON client_field_values
  FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE org_id = auth_org_id())
  );

-- service_default_stages: inherit via service_id
DROP POLICY IF EXISTS "org_isolation" ON service_default_stages;
CREATE POLICY "org_isolation" ON service_default_stages
  FOR ALL USING (
    service_id IN (SELECT id FROM services WHERE org_id = auth_org_id())
  );

-- ministry_requirements: inherit via ministry_id
DROP POLICY IF EXISTS "org_isolation" ON ministry_requirements;
CREATE POLICY "org_isolation" ON ministry_requirements
  FOR ALL USING (
    ministry_id IN (SELECT id FROM ministries WHERE org_id = auth_org_id())
  );

-- ─────────────────────────────────────────────────
-- 7. Backfill existing data (Bechara's company)
-- ─────────────────────────────────────────────────
-- Creates a single "default" org for all existing data.
-- After running this: manually set team_members.auth_id for existing users
-- via: UPDATE team_members SET auth_id = '<uuid from auth.users>' WHERE email = 'becharaabdelmassih@gmail.com';

DO $$
DECLARE
  _org_id uuid;
BEGIN
  INSERT INTO organizations (name, slug, plan)
  VALUES ('My Company', 'my-company', 'free')
  RETURNING id INTO _org_id;

  -- Backfill all existing rows with the default org
  UPDATE team_members          SET org_id = _org_id WHERE org_id IS NULL;
  UPDATE clients               SET org_id = _org_id WHERE org_id IS NULL;
  UPDATE ministries            SET org_id = _org_id WHERE org_id IS NULL;
  UPDATE services              SET org_id = _org_id WHERE org_id IS NULL;
  UPDATE status_labels         SET org_id = _org_id WHERE org_id IS NULL;
  UPDATE tasks                 SET org_id = _org_id WHERE org_id IS NULL;
  UPDATE assignees             SET org_id = _org_id WHERE org_id IS NULL;
  UPDATE cities                SET org_id = _org_id WHERE org_id IS NULL;
  UPDATE client_field_definitions SET org_id = _org_id WHERE org_id IS NULL;
  UPDATE service_documents     SET org_id = _org_id WHERE org_id IS NULL;
END $$;

-- ─────────────────────────────────────────────────
-- AFTER RUNNING THIS MIGRATION:
-- 1. Find auth.users.id for becharaabdelmassih@gmail.com in Supabase Auth dashboard
-- 2. Run: UPDATE team_members SET auth_id = '<that-uuid>' WHERE email = 'becharaabdelmassih@gmail.com';
-- 3. New registrations through RegisterScreen will automatically create org + team_member rows
-- ─────────────────────────────────────────────────
