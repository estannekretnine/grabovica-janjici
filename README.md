# Grabovica Janjići — porodično stablo

## Povezivanje sa GitHubom (prvi push)

Nakon što na GitHubu postoji repozitorijum **`grabovica-janjici`** (pod tvojim nalogom ili organizacijom), u korenu ovog foldera:

```powershell
git remote add origin https://github.com/TVOJ_NALOG/grabovica-janjici.git
git push -u origin main
```

Zameni `TVOJ_NALOG` tačnim korisničkim imenom ili organizacijom iz URL-a u browseru. Ako `origin` već postoji sa pogrešnim URL-om: `git remote set-url origin https://github.com/.../grabovica-janjici.git`.

Alternativa (PowerShell): [`scripts/push-to-github.ps1`](scripts/push-to-github.ps1) — `.\scripts\push-to-github.ps1 -Owner tvoj_github_nalog`

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

## Deploy na Vercel (povezivanje sa Gitom)

1. **Git na GitHubu (ili GitLab / Bitbucket)**  
   Repozitorijum mora biti na udaljenom originu (npr. `git push -u origin main`). Vercel se veže za taj remote.

2. **Novi projekat na Vercelu**  
   - Ulogujte se na [vercel.com](https://vercel.com) → **Add New…** → **Project**.  
   - **Import** odabranog Git repozitorijuma (dozvolite Vercelu pristup nalogu ako traži).

3. **Podešavanje builda (monorepo)**  
   Vite aplikacija je u **`admin/`**. Možeš na jedan od dva načina:  
   - **A)** Ostavi **Root Directory** prazan (koren repozitorijuma) — u korenu postoji [`vercel.json`](vercel.json) koji gradi `admin/` i izlaz stavlja u `admin/dist` (ovo rešava uobičajeni **404** ako ranije nisi podešavao `admin`).  
   - **B)** **Root Directory** = `admin` — onda Vercel koristi samo `admin/` (Build: `npm run build`, Output: `dist`).

4. **Environment Variables** (Settings → Environment Variables), za **Production** (i po želji Preview):  
   - `VITE_SUPABASE_URL` — URL projekta iz Supabase  
   - `VITE_SUPABASE_ANON_KEY` — anon javni ključ  

   Posle dodavanja varijabli pokrenite **Redeploy** da build uključi `.env` vrednosti u Vite.

5. **SPA rute**  
   U [`admin/vercel.json`](admin/vercel.json) je podešen rewrite na `index.html` da osvežavanje stranica tipa `/persons` ne vrati 404.

## Admin panel

Pogledajte [`admin/README.md`](admin/README.md).
