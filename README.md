# Grabovica Janjići — porodično stablo

## Baza (Supabase)

1. U Supabase Dashboard otvorite **SQL Editor**.
2. Nalepite sadržaj migracije iz [`supabase/migrations/20260416120000_family_genealogy.sql`](supabase/migrations/20260416120000_family_genealogy.sql) i pokrenite ga jednom.

Ili lokalno sa [Supabase CLI](https://supabase.com/docs/guides/cli): `supabase db push` (ako je projekat povezan sa remoteom).

Ako ste ranije već pokrenuli stariju migraciju **bez** prefiksa `gr_`, ova nova verzija neće automatski preimenovati postojeće tabele — potrebno je ručno obrisati stare objekte (pa ponovo pokrenuti SQL) ili dodati posebnu migraciju sa `ALTER TABLE ... RENAME TO ...`.

### Odluka o opsegu stabla

Tabele su u PostgreSQL šemi **`audit`**, sa prefiksom **`gr_`**: `audit.gr_family_trees`, `audit.gr_persons`, `audit.gr_parent_child`, `audit.gr_partnerships`. Podrazumevano stablo ima `id` = `00000000-0000-0000-0000-000000000001` (slug `default`). Nova osoba dobija `tree_id` po defaultu ako ga ne prosledite.

U Supabase Dashboard: **Project Settings → API → Exposed schemas** dodajte `audit` (pored `public`), inače REST klijent neće videti ove tabele.

### Autentifikacija

RLS dozvoljava **samo ulogovane** korisnike (`authenticated`). U **Authentication** kreirajte korisnika za admin pristup, zatim se prijavite u admin panelu.

## Admin panel

Pogledajte [`admin/README.md`](admin/README.md).
