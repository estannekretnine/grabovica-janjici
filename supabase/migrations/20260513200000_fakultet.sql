-- Šifrarnik fakulteta: id, naziv, grad (isti obrazac + RLS kao skolskasprema).

create table if not exists public.fakultet (
  id bigserial primary key,
  naziv text not null default '',
  grad text
);

grant select, insert, update, delete on table public.fakultet to anon, authenticated, service_role;
grant usage, select on sequence public.fakultet_id_seq to anon, authenticated, service_role;

alter table public.fakultet enable row level security;

drop policy if exists "fakultet_select_client_roles" on public.fakultet;
drop policy if exists "fakultet_insert_client_roles" on public.fakultet;
drop policy if exists "fakultet_update_client_roles" on public.fakultet;
drop policy if exists "fakultet_delete_client_roles" on public.fakultet;

create policy "fakultet_select_client_roles"
  on public.fakultet for select
  to anon, authenticated
  using (true);

create policy "fakultet_insert_client_roles"
  on public.fakultet for insert
  to anon, authenticated
  with check (true);

create policy "fakultet_update_client_roles"
  on public.fakultet for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "fakultet_delete_client_roles"
  on public.fakultet for delete
  to anon, authenticated
  using (true);

grant select, insert, update, delete on table public.fakultet to anon, authenticated;
