# TDGLTE Project TODO

## Security hardening
- [x] Remove the committed admin credential file and stop loading credentials from disk.
- [x] Require production admin credentials, a strong session secret, MongoDB, and HTTPS client origins.
- [x] Add MongoDB-backed sessions and login rate limiting for production.
- [x] Prevent production file-based persistence fallback.
- [x] Add baseline HTTP security headers and remove the invalid-TLS-certificate escape hatch.
- [ ] Rotate the previously committed admin password in Vercel and any other place it was reused.
- [ ] Confirm the admin credential file is removed from Git history if history cleanup is appropriate.
- [ ] Configure a least-privilege MongoDB Atlas database user and review Atlas network access.
- [ ] Add a tailored Content-Security-Policy after validating all frontend asset sources.

## Database
- [x] Confirm the current backend is MongoDB-based; PostgreSQL files are historical.
- [ ] Verify the existing MongoDB Atlas database name and confirm content, characters, comments, likes, reports, and messages are present before deployment.
- [ ] Set MONGODB_URI and MONGODB_DB in Vercel without sharing the values.
- [ ] Back up/export the Atlas database before changing production settings.

## Verification and deployment
- [ ] Run backend syntax checks and frontend build/lint locally.
- [ ] Run dependency vulnerability audits for backend and frontend.
- [ ] Verify API routes reach the backend on a preview deployment.
- [ ] Test admin login, failed-login throttling, session persistence across serverless requests, and logout.
- [ ] Test public comments, replies, likes, reports, contact messages, and admin moderation against Atlas.
- [ ] Confirm all admin endpoints reject unauthenticated requests.
- [ ] Confirm production startup fails safely when required environment variables or MongoDB are unavailable.
- [ ] Verify frontend-to-backend cookie behavior using the actual production domains.
- [ ] Confirm preview checks pass before attaching or promoting the live domain.
