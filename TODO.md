# TDGLTE Migration TODO

## MongoDB migration

- [x] Audit the existing MongoDB persistence layer.
- [x] Create a dedicated MongoDB migration branch.
- [x] Remove PostgreSQL connection variables from the active backend configuration examples.
- [x] Update backend and database documentation to describe MongoDB as the active persistence layer.
- [x] Make backend database initialization depend on `MONGODB_URI` instead of the legacy `DATABASE_URL`.
- [ ] Add and run a local JSON → MongoDB import utility.
- [ ] Create the free MongoDB Atlas cluster.
- [ ] Configure Atlas database user and network access.
- [ ] Import the available local content/character data into Atlas.
- [ ] Verify all API features against MongoDB: content, messages, comments, replies, likes, reports, and characters.
- [ ] Configure production environment variables.
- [ ] Deploy and run a production smoke test.

## Render PostgreSQL recovery

- [ ] Preserve the expired Render PostgreSQL database during its 14-day recovery window.
- [ ] If funding becomes available, export the database with `pg_dump` before deletion.
- [ ] If the old database becomes accessible, compare its records with the MongoDB dataset.
- [ ] Do not delete the legacy PostgreSQL schema/reference files until recovery is no longer possible.

## Security cleanup

- [ ] Remove the tracked `backend/src/data/admin.json` credential fallback after confirming environment-based admin credentials work locally.
- [ ] Rotate any credentials that may previously have been stored in repository files.
- [ ] Replace the development fallback `SESSION_SECRET` before production deployment.
