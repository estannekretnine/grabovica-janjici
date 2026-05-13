-- RLS za public.skolskasprema i public.zanimanje (isti obrazac kao drzava/opstina/lokacija u 20260417103000).
-- Bez ovoga INSERT kroz PostgREST pada: "new row violates row-level security policy".

-- Školska sprema
alter table public.skolskasprema enable row level security;

drop policy if exists "skolskasprema_select_client_roles" on public.skolskasprema;
drop policy if exists "skolskasprema_insert_client_roles" on public.skolskasprema;
drop policy if exists "skolskasprema_update_client_roles" on public.skolskasprema;
drop policy if exists "skolskasprema_delete_client_roles" on public.skolskasprema;

create policy "skolskasprema_select_client_roles"
  on public.skolskasprema for select
  to anon, authenticated
  using (true);

create policy "skolskasprema_insert_client_roles"
  on public.skolskasprema for insert
  to anon, authenticated
  with check (true);

create policy "skolskasprema_update_client_roles"
  on public.skolskasprema for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "skolskasprema_delete_client_roles"
  on public.skolskasprema for delete
  to anon, authenticated
  using (true);

grant select, insert, update, delete on table public.skolskasprema to anon, authenticated;

-- Zanimanje
alter table public.zanimanje enable row level security;

drop policy if exists "zanimanje_select_client_roles" on public.zanimanje;
drop policy if exists "zanimanje_insert_client_roles" on public.zanimanje;
drop policy if exists "zanimanje_update_client_roles" on public.zanimanje;
drop policy if exists "zanimanje_delete_client_roles" on public.zanimanje;

create policy "zanimanje_select_client_roles"
  on public.zanimanje for select
  to anon, authenticated
  using (true);

create policy "zanimanje_insert_client_roles"
  on public.zanimanje for insert
  to anon, authenticated
  with check (true);

create policy "zanimanje_update_client_roles"
  on public.zanimanje for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "zanimanje_delete_client_roles"
  on public.zanimanje for delete
  to anon, authenticated
  using (true);

grant select, insert, update, delete on table public.zanimanje to anon, authenticated;
