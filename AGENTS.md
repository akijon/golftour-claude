# AGENTS.md — Golfhópur SHS 2026

> Context file for AI agents and developers picking up this project.
> Last updated: 2026-07-15

## What this is

Golf tournament signup app for the SHS (Slökkvilið höfuðborgarsvæðisins) golf group.
5 rounds of golf over summer 2026. Players sign up per round. One admin page for
creating, editing, and removing rounds.

- **Owner:** Aki (server administrator, homelab: UniFi UCG Fiber, gerpi.org)
- **Production URL:** https://eldturinn.khalipa.net (custom domain on the
  golftour-claude Pages project; pages.dev fallback: golftour-claude.pages.dev)
- **UI language:** Icelandic
- **Production URL:** https://eldturinn.khalipa.net (Pages custom domain; pages.dev name: golftour-claude)
- **Player source of truth:** `golfhopur-2026-uppfært-19_5_2026.xlsx` (58 players) + 2 added 2026-07-21: Ólafur Halldór Torfason (from CSV, gb 9-3907), Árni Oddsson (aka "Árni Odds" in GameBook, hcp 20, no gb id). DB now 60 players.

## Stack

| Layer    | Choice                                   |
|----------|------------------------------------------|
| Frontend | React 19 + Vite (SPA, no router — view state toggle) |
| Database | Supabase (free tier, RLS with open policies) |
| Hosting  | **Cloudflare Workers (static assets)** via Workers Builds, repo-connected. Was Pages; converted 2026-07-21 after repo got connected as a Workers project and `wrangler deploy` failed. |
| Styling  | Plain CSS, single `src/index.css`. No Tailwind. |

## File map

```
golf-signup/
├── AGENTS.md              ← this file
├── README.md              ← human setup instructions (Icelandic)
├── supabase-setup.sql     ← one-shot schema + RLS + seed (58 players, 5 rounds)
├── index.html             ← lang="is", theme #0e3b2e
├── .env.example           ← VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
└── src/
    ├── main.jsx           ← entry
    ├── App.jsx            ← ALL components: Shell, RoundsView, AdminView, SetupNotice
    ├── supabase.js        ← client, exports { supabase, configured }
    ├── players.json       ← extracted player seed data from Excel
    └── index.css          ← full design system
```

## Database schema (current, deployed via supabase-setup.sql)

- `players(id, name unique, position, active, created_at)`
- `rounds(id, title, course, round_date, tee_time, max_players nullable, notes, created_at)`
- `signups(id, round_id fk cascade, player_id fk cascade, created_at, unique(round_id, player_id))`
- `scores(id, round_id fk, player_id fk, points int >=0, position int null, unique(round_id, player_id))`
  Tournament rule: winner = highest SUM OF BEST 3 round scores (of 5), Stableford.
  Tiebreak in UI: best single round. Migration: scores_table_and_round2_hella.
- RLS (since migration auth_rls_lockdown, 2026-07-21):
  READS public on all tables. signups INSERT+DELETE public (self-signup by
  design, no accounts). players/rounds/scores WRITES require Supabase Auth
  (role authenticated). Admin login = email/password user created in
  Supabase Dashboard -> Authentication. IMPORTANT: public signups must be
  DISABLED in Supabase Auth settings, else anyone can register and gain
  write access.

## ✅ Schema change DONE (2026-07-21)

Players table now has `handicap numeric(4,1)` and `golfbox_id text`.
- New installs: in `supabase-setup.sql`
- Existing DBs: run `migrations-001-handicap.sql`
- UI shows handicap ("fgj", Icelandic decimal comma) in dropdown, selected-player
  badge, and round rosters. Null handicap = hidden, no placeholder.

## ❌ REMOVED (2026-07-21): Golfbox / GSÍ handicap integration

Scraper adapter never worked reliably against real GolfBox; user ordered
removal. Handicap + golfbox_id columns and manual editing in PlayersAdmin
REMAIN. Handicaps maintained via CSV imports or manual edits. If revisited,
history below still applies.

