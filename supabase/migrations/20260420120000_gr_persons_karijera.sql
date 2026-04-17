-- Biografija / karijera (slobodan tekst)
alter table audit.gr_persons
  add column if not exists karijera text;
