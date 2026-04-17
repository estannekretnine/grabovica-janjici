-- Javno čitanje rodoslovnog stabla (samo podrazumevano stablo iz family_genealogy.sql).
-- Anon nema insert/update/delete na ovim tabelama; authenticated politike ostaju.

-- Isti UUID kao u insert into audit.gr_family_trees (id, ...)
-- '00000000-0000-0000-0000-000000000001'

drop policy if exists "gr_family_trees_select_anon_public_default" on audit.gr_family_trees;
create policy "gr_family_trees_select_anon_public_default"
  on audit.gr_family_trees for select
  to anon
  using (id = '00000000-0000-0000-0000-000000000001'::uuid);

drop policy if exists "gr_persons_select_anon_public_tree" on audit.gr_persons;
create policy "gr_persons_select_anon_public_tree"
  on audit.gr_persons for select
  to anon
  using (tree_id = '00000000-0000-0000-0000-000000000001'::uuid);

drop policy if exists "gr_parent_child_select_anon_public_tree" on audit.gr_parent_child;
create policy "gr_parent_child_select_anon_public_tree"
  on audit.gr_parent_child for select
  to anon
  using (
    exists (
      select 1
      from audit.gr_persons p
      where p.id = parent_person_id
        and p.tree_id = '00000000-0000-0000-0000-000000000001'::uuid
    )
    and exists (
      select 1
      from audit.gr_persons c
      where c.id = child_person_id
        and c.tree_id = '00000000-0000-0000-0000-000000000001'::uuid
    )
  );

drop policy if exists "gr_partnerships_select_anon_public_tree" on audit.gr_partnerships;
create policy "gr_partnerships_select_anon_public_tree"
  on audit.gr_partnerships for select
  to anon
  using (
    exists (
      select 1
      from audit.gr_persons a
      where a.id = person_a_id
        and a.tree_id = '00000000-0000-0000-0000-000000000001'::uuid
    )
    and exists (
      select 1
      from audit.gr_persons b
      where b.id = person_b_id
        and b.tree_id = '00000000-0000-0000-0000-000000000001'::uuid
    )
  );

drop policy if exists "gr_aktivnosti_select_anon_public_tree" on audit.gr_aktivnosti;
create policy "gr_aktivnosti_select_anon_public_tree"
  on audit.gr_aktivnosti for select
  to anon
  using (
    exists (
      select 1
      from audit.gr_persons p
      where p.id = person_id
        and p.tree_id = '00000000-0000-0000-0000-000000000001'::uuid
    )
  );
