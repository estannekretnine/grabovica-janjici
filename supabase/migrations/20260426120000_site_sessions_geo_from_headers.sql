create or replace function audit.fill_site_session_geo_from_headers()
returns trigger
language plpgsql
security definer
set search_path = audit, public, pg_temp
as $$
declare
  headers jsonb;
  forwarded_for text;
  ip_from_header text;
  country_code_from_header text;
  country_name_from_header text;
  region_from_header text;
begin
  begin
    headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception
    when others then
      headers := null;
  end;

  if headers is null then
    return new;
  end if;

  forwarded_for := nullif(headers ->> 'x-forwarded-for', '');
  if forwarded_for is not null then
    ip_from_header := nullif(split_part(forwarded_for, ',', 1), '');
    if ip_from_header is not null then
      ip_from_header := btrim(ip_from_header);
    end if;
  end if;
  if ip_from_header is null then
    ip_from_header := nullif(headers ->> 'x-real-ip', '');
  end if;
  if ip_from_header is null then
    ip_from_header := nullif(headers ->> 'cf-connecting-ip', '');
  end if;

  country_code_from_header :=
    coalesce(
      nullif(headers ->> 'x-vercel-ip-country', ''),
      nullif(headers ->> 'cf-ipcountry', ''),
      nullif(headers ->> 'x-country-code', '')
    );
  if country_code_from_header is not null then
    country_code_from_header := upper(country_code_from_header);
  end if;

  country_name_from_header :=
    coalesce(
      nullif(headers ->> 'x-vercel-ip-country-name', ''),
      nullif(headers ->> 'x-country-name', '')
    );

  region_from_header :=
    coalesce(
      nullif(headers ->> 'x-vercel-ip-country-region', ''),
      nullif(headers ->> 'x-region-name', ''),
      nullif(headers ->> 'x-region', '')
    );

  if (new.ip_address is null or btrim(new.ip_address) = '') and ip_from_header is not null then
    new.ip_address := ip_from_header;
  end if;
  if (new.country_code is null or btrim(new.country_code) = '') and country_code_from_header is not null then
    new.country_code := country_code_from_header;
  end if;
  if (new.country_name is null or btrim(new.country_name) = '') and country_name_from_header is not null then
    new.country_name := country_name_from_header;
  end if;
  if (new.region_name is null or btrim(new.region_name) = '') and region_from_header is not null then
    new.region_name := region_from_header;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_fill_site_session_geo_from_headers on audit.gr_site_sessions;

create trigger trg_fill_site_session_geo_from_headers
before insert or update on audit.gr_site_sessions
for each row
execute function audit.fill_site_session_geo_from_headers();