## (historical) Golfbox / GSÍ handicap integration

User wants handicaps fetched from the Icelandic Golf Association via
**golfbox.dk** (GSÍ uses GolfBox as its national system). User can provide
credentials.

**User answers (2026-07-21):**
1. Sync frequency: **MANUAL** — a "refresh handicaps" action, no cron needed.
2. GolfBox IDs: **not known** — look players up **by name** on GolfBox/golf.is,
   store resulting golfbox_id, then fetch handicap by id on refresh.
3. Credentials: **personal golfbox.dk login** (not API/club-admin). User will
   provide when integration is built. Personal login → almost certainly a
   scraping/session approach, must run server-side (Supabase Edge Function or
   Cloudflare Pages Function), secrets in platform secret store only.

**Research findings (2026-07-21, web):**
- GolfBox Vendor/member-lookup APIs are union/partner-only (GSÍ is a union
  customer); no personal-account API exists. Official API route: dead end.
- Iceland login paths: classic ASP portal at golfbox.dk (/portal, /site —
  still live, Icelandic supported) and new golfbox.golf SPA using AUTH0
  (GolfBoxAS forked auth0-spa-js) — Auth0 makes headless login on the new
  path painful; classic portal is the pragmatic target.
- Logged-in members can search players by name+club ("golfvinir" search) and
  see handicaps -> confirms name-lookup approach with personal creds.
- Public endpoints: only tournament scoring widgets (scores.golfbox.dk); no
  handicap lookup.

**Implementation (2026-07-21) — built, NOT yet live-verified:**
- `functions/api/sync-handicaps.js` — Cloudflare Pages Function, POST,
  requires `X-Sync-Token` == env SYNC_TOKEN. Logs into GolfBox, iterates
  active players, searches by name, PATCHes handicap/golfbox_id via Supabase
  REST with service-role key. 400ms delay between lookups.
- `functions/lib/golfbox.js` — isolated adapter (login, search, parse).
  ⚠️ UNVERIFIED: endpoints/regexes are best-effort; first authenticated run
  will 502 with diagnostics if wrong. Fix ONLY this file when that happens.
- (obsolete) secrets GOLFBOX_USER/GOLFBOX_PASS/SYNC_TOKEN/SUPABASE_URL/
  SUPABASE_SERVICE_KEY can be DELETED from the Worker. New secret: ADMIN_PIN.
- UI: PlayersAdmin section on Hringir page — manual inline edit of
  handicap/golfbox_id (works today regardless of scraper), sync button with
  token field (token cached in localStorage), per-player failure report.

## Conventions

- Keep everything in `App.jsx` unless it grows past ~400 lines; then split.
- Icelandic for all user-facing strings; English for code/comments.
- Dates stored as `date`, times as `time`, formatted client-side (fmtDate/fmtTime).
- Player identity = localStorage `shs_player_id` (no auth by design).
- Past rounds auto-lock (isPast check), never deleted automatically.
- Build must pass `npm run build` clean before delivering.

## Deploy recap

Supabase: run `supabase-setup.sql` once in SQL Editor (existing DBs: also
`migrations-001-handicap.sql`).

Cloudflare Pages (config-as-code in `wrangler.toml`; project creation is
dashboard-only — the account's bindings MCP has no Pages tools, verified
2026-07-21):
1. dash.cloudflare.com -> Workers & Pages -> Create -> Pages -> Connect to Git
   -> akijon/golftour-claude. Build command `npm run build`; output dir comes
   from wrangler.toml (`./dist`), name `golftour-claude`.
2. Settings -> Variables and Secrets:
   Secrets (Prod+Preview): GOLFBOX_USER, GOLFBOX_PASS, SYNC_TOKEN,
   SUPABASE_URL, SUPABASE_SERVICE_KEY
   Plaintext: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
