# Admin panel — članovi porodice

React (Vite) + Supabase klijent za unos i ažuriranje osoba, roditelj–dete i partnerskih veza.

## Podešavanje

1. U Supabase projektu pokrenite SQL migraciju iz korena repozitorijuma (vidi glavni [`README.md`](../README.md)).
2. U **Authentication** uključite email/lozinku i kreirajte korisnika za admina.
3. U **Project Settings → API → Exposed schemas** uključite šemu **`audit`** (potrebno za `supabase.schema("audit")` u kodu).
4. U `admin` folderu:

```bash
npm install
```

5. Kopirajte `.env.example` u `.env` i unesite URL i **anon** ključ (Project Settings → API).

```bash
cp .env.example .env
```

6. Pokretanje:

```bash
npm run dev
```

Otvorite prikazani URL, prijavite se, zatim koristite **Članovi**, **Veze** i **Stabla**.

## Napomene

- RLS dozvoljava pristup samo ulogovanim korisnicima; anon ključ bez sesije neće moći da čita tabele.
- Nova osoba u podrazumevanom stablu koristi `tree_id` iz baze (default u migraciji) ako ne menjate stablo u padajućoj listi.
- Tabele su u šemi **`audit`** sa prefiksom **`gr_`** (npr. `audit.gr_persons`); u kodu se koristi `audit` klijent iz [`src/lib/supabase.ts`](src/lib/supabase.ts).
