-- Poruke sa javnog sajta (kontakt forma) — tabela audit.klijenti (bez prefiksa gr_)
create table audit.klijenti (
  id serial not null,
  ime text null,
  prezime text null,
  firma text null,
  email text null,
  kontakt text null,
  datumupisa timestamp with time zone null default now(),
  datumpromene timestamp with time zone null,
  opis text null,
  stsarhiviran boolean null default false,
  stsinvestitoraudit boolean null default false,
  source text null,
  contactid text null,
  constraint klijenti_pkey primary key (id)
);

create index klijenti_datumupisa_idx on audit.klijenti (datumupisa desc);

alter table audit.klijenti enable row level security;

drop policy if exists "klijenti_insert_anon" on audit.klijenti;
drop policy if exists "klijenti_insert_authenticated" on audit.klijenti;
drop policy if exists "klijenti_select_authenticated" on audit.klijenti;
drop policy if exists "klijenti_update_authenticated" on audit.klijenti;
drop policy if exists "klijenti_delete_authenticated" on audit.klijenti;

create policy "klijenti_insert_anon"
  on audit.klijenti for insert to anon
  with check (true);

create policy "klijenti_insert_authenticated"
  on audit.klijenti for insert to authenticated
  with check (true);

create policy "klijenti_select_authenticated"
  on audit.klijenti for select to authenticated
  using (true);

create policy "klijenti_update_authenticated"
  on audit.klijenti for update to authenticated
  using (true)
  with check (true);

create policy "klijenti_delete_authenticated"
  on audit.klijenti for delete to authenticated
  using (true);

grant insert on table audit.klijenti to anon;
grant select, insert, update, delete on table audit.klijenti to authenticated;
grant usage, select on sequence audit.klijenti_id_seq to anon, authenticated;

-- Javni prikaz jednog nasumičnog člana (PostgREST: funkcija u public šemi)
create or replace function public.get_public_home_person()
returns jsonb
language sql
security definer
set search_path = audit, pg_temp
stable
as $$
  select to_jsonb(sub) from (
    select
      p.first_name,
      p.last_name,
      p.birth_date::text as birth_date,
      p.birth_place,
      p.death_date::text as death_date,
      p.gender,
      p.is_living
    from audit.gr_persons p
    where p.tree_id = '00000000-0000-0000-0000-000000000001'::uuid
    order by random()
    limit 1
  ) sub;
$$;

revoke all on function public.get_public_home_person() from public;
grant execute on function public.get_public_home_person() to anon, authenticated;
