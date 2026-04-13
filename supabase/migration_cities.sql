-- Create cities table
create table if not exists cities (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz default now()
);

-- Add city_id to tasks (nullable, optional)
alter table tasks add column if not exists city_id uuid references cities(id) on delete set null;

-- Seed Lebanese cities
insert into cities (name) values
  ('Beirut'), ('Tripoli'), ('Sidon'), ('Tyre'), ('Jounieh'),
  ('Baalbek'), ('Zahle'), ('Byblos'), ('Nabatieh'), ('Aley'),
  ('Broummana'), ('Antelias'), ('Zouk Mikael'), ('Batroun'),
  ('Zgharta'), ('Bint Jbeil'), ('Ghazir'), ('Deir el-Qamar'),
  ('Choueifat'), ('Metn')
on conflict (name) do nothing;
