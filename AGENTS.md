# AGENTS.md — Golfhópur SHS 2026

> Context file for AI agents and developers picking up this project.
> Last updated: 2026-08-16

## What this is

Golf tournament signup app for the SHS (Slökkvilið höfuðborgarsvæðisins) golf group.
5 rounds of golf over summer 2026. Players sign up per round. One admin page for
creating, editing, and removing rounds.

- **Owner:** Aki (server administrator, homelab: UniFi UCG Fiber, gerpi.org)
- **Production URL:** https://eldturinn.khalipa.net (custom domain on the
  golftour-claude Worker; workers.dev fallback: golftour-claude.workers.dev)
- **UI language:** Icelandic
- **Player source of truth:** `golfhopur-2026-uppfært-19_5_2026.xlsx` (58 players) + 2 added 2026-07-21: Ólafur Halldór Torfason (from CSV, gb 9-3907), Árni Oddsson (aka "Árni Odds" in GameBook, hcp 20, no gb id). DB now 60 players.

## Stack

| Layer    | Choice                                   |
|----------|------------------------------------------|
| Frontend | React 19 + Vite (SPA, hash routing — `#rounds` / `#standings` / `#admin`) |
| Database | Supabase (free tier, RLS locked down to authenticated writes) |
| Hosting  | **Cloudflare Workers (static assets only, no worker script)** via Workers Builds, repo-connected. Was Pages; converted 2026-07-21. |
| Auth     | Supabase Auth (email/password), admin-only. No custom API endpoints — `functions/` was removed in s11. |
| Styling  | Plain CSS, single `src/index.css`. No Tailwind. |

## File map

```
golftour-claude/
├── AGENTS.md              ← this file
├── README.md              ← human setup instructions (Icelandic)
├── supabase-setup.sql     ← one-shot schema + RLS + seed (58 players, 5 rounds)
├── migrations-001-handicap.sql ← handicap/golfbox_id columns for existing DBs
├── wrangler.jsonc         ← Workers static-assets config (no main worker script)
├── index.html             ← lang="is", theme #0e3b2e
├── .env.example           ← VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├── public/                ← favicon.svg, icons.svg (served as-is)
└── src/
    ├── main.jsx           ← entry
    ├── App.jsx            ← Shell, RoundsView, AdminView, AdminGate, hash routing, toast
    ├── PlayerCombobox.jsx ← searchable player selector (filter + keyboard nav)
    ├── PlayersAdmin.jsx   ← handicap/golfbox_id inline editing
    ├── ScoresAdmin.jsx    ← per-round score entry (signed-up players first)
    ├── Standings.jsx      ← tournament standings (best-3-of-5, leader crown)
    ├── supabase.js        ← client, exports { supabase, configured }
    ├── utils.js           ← friendlyError() + fmtHcp() shared helpers
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
- UI shows handicap ("Fgj.", Icelandic decimal comma) in combobox, selected-player
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
- UI: PlayersAdmin section on Stjórnun page — manual inline edit of
  handicap/golfbox_id (works today regardless of scraper), sync button with
  token field (token cached in localStorage), per-player failure report.

## Conventions

- Keep `App.jsx` under ~400 lines; split self-contained components into their
  own modules (e.g. `PlayerCombobox.jsx` was extracted at 468→397 lines).
- Icelandic for all user-facing strings; English for code/comments.
- Dates stored as `date`, times as `time`, formatted client-side (fmtDate/fmtTime).
- Player identity = localStorage `shs_player_id` (no auth by design). Cleared
  via "Hreinsa val" link which also removes the localStorage key.
- Navigation = hash routing (`#rounds` / `#standings` / `#admin`). Browser
  back/forward works; dirty admin form triggers confirmation on nav.
- Error messages mapped to plain Icelandic via `friendlyError()` (src/utils.js),
  never shown as raw Supabase/English strings.
