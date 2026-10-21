# Safe metadata-only site-content sync

This utility updates the existing MongoDB `content` document whose key is `site-content` using approved fields from `src/data/content.json`.

## Exactly what can change

- The top-level `siteName` and `author` fields.
- For the existing TDGLTE book with slug `the-day-good-lost-to-evil`: `title`, `shortTitle`, `subtitle`, `tagline`, `summary`, `coverAsset`, and `metadata`.

## What it deliberately preserves

- The entire existing TDGLTE chapter array, including chapter text, order, IDs, and chapters added through the admin dashboard.
- TDGLTE lore and future-title arrays.
- All other book records, including any database-only books.
- Comments, likes, comment reports, messages, characters, and all other collections.
- Any other existing fields in the `site-content` document that are not explicitly listed as updateable above.

If the database does not already contain the TDGLTE book record, the script stops instead of creating a new one.

## Safety behavior

- Running without flags is a **dry run**. It reads the current document and reports what would change without writing.
- Running with `--apply` first saves the complete current MongoDB document in `content_backups`, then updates only the existing `site-content` record.
- The update checks the record's current `updatedAt` value to avoid overwriting a concurrent change.
- The script refuses to create a missing `site-content` record.

## Run on Windows PowerShell

From the repository root:

```powershell
cd backend
node src/scripts/sync-site-content.js
```

Review the dry-run report. Confirm the target database and the metadata-only change scope before applying:

```powershell
node src/scripts/sync-site-content.js --apply
```

The script reads `backend/.env` and requires `MONGODB_URI` (or `DATABASE_URL`). `MONGODB_DB` is optional if the connection string already selects a database. Never paste your database URI or credentials into chat or commit them to Git.

This utility updates the database directly. It does not require a redeploy for stored content to change, although frontend source-code changes require the normal deployment pipeline.
