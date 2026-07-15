---
name: github-golf-signup
description: GitHub and git workflow for Aki's golf-signup project (Golfhópur SHS 2026). Use whenever the task involves committing, pushing, branching, or releasing this project, or resuming work on it in a fresh session. Covers repo conventions, commit style, what never to commit, and how to push from the Claude sandbox with a user-provided token.
---

# GitHub workflow — golf-signup (Golfhópur SHS 2026)

## First step in any session

Read `AGENTS.md` in the repo root. It holds current schema, pending changes,
and open TODOs. Update its Session log before the final commit of a session.

## Repo state

- Local git repo lives at project root; default branch: `main`.
- Remote: GitHub, repo URL provided by Aki (not yet configured — ask if absent:
  `git remote -v`).
- Sandbox network allows `github.com` and `api.github.com`, so push works with
  an HTTPS token remote.

## Pushing with a user-provided token

Never echo or commit the token. Use it inline, then it stays only in the
remote URL of the local sandbox (which is discarded):

```bash
git remote add origin https://<TOKEN>@github.com/<user>/<repo>.git  # or set-url
git push -u origin main
```

Prefer fine-grained PAT scoped to this single repo, contents:read/write.

## Commit conventions

- Imperative, concise subject: `Add handicap column to players schema`
- Group related changes; never mix schema, UI, and docs in one commit if
  avoidable.
- Update `AGENTS.md` session log in the last commit of every session.

## Never commit

- `.env` (gitignored — verify before every commit: `git status --ignored`)
- `node_modules/`, `dist/` (gitignored)
- Any GolfBox/GSÍ credentials, tokens, or kennitölur beyond what the public
  player list already contains. Secrets belong in Cloudflare Pages /
  Supabase secret stores only.

## Deploy linkage

Cloudflare Pages auto-deploys from `main` once connected. A push to `main`
is therefore a production deploy — build must pass `npm run build` locally
first, every time.

## Verify before ending a session

```bash
npm run build          # must be clean
git status             # nothing untracked that should be tracked
git log --oneline -5   # commits look sane
```
