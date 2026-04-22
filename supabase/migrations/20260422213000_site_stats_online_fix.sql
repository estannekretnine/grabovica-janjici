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
      where last_seen >= now() - interval '5 minutes'
    )::bigint as currently_online
  from audit.gr_site_sessions;
$$;

revoke all on function public.get_site_stats() from public;
grant execute on function public.get_site_stats() to anon, authenticated;
