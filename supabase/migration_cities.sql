-- Create cities table
create table if not exists cities (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz default now()
);

-- Add city_id to tasks (nullable, optional)
alter table tasks add column if not exists city_id uuid references cities(id) on delete set null;

-- Seed Lebanese cities in Arabic
insert into cities (name) values
  -- بيروت
  ('بيروت'),
  -- جبل لبنان
  ('جونية'),
  ('جبيل'),
  ('أنطلياس'),
  ('ذوق مكايل'),
  ('غزير'),
  ('جديدة'),
  ('الدكوانة'),
  ('سن الفيل'),
  ('جل الديب'),
  ('الحازمية'),
  ('برمانا'),
  ('بكفيا'),
  ('بيت مري'),
  ('عجلتون'),
  ('صربا'),
  ('كسروان'),
  ('الشويفات'),
  ('دير القمر'),
  ('عاليه'),
  ('بعبدا'),
  ('الغبيري'),
  ('برج البراجنة'),
  ('حارة حريك'),
  ('الشياح'),
  ('المتن'),
  ('الشوف'),
  -- الشمال
  ('طرابلس'),
  ('الميناء'),
  ('المنية'),
  ('البترون'),
  ('زغرتا'),
  ('إهدن'),
  ('بشري'),
  ('تنورين'),
  ('الكورة'),
  ('حلبا'),
  ('القبيات'),
  ('عكار'),
  ('الضنية'),
  -- الجنوب
  ('صيدا'),
  ('صور'),
  ('النبطية'),
  ('بنت جبيل'),
  ('مرجعيون'),
  ('خيام'),
  ('حاصبيا'),
  ('جزين'),
  ('الناقورة'),
  -- البقاع
  ('زحلة'),
  ('بعلبك'),
  ('الهرمل'),
  ('عرسال'),
  ('القاع'),
  ('دير الأحمر'),
  ('مجدل عنجر'),
  ('يحمر')
on conflict (name) do nothing;
