-- Veza osobe sa šifrarnikom fakulteta (opciono).

alter table audit.gr_persons
  add column if not exists fakultetid bigint
    references public.fakultet (id) on delete restrict;

create index if not exists gr_persons_fakultetid_idx
  on audit.gr_persons (fakultetid);
