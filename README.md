# Work Ledger

A work-tracking app styled as a paper timesheet. Track focused work blocks, bank verified minutes, race your own 4-week shadow, and spend earned money planting forests on a pixel Earth.

## Pages

The app has four pages (hash-routed, so the browser back button and bookmarks work):

- **Today** — the clock, a live "today so far" readout (worked, deep focus, blocks, vs your typical day, daily-goal pace), the shadow race, records, and today's blocks.
- **Insights** — pick Day / Week / Month / Year / All time and step back through history. Shows hours worked, deep-focus time and share, days worked, blocks, earnings, goal pace, a bar chart (tap a bar to drill in), where the time went by project, when you work by hour, weekday averages, an auto-generated "honest read", and all-time personal records.
- **Ledger** — the 26-week record grid (tap a day to open it right below), the week-by-week bank, and markdown export.
- **World** — plant forests on the pixel Earth with wallet money.

The header shows Today / This week / This month / All time totals on every page.

## Features

- **Timer** with pause/resume, focus sessions (1.5× pay multiplier), and an accidental-start guard
- **Deep focus** = completed focus-mode sessions; aborted ones pay 0.5× and are called out in insights
- **Goals** — daily and weekly hour targets (edit at the top); month/year goals scale from the weekly one
- **Bank statement** — minute-exact, grouped week (Sun–Sat) → day → entry
- **Ghost race** against your trailing 4-week average, paced to the current moment
- **Personal records** — best day, week, month, streaks, longest block (verified time only)
- **Payslip** generation for the current week
- **Pixel Earth** — plant forests with wallet money earned from verified work
- **Entry editor** — start time, reflection notes, 1–10 session ratings, evidence links
- **Markdown export** of the full statement

Analytics live in `src/lib/insights.js` as pure functions; pages are in `src/pages/`.

## Stack

Vite + React. Persistence via Supabase (with localStorage fallback when unconfigured).

## Development

```bash
npm install
npm run dev        # http://localhost:5199
npm run build
npm test           # Playwright e2e suite
```

If your environment pre-installs Chromium outside Playwright's cache, point the suite at it: `CHROMIUM_PATH=/path/to/chromium npm test`.

## Configuration

Copy `.env.example` to `.env` and fill in your Supabase project:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Without these, the app runs fully on localStorage.

With Supabase configured:

1. Run `supabase/migrations/001_ledger.sql` against your project (SQL editor or `supabase db push`). It creates the `ledger` table (`id, user_id, entries jsonb, settings jsonb, world int[]`) with RLS so each user can only touch their own row.
2. Enable **anonymous sign-ins** (Authentication → Providers) — the app signs each device in anonymously to get a `user_id` for RLS. Swap in real auth later if you want cross-device sync under one account.

localStorage remains a synchronous write-through cache, so nothing is lost if a tab closes mid-sync; the newest copy wins on load.

## Deploy

Point Vercel at this directory (framework preset: Vite). Set the two `VITE_SUPABASE_*` environment variables in the Vercel project. Every push auto-deploys.
