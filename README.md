# Golfhópur SHS — Sumarið 2026

**Vefslóð:** https://eldturinn.khalipa.net

Skráningarapp fyrir 5 golfhringi sumarsins. React + Vite + Supabase, hýst á Cloudflare Pages.

## Uppsetning (einu sinni)

### 1. Supabase (frítt)
1. Búðu til verkefni á https://supabase.com (Free tier)
2. Opnaðu **SQL Editor** → límdu inn allt úr `supabase-setup.sql` → Run
   - Býr til töflurnar `players`, `rounds`, `signups`
   - Seedar alla 58 leikmenn úr Excel-skjalinu og 5 hringi sumarsins
3. Í **Project Settings → API**: afritaðu *Project URL* og *anon public key*

### 2. Cloudflare Pages
1. Push-aðu þessari möppu á GitHub repo
2. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git**
3. Build stillingar:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`
4. **Environment variables** (Production + Preview):
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon public key
5. Deploy — appið er í loftinu

### Keyra locally
```bash
cp .env.example .env   # fylltu inn Supabase gildin
npm install
npm run dev
```

## Notkun
- **Skráning**: leikmaður velur nafnið sitt (vistast í vafranum) og smellir „Skrá mig" / „Afskrá mig" á hverjum hring
- **Hringir**: ein síða til að búa til, breyta og eyða hringjum (titill, völlur, dagsetning, rástími, hámark, athugasemd)
- Hringir sem eru liðnir læsast sjálfkrafa
- Hámark leikmanna er valfrjálst — tómt = ótakmarkað

## Athugasemd um öryggi
RLS-reglurnar eru opnar (allir mega lesa/skrifa) — hentar fyrir lokaðan klúbbhóp þar sem slóðin er ekki opinber. Ef þú vilt læsa admin-síðunni má bæta Supabase Auth við seinna.
