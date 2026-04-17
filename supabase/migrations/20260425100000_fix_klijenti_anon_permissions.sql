-- Osiguraj dozvole za anonimne korisnike na audit.klijenti tabeli

-- Proveri da li tabela postoji i primeni dozvole
do $$
begin
  if to_regclass('audit.klijenti') is not null then
    -- Omogući RLS
    execute 'alter table audit.klijenti enable row level security';
    
    -- Ukloni postojeće politike i ponovo ih kreiraj
    execute 'drop policy if exists "klijenti_insert_anon" on audit.klijenti';
    execute 'create policy "klijenti_insert_anon" on audit.klijenti for insert to anon with check (true)';
    
    -- Grant dozvole
    execute 'grant insert on table audit.klijenti to anon';
    execute 'grant usage, select on sequence audit.klijenti_id_seq to anon';
  end if;
end $$;
