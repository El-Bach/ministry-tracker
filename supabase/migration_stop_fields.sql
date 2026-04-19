-- migration_stop_fields.sql
-- Creates cities table + seeds Lebanese cities + adds city/assignee columns to task_route_stops
-- Run this in Supabase SQL Editor (supersedes migration_cities.sql which was never run)

-- Cities table
create table if not exists cities (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz default now()
);

-- Seed Lebanese cities (Arabic names)
insert into cities (name) values
  ('بيروت'),('جونية'),('جبيل'),('أنطلياس'),('ذوق مكايل'),('غزير'),('جديدة'),
  ('الدكوانة'),('سن الفيل'),('جل الديب'),('الحازمية'),('برمانا'),('بكفيا'),
  ('بيت مري'),('عجلتون'),('صربا'),('كسروان'),('الشويفات'),('دير القمر'),
  ('عاليه'),('بعبدا'),('الغبيري'),('برج البراجنة'),('حارة حريك'),('الشياح'),
  ('المتن'),('الشوف'),('طرابلس'),('الميناء'),('المنية'),('البترون'),
  ('زغرتا'),('إهدن'),('بشري'),('تنورين'),('الكورة'),('حلبا'),('القبيات'),
  ('عكار'),('الضنية'),('صيدا'),('صور'),('النبطية'),('بنت جبيل'),('مرجعيون'),
  ('خيام'),('حاصبيا'),('جزين'),('الناقورة'),('زحلة'),('بعلبك'),('الهرمل'),
  ('عرسال'),('القاع'),('دير الأحمر'),('مجدل عنجر'),('يحمر')
on conflict (name) do nothing;

-- Add city + assignee columns to task_route_stops (per-stage fields)
alter table task_route_stops
  add column if not exists city_id uuid references cities(id) on delete set null,
  add column if not exists assigned_to uuid references team_members(id) on delete set null,
  add column if not exists ext_assignee_id uuid references assignees(id) on delete set null;
