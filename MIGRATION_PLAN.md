# Google Sheets to Vercel Postgres Migration Plan

This document outlines the plan to migrate the GFL application from using Google Sheets as a backend to a Vercel Postgres database.

## Phase 1: Schema Definition and Initial Setup (Complete)

1.  **Analyze Existing Google Sheets Integration**: Identify all the parts of the codebase that interact with the Google Sheets API.
2.  **Define Database Schema**: Create a Drizzle ORM schema in `schema.ts` that models the data currently stored in Google Sheets. This includes tables for teams, players, transactions, draft picks, etc.
3.  **Set up Database Connection**: Configure the application to connect to the Vercel Postgres database using environment variables.

## Phase 2: Data Migration

1.  **Create Migration Scripts**: Write scripts to extract data from each Google Sheet tab (`Transactions`, `DraftPicks`, `Cuts`, `Players`, `Coaches/Teams`, `Rules`, `Resources`, `Standings`, `Schedule`).
2.  **Transform Data**: Transform the data from the format in Google Sheets to match the new database schema. This may involve mapping team names to foreign keys, etc.
3.  **Load Data into Postgres**: Run the migration scripts to populate the Vercel Postgres database with the transformed data.

## Phase 3: API Refactoring

For each API endpoint and server-side function that currently interacts with Google Sheets, we will perform the following:

1.  **Identify Data Fetching Logic**: Pinpoint the code that reads from or writes to Google Sheets.
2.  **Replace with Drizzle ORM**: Replace the Google Sheets API calls with Drizzle ORM queries to interact with the new Postgres database.
3.  **Test**: Thoroughly test each refactored endpoint to ensure it behaves as expected.

### Refactoring Order:

The following is a recommended order for refactoring the API endpoints:

1.  `lib/getStandings.ts`
2.  `lib/transactions.ts`
3.  `lib/draftPicks.ts`
4.  `lib/players.ts`
5.  `lib/cuts.ts`
6.  `lib/getSchedule.ts`
7.  `lib/rules.ts`
8.  `lib/getResources.ts`
9.  All other files in `lib/` and `app/api/` that use the Google Sheets API.

## Phase 4: Deprecation of Google Sheets

1.  **Remove Google Sheets Code**: Once all data is migrated and all APIs are refactored, remove the Google Sheets-related code (e.g., `lib/googleSheets.ts`, `lib/google-cloud.ts`).
2.  **Remove Environment Variables**: Remove the `GOOGLE_SHEET_ID` and other Google-related environment variables.