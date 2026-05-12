# Tech Competition Scoring Platform

Internal scoring and operations web app for technology competitions, with separate experiences for `admin`, `judge`, and `team`.

## Stack

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 4
- Prisma ORM
- NextAuth credentials login
- SQLite demo datasource (default), PostgreSQL-ready schema

## Core Workflow

1. Admin creates a competition.
2. Admin selects a competition and creates categories under it.
3. Admin creates scoring criteria under each category, with active criteria weight totaling exactly `100%`.
4. Team selects competition + category and submits project data.
5. Admin approves submission.
6. Judge selects competition + category + team and submits scores.

## Current Feature Set

### Admin

- Competition management (multi-competition setup)
- Category management scoped by selected competition
- Criterion management scoped by selected category
- Server-side weight guard for active criteria (`<= 100%`, scoring requires exactly `100%`)
- Team management with competition/category linkage
- Account management for Admin / Judge / Team
- Comments review with filters
- Leaderboard with:
  - overall ranking
  - per-category ranking
  - per-judge score cards
  - criterion-level score breakdown and comments
- CSV export endpoints for results/comments

### Judge

- Can access approved works across competitions (subject to judge visibility settings)
- Competition/category filtering in team list
- Scoring form with:
  - criterion numeric input with range validation
  - criterion comment
  - overall judge comment
  - draft save and final submit
  - edit-after-submit behavior from admin setting
- Navigation between previous/next team
- Completion progress indicators

### Team

- Submission form with competition + category selection
- Draft save and submit for approval
- Approval lifecycle: `DRAFT` -> `PENDING` -> `APPROVED` / `REJECTED`
- Review status page with judge activity and averages

### UX / Localization

- English/Chinese language toggle
- Role-based protected navigation and route middleware
- Judge score card blocks support horizontal drag/scroll and detail modal
- Score-card color gradient reflects low/mid/high score bands

## SQLite Concurrency Protection

The app includes lock mitigation for concurrent judge writes:

- SQLite `WAL` mode enabled at runtime
- `busy_timeout` configured at runtime
- Automatic write retry with backoff for lock/timeout-like errors

Implementation:

- `src/lib/prisma.ts` (`ensureSqlitePragmas`)
- `src/lib/sqlite-write-retry.ts` (`withSqliteWriteRetry`)
- Applied in write-heavy actions:
  - `src/actions/scoring.ts`
  - `src/actions/team.ts`

Configurable env vars:

- `SQLITE_BUSY_TIMEOUT_MS` (default `5000`)
- `SQLITE_WRITE_RETRIES` (default `3`)
- `SQLITE_WRITE_RETRY_DELAYS_MS` (default `300,700,1200`)

## Project Structure

```text
prisma/
  schema.prisma
  init.sql
  seed.ts
src/
  actions/
    auth.ts
    scoring.ts
    team.ts
  app/
    (auth)/login
    (protected)/admin
    (protected)/judge
    (protected)/team
    api/auth/[...nextauth]
    api/export/results
    api/export/comments
  components/
    admin/
    auth/
    i18n/
    judge/
    layout/
    shared/
    team/
  lib/
    data.ts
    i18n.ts
    i18n-server.ts
    prisma.ts
    sqlite-write-retry.ts
    utils.ts
    validators.ts
  auth.ts
middleware.ts
```

## Main Routes

- `/login`
- `/admin`
- `/admin/teams`
- `/admin/comments`
- `/admin/leaderboard`
- `/admin/settings`
- `/judge`
- `/judge/teams`
- `/judge/teams/[teamId]`
- `/team`
- `/team/submission`
- `/team/results`

## Prisma Models

- `User`
- `Competition`
- `Category`
- `Criterion`
- `Team`
- `TeamAssignment`
- `Score`
- `ScoreItem`
- `Settings`
- `ScoreAudit`

Highlights:

- `Score` unique key: `@@unique([teamId, judgeId])`
- Category is competition-scoped: `@@unique([competitionId, name])`
- Team account can be linked directly to one team (`ownerUserId`)

## Seed Data

`prisma/seed.ts` creates:

- 1 admin account
- 3 judge accounts
- 5 team accounts
- 2 competitions
- 3 categories in main competition + 2 categories in secondary competition
- 5 scoring criteria per main category:
  - Innovation 20%
  - Technical Execution 10%
  - Impact 30%
  - Presentation 20%
  - Feasibility 20%
- team assignments, approved/pending submissions, sample scores/comments/audits

Demo credentials:

- Admin: `admin@techscore.local` / `Demo123!`
- Judge: `maya@techscore.local` / `Demo123!`
- Judge: `daniel@techscore.local` / `Demo123!`
- Judge: `aisha@techscore.local` / `Demo123!`
- Team: `team1@techscore.local` / `Demo123!`
- Team: `team2@techscore.local` / `Demo123!`
- Team: `team3@techscore.local` / `Demo123!`

## Local Development

```bash
npm install
npm run db:setup
npm run dev -- -p 9747
```

Open [http://localhost:3000](http://localhost:3000).

## Available Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run db:setup`
- `npm run db:generate`
- `npm run db:seed`
- `npm run db:push` (alias to `db:setup`)

## Notes / Constraints

- Default local MVP uses SQLite (`DATABASE_URL=file:./prisma/dev.db`).
- If Prisma client generation fails on Windows with `EPERM` for query engine rename, ensure no process is holding `node_modules/.prisma/client/*` and rerun `npm run db:generate`.
- CSV export is implemented; XLSX export is not included yet.
rm -rf .nextnpm run dev -- -p 9747