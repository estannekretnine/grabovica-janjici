do $$
begin
  begin
    execute 'alter role anon set timezone = ''Europe/Belgrade''';
  exception
    when others then
      null;
  end;

  begin
    execute 'alter role authenticated set timezone = ''Europe/Belgrade''';
  exception
    when others then
      null;
  end;

  begin
    execute 'alter role service_role set timezone = ''Europe/Belgrade''';
  exception
    when others then
      null;
  end;
end;
$$;
