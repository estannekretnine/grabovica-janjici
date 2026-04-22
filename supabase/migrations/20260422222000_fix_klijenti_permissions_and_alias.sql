do $$
declare
  tbl text;
begin
  foreach tbl in array array['gr_klijenti', 'klijenti']
  loop
    if to_regclass('audit.' || tbl) is null then
      continue;
    end if;

    execute format('alter table audit.%I enable row level security', tbl);

    execute format('drop policy if exists "%s_insert_anon" on audit.%I', tbl, tbl);
    execute format('drop policy if exists "%s_insert_authenticated" on audit.%I', tbl, tbl);
    execute format('drop policy if exists "%s_select_authenticated" on audit.%I', tbl, tbl);
    execute format('drop policy if exists "%s_update_authenticated" on audit.%I', tbl, tbl);
    execute format('drop policy if exists "%s_delete_authenticated" on audit.%I', tbl, tbl);

    execute format(
      'create policy "%s_insert_anon" on audit.%I for insert to anon with check (true)',
      tbl,
      tbl
    );
    execute format(
      'create policy "%s_insert_authenticated" on audit.%I for insert to authenticated with check (true)',
      tbl,
      tbl
    );
    execute format(
      'create policy "%s_select_authenticated" on audit.%I for select to authenticated using (true)',
      tbl,
      tbl
    );
    execute format(
      'create policy "%s_update_authenticated" on audit.%I for update to authenticated using (true) with check (true)',
      tbl,
      tbl
    );
    execute format(
      'create policy "%s_delete_authenticated" on audit.%I for delete to authenticated using (true)',
      tbl,
      tbl
    );

    execute format('grant insert on table audit.%I to anon', tbl);
    execute format('grant select, insert, update, delete on table audit.%I to authenticated', tbl);

    if to_regclass(format('audit.%I_id_seq', tbl)) is not null then
      execute format('grant usage, select on sequence audit.%I_id_seq to anon, authenticated', tbl);
    end if;
  end loop;
end $$;
