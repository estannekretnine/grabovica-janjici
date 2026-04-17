-- Ako je ranije primenjena verzija migracije sa audit.gr_klijenti, preimenuj u audit.klijenti
do $$
begin
  if to_regclass('audit.gr_klijenti') is not null and to_regclass('audit.klijenti') is null then
    alter table audit.gr_klijenti rename to klijenti;
    if exists (
      select 1 from pg_indexes
      where schemaname = 'audit' and indexname = 'gr_klijenti_datumupisa_idx'
    ) then
      execute 'alter index audit.gr_klijenti_datumupisa_idx rename to klijenti_datumupisa_idx';
    end if;
  end if;
end $$;
