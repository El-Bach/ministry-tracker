-- ============================================================
-- Ministry Tracker — Supabase Schema
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- TEAM MEMBERS
-- ============================================================
create table team_members (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  role text not null default 'Agent',
  avatar_url text,
  email text unique not null,
  created_at timestamptz default now()
);

-- ============================================================
-- CLIENTS
-- ============================================================
create table clients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  client_id text unique not null,
  phone text,
  created_at timestamptz default now()
);

-- ============================================================
-- MINISTRIES
-- ============================================================
create table ministries (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null check (type in ('parent', 'child')),
  parent_id uuid references ministries(id) on delete set null,
  created_at timestamptz default now()
);

-- ============================================================
-- SERVICES
-- ============================================================
create table services (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  ministry_id uuid references ministries(id) on delete set null,
  estimated_duration_days integer not null default 7,
  created_at timestamptz default now()
);

-- ============================================================
-- STATUS LABELS (user-defined)
-- ============================================================
create table status_labels (
  id uuid primary key default uuid_generate_v4(),
  label text not null unique,
  color text not null default '#6366f1',
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

-- Seed default status labels
insert into status_labels (label, color, sort_order) values
  ('Submitted', '#3b82f6', 1),
  ('In Review', '#f59e0b', 2),
  ('Pending Signature', '#8b5cf6', 3),
  ('Approved', '#10b981', 4),
  ('Rejected', '#ef4444', 5),
  ('Closed', '#6b7280', 6);

-- ============================================================
-- TASKS / FILES
-- ============================================================
create table tasks (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  service_id uuid not null references services(id) on delete restrict,
  assigned_to uuid references team_members(id) on delete set null,
  current_status text not null default 'Submitted',
  due_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- TASK ROUTE STOPS (ordered ministry chain per task)
-- ============================================================
create table task_route_stops (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references tasks(id) on delete cascade,
  ministry_id uuid not null references ministries(id) on delete restrict,
  stop_order integer not null,
  status text not null default 'Pending',
  updated_at timestamptz,
  updated_by uuid references team_members(id) on delete set null,
  gps_lat double precision,
  gps_lng double precision,
  notes text,
  created_at timestamptz default now(),
  unique(task_id, stop_order)
);

-- ============================================================
-- TASK COMMENTS / ACTIVITY LOG
-- ============================================================
create table task_comments (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references tasks(id) on delete cascade,
  author_id uuid references team_members(id) on delete set null,
  body text not null,
  gps_lat double precision,
  gps_lng double precision,
  created_at timestamptz default now()
);

-- ============================================================
-- STATUS UPDATE LOG (audit trail)
-- ============================================================
create table status_updates (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references tasks(id) on delete cascade,
  stop_id uuid references task_route_stops(id) on delete cascade,
  updated_by uuid references team_members(id) on delete set null,
  old_status text,
  new_status text not null,
  gps_lat double precision,
  gps_lng double precision,
  created_at timestamptz default now()
);

-- ============================================================
-- REALTIME: enable for relevant tables
-- ============================================================
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table task_route_stops;
alter publication supabase_realtime add table task_comments;
alter publication supabase_realtime add table status_updates;

-- ============================================================
-- ROW LEVEL SECURITY — all authenticated users have full access
-- (flat permission model per spec)
-- ============================================================
alter table team_members enable row level security;
alter table clients enable row level security;
alter table ministries enable row level security;
alter table services enable row level security;
alter table status_labels enable row level security;
alter table tasks enable row level security;
alter table task_route_stops enable row level security;
alter table task_comments enable row level security;
alter table status_updates enable row level security;

-- Policy: any authenticated user can do everything
create policy "auth_full_access" on team_members for all using (auth.role() = 'authenticated');
create policy "auth_full_access" on clients for all using (auth.role() = 'authenticated');
create policy "auth_full_access" on ministries for all using (auth.role() = 'authenticated');
create policy "auth_full_access" on services for all using (auth.role() = 'authenticated');
create policy "auth_full_access" on status_labels for all using (auth.role() = 'authenticated');
create policy "auth_full_access" on tasks for all using (auth.role() = 'authenticated');
create policy "auth_full_access" on task_route_stops for all using (auth.role() = 'authenticated');
create policy "auth_full_access" on task_comments for all using (auth.role() = 'authenticated');
create policy "auth_full_access" on status_updates for all using (auth.role() = 'authenticated');

-- ============================================================
-- INDEXES for common query patterns
-- ============================================================
create index idx_tasks_client on tasks(client_id);
create index idx_tasks_assigned on tasks(assigned_to);
create index idx_tasks_status on tasks(current_status);
create index idx_tasks_due on tasks(due_date);
create index idx_route_stops_task on task_route_stops(task_id);
create index idx_comments_task on task_comments(task_id);
create index idx_updates_task on status_updates(task_id);
