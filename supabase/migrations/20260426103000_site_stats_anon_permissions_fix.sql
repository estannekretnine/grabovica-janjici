grant usage on schema audit to anon, authenticated, service_role;

grant insert, update on table audit.gr_site_sessions to anon;
grant insert on table audit.gr_site_page_views to anon;
grant usage, select on sequence audit.gr_site_page_views_id_seq to anon;

grant select, insert, update, delete on table audit.gr_site_sessions to authenticated;
grant select, insert, update, delete on table audit.gr_site_page_views to authenticated;
grant usage, select on sequence audit.gr_site_page_views_id_seq to authenticated;

alter table audit.gr_site_sessions enable row level security;
alter table audit.gr_site_page_views enable row level security;

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
