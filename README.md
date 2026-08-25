# Golfhópur SHS — Eldtúrinn 2026

**Vefslóð:** https://eldtur.khalipa.net

Skráningar- og stigakerfi fyrir 5 golfhringi sumarsins. React + Vite + Supabase,
hýst sem Cloudflare Worker (static assets), auto-deploy frá `main`.

## Síður
- **Skráning** (opið): leikmaður velur nafnið sitt í leitarboxi (vistast í
  vafranum) og skráir sig / afskráir á hringi. Forgjöf birtist við nöfn.
  „Hreinsa val“ hreinsar valið úr vafranum.
- **Stigatafla** (opið): mótsstaðan — samtals = besti árangur úr 3 hringjum
  af 5 (Stableford). Talin stig eru merkt, efsti fær 🏆.
- **Stjórnun** (læst, stjórnandahlutverk í Supabase): búa til/breyta/eyða
  hringjum, skrá stig, stjórna hópum, leikmönnum og kerfisstillingum. Skráðir
  leikmenn birtast efst í stigaskráningu. Óvistaðar breytingar vara við fyrir
  yfirför.

## Uppsetning frá grunni
1. **Supabase**: nýtt verkefni → SQL Editor → keyra `supabase-setup.sql`.
   Skráin inniheldur allt núverandi schema, RLS, stjórnandahlutverk, RPC föll,
   audit log og seed (58 leikmenn + 5 hringir; núverandi gagnagrunnur er með
   60 leikmenn). Fyrir eldra schema skal keyra `migrations-001-handicap.sql`,
   `migrations-002-admin.sql`, `migrations-003-player-crud.sql` og
   `migrations-004-admin-policy-hardening.sql` í þeirri röð.
2. **Supabase Auth**: Authentication → Add user (netfang+lykilorð fyrir
   stjórnanda), **slökkva á public sign-ups**, og keyra svo kommentuðu
   `insert into user_roles ...` skipunina neðst í `supabase-setup.sql` með
   réttu netfangi. Aðeins notendur með `admin` hlutverk fá skrifréttindi.
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
