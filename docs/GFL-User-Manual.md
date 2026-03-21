# GFL Fantasy Football League — User Manual

**Version:** 2026 Season
**Last Updated:** March 2026

---

## Table of Contents

1. [Getting Started — Login](#1-getting-started--login)
2. [Navigation](#2-navigation)
3. [Home Dashboard](#3-home-dashboard)
4. [Rosters](#4-rosters)
5. [Standings](#5-standings)
6. [Schedule](#6-schedule)
7. [Transactions](#7-transactions)
8. [Draft Board](#8-draft-board)
   - [Draft Table](#81-draft-table)
   - [On the Clock](#82-on-the-clock)
   - [Making a Pick](#83-making-a-pick)
   - [Draft Selection Modal — Position Filters](#84-draft-selection-modal--position-filters)
   - [Skipped / Expired Picks](#85-skipped--expired-picks)
   - [Late Selections](#86-late-selections)
   - [Draft Notifications](#87-draft-notifications)
9. [Trade Block](#9-trade-block)
10. [Commissioner Tools — Maintenance](#10-commissioner-tools--maintenance)
    - [Team Management & Password Reset](#101-team-management--password-reset)
    - [Player Upload](#102-player-upload)
    - [Signup Approvals](#103-signup-approvals)
11. [Audit Log](#11-audit-log)

---

## 1. Getting Started — Login

Navigate to the GFL app URL and you will land on the Login page.

![Login Page](screenshots/login.png)

### Accepted Login Identifiers

You can log in using any of the following:

| Field | Example |
|-------|---------|
| Full team name | `Lake Bluff Indians` |
| Team short code | `LBI` |
| Email address | `coach@example.com` |

Your password is set by the commissioner. If you have not received a password, contact your league commissioner.

### Demo Account

A read-only demo account is available. Contact your commissioner for demo credentials.

---

## 2. Navigation

![Navbar](screenshots/navbar.png)

The navigation bar appears at the top of every page. On wide screens (1536px+) all items are visible inline. On smaller screens a hamburger menu ☰ is shown.

| Menu Item | Description |
|-----------|-------------|
| **Rosters** | View all team rosters |
| **Standings** | Current season standings |
| **Schedule** | Game schedule and results |
| **Transactions** | Player transactions log |
| **Draft Board** | Live draft entry board |
| **Traded Picks** | History of traded draft picks |
| **Trade Block** | Players available for trade |
| **Resources** | League resources and links |
| **Maintenance** | Commissioner admin tools (admin only) |

The league name is displayed in the navbar when you are logged in. Unauthenticated users see the generic "Football League" placeholder.

---

## 3. Home Dashboard

![Home Dashboard](screenshots/home.png)

The home page shows a summary of recent league activity including standings, recent transactions, and league announcements.

---

## 4. Rosters

![Rosters](screenshots/rosters.png)

The Rosters page displays the full player roster for every team in the league.

- Players are grouped by team
- Each player card shows position, overall rating, salary, and age
- Click a player to view full details
- Use the search and filter controls to narrow results

---

## 5. Standings

![Standings](screenshots/standings.png)

The Standings page shows win/loss records for the current season and historical seasons.

- Records are sorted by winning percentage
- Points for (PF) and points against (PA) are shown
- Historical season tabs allow browsing past standings

---

## 6. Schedule

The Schedule page shows all matchups for the current season including scores for completed games and upcoming game dates.

---

## 7. Transactions

![Transactions](screenshots/transactions.png)

The Transactions log records all player movements: signings, cuts, trades, and waivers.

### Status Filter Pills

Use the pill buttons at the top of the log to filter by status:

| Status | Description |
|--------|-------------|
| **All** | Show every transaction |
| **Pending** | Awaiting commissioner approval |
| **On Team** | Transaction is active |
| **Done** | Completed/finalized |

### For Coaches

- Submit new transactions using the form at the top of the page
- Transactions are created with **Pending** status
- The commissioner reviews and approves or rejects

### For Commissioners

- Change a transaction's status via the status dropdown on each row
- Status changes are logged in the audit log

---

## 8. Draft Board

![Draft Board](screenshots/draft-board.png)

The Draft Board is the live entry console for the annual player draft. Picks are made in order and the board updates in real time.

### 8.1 Draft Table

Each row in the table represents one draft pick:

| Column | Description |
|--------|-------------|
| **RD** | Round number |
| **Pick** | Overall pick number |
| **Drafted Player** | Position badge + player name (when drafted) or status label |
| **Current Owner** | The team that owns this pick (may differ from original team if traded) |
| **Status** | Finalized / Skipped / On the Clock / Locked / Late Selection button |

#### Position Badge

When a pick has been made, a blue **position badge** (e.g. `QB`, `WR`, `RB`) appears to the left of the player's name, making it easy to scan the board by position at a glance.

![Draft Pick Row](screenshots/draft-pick-row.png)

#### Timestamp

Every finalized pick shows the date and time it was made directly below the player name, formatted as `Mar 17, 3:45 PM`.

#### Traded Picks

If a pick was acquired via trade, the original team is shown in blue below the current owner's name:

```
VIA Lake Bluff Indians
```

For multi-team trades, the full trade chain is shown:
```
LBI → VV → RHB
```

### 8.2 On the Clock

When it is a team's turn to pick, the draft board shows a large **On the Clock** panel at the top of the page with:

- The team name
- Current pick number and round
- A live countdown timer (amber digits)
- A progress bar showing how much time remains

**Time limits:**
- Rounds 1–2: **24 hours**
- Rounds 3+: **12 hours**

The timer starts from the moment the previous pick was finalized.

### 8.3 Making a Pick

![Draft Buttons](screenshots/draft-buttons.png)

When it is your team's turn, the **Enter Selection** button appears in the Status column of your pick row. Click it to open the Selection Modal.

If you are a commissioner you can make a pick for any team whose pick row shows the button.

### 8.4 Draft Selection Modal — Position Filters

![Draft Modal](screenshots/draft-modal.png)

The selection modal lets you search the free agent pool and choose a player to draft.

**Position Filter Pills**

A row of position buttons lets you quickly filter the player list:

`All` · `QB` · `RB` · `WR` · `TE` · `OL` · `DL` · `LB` · `DB` · `K` · `P`

Click any position pill to show only players at that position. Click **All** to clear the filter.

**Search**

Type in the search box to filter by player name in addition to (or instead of) the position filter.

**Confirming the Pick**

Once you have selected a player, click **Confirm Selection**. The draft board updates immediately and a pick notification is sent.

### 8.5 Skipped / Expired Picks

If the clock runs out before a team makes their selection, the pick is automatically **expired and skipped**. This can happen in two ways:

1. **Client-side (immediate):** The browser countdown hits zero and triggers expiry right away — no waiting for the next cron cycle
2. **Server-side (fallback):** The hourly cron job expires any picks that slipped through

An expired pick row shows:

```
Expired (Skipped)
Mar 17, 3:45 PM        ← time when the pick expired
Late Selection Eligible
```

The pick expiry timestamp is displayed in the same format as a regular drafted pick.

### 8.6 Late Selections

After a pick is skipped, the team still has the opportunity to make a **Late Selection** at any time. The **Late Selection** button (orange) appears in the Status column of the skipped pick row.

Clicking it opens the same Selection Modal so the team can still select a player. The pick is then marked as finalized and the player is assigned to the team's roster.

### 8.7 Draft Notifications

The system sends three types of draft notifications:

| Notification | When | Sent by |
|---|---|---|
| **1-Hour Warning** | When exactly 1 hour remains on the active pick's clock | Hourly cron job — fires once per pick via `warningSent` flag |
| **Expiration** | When the pick clock reaches zero and the pick is skipped | Client timer (immediately) with cron job as fallback |
| **Pick Made** | When a team submits their selection | Draft selection API — fires immediately on submission |

---

## 9. Trade Block

The Trade Block shows players whose coaches have posted them as available for trade, along with the asking terms.

- Any coach can post a player to the trade block
- Re-posting a player updates the asking terms
- Contact the other coach directly to negotiate trades

---

## 10. Commissioner Tools — Maintenance

![Maintenance](screenshots/maintenance.png)

The Maintenance page is only accessible to commissioners and superusers. It provides tools for managing the league.

### 10.1 Team Management & Password Reset

The team list shows all teams in the league with their status (Active/Pending).

#### Resetting a Coach's Password

Each team row has an amber **Reset PW** button. To reset a coach's password:

1. Click **Reset PW** next to the team name
2. An inline password input appears
3. Type the new password
4. Click **Set Password** to save

The password is stored securely (bcrypt-hashed). The event is recorded in the audit log.

To cancel without saving, click **Cancel**.

#### Approving New Signups

New coaches who register via the signup page arrive with `Pending` status. The commissioner can approve them from the team list by changing their status to `Active`.

### 10.2 Player Upload

The maintenance page includes a file upload tool to bulk-import or update player data from a CSV/spreadsheet export.

### 10.3 Signup Approvals

Coaches can self-register at `/signup`. Their account is created with `Pending` status and will not be able to log in until the commissioner activates their account in Maintenance.

---

## 11. Audit Log

The audit log (available to commissioners via Maintenance) records all significant system events:

| Event | Description |
|-------|-------------|
| `LOGIN` | Coach logged in (includes team code and league ID) |
| `RESET_PASSWORD` | Commissioner reset a coach's password |
| `UPDATE_TEAM` | Team record was updated |
| `DRAFT_DELETE_PICK` | A draft pick was deleted/reversed |
| `DRAFT_CLEAR_ALL` | All picks for a draft year were cleared |
| `TRANSACTION_*` | Transaction created, updated, or deleted |

All events include the acting user, timestamp, and league ID for multi-league installations.

---

## Quick Reference — Coach Checklist

| Task | Where |
|------|-------|
| Log in | `/login` — use team name, short code, or email |
| View roster | **Rosters** |
| Check standings | **Standings** |
| Submit a transaction | **Transactions** → form at top |
| Make your draft pick | **Draft Board** → Enter Selection button |
| Make a late pick | **Draft Board** → Late Selection button on expired row |
| Post to trade block | **Trade Block** |
| Contact commissioner | Direct message / email |

---

*This manual covers features as of the 2026 season. For technical issues contact your league commissioner.*