3. Every push to main = production deploy. functions/ dir auto-becomes Pages
   Functions (/api/sync-handicaps).

CONVERTED to Workers static assets (2026-07-21, per CF migration guide):
- wrangler.jsonc: main ./dist/_worker.js/index.js, assets ./dist with ASSETS
  binding, SPA not_found_handling, run_worker_first ["/api/*"]
- functions/ dir KEPT as source; build compiles it:
  `vite build && wrangler pages functions build --outdir=./dist/_worker.js/`
- public/.assetsignore excludes _worker.js from served assets
- Deploy command in Workers Builds: `npx wrangler deploy` (now valid)
- Secrets: same five names, now under the WORKER's Settings -> Variables and
  Secrets. VITE_* as Workers Builds build variables.
- Custom domain eldturinn.khalipa.net: Worker -> Settings -> Domains & Routes
  -> Add -> Custom Domain (CNAME/cert automatic if zone in account).

## Next steps

1. User: create Pages project in dashboard (see Deploy recap), set secrets,
   attach custom domain eldturinn.khalipa.net (CNAME auto if khalipa.net zone
   is in same CF account; else manual CNAME -> golftour-claude.pages.dev).
   ALT: user adds https://mcp.cloudflare.com/mcp as custom connector in
   claude.ai -> may expose Pages/DNS tools so agent can do this itself.,
   attach custom domain eldturinn.khalipa.net (Custom domains tab; CNAME
   auto-created if khalipa.net zone is in same CF account)
2. User: run migrations-001 in Supabase; ROTATE the GitHub PAT (was pasted in chat)
3. First live sync run -> read failure diagnostics -> fix functions/lib/golfbox.js
4. Consider: lock admin page (Supabase Auth) if link leaks

## Session log

- **2026-07-21 (s11):** REAL auth: migration auth_rls_lockdown (writes on
  players/rounds/scores -> authenticated only; reads + signup insert/delete
  stay public). AdminGate rewritten to Supabase Auth email/password
  (signInWithPassword, session via onAuthStateChange, logout in admin bar).
  /api/admin-login DELETED; functions/ gone; wrangler.jsonc now assets-only
  (no main worker, no run_worker_first); build back to plain `vite build`.
  No Worker secrets needed at all. USER MUST: 1) Supabase Dashboard ->
  Authentication -> Add user (email+pw), 2) disable public signups in Auth
  providers settings, 3) may delete ADMIN_PIN + all other Worker secrets.

- **2026-07-21 (s10):** GolfBox integration REMOVED (functions/api/
  sync-handicaps.js, functions/lib/golfbox.js, sync UI). Added admin gate:
  functions/api/admin-login.js (POST, checks ADMIN_PIN Worker secret,
  explicit CORS + OPTIONS preflight), AdminGate component wraps Hringir view,
  unlock stored in sessionStorage per tab. (Superseded by s11 same day.)

- **2026-07-21 (s9):** All three played rounds now fully scored from GameBook
  screenshots: H1 "Moooosó" Hlíðavöllur/GM 23 scores (course corrected from
  Grafarholt), H2 Hella positions 1-8 added (now 25 complete), H3 "Kef"
  Hólmsvöllur/GS 13 scores (course corrected from Keilir). New aliases:
  Oliver Oliver=Óliver Ormar, Jón Júlíus Haraldsson=Jón Haraldsson, Larus=
  Lárus Petersen, Thorir Jonasson=Þórir Karl (ASSUMED), Sævar Hafsteinsson=
  Sævar Ö H (ASSUMED - verify with user), Jón Trausti=Jón Trausti Gylfason.
  Standings after 3 rounds: Gylfi Dagur 106 leads, Guðjón Ingason 101,
  Þorsteinn 100, Finnur 99.

