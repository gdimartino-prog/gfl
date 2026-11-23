# Self-Service Password Reset Flow (F12)

## 1. Problem (REQUIRED)
Locked-out coaches previously had to manually email George Di Martino to get their team password reset, while the Forgot Password modal offered no self-service flow or multi-league commissioner fallback.

## 2. Who (REQUIRED)
- **Leagues:** All real leagues (GFL `1`, and any provisioned league), explicitly excluding the Demo league (`leagueId === 2`).
- **Roles:**
  - **Unauthenticated coaches:** Can request a reset link from `/login` and set a new password via `/reset-password?token=...` if their active team has an email on file.
  - **Admin / Commissioner (`isPrivileged()`):** Retains full ability to reset team passwords via `PATCH /api/admin/teams` (which also revokes any pending self-reset tokens for that team).
  - **Demo (`leagueId === 2`):** Blocked from self-service password resets.
  - **Superuser (`SUPER`):** Managed via env vars (`SUPERUSER_USERNAME` / `SUPERUSER_PASSWORD`), unaffected.

## 3. Done when (REQUIRED)
- Clicking **Forgot Password?** on `/login` opens an accessible modal (`role="dialog"`, `aria-modal="true"`, Escape to close) accepting league + team name, short code, or email and calling `POST /api/password-reset/request`.
- `POST /api/password-reset/request` is IP rate-limited, enforces a 3-minute per-team cooldown in `password_reset_tokens`, stores only the SHA-256 hash of a 32-byte random token (30-minute TTL), emails the link directly to `teams.email` via `sendDirectEmail` (never `GROUP_EMAIL`), and always returns a uniform neutral `200` response to prevent account enumeration.
- `/reset-password` captures the token, scrubs `?token=` from browser URL history via `history.replaceState`, enforces `8..72` bytes with no leading/trailing spaces, atomically claims the single-use token inside `db.transaction`, updates `teams.password` (`bcrypt`, cost 12) + `touch_id`/`touch_dt`, revokes other open tokens, busts `coaches` and `team-leagues`, and logs `PASSWORD_RESET_COMPLETED` to `audit_log`.
- Admin password reset (`PATCH /api/admin/teams`) and Settings password update (`updatePassword`) continue to work and revoke pending self-service reset tokens for that team.
- `npm test` covers `lib/passwordResetRules.ts` (`tests/passwordReset.test.ts`), and `npm run verify:prepush` (`lint`, `semgrep`, `test`, `build`) passes with zero errors and zero findings.

## 4. Must not (REQUIRED)
- Must not broadcast password reset links to `GROUP_EMAIL` or `MY_EMAIL`, nor log recipient emails, raw tokens, or reset URLs in `console.log` or `audit_log`.
- Must not leak account existence, email status, or email addresses in `/api/password-reset/request` responses.
- Must not allow Demo league (`leagueId === 2`) or inactive teams (`status !== 'active'`) to issue or consume reset tokens.
- Must not back up `password_reset_tokens` in `scripts/backup-db.ts`.
- Must not skip RLS (`scripts/enable-rls.ts`) after creating `password_reset_tokens`.

## 5. Decided
- **Token storage:** DB-backed `password_reset_tokens` table storing SHA-256 token hashes with single-use `used_at` claim and `expires_at` (`npm run db:push` / `scripts/create-password-reset-table.ts` + `scripts/enable-rls.ts`).
- **League scope:** All real leagues, excluding Demo (`leagueId = 2`).
- **Lookup identifier:** Accepts email, team name, or case-insensitive `teamshort` scoped to the chosen `leagueId`, always delivering only to `teams.email`.
- **TTL & cooldown:** 30-minute token expiry, 3-minute per-team resend cooldown, `8..72`-byte password policy without leading/trailing whitespace.
- **Admin resets preserved:** `PATCH /api/admin/teams` continues to allow immediate Admin/Commissioner resets and revokes open self-service tokens.

## 6. Open
None — all product decisions confirmed prior to implementation.
