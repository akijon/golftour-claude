# Golfhópur SHS — Eldtúrinn 2026

**Vefslóð:** https://eldturinn.khalipa.net

Skráningar- og stigakerfi fyrir 5 golfhringi sumarsins. React + Vite + Supabase,
hýst sem Cloudflare Worker (static assets), auto-deploy frá `main`.

## Síður
- **Skráning** (opið): leikmaður velur nafnið sitt í leitarboxi (vistast í
  vafranum) og skráir sig / afskráir á hringi. Forgjöf birtist við nöfn.
  „Hreinsa val“ hreinsar valið úr vafranum.
- **Stigatafla** (opið): mótsstaðan — samtals = besti árangur úr 3 hringjum
  af 5 (Stableford). Talin stig eru merkt, efsti fær 🏆.
- **Stjórnun** (læst, Supabase Auth): búa til/breyta/eyða hringjum, skrá stig
  eftir hring, breyta forgjöf og GolfBox ID leikmanna. Skráðir leikmenn
  birtast efst í stigaskráningu. Óvistaðar breytingar vara við fyrir yfirför.

## Uppsetning frá grunni
1. **Supabase**: nýtt verkefni → SQL Editor → keyra `supabase-setup.sql`
   (töflur `players`/`rounds`/`signups`/`scores`, RLS, seed: 58 leikmenn +
   5 hringir — núverandi gagnagrunnur er með 60 leikmenn).
2. **Supabase Auth**: Authentication → Add user (netfang+lykilorð fyrir
   stjórnanda) og **slökkva á public sign-ups** — allir innskráðir notendur
   fá skrifréttindi.
3. **Cloudflare**: tengja GitHub repo sem Workers Builds verkefni.
   Build command `npm run build`, deploy `npx wrangler deploy`
   (stillingar í `wrangler.jsonc`). Build variables:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Engin secrets.
4. Custom domain: Worker → Settings → Domains & Routes.

## Keyra locally
```bash
cp .env.example .env   # fylltu inn Supabase gildin
npm install
npm run dev
```

## Reglur
- Liðnir hringir læsast sjálfkrafa á Skráningu
- Hámark leikmanna er valfrjálst — tómt = ótakmarkað
- Sigurvegari móts: hæsta samtala af 3 bestu hringjum af 5
