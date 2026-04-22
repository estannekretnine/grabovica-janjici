create table if not exists audit.gr_site_sessions (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  ip_address text null,
  user_agent text null,
  entry_path text not null,
  current_path text not null,
  pages_count integer not null default 1,
  started_at timestamp with time zone not null default now(),
  last_seen timestamp with time zone not null default now(),
  ended_at timestamp with time zone null
);

create index if not exists gr_site_sessions_started_idx on audit.gr_site_sessions (started_at desc);
create index if not exists gr_site_sessions_last_seen_idx on audit.gr_site_sessions (last_seen desc);
create index if not exists gr_site_sessions_visitor_idx on audit.gr_site_sessions (visitor_id);

create table if not exists audit.gr_site_page_views (
  id bigserial primary key,
  session_id uuid not null references audit.gr_site_sessions(id) on delete cascade,
  visitor_id text not null,
  path text not null,
  viewed_at timestamp with time zone not null default now(),
  duration_seconds integer null check (duration_seconds is null or duration_seconds >= 0)
);

create index if not exists gr_site_page_views_session_idx on audit.gr_site_page_views (session_id, viewed_at desc);
create index if not exists gr_site_page_views_viewed_idx on audit.gr_site_page_views (viewed_at desc);

alter table audit.gr_site_sessions enable row level security;
alter table audit.gr_site_page_views enable row level security;

drop policy if exists "site_sessions_insert_anon" on audit.gr_site_sessions;
drop policy if exists "site_sessions_update_anon" on audit.gr_site_sessions;
drop policy if exists "site_sessions_select_authenticated" on audit.gr_site_sessions;
drop policy if exists "site_sessions_all_authenticated" on audit.gr_site_sessions;
drop policy if exists "site_page_views_insert_anon" on audit.gr_site_page_views;
drop policy if exists "site_page_views_select_authenticated" on audit.gr_site_page_views;
drop policy if exists "site_page_views_all_authenticated" on audit.gr_site_page_views;

create policy "site_sessions_insert_anon"
  on audit.gr_site_sessions for insert to anon
  with check (true);

create policy "site_sessions_update_anon"
  on audit.gr_site_sessions for update to anon
  using (true)
  with check (true);

create policy "site_sessions_select_authenticated"
  on audit.gr_site_sessions for select to authenticated
  using (true);

create policy "site_sessions_all_authenticated"
  on audit.gr_site_sessions for all to authenticated
  using (true)
  with check (true);

create policy "site_page_views_insert_anon"
  on audit.gr_site_page_views for insert to anon
  with check (true);

create policy "site_page_views_select_authenticated"
  on audit.gr_site_page_views for select to authenticated
  using (true);

create policy "site_page_views_all_authenticated"
  on audit.gr_site_page_views for all to authenticated
  using (true)
  with check (true);

grant insert, update on table audit.gr_site_sessions to anon;
grant insert on table audit.gr_site_page_views to anon;
grant usage, select on sequence audit.gr_site_page_views_id_seq to anon;

grant select, insert, update, delete on table audit.gr_site_sessions to authenticated;
grant select, insert, update, delete on table audit.gr_site_page_views to authenticated;
grant usage, select on sequence audit.gr_site_page_views_id_seq to authenticated;

create or replace function public.get_site_stats()
returns table (
  total_visits bigint,
  currently_online bigint
)
language sql
security definer
set search_path = audit, pg_temp
stable
as $$
  select
    count(*)::bigint as total_visits,
    count(*) filter (
      where last_seen >= now() - interval '2 minutes'
        and (ended_at is null or ended_at < last_seen)
    )::bigint as currently_online
  from audit.gr_site_sessions;
$$;

revoke all on function public.get_site_stats() from public;
grant execute on function public.get_site_stats() to anon, authenticated;
