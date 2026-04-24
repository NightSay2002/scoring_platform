# Tech Competition Scoring Platform

Internal scoring and operations web app for a technology competition, with separate `admin`, `judge`, and `team` experiences.

## Stack

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 4
- Prisma ORM schema
- NextAuth credentials login
- Demo SQLite bootstrap for local MVP

Production note: the current MVP runs locally with SQLite for zero-setup demo data. The Prisma schema is structured so the datasource can be switched to PostgreSQL for production deployment.

## Roles

### Admin

- Secure credentials login
- Team add/edit/delete
- Competition settings and judge management
- Scoring criteria management
- Comments review
- Leaderboard and ranking view
- Judge progress tracking
- CSV export for results and comments

### Judge

- Secure credentials login
- Assigned or all-team visibility based on admin settings
- Team list with scoring status
- Team scoring page with:
  - team details
  - embedded video
  - criterion-by-criterion numeric inputs
  - live subtotal and weighted total
  - comments
  - draft save
  - final submit with confirmation
  - editable-after-submit behavior controlled by admin settings
  - previous/next team navigation
  - completion progress

### Team

- Secure credentials login
- Own-team submission portal
- Category selection during upload
- Save draft or submit for admin approval
- Review current approval status and admin notes
- See judge activity once the submission is approved and judging starts

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
    judge/
    layout/
    shared/
  lib/
    data.ts
    prisma.ts
    utils.ts
    validators.ts
  auth.ts
middleware.ts
```

## Main Pages

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

## Database Model

Core Prisma models:

- `User`
- `Team`
- `TeamAssignment`
- `Category`
- `Criterion`
- `Score`
- `ScoreItem`
- `Settings`
- `ScoreAudit`

Highlights:

- `User.role` supports `ADMIN`, `JUDGE`, and `TEAM`
- `Team` stores category, approval state, linked team account, and admin review metadata
- `Category` enables per-category submission browsing and per-category winners
- `Score` is unique by `teamId + judgeId`
- `ScoreItem` stores per-criterion numeric and weighted values
- `Settings` stores single-instance competition configuration
- `ScoreAudit` captures draft/save/submit history
- `TeamAssignment` supports judge-specific assignments

## Reusable UI Components

- `AppShell`
- `Sidebar`
- `Header`
- `PageHeader`
- `StatCard`
- `Card`
- `Badge`
- `Button`
- `Input`
- `Textarea`
- `ProgressBar`
- table primitives in `src/components/shared/table.tsx`

## Demo Seed Data

Created by `prisma/seed.ts`:

- 1 admin account
- 3 judge accounts
- 5 team accounts
- 5 teams
- 3 categories
- 4 weighted scoring criteria
- assignments across judges
- sample approved and pending submissions
- sample draft and submitted scores
- sample judge comments and audit entries

Demo credentials:

- Admin: `admin@techscore.local` / `Demo123!`
- Judge: `maya@techscore.local` / `Demo123!`
- Judge: `daniel@techscore.local` / `Demo123!`
- Judge: `aisha@techscore.local` / `Demo123!`
- Team: `team1@techscore.local` / `Demo123!`
- Team: `team2@techscore.local` / `Demo123!`
- Team: `team3@techscore.local` / `Demo123!`

## Run Locally

```bash
npm install
npm run db:setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Important MVP Behaviors

- Admin-only exports are protected in the route handlers
- Middleware enforces admin vs judge vs team route access
- Judges only see admin-approved works
- Admin can create categories and manage all three account types
- Team submissions move through draft, pending approval, approved, and rejected states
- Leaderboard supports per-category rankings and 1st / 2nd / 3rd podium views
- Judge scoring validates criterion ranges on the server
- Submitted scores can be edited only when enabled in settings
- Leaderboard handles incomplete judging gracefully
- Comments and results export as CSV

## Known MVP Constraints

- Local bootstrap uses `prisma/init.sql` because `prisma db push` is unreliable in this environment
- CSV export is implemented; XLSX export is not yet included
- Team import is not yet included
- Public leaderboard is not separated into a standalone public route yet
