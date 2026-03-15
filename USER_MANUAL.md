# AFL Front Office — User Manual

**Version:** 2026 Season
**Application:** AFL League Manager (Front Office)

---

## Table of Contents

1. [Getting Started](#1-getting-started)
   - [Logging In](#11-logging-in)
   - [Password Recovery](#12-password-recovery)
   - [Creating an Account](#13-creating-an-account)
   - [Navigation Overview](#14-navigation-overview)
   - [User Roles](#15-user-roles)
2. [Home Page](#2-home-page)
3. [Team Rosters](#3-team-rosters)
4. [League Standings](#4-league-standings)
5. [League Schedule](#5-league-schedule)
6. [Draft Board](#6-draft-board)
7. [Transactions](#7-transactions)
8. [Roster Cuts](#8-roster-cuts)
9. [Trade Block](#9-trade-block)
10. [Coaching Hub (COA Files)](#10-coaching-hub-coa-files)
11. [Press Box](#11-press-box)
12. [League Resources](#12-league-resources)
13. [League Directory](#13-league-directory)
14. [Constitution & Rules](#14-constitution--rules)
15. [Franchise Settings](#15-franchise-settings)
16. [Commissioner Panel](#16-commissioner-panel)
17. [League Switcher](#17-league-switcher)

---

<a id="getting-started"></a>

## 1. Getting Started

### 1.1 Logging In

Navigate to `/login` or click **Coach Login** from any page.

**To log in:**
- Enter your **Team Name** (e.g., `Amalfi`) or your **Email Address**
- Enter your **Password**
- Click **Sign In**

> **Tip:** The "Remember Me" checkbox is enabled by default and keeps you signed in for 30 days.

**After logging in**, you will be returned to the home page. Your franchise name will appear in the top navigation bar confirming you are authenticated.

---

### 1.2 Password Recovery

If you forget your password:

1. On the Login page, click **"Forgot Password?"**
2. A recovery modal appears with the Commissioner's contact information
3. Click **"Send Recovery Email"** to open a pre-filled email to the Commissioner requesting a reset
4. The Commissioner will manually reset your password and notify you

---

### 1.3 Creating an Account

New coaches must register and await Commissioner approval:

1. Navigate to `/signup` or click the signup link on the Login page
2. Complete the registration form:
   - **League ID** — provided by your Commissioner
   - **Coach Name** — your full name
   - **Team Name** — your franchise name (e.g., `New York Giants`)
   - **Shortcode** — unique team abbreviation, max 6 characters (e.g., `NYG`), auto-converted to uppercase
   - **Email** *(optional)* — for league communications
   - **Mobile** *(optional)* — shown in the League Directory
   - **Password** — minimum 6 characters
   - **Confirm Password** — must match
3. Click **Register** — you will see a "Pending Commissioner Approval" confirmation screen
4. Wait for the Commissioner to approve your account; you will be notified when active
5. Once approved, log in with your team name and password

---

### 1.4 Navigation Overview

The top navigation bar provides access to all sections of the app.

**On large screens (1536px+):** Full horizontal menu visible
**On smaller screens:** Tap the hamburger icon (☰) to open the menu

| Menu Item | Page | Auth Required |
|-----------|------|---------------|
| Rosters | `/rosters` | Yes |
| Schedule | `/schedule` | No |
| Standings | `/standings` | No |
| Transactions | `/transactions` | Yes |
| Trade Block | `/trade-block` | No (view) / Yes (post) |
| COA Hub | `/coaching` | Yes |
| Draft Board | `/draft` | No (view) / Yes (pick) |
| Cuts | `/cuts` | Yes |
| Press Box | `/press-box` | Yes |
| Resources | `/resources` | No |
| Directory | `/directory` | Yes |
| Constitution | `/rules` | No |

The **right side** of the navigation bar shows:
- Your authenticated identity (coach name and franchise) when logged in
- A **Logout** button
- The current **season year** badge
- A **league switcher** dropdown (if you have access to multiple leagues)

---

### 1.5 User Roles

The app has three permission levels:

| Role | Who | Capabilities |
|------|-----|-------------|
| **Coach** | All registered coaches | Manage own team — transactions, cuts, COA uploads, settings |
| **Commissioner** | Designated admin coach | All coach capabilities + approve signups, manage league rules, override team data |
| **Superuser** | System administrator | Full access to everything across all leagues |

Actions that require elevated permissions display a lock icon or return an "Unauthorized" message if your role is insufficient.

---

<a id="home-page"></a>

## 2. Home Page

**URL:** `/`
**Access:** Public (some cards require login)

The home page is your central hub. It displays a grid of feature cards linking to all major sections.

### Feature Cards

| Card | Description | Auth Required |
|------|-------------|---------------|
| Team Rosters | Browse and search all franchise rosters | Yes |
| League Resources | Download season files and documents | No |
| Coach Hub | Upload your `.COA` gameday file | Yes |
| Transactions | Execute player transactions | Yes |
| Roster Cuts | Submit protected/pullback player selections | Yes |
| Draft Board | View picks and make draft selections | No (view) |
| Standings | Season records and historical data | No |
| Training | External training facilities link | No |
| Classic League Site | Link to legacy league website | No |
| Franchise Settings | Update your contact info and password | Yes |
| Commissioner | League management panel | Commissioner only |

### Weekly Schedule Widget

The right sidebar (visible on wide screens) shows the **current week's matchups** for your league, including scores for completed games.

---

<a id="rosters"></a>

## 3. Team Rosters

**URL:** `/rosters`
**Access:** Authenticated coaches

View and search player rosters for any franchise.

### Browsing Rosters

1. Use the **Team Selector** dropdown at the top to choose a franchise
2. The roster loads automatically showing all players on that team
3. Players are organized by position group (Offense → Defense → Special Teams)

### Player Cards

Each player card shows:
- Name, age, position
- Key ratings (Overall, Run Block, Pass Block, Rush Yards, Interceptions, Sacks, Durability)
- IR status (if on Injured Reserve)

Click any player card to open the **Player Details Modal**, which shows:
- Full stats grid (salary, years, games played)
- Rushing, receiving, passing statistics
- Defensive statistics
- All scouting ratings

### Search & Filter

- Use the **search bar** to filter players by name in real time
- Position filter buttons (QB, RB, WR, TE, OL, DL, LB, DB, K, P) narrow the display

### Roster Draft Picks

Below the player list, each franchise's **current and future draft picks** are shown in a table with year, round, overall pick number, and original team.

### Coach Contact

The roster page displays the coach's contact information (email and phone) from the League Directory. Click **email** to open a mail client, or **phone** to dial on mobile.

---

<a id="standings"></a>

## 4. League Standings

**URL:** `/standings` · `/standings/summary`
**Access:** Public

### Yearly View (`/standings`)

Displays the current season's league standings.

- **Season** shown at top; defaults to the current season year
- **Year selector** to browse historical seasons
- **Records table** shows W-L-T, points for, points against, and point differential for each team
- Playoff positions are highlighted (clinched teams marked with prefix indicators: `x-`, `y-`, `*`)
- **GM column** shows the coach managing each franchise

### All-Time Leaderboard (`/standings/summary`)

Aggregate career statistics for every franchise:

| Column | Description |
|--------|-------------|
| Franchise | Team name and current GM |
| Seasons | Total seasons participated |
| W-L-T | Career record |
| Win % | Career winning percentage |
| Pts For / Against | Career offensive and defensive totals |
| Division Titles | Number of division championships |
| Playoffs | Total playoff appearances |
| Super Bowls | Championship game appearances |
| Championships | Titles won |

Click any column header to sort the leaderboard.

---

<a id="schedule"></a>

## 5. League Schedule

**URL:** `/schedule`
**Access:** Public

View the full season schedule organized by week.

- Each **week's games** are shown as matchup cards
- Scores appear on completed games
- Upcoming games show the scheduled matchup without a score
- Playoff bracket becomes available in the post-season

---

<a id="draft-board"></a>

## 6. Draft Board

**URL:** `/draft`
**Access:** Public view; authenticated to make picks

The Draft Board is the live hub for all draft activity.

### What You See

**On the Clock Panel** (top section, dark background):
- Which team is **currently picking**
- The **pick number** and **round**
- A **countdown timer** (HH:MM:SS):
  - Amber color during normal time
  - Red when less than 10% of time remains
  - "EXPIRED" when the clock runs out
- A visual **progress bar** showing time consumed

**Recent Picks Ticker:**
A horizontal scrolling bar at the top shows the most recent selections in real time.

**Filters:**
- Season year
- Franchise/Team
- Round number
- Player name search

**Draft Picks Table Columns:**
| Column | Description |
|--------|-------------|
| Round | Draft round number |
| Pick | Overall pick number |
| Player | Name of player selected (or blank if available) |
| Owner | Team currently holding this pick |
| Status | Finalized / On the Clock / Late Selection / Locked |
| Trade History | Shows "VIA [team]" if the pick was traded; chains multiple trades |

### Making a Draft Selection

When it is your team's turn:
1. An **"Enter Selection"** button appears on your pick row
2. Click it to open the **Selection Modal**
3. Search for the player you want to select by name
4. Confirm the selection — it is saved immediately

If your pick expires (timer runs out):
- The pick shows **"Late Selection"** status
- You can still submit your pick at any time by clicking the Late Selection button
- The pick remains valid but will be flagged as a late submission

### Scouting Terminal (Free Agent Viewer)

Click **"Scout Free Agents"** to open the right-side scouting panel:

- **Search** players by name
- **Filter** by position (QB, RB, WR, TE, OL, DL, LB, DB, K, P)
- **Sort** by: Overall Rating | Age | Name
- **Star / Watchlist** — click the star icon to save players to your watchlist (persists between sessions)
- **Hover** over a player card to pre-load their full stats
- **Click** a player card to open the full Player Details Modal

Your watchlist players float to the top of the list for easy access during draft day.

---

<a id="transactions"></a>

## 7. Transactions

**URL:** `/transactions`
**Access:** Authenticated coaches

Execute and track all roster moves: adds, drops, IR movements, and trades.

### Operation Tabs

Select from four operation types using the tabs at the top:

#### Add Player
For signing a free agent to your roster.
1. Search for the player by name in the FA search field
2. Select the player from the results
3. The system confirms roster space
4. Click **Submit** — the transaction is logged as "Pending"

#### Drop / Waive Player
For removing a player from your roster.
1. Select the player from your roster list
2. Choose **Drop** (release outright) or **Waive** (return to waiver wire)
3. Click **Submit** — logged as "DROP" or "WAIVE"

#### IR Movement
For placing a player on Injured Reserve or returning them.
1. Select the player
2. Choose **Move to IR** or **Return from IR**
3. Click **Submit** — logged as "IR" or "IR MOVE"

#### Team Trade
For player trades between franchises.
1. Select the **trading partner** team
2. Select players from **your** side
3. Select players from the **other team's** side
4. Click **Submit** — logged as "TRADE"

### Transaction Log

All transactions are displayed in a table below the operation panel.

**Columns:**
| Column | Description |
|--------|-------------|
| Timestamp | Date and time of submission (ET) |
| Type | Color-coded badge (ADD=blue, DROP/WAIVE=red, IR=orange, TRADE=purple) |
| Details | Player name, positions, and submitting coach |
| From | Team releasing or trading away |
| To | Team acquiring |
| Wk Back | Week the transaction applies back to |
| Status | Current processing status |

**Status Values:**
- **Pending** (amber) — submitted, awaiting Commissioner review
- **On Team** (blue) — Commissioner has acknowledged and is processing
- **Done** (green) — transaction finalized and applied

**Filters:**
- Status pills: **All | Pending | On Team | Done**
- Type dropdown: filter by transaction type
- Team dropdown: filter by franchise
- **Clear All** button resets filters

**Commissioner Actions:**
Commissioners can change any transaction's status via the dropdown in the Status column. Coaches can only view statuses.

### Refresh

Click the **Refresh** button (top right of log) to reload the transaction list. The list also refreshes automatically after you submit a transaction.

---

<a id="cuts"></a>

## 8. Roster Cuts

**URL:** `/cuts`
**Access:** Authenticated coaches

Submit your protected and pullback player selections for the new season.

### Understanding the Process

Each offseason, coaches must designate:
- **Protected** players (max 30) — kept for next season
- **Pullback** players (max 8) — returned to the draft pool but your team retains first right of refusal
- Remaining players are automatically **Released**

### Compliance Monitor

The dark panel at the top shows all franchises' submission status:
- Each team shows `Protected X/30` and `Pullback X/8`
- **Green** = team has fully completed their submission (both limits reached)
- **Blue** = currently selected team
- **Deadline countdown** (D H M format) shows time remaining until the cuts deadline
- **Red countdown** = deadline has passed; no changes allowed

Click any team card in the compliance monitor to jump to that team's roster. Coaches only see their own team; Commissioners can view and edit all teams.

### Making Selections

Each player in your roster list has three buttons:

| Button | Meaning |
|--------|---------|
| **Protect** (blue) | Keep this player on your roster |
| **Pullback** (yellow) | Retain first right of refusal for the draft |
| **Release** (red) | Release this player |

1. Click the appropriate button for each player
2. The capacity counters at the top update in real time (`Protected: X / 30`)
3. If you exceed the limit, an alert prevents the selection
4. Use the **search bar** to filter players by name

### Stat Summary Cards

Above the roster, three cards show a breakdown of your current selections:
- Protected: count, average age, position breakdown
- Pullback: count, average age, position breakdown
- Released: count, average age, position breakdown

### Submitting

When you are satisfied with your selections:
1. Click **"Submit Roster Cut List"** (sticky panel)
2. Selections are saved immediately
3. You can re-submit any time before the deadline to revise

The button is **disabled** if:
- The deadline has passed
- You are not authorized (wrong team or not logged in)

### Viewing Player Stats

Click the **"Stats Terminal"** button on any player card to open their full scouting report in a modal.

---

<a id="trade-block"></a>

## 9. Trade Block

**URL:** `/trade-block`
**Access:** Public view; authenticated to post/remove

The Trade Block is a public marketplace where coaches list players available for trade.

### Viewing the Trade Block

The table shows all players currently listed, including:
- Player name (click to search Google)
- Team (franchise name)
- Position
- Asking (what the coach wants in return)

Click **"View Details"** to open the full Player Details Modal for any listed player.

### Posting a Player

*Currently managed through the Commissioner — contact your Commissioner to post a player to the trade block.*

### Removing a Player

If one of your players appears on the trade block:
1. A **red "Remove"** button appears in the Actions column
2. Click **Remove** — a confirmation dialog appears
3. Click **Confirm** — the player is removed from the trade block

---

<a id="coaching-hub"></a>

## 10. Coaching Hub (COA Files)

**URL:** `/coaching`
**Access:** Authenticated coaches only

Upload and manage your Action! PC Football gameday coach files.

### What is a COA File?

A `.COA` file is an Action! PC Football coach profile that defines your team's strategy and play calls. It must be uploaded before each gameday for the Commissioner to process.

### Uploading Your File

1. Your file will be saved as **`{TeamName}.COA`** (spaces replaced with underscores) to match Action! PC naming requirements — this is shown in the info box at the top
2. Either **drag and drop** your `.COA` file onto the upload area, or click to **browse** for the file
3. The file uploads automatically
4. A confirmation message shows the upload timestamp

### Downloading Your Current File

If you need to retrieve your previously uploaded file:
1. A **Download** button appears if a file exists for your team
2. Click it to download your current `.COA` file

### Last Sync

The upload area displays the **last sync timestamp** showing when your file was last uploaded. This timestamp is also visible in your Franchise Settings page.

---

<a id="press-box"></a>

## 11. Press Box

**URL:** `/press-box`
**Access:** Authenticated coaches

The Press Box is the league's game analysis and media center.

### Features

- **Upload game result files** for AI-powered analysis
- **Generate game summaries** using Google Gemini AI
- **View published summaries** from previous games

### Generating a Summary

1. Upload your game result file
2. Click **Generate Summary**
3. The AI analyzes the data and writes a narrative game summary
4. The summary is published to the Press Box for all coaches to view

---

<a id="resources"></a>

## 12. League Resources

**URL:** `/resources`
**Access:** Public

Download season files, documents, and league assets.

Resources are organized by category. Click any link to open or download the file in a new tab. Categories may include:
- Player photos
- Team files and logos
- League encyclopedia
- Playbook templates
- Season rulebooks
- Historical archives

---

<a id="directory"></a>

## 13. League Directory

**URL:** `/directory`
**Access:** Authenticated coaches

View contact information for all active coaches in your league.

### Directory Table

| Column | Description |
|--------|-------------|
| Franchise | Team shortcode and full team name |
| Coach | Coach name (Commissioner badge shown if applicable) |
| Email | Clickable mailto: link |
| Mobile | Formatted phone number |
| Actions | "View Roster" link |

### Searching

Use the **search bar** to filter by coach name, team name, or shortcode. Results filter in real time as you type.

### Updating Your Info

Your own row shows a link to **Franchise Settings** where you can update your name, email, and mobile number. Changes appear in the directory immediately.

---

<a id="constitution"></a>

## 14. Constitution & Rules

**URL:** `/rules`
**Access:** Public

The full league constitution displayed as a readable document.

### Navigation

The **left sidebar** (visible on wide screens) contains a table of contents with links to each section:

| Section | Topic |
|---------|-------|
| I | League Structure |
| II | Roster Rules |
| III | Expansion |
| IV | Trades |
| V | Protocol |
| VI | Post Season |
| VII | Game Rules |

Click any section link to jump directly to that part of the document.

---

<a id="settings"></a>

## 15. Franchise Settings

**URL:** `/settings`
**Access:** Authenticated coaches (own profile only)

Manage your coach profile, contact information, and account security.

### Profile Header

Displays your current:
- Coach name
- Franchise name and nickname
- Authorized ID (your team shortcode)

### Update Directory Info

Change your information visible to other coaches in the League Directory:

1. **Coach Name** — your displayed name
2. **Team Nickname** — short team nickname
3. **Team Name** — full franchise name
4. **Email Address** — contact email
5. **Mobile** — contact phone number

Click **"Update Directory Info"** to save. Changes are reflected immediately in the League Directory.

### Change Password

1. Enter your **New Password** (minimum 4 characters)
2. Enter it again in **Confirm New Password**
3. Click **"Save Security Settings"**

Passwords are stored securely using bcrypt hashing.

### Quick Links

The settings page includes shortcut links to:
- **Coaching Hub** — upload your COA file (shows last sync time)
- **League Directory** — view all coach contacts

---

<a id="commissioner"></a>

## 16. Commissioner Panel

**URL:** `/maintenance`
**Access:** Commissioner and Superuser only

The Commissioner Panel provides league administration tools.

> Non-admin users see an "Unauthorized" message and cannot access this page.

### File Upload (Import)

Upload league data files to synchronize the database:

1. **Drag and drop** files onto the upload area, or click to **browse**
2. Multiple files can be selected at once
3. Click **"Synchronize Files"**
4. Results show success/failure per file with details

**Supported file types:**
| File | Detected By | What It Does |
|------|------------|-------------|
| Players CSV (`.csv`) | `.csv` extension | Full player roster replace — deletes existing league players and re-imports all from file |
| Schedule file | Contains "SCHEDULE" | Imports or updates weekly game matchups and scores |
| Standings file | Contains "STANDING" | Imports season win/loss records for all teams |

> **Important:** Player import is a **full replacement** — all current league players are deleted and replaced with the file contents. Always upload a complete player file, not a partial one.

### Pending Signups

New coach registrations with `status = pending` appear here:

Each pending application shows:
- Team shortcode and full name
- Coach name, email, and mobile
- League ID they registered for
- Date applied

**Actions:**
- Click **"Approve"** (green) — activates the account; coach can now log in
- Click **"Reject"** (red) — removes the application
- Click **"Refresh"** to reload the pending list

### League Settings (Rules Editor)

All configurable league rules are displayed in an editable list.

| Rule | Description |
|------|-------------|
| `cuts_year` | Current season year (shown throughout the app) |
| `draft_year` | Draft year for the Draft Board |
| `season_games` | Number of regular season games |
| `playoff_teams` | Number of teams making the playoffs |
| `limit_protected` | Maximum players coaches can protect in cuts |
| `limit_pullback` | Maximum pullback selections in cuts |
| `cuts_due_date` | Cuts submission deadline (YYYY-MM-DD format) |
| `limit_roster` | Roster size limit (if enforced) |
| `draft_start` | Draft start date |
| `player_sync` | Timestamp of last player data sync (auto-updated on import) |

**To edit a rule:**
1. Click the value field next to the rule name
2. Type the new value
3. Press **Enter** or click **"Save"** (button turns blue when there are unsaved changes)
4. A green "Saved" confirmation appears

**Initialize Defaults:**
Click **"+ Init Defaults"** to create any rules that don't yet exist for the current league. Existing rules are not overwritten.

---

<a id="league-switcher"></a>

## 17. League Switcher

If your account has access to multiple leagues, a **league switcher** dropdown appears in the top navigation bar.

### Switching Leagues

1. Click the current league name in the nav bar
2. A dropdown shows all available leagues
3. Click a league to switch

After switching:
- All pages reload with the selected league's data
- The league name in the navigation updates
- Your selection is saved in a browser cookie for future visits
- Every page, API call, and data fetch uses the selected league's isolated dataset

Each league is completely independent — teams, players, standings, schedule, draft picks, rules, and resources are all separate per league.

---

## Appendix: Status & Badge Reference

### Transaction Status Colors
| Badge | Color | Meaning |
|-------|-------|---------|
| Pending | Amber | Submitted, awaiting processing |
| On Team | Blue | Commissioner acknowledged, processing |
| Done | Green | Finalized |

### Transaction Type Colors
| Type | Color |
|------|-------|
| ADD / INJURY PICKUP | Blue |
| DROP / WAIVE | Red |
| IR / IR MOVE | Orange |
| TRADE | Purple |

### Draft Pick Status
| Status | Meaning |
|--------|---------|
| Finalized | Pick has been made |
| On the Clock | Team is actively picking (timer running) |
| Late Selection | Timer expired, pick still pending submission |
| Locked | Pick not yet reached in draft order |

### Cuts Compliance Colors
| Color | Meaning |
|-------|---------|
| Blue highlight | Currently selected team |
| Green highlight | Team has fully completed their cuts submission |
| Default | Team has not yet completed submission |

---

## Appendix: Timezone Note

All timestamps in the app are displayed in **Eastern Time (ET)** — America/New_York. This applies to:
- Transaction log timestamps
- Draft pick timestamps
- Player sync timestamps
- Draft clock countdown (deadlines are calculated in ET)
