-- Porodično stablo: šema audit + RLS (Supabase / PostgreSQL)
-- Prefiks tabela: gr_
-- Podrazumevano stablo: fiksni UUID za jednostavne DEFAULT/NOT NULL na gr_persons.tree_id

create schema if not exists audit;

-- Opciono: više stabala / porodica u istoj bazi
create table audit.gr_family_trees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_at timestamptz not null default now()
);

-- Osobe
create table audit.gr_persons (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references audit.gr_family_trees (id) on delete cascade,

  first_name text not null default '',
  middle_name text,
  last_name text not null default '',
  maiden_name text,

  gender text check (gender in ('male', 'female', 'other', 'unknown')),

  birth_date date,
  death_date date,
  birth_place text,
  death_place text,

  is_living boolean,

  photo_storage_path text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint gr_persons_death_after_birth check (
    birth_date is null or death_date is null or death_date >= birth_date
  )
);

create index gr_persons_tree_id_idx on audit.gr_persons (tree_id);
create index gr_persons_last_first_idx on audit.gr_persons (tree_id, last_name, first_name);

-- Roditelj -> dete (usmerena veza)
create table audit.gr_parent_child (
  id uuid primary key default gen_random_uuid(),

  parent_person_id uuid not null references audit.gr_persons (id) on delete cascade,
  child_person_id uuid not null references audit.gr_persons (id) on delete cascade,

  relation_subtype text not null default 'biological'
    check (relation_subtype in ('biological', 'adoptive', 'step', 'guardian', 'other')),

  notes text,
  created_at timestamptz not null default now(),

  constraint gr_parent_child_distinct check (parent_person_id <> child_person_id),
  constraint gr_parent_child_unique unique (parent_person_id, child_person_id)
);

create index gr_parent_child_by_parent_idx on audit.gr_parent_child (parent_person_id);
create index gr_parent_child_by_child_idx on audit.gr_parent_child (child_person_id);

-- Brak / partnerstvo (neusmerena veza između dve osobe)
create table audit.gr_partnerships (
  id uuid primary key default gen_random_uuid(),

  person_a_id uuid not null references audit.gr_persons (id) on delete cascade,
  person_b_id uuid not null references audit.gr_persons (id) on delete cascade,

  partnership_type text not null default 'marriage'
    check (partnership_type in ('marriage', 'civil_union', 'domestic_partnership', 'other')),

  start_date date,
  end_date date,
  place text,
  notes text,

  created_at timestamptz not null default now(),

  constraint gr_partnerships_distinct check (person_a_id <> person_b_id),
  constraint gr_partnerships_dates check (
    start_date is null or end_date is null or end_date >= start_date
  )
);

-- Najviše jedna "aktivna" veza po paru (end_date IS NULL); istorijske veze sa end_date dozvoljene u više redova
create unique index gr_partnerships_one_active_per_pair
  on audit.gr_partnerships (least(person_a_id, person_b_id), greatest(person_a_id, person_b_id))
  where end_date is null;

create index gr_partnerships_person_a_idx on audit.gr_partnerships (person_a_id);
create index gr_partnerships_person_b_idx on audit.gr_partnerships (person_b_id);

-- updated_at trigger (funkcija u public radi sa bilo kojom šemom)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger gr_persons_set_updated_at
before update on audit.gr_persons
for each row
execute function public.set_updated_at();

-- Podrazumevano stablo + DEFAULT na gr_persons.tree_id
insert into audit.gr_family_trees (id, name, slug)
values (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Glavno porodično stablo',
  'default'
);

alter table audit.gr_persons
  alter column tree_id set default '00000000-0000-0000-0000-000000000001'::uuid;

-- Pristup šemi audit preko PostgREST (Supabase API)
grant usage on schema audit to postgres, anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema audit to anon, authenticated, service_role;
grant usage, select on all sequences in schema audit to anon, authenticated, service_role;

alter default privileges in schema audit grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema audit grant usage, select on sequences to anon, authenticated, service_role;

-- RLS
alter table audit.gr_family_trees enable row level security;
alter table audit.gr_persons enable row level security;
alter table audit.gr_parent_child enable row level security;
alter table audit.gr_partnerships enable row level security;

-- Autentifikovani korisnici: pun CRUD (admin panel); anon: bez pristupa
-- Za produkciju uvedite uže politike (npr. samo uloga admin iz user_roles).
create policy gr_family_trees_select_authenticated
  on audit.gr_family_trees for select to authenticated using (true);
create policy gr_family_trees_insert_authenticated
  on audit.gr_family_trees for insert to authenticated with check (true);
create policy gr_family_trees_update_authenticated
  on audit.gr_family_trees for update to authenticated using (true) with check (true);
create policy gr_family_trees_delete_authenticated
  on audit.gr_family_trees for delete to authenticated using (true);

create policy gr_persons_select_authenticated
  on audit.gr_persons for select to authenticated using (true);
create policy gr_persons_insert_authenticated
  on audit.gr_persons for insert to authenticated with check (true);
create policy gr_persons_update_authenticated
  on audit.gr_persons for update to authenticated using (true) with check (true);
create policy gr_persons_delete_authenticated
  on audit.gr_persons for delete to authenticated using (true);

create policy gr_parent_child_select_authenticated
  on audit.gr_parent_child for select to authenticated using (true);
create policy gr_parent_child_insert_authenticated
  on audit.gr_parent_child for insert to authenticated with check (true);
create policy gr_parent_child_update_authenticated
  on audit.gr_parent_child for update to authenticated using (true) with check (true);
create policy gr_parent_child_delete_authenticated
  on audit.gr_parent_child for delete to authenticated using (true);

create policy gr_partnerships_select_authenticated
  on audit.gr_partnerships for select to authenticated using (true);
create policy gr_partnerships_insert_authenticated
  on audit.gr_partnerships for insert to authenticated with check (true);
create policy gr_partnerships_update_authenticated
  on audit.gr_partnerships for update to authenticated using (true) with check (true);
create policy gr_partnerships_delete_authenticated
  on audit.gr_partnerships for delete to authenticated using (true);
