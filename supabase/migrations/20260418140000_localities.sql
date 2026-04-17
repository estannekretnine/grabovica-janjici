-- Lokalitet tabele u audit šemi: države, opštine, lokacije.
-- Ovaj migration prati postojeći obrazac za grant + RLS politike.

create table if not exists audit.gr_countries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  created_at timestamptz not null default now()
);

create table if not exists audit.gr_municipalities (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references audit.gr_countries (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists audit.gr_locations (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references audit.gr_municipalities (id) on delete cascade,
  name text not null,
  address text,
  lat numeric,
  lng numeric,
  created_at timestamptz not null default now()
);

create index if not exists gr_municipalities_country_idx
  on audit.gr_municipalities (country_id, name);
create index if not exists gr_locations_municipality_idx
  on audit.gr_locations (municipality_id, name);

grant usage on schema audit to postgres, anon, authenticated, service_role;
grant select, insert, update, delete on table audit.gr_countries to anon, authenticated, service_role;
grant select, insert, update, delete on table audit.gr_municipalities to anon, authenticated, service_role;
grant select, insert, update, delete on table audit.gr_locations to anon, authenticated, service_role;

alter table audit.gr_countries enable row level security;
alter table audit.gr_municipalities enable row level security;
alter table audit.gr_locations enable row level security;

drop policy if exists gr_countries_select_authenticated on audit.gr_countries;
drop policy if exists gr_countries_insert_authenticated on audit.gr_countries;
drop policy if exists gr_countries_update_authenticated on audit.gr_countries;
drop policy if exists gr_countries_delete_authenticated on audit.gr_countries;

drop policy if exists gr_municipalities_select_authenticated on audit.gr_municipalities;
drop policy if exists gr_municipalities_insert_authenticated on audit.gr_municipalities;
drop policy if exists gr_municipalities_update_authenticated on audit.gr_municipalities;
drop policy if exists gr_municipalities_delete_authenticated on audit.gr_municipalities;

drop policy if exists gr_locations_select_authenticated on audit.gr_locations;
drop policy if exists gr_locations_insert_authenticated on audit.gr_locations;
drop policy if exists gr_locations_update_authenticated on audit.gr_locations;
drop policy if exists gr_locations_delete_authenticated on audit.gr_locations;

create policy gr_countries_select_authenticated
  on audit.gr_countries for select to authenticated using (true);
create policy gr_countries_insert_authenticated
  on audit.gr_countries for insert to authenticated with check (true);
create policy gr_countries_update_authenticated
  on audit.gr_countries for update to authenticated using (true) with check (true);
create policy gr_countries_delete_authenticated
  on audit.gr_countries for delete to authenticated using (true);

create policy gr_municipalities_select_authenticated
  on audit.gr_municipalities for select to authenticated using (true);
create policy gr_municipalities_insert_authenticated
  on audit.gr_municipalities for insert to authenticated with check (true);
create policy gr_municipalities_update_authenticated
  on audit.gr_municipalities for update to authenticated using (true) with check (true);
create policy gr_municipalities_delete_authenticated
  on audit.gr_municipalities for delete to authenticated using (true);

create policy gr_locations_select_authenticated
  on audit.gr_locations for select to authenticated using (true);
create policy gr_locations_insert_authenticated
  on audit.gr_locations for insert to authenticated with check (true);
create policy gr_locations_update_authenticated
  on audit.gr_locations for update to authenticated using (true) with check (true);
create policy gr_locations_delete_authenticated
  on audit.gr_locations for delete to authenticated using (true);
