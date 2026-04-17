-- Ensure CRUD works for both anon and authenticated sessions
-- in public locality tables used by admin SPA.

-- Drzava
alter table public.drzava enable row level security;

drop policy if exists "drzava_select_authenticated" on public.drzava;
drop policy if exists "drzava_insert_authenticated" on public.drzava;
drop policy if exists "drzava_update_authenticated" on public.drzava;
drop policy if exists "drzava_delete_authenticated" on public.drzava;
drop policy if exists "drzava_select_client_roles" on public.drzava;
drop policy if exists "drzava_insert_client_roles" on public.drzava;
drop policy if exists "drzava_update_client_roles" on public.drzava;
drop policy if exists "drzava_delete_client_roles" on public.drzava;

create policy "drzava_select_client_roles"
  on public.drzava for select
  to anon, authenticated
  using (true);

create policy "drzava_insert_client_roles"
  on public.drzava for insert
  to anon, authenticated
  with check (true);

create policy "drzava_update_client_roles"
  on public.drzava for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "drzava_delete_client_roles"
  on public.drzava for delete
  to anon, authenticated
  using (true);

grant select, insert, update, delete on table public.drzava to anon, authenticated;

-- Opstina
alter table public.opstina enable row level security;

drop policy if exists "opstina_select_authenticated" on public.opstina;
drop policy if exists "opstina_insert_authenticated" on public.opstina;
drop policy if exists "opstina_update_authenticated" on public.opstina;
drop policy if exists "opstina_delete_authenticated" on public.opstina;
drop policy if exists "opstina_select_client_roles" on public.opstina;
drop policy if exists "opstina_insert_client_roles" on public.opstina;
drop policy if exists "opstina_update_client_roles" on public.opstina;
drop policy if exists "opstina_delete_client_roles" on public.opstina;

create policy "opstina_select_client_roles"
  on public.opstina for select
  to anon, authenticated
  using (true);

create policy "opstina_insert_client_roles"
  on public.opstina for insert
  to anon, authenticated
  with check (true);

create policy "opstina_update_client_roles"
  on public.opstina for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "opstina_delete_client_roles"
  on public.opstina for delete
  to anon, authenticated
  using (true);

grant select, insert, update, delete on table public.opstina to anon, authenticated;

-- Lokacija
alter table public.lokacija enable row level security;

drop policy if exists "lokacija_select_authenticated" on public.lokacija;
drop policy if exists "lokacija_insert_authenticated" on public.lokacija;
drop policy if exists "lokacija_update_authenticated" on public.lokacija;
drop policy if exists "lokacija_delete_authenticated" on public.lokacija;
drop policy if exists "lokacija_select_client_roles" on public.lokacija;
drop policy if exists "lokacija_insert_client_roles" on public.lokacija;
drop policy if exists "lokacija_update_client_roles" on public.lokacija;
drop policy if exists "lokacija_delete_client_roles" on public.lokacija;

create policy "lokacija_select_client_roles"
  on public.lokacija for select
  to anon, authenticated
  using (true);

create policy "lokacija_insert_client_roles"
  on public.lokacija for insert
  to anon, authenticated
  with check (true);

create policy "lokacija_update_client_roles"
  on public.lokacija for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "lokacija_delete_client_roles"
  on public.lokacija for delete
  to anon, authenticated
  using (true);

grant select, insert, update, delete on table public.lokacija to anon, authenticated;
