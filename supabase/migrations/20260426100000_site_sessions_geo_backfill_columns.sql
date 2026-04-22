alter table audit.gr_site_sessions
  add column if not exists ip_address text null,
  add column if not exists country_code text null,
  add column if not exists country_name text null,
  add column if not exists region_name text null;

create index if not exists gr_site_sessions_country_name_idx
  on audit.gr_site_sessions (country_name);

create index if not exists gr_site_sessions_region_name_idx
  on audit.gr_site_sessions (region_name);
