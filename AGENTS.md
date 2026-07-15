# AGENTS.md — Golfhópur SHS 2026

> Context file for AI agents and developers picking up this project.
> Last updated: 2026-07-15

## What this is

Golf tournament signup app for the SHS (Slökkvilið höfuðborgarsvæðisins) golf group.
5 rounds of golf over summer 2026. Players sign up per round. One admin page for
creating, editing, and removing rounds.

- **Owner:** Aki (server administrator, homelab: UniFi UCG Fiber, gerpi.org)
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

## ⚠️ PENDING schema change (agreed, NOT yet implemented)

Players table must gain:

```sql
alter table players add column handicap numeric(4,1);
alter table players add column golfbox_id text;
```

Reflect these in: `supabase-setup.sql`, the player dropdown/roster UI in
`App.jsx` (show handicap next to name), and possibly a players admin section.

## 🔴 OPEN TODO: Golfbox / GSÍ handicap integration

User wants handicaps fetched from the Icelandic Golf Association via
**golfbox.dk** (GSÍ uses GolfBox as its national system). User can provide
credentials.

**Blocked on user answers (asked, not yet answered):**
1. Sync frequency — automatic (nightly/on-load) vs manual "refresh" button?
2. Does user already have each player's GolfBox ID, or must players be looked
   up by name first?
3. Credential type — personal golfbox.dk login vs club-admin/API credentials?

**Implementation notes for whoever picks this up:**
- GolfBox has no public REST API for handicaps; options to research: GolfBox
  Portal/API partner access, scraping the logged-in golfbox.dk/golf.is pages,
  or the golf.is public player search.
- Credentials must NEVER live in frontend env vars (VITE_* is public in the
  bundle). Any authenticated fetch belongs server-side: Supabase Edge Function
  or Cloudflare Pages Function, with secrets in that platform's secret store.
- Suggested design: scheduled Edge Function (pg_cron / Cloudflare cron
  trigger) that logs in, pulls handicaps by golfbox_id, updates players table.
- Do research on current GolfBox integration options before building — this
  changes; verify against 2026 reality.

## Conventions

- Keep everything in `App.jsx` unless it grows past ~400 lines; then split.
- Icelandic for all user-facing strings; English for code/comments.
- Dates stored as `date`, times as `time`, formatted client-side (fmtDate/fmtTime).
- Player identity = localStorage `shs_player_id` (no auth by design).
- Past rounds auto-lock (isPast check), never deleted automatically.
- Build must pass `npm run build` clean before delivering.

## Deploy recap

Supabase: run `supabase-setup.sql` once in SQL Editor.
Cloudflare Pages: connect GitHub repo, Vite preset, output `dist`, set
`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` env vars.

## Session log

- **2026-07-15 (s1):** Misread brief as EMS training app; corrected. Built full
  signup app from Excel (58 players), schema, seed SQL, Icelandic UI, delivered
  zip. Design: fairway green / cream / flag red, Archivo display type.
- **2026-07-15 (s2):** User requested handicap + golfbox_id columns and GSÍ
  handicap fetch. Clarifying questions asked (see OPEN TODO). AGENTS.md created,
  git repo initialized, committed locally. GitHub push pending user repo/token.