- Past rounds auto-lock (isPast check), never deleted automatically.
- Past round cards at 0.75 opacity (WCAG AA contrast, was 0.6).
- Handicap abbreviation normalized to "Fgj." (with period) everywhere.
- Build must pass `npm run build` clean before delivering.

## Deploy recap (current state — live in production)

Supabase: schema is deployed (`supabase-setup.sql` + `migrations-001-handicap.sql`
both applied). Admin writes require Supabase Auth (email/password user created
in Dashboard -> Authentication); public sign-ups must stay disabled there.

Cloudflare Workers (static assets only, config-as-code in `wrangler.jsonc`,
repo-connected via Workers Builds):
- No worker script (`main`) — pure static asset serving, SPA fallback via
  `not_found_handling`. No secrets needed.
- Build variables (Workers Builds settings): `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`.
- Deploy command: `npx wrangler deploy`. Every push to `main` = production
  deploy — `npm run build` must pass clean first.
- Custom domain eldturinn.khalipa.net attached via Worker -> Settings ->
  Domains & Routes (workers.dev fallback also live).

For the historical Pages→Workers migration and the removed GolfBox
integration, see the Session log below.

## Open items

- Consider: further lock down admin route if the link leaks (currently gated
  by Supabase Auth login, which is sufficient today).

## Session log

- **2026-08-15 (s13):** UX heuristic evaluation (Nielsen/Krug). Audited all 3
  views, scored 7/10 (no severity-3+ issues; 5 failed diagnostic rows).
  Implemented 10 fixes in PR #1 (merged):
  1. Nav label "Hringir" → "Stjórnun" (was misleading — led to login wall)
  2. 60-player `<select>` → searchable combobox with keyboard nav (PlayerCombobox.jsx)
  3. Raw Supabase errors → plain Icelandic via friendlyError() (utils.js)
  4. Hash routing (#rounds/#standings/#admin) — browser back/forward now works
  5. Dirty-state warning on admin form (beforeunload + nav confirm + hashchange guard)
  6. Success toast on round/player/score saves
  7. Score entry: signed-up players sorted first with visual emphasis
  8. "fgj"/"Fgj" → "Fgj." normalized everywhere
  9. "Val þitt er geymt í vafranum" note + "Hreinsa val" link (clears localStorage)
  10. Past-card opacity 0.6 → 0.75 (WCAG AA contrast)
  Codex review found 3 P2 issues, all fixed in follow-up commit:
  - PlayerCombobox extracted to its own module (App.jsx 468→397 lines, under ~400 limit)
  - "Hreinsa val" now removes localStorage key (was only clearing React state)
  - hashchange handler guards dirty admin form (back button was bypassing confirmation)
  Verified: oxlint 0 warnings, build 65 modules, hermes verify all green.

- **2026-08-16 (s14):** Housekeeping. AGENTS.md rewritten: removed duplicate
  "Production URL" line, fixed file map (root folder name, added
  wrangler.jsonc/migrations-001-handicap.sql/public/ entries), corrected Stack
  table and Deploy recap to reflect the assets-only Worker (no `functions/`,
  no worker script — that setup was superseded in s11 and the doc still
  described it), collapsed the fully-stale "Next steps" list. Removed unused
  files: `src/assets/hero.png` (tracked, unreferenced anywhere in code, and
  had ballooned to 690KB uncommitted vs. its 13KB committed version),
  `src/assets/hero.png.bak` (untracked leftover), `src/assets/vite.svg`
  (default Vite scaffold logo, unreferenced). `src/assets/` is now empty.

- **2026-07-21 (s12):** Code review pass. Fixed: supabase-setup.sql drift
  (now includes scores table + auth RLS matching deployed migrations — fresh
  installs are correct again), README rewritten (was garbled/stale: dupe URL
  lines, said Pages, missed auth), PlayersAdmin NaN guard on handicap input.
  Verified clean: lint 0/0, build OK, auth flow, standings math, RLS usage.
  Known accepted trade-offs: anyone can delete anyone's signup (no-identity
  design), any authenticated user = admin (public sign-ups must stay off).

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
