-- Aktivnosti po članu (neograničen broj po osobi)
create table audit.gr_aktivnosti (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references audit.gr_persons (id) on delete cascade,
  naslov text not null default '',
  opis text,
  datum date,
  veb_link text,
  foto_storage_path text,
  redosled int not null default 0,
  napomena text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index gr_aktivnosti_person_id_idx on audit.gr_aktivnosti (person_id);
create index gr_aktivnosti_person_order_idx on audit.gr_aktivnosti (person_id, redosled, created_at);

create trigger gr_aktivnosti_set_updated_at
  before update on audit.gr_aktivnosti
  for each row
  execute function public.set_updated_at();

alter table audit.gr_aktivnosti enable row level security;

create policy gr_aktivnosti_select_authenticated
  on audit.gr_aktivnosti for select to authenticated using (true);
create policy gr_aktivnosti_insert_authenticated
  on audit.gr_aktivnosti for insert to authenticated with check (true);
create policy gr_aktivnosti_update_authenticated
  on audit.gr_aktivnosti for update to authenticated using (true) with check (true);
create policy gr_aktivnosti_delete_authenticated
  on audit.gr_aktivnosti for delete to authenticated using (true);

grant select, insert, update, delete on audit.gr_aktivnosti to anon, authenticated, service_role;
