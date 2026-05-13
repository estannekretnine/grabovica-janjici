-- Javno praćenje sajta: anon mora moći INSERT/UPDATE na audit.gr_site_sessions
-- i INSERT na audit.gr_site_page_views. Ako su GRANT-ovi skinuti u konzoli ili
-- nikad primenjeni na ovoj bazi, PostgREST vraća 42501 "permission denied for table ...".
--
-- Trigger BEFORE INSERT|UPDATE poziva audit.fill_site_session_geo_from_headers();
-- pozivalac (anon) mora imati EXECUTE na toj funkciji.

grant usage on schema audit to anon;

grant insert, update on table audit.gr_site_sessions to anon;
grant insert on table audit.gr_site_page_views to anon;
grant usage, select on sequence audit.gr_site_page_views_id_seq to anon;

-- Osiguraj da politike postoje (idempotentno)
drop policy if exists "site_sessions_insert_anon" on audit.gr_site_sessions;
drop policy if exists "site_sessions_update_anon" on audit.gr_site_sessions;
drop policy if exists "site_page_views_insert_anon" on audit.gr_site_page_views;

create policy "site_sessions_insert_anon"
  on audit.gr_site_sessions for insert to anon
  with check (true);

create policy "site_sessions_update_anon"
  on audit.gr_site_sessions for update to anon
  using (true)
  with check (true);

create policy "site_page_views_insert_anon"
  on audit.gr_site_page_views for insert to anon
  with check (true);

grant execute on function audit.fill_site_session_geo_from_headers() to anon;
grant execute on function audit.fill_site_session_geo_from_headers() to authenticated, service_role;
