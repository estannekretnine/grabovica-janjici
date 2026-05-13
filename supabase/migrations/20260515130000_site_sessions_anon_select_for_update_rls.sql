-- Heartbeat / PATCH na audit.gr_site_sessions: PostgreSQL RLS za UPDATE
-- implicitno mora moći da "vidi" red (SELECT pravilo). Ranije je postojao samo
-- SELECT za authenticated, pa je anon mogao INSERT ali ne i UPDATE — u konzoli
-- 401 / "update session heartbeat/path failed".
--
-- Napomena: anon ključ je ionako u browser bundle-u; ova politika dozvoljava
-- čitanje redova sesija preko javnog API-ja. Podaci su statistika poseta.

grant select on table audit.gr_site_sessions to anon;

drop policy if exists "site_sessions_select_anon" on audit.gr_site_sessions;

create policy "site_sessions_select_anon"
  on audit.gr_site_sessions for select to anon
  using (true);
