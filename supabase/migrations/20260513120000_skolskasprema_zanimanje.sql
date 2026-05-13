-- Šifrarnici: školska sprema i zanimanje, plus veze sa audit.gr_persons.
-- Prati postojeći obrazac za public.drzava / public.opstina / public.lokacija.

create table if not exists public.skolskasprema (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  opis text
);

create table if not exists public.zanimanje (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  opis text
);

grant select, insert, update, delete on table public.skolskasprema to anon, authenticated, service_role;
grant select, insert, update, delete on table public.zanimanje    to anon, authenticated, service_role;
grant usage, select on sequence public.skolskasprema_id_seq to anon, authenticated, service_role;
grant usage, select on sequence public.zanimanje_id_seq    to anon, authenticated, service_role;

-- Nove kolone na osobama:
--   skolskaspremaid -> jedna vrednost (FK na šifrarnik)
--   zanimanja       -> niz objekata { zanimanjeid, datum_od, datum_do } u JSONB
alter table audit.gr_persons
  add column if not exists skolskaspremaid bigint
    references public.skolskasprema(id) on delete restrict,
  add column if not exists zanimanja jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'gr_persons_zanimanja_is_array'
  ) then
    alter table audit.gr_persons
      add constraint gr_persons_zanimanja_is_array
        check (jsonb_typeof(zanimanja) = 'array');
  end if;
end$$;

create index if not exists gr_persons_skolskaspremaid_idx
  on audit.gr_persons (skolskaspremaid);
