-- Kontakt polja za osobe u genealogiji
alter table audit.gr_persons
  add column if not exists email text,
  add column if not exists mob1 text,
  add column if not exists mob2 text;
