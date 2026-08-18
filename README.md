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

Run `supabase/schema.sql` in your project, then set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STAFF_TOKEN`
