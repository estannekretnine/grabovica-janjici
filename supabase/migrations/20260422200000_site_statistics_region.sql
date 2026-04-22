alter table audit.gr_site_sessions
  add column if not exists region_name text null;

create index if not exists gr_site_sessions_region_idx
  on audit.gr_site_sessions (region_name);
