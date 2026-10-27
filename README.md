# Google Student Ambasador 2026

## Getting Started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:9999](http://localhost:9999).

Without Supabase env vars, submissions use in-memory storage (good for UI testing).

## Staff

Visit `/staff` and unlock with `STAFF_TOKEN` (default `gsa-staff-2026`).

## Supabase

Run `supabase/schema.sql` (or migrations under `supabase/migrations/`) in your project, then set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STAFF_TOKEN` (required in production — no default)

Optional: `WALL_REVEAL_TARGET` (default `20`).

## Production deploy (Vercel)

1. Import the repo on Vercel (Next.js, `npm run build`, default output).
2. Add the env vars above for **Production** (and Preview if you test there).
3. Confirm `npm run build` passes locally before pushing.
4. Event URLs: students `/`, projector `/wall`, ops `/staff`.

Without Supabase in production, API routes return **503** (in-memory mode is dev-only).

If dev shows `a[d] is not a function` or 500s after a build, stop dev and run `npm run dev:clean` — stale `.next`, not app logic.
