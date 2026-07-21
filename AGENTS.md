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
- **Player source of truth:** `golfhopur-2026-uppfært-19_5_2026.xlsx` (58 players, name + position)

## Stack

| Layer    | Choice                                   |
|----------|------------------------------------------|
| Frontend | React 19 + Vite (SPA, no router — view state toggle) |
| Database | Supabase (free tier, RLS with open policies) |
| Hosting  | **Cloudflare Pages** (NOT Vercel — user corrected this early) |
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
- RLS enabled on all tables, policies are fully open (read+write for anon).
  Acceptable for private club link; Supabase Auth is the upgrade path if admin
  page needs locking.

## ✅ Schema change DONE (2026-07-21)

Players table now has `handicap numeric(4,1)` and `golfbox_id text`.
- New installs: in `supabase-setup.sql`
- Existing DBs: run `migrations-001-handicap.sql`
- UI shows handicap ("fgj", Icelandic decimal comma) in dropdown, selected-player
  badge, and round rosters. Null handicap = hidden, no placeholder.

## 🔴 OPEN TODO: Golfbox / GSÍ handicap integration

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
- CF Pages secrets needed: GOLFBOX_USER, GOLFBOX_PASS, SYNC_TOKEN,
  SUPABASE_URL, SUPABASE_SERVICE_KEY. Never VITE_*.
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

NOTE: Cloudflare now recommends Workers static assets for NEW projects and
provides a Pages->Workers migration path (MCP tool
migrate_pages_to_workers_guide exists). Staying on Pages deliberately:
functions/ file-routing is Pages-native and fully supported. Revisit only if
Pages deprecation is announced.

## Next steps

1. User: create Pages project in dashboard (see Deploy recap), set secrets,
   attach custom domain eldturinn.khalipa.net (Custom domains tab; CNAME
   auto-created if khalipa.net zone is in same CF account)
2. User: run migrations-001 in Supabase; ROTATE the GitHub PAT (was pasted in chat)
3. First live sync run -> read failure diagnostics -> fix functions/lib/golfbox.js
4. Consider: lock admin page (Supabase Auth) if link leaks

## Session log

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
