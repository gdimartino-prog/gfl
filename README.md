# GFL — Fantasy Football League Manager

Next.js + Vercel Postgres (Supabase) + Drizzle, multi-league via row-level tenancy. GFL = leagueId 1.

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — canonical reference: tech stack, DB schema, API routes, auth, draft system, notifications, cron jobs, caching.
- **[CLAUDE.md](./CLAUDE.md)** — working agreements, conventions, and gotchas.
- **User manual** — served in-app at `/manual`.

```bash
npm run dev        # Dev server (localhost:3000)
npm run build      # Production build
npm run lint       # ESLint
npm run db:push    # Push schema changes (then RLS is re-enabled automatically)
```

Environment variables live in `.env.local` (never committed) — see ARCHITECTURE.md § Deployment Pipeline for the full list.
