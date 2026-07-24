# Work Ledger

A work-tracking app styled as a paper timesheet. Track focused work blocks, bank verified minutes, race your own 4-week shadow, and spend earned money planting forests on a pixel Earth.

## Features

- **Timer** with pause/resume, focus sessions (1.5× pay multiplier), and an accidental-start guard
- **Bank statement** — minute-exact, grouped week (Sun–Sat) → day → entry
- **Ghost race** against your trailing 4-week average, paced to the current moment
- **Personal records** — best day, best week, streak
- **Payslip** generation for the current week
- **Pixel Earth** — plant forests with wallet money earned from verified work
- **Entry editor** — reflection notes, 1–10 session ratings, evidence links
- **Markdown export** of the full statement

## Stack

Vite + React. Persistence via Supabase (with localStorage fallback when unconfigured).

## Development

```bash
npm install
npm run dev        # http://localhost:5199
npm run build
npm test           # Playwright e2e suite
```

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
