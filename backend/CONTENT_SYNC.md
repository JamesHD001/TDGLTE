# Safe site-content sync

This utility syncs the approved local `src/data/content.json` into the existing MongoDB `content` document whose key is `site-content`.

## Safety behavior

- Running without flags is a **dry run**. It reads the current document and reports what it would do without writing.
- Running with `--apply` first saves the complete current MongoDB document in `content_backups`, then updates only the `value` and `updatedAt` fields of the existing `site-content` record.
- It does not delete or rewrite comments, likes, comment reports, messages, characters, or their collections.
- If MongoDB contains more chapters for a matching book than the local JSON does, the script preserves the longer database chapter list.
- Books that exist only in MongoDB are retained.
- The script refuses to create a missing `site-content` record.

## Run on Windows PowerShell

From the repository root:

```powershell
cd backend
node src/scripts/sync-site-content.js
```

Review the dry-run report first. If the source content and preservation report look correct, apply deliberately:

```powershell
node src/scripts/sync-site-content.js --apply
```

The script reads `backend/.env` and requires `MONGODB_URI` (or `DATABASE_URL`). `MONGODB_DB` is optional if the connection string already selects a database. Never paste your database URI or credentials into chat or commit them to Git.

This utility updates the database directly. It does not require a redeploy for the stored content to change, although frontend source-code changes do require the normal deployment pipeline.
