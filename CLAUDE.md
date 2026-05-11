# GFL — Claude Code Instructions

GFL Fantasy Football League Manager — Next.js + Vercel Postgres (Supabase) + Drizzle, multi-league via row-level tenancy. **GFL = leagueId 1.**

**Canonical reference:** [ARCHITECTURE.md](./ARCHITECTURE.md) is the source of truth for tech stack, full DB schema, project structure, API routes, auth flow, draft system, notification system, cron jobs, and caching strategy. Read it before designing anything non-trivial.

This file holds Claude-specific working agreements: how to make changes safely, what to commit, what conventions to follow, and the gotchas that bite.

---

## Common Commands

```bash
npm run dev              # Dev server (localhost:3000)
npm run build            # Production build
npm run lint             # ESLint
npm run db:push          # Push schema changes (interactive terminal only — WebSocket drops on non-interactive input)
npm run db:studio        # Drizzle Studio
npx tsx scripts/enable-rls.ts   # Re-enable RLS — REQUIRED after every db:push
```

Run scripts with env loaded:
```bash
node --env-file=.env.local --import tsx scripts/foo.ts
```

---

## Working Agreements

- **Run `npm run lint` before suggesting a commit.**
- **Never push to remote without explicit user confirmation.** The pre-push hook runs lint + build; if it fails, fix the underlying issue, don't bypass it.
- **Schema first.** Add columns to `schema.ts` → `npm run db:push` → `npx tsx scripts/enable-rls.ts` → write lib code. **Always commit `schema.ts`** when adding columns or Vercel build will fail.
- **Keep API routes thin.** Business logic belongs in `/lib`.
- **Server Components by default.** Add `"use client"` only when needed.
- **TypeScript interfaces** live in `types/index.ts` — check before creating new ones.
- **Don't use `google-spreadsheet` or any Google Sheets code** for anything new. The migration is complete; remaining references in `scripts/` are one-shot legacy.

---

## Code Conventions

### Multi-league tenancy
- Every query on a tenant table must filter by `leagueId`.
- Use `getLeagueId()` from `lib/getLeagueId.ts` server-side. It's wrapped in React `cache()` so calling it multiple times per request is free.
- Default to `leagueId = 1` only as a fallback for unauthenticated/edge cases.

### Cache pattern
```ts
const _fn = unstable_cache(
  async (leagueId: number) => { /* DB query */ },
  ['cache-key'],
  { revalidate: 60, tags: ['tag'] }
);
export async function fn(leagueId = 1) { return _fn(leagueId); }
```
Bust caches in mutation routes: `revalidateTag('tag', 'max')`. See [ARCHITECTURE.md § Caching Strategy](./ARCHITECTURE.md#caching-strategy) for the full cache key / tag list.

### Identity keys (dedup)
- **Players:** `first|last|age|offense|defense|special` (all lowercase). Used by `lib/maintenance.ts` upsert.
- **Cuts:** same as players; age-mismatch fallback drops the age field.

### Mixed-case `teamshort`
Some leagues have mixed-case `teamshort` values seeded historically. **Always `.toUpperCase()` before matching** in lookups.

### Audit fields
Every mutation writes `touch_id` (actor) and `touch_dt` (timestamp). Don't skip these — they're how we trace incidents.

---

## Gotchas

### Awaiting notifications
**All `notify*()` calls must be `await`ed.** Vercel serverless kills unawaited promises on response return, silently losing the notification.

### WhatsApp is GFL-only
`lib/notify.ts` checks `leagueId === 1` before calling `sendWhatsApp()`. GreenAPI env vars are `.trim()`-ed to handle copy-paste whitespace.

### `revalidateTag` arity
This Next.js version requires `revalidateTag(tag, 'max')` — single-arg form is a type error and breaks the build.

### `revalidateTag` on localhost
Doesn't flush the file-based dev cache. Restart `npm run dev` after a player sync to see updated team assignments.

### `force-dynamic` is rarely needed
Dropping `force-dynamic` lets Next.js cache server-component output and honors `unstable_cache` more aggressively. Only add it when there's a concrete reason (a route that must not be cached even briefly).

### Cache headers on league-scoped routes
Use `Cache-Control: private, max-age=N` — never `s-maxage` — for endpoints whose response depends on the `gfl-league-id` cookie. Shared CDN caching would leak one league's data to another league's users.

### `logSystemEvent` must be awaited
Same reason as `notify*()`. Vercel kills unawaited promises.

### Transaction status
`logTransaction()` always saves `status='Pending'`. Commissioners flip to `Done` or `On Team` via `PATCH /api/transactions`.

### Player file imports clean up duplicates
`processPlayersFile` consolidates same-identity rows in the DB before upserting. The standalone `scripts/dedupe-players.ts` runs the same logic as a one-shot cleanup.

---

## Cron Routes
See [ARCHITECTURE.md § Cron Jobs](./ARCHITECTURE.md#cron-jobs--automation) for the dispatcher split. Key point: `/api/cron/draft` is fired by cron-job.org (not GitHub Actions — `*/5` schedules are throttled on GH). All cron routes require `Authorization: Bearer CRON_SECRET`.

---

## Environment Variables

Maintained in `.env.local` — never commit. Full list in [ARCHITECTURE.md § Deployment Pipeline](./ARCHITECTURE.md#deployment-pipeline).

Keys to know off the top of your head:
- `POSTGRES_URL` — DB
- `AUTH_SECRET` — NextAuth
- `CRON_SECRET` — cron auth header
- `SUPERUSER_USERNAME` / `SUPERUSER_PASSWORD` — superuser bypass login
- `SEND_WHATSAPP=false` — globally disable WhatsApp (useful for testing)
