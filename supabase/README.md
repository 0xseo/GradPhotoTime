# Supabase Setup

Apply migrations from `supabase/migrations` to the Supabase project, then generate
fresh database types.

```bash
cp .env.example .env.local
npm run db:types
```

For local Supabase development:

```bash
npx supabase start
npm run db:types:local
```
