-- Osiguraj dozvole za anonimne korisnike na audit.gr_klijenti tabeli

-- Proveri da li tabela postoji i primeni dozvole
do $$
begin
  if to_regclass('audit.gr_klijenti') is not null then
    -- Omogući RLS
    execute 'alter table audit.gr_klijenti enable row level security';
    
    -- Ukloni postojeće politike i ponovo ih kreiraj
    execute 'drop policy if exists "gr_klijenti_insert_anon" on audit.gr_klijenti';
    execute 'create policy "gr_klijenti_insert_anon" on audit.gr_klijenti for insert to anon with check (true)';
    
    -- Grant dozvole
    execute 'grant insert on table audit.gr_klijenti to anon';
    execute 'grant usage, select on sequence audit.gr_klijenti_id_seq to anon';
  end if;
end $$;