- **2026-07-21 (s8):** User-provided merged CSV (Name,GolfboxID,Handicap,Sex)
  applied via MCP: all 58 players got handicap; 35 got real golfbox_id.
  Placeholder IDs "11111"/"1111" SKIPPED (not written). hcp 24.0 = club
  default for unknowns (28.0 Jóhanna). CSV aliases: Viktor Rúnar=Viktor
  retireee, Kristmundur Carter=Carter, Sigurjón Ingi Sveinsson=Sigurjón Ingi.
  UNRESOLVED: duplicate golfbox_ids in CSV written as-is, user must fix one
  of each pair: 9-386 (Árni Sig/Bjarni Ingim), 1-1453 (Jón H./Jón Reynir),
  1-1401 (Svavar/Sævar Sigf), 2-1285 (Sævar Dór/Ævar Örn).
  RESOLVED later same day: Ólafur Halldór Torfason added (id 59); Árni Oddsson
  added (id 60) = GameBook "Árni Odds", his round-2 score (15 pts, pos 21)
  inserted. Round 2 now complete for positions 9-25; POSITIONS 1-8 STILL
  MISSING from screenshots.

- **2026-07-21 (s7):** Round 2 (Hella, GK Hellu — course corrected from Korpa)
  scores entered from Golf GameBook screenshots: 16 players matched+inserted,
  positions 9-25. MISSING: positions 1-8 (screenshots didn't include) and
  "Árni Odds" (15 pts, pos 21) unmatched to any DB player — ask user. Built:
  scores table, Stigatafla view (best-3-of-5 totals, counted rounds
  highlighted, leader crowned), ScoresAdmin (per-round entry, empty=delete).
  GameBook name aliases used for matching: Oliver O=Óliver Ormar, Magnús
  Kristófersson=Magnús Jón K., Jón Heiðar=Jón H., Eyjó Tómasson=Eyjólfur
  Tómedic, Kristófer Beck=Bekk, erling hugi másson=Erling Hugi, Johanna
  Johannsdottir=Jóhanna Guðrún, Viktor Sigursson=Viktor retireee,
  Sigurjón Ingi Sveinsson=Sigurjón Ingi.

- **2026-07-21 (s6):** Supabase connector re-scoped by user; project
  mupdltouvvagdwhgumry ("eldturinn app", eu-west-1) now accessible. Applied
  tracked migration initial_schema_rls_and_seed via MCP: verified 58 players
  (handicap+golfbox_id present), 5 rounds, RLS on. supabase-setup.sql now
  matches deployed state; DB uses new-format keys (sb_publishable_/sb_secret_).
  VITE vars confirmed to user for Workers Builds settings.

- **2026-07-21 (s5):** Ya/ legacy folder removed. Pushed all commits to GitHub
  (PAT used inline, scrubbed after; user told to rotate). Cloudflare MCP
  connector enabled + verified (workers_list OK; no Pages tools). Fetched CF
  agent-setup doc (targets Claude Code/local agents; N/A in chat UI). Docs
  research: Workers static assets is CF's new-project recommendation; staying
  on Pages. Added wrangler.toml (Pages config-as-code).

- **2026-07-15 (s1):** Misread brief as EMS training app; corrected. Built full
  signup app from Excel (58 players), schema, seed SQL, Icelandic UI, delivered
  zip. Design: fairway green / cream / flag red, Archivo display type.
- **2026-07-21 (s4):** Researched GolfBox integration (no personal API; Auth0
  on new login; classic portal viable). Built CF Pages Function sync endpoint +
  adapter + PlayersAdmin UI with manual editing fallback. Adapter unverified
  until first run with real creds.
- **2026-07-21 (s3):** Handicap + golfbox_id columns added (schema, migration,
  UI). GitHub remote known: https://github.com/akijon/golftour-claude — push
  pending PAT from user. GolfBox questions answered; integration still TODO.
- **2026-07-15 (s2):** User requested handicap + golfbox_id columns and GSÍ
  handicap fetch. Clarifying questions asked (see OPEN TODO). AGENTS.md created,
  git repo initialized, committed locally. GitHub push pending user repo/token.
