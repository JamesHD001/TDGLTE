# TDGLTE

TDGLTE is split into three areas:

- `frontend/`: React + Vite website
- `backend/`: Express API, admin authentication, messages, uploads, comments, likes, and content APIs
- `database/`: historical PostgreSQL schema and seed material from the earlier database setup

## Database status

The backend now uses **MongoDB** through the official MongoDB Node.js driver. MongoDB Atlas is the production persistence target. PostgreSQL was the previous database; the files in `database/` are historical reference material and are not used by the current backend.

If your MongoDB Atlas database already contains the recovered project data, keep that database intact. Do not run a migration, drop collections, or replace its contents just to deploy this branch. Confirm the database name and collection contents in Atlas first, then use the matching connection string.

## Local development

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Backend defaults to `http://localhost:3001`.

Set `MONGODB_URI` and `MONGODB_DB` in `backend/.env` if you want to test against Atlas. For local-only work without MongoDB, the backend can still use its development file fallback. Never use that fallback in production.

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend defaults to `http://localhost:5173`. During local development, the Vite proxy sends `/api` to port 3001, so `VITE_API_URL` can stay blank.

## Production / Vercel

Deploy `frontend` and `backend` as separate Vercel projects, with the backend project root set to `backend` and the frontend project root set to `frontend`.

Frontend environment:

```env
VITE_API_URL=https://YOUR-BACKEND-DOMAIN
```

Backend environment:

```env
NODE_ENV=production
CLIENT_ORIGIN=https://YOUR-FRONTEND-DOMAIN
SESSION_SECRET=YOUR-RANDOM-SECRET-AT-LEAST-32-CHARACTERS
ADMIN_USERNAME=YOUR-ADMIN-USERNAME
ADMIN_PASSWORD=YOUR-UNIQUE-PASSWORD-AT-LEAST-16-CHARACTERS
MONGODB_URI=YOUR-MONGODB-ATLAS-CONNECTION-STRING
MONGODB_DB=YOUR-EXISTING-DATABASE-NAME
```

Use exact HTTPS frontend origins, comma-separated if required. Generate a unique session secret locally and enter it directly in Vercel environment settings. Never commit production credentials or paste them into chat.

Production startup now fails if the MongoDB URI, admin credentials, session secret, or HTTPS client origin is missing or invalid. MongoDB connection failure also prevents the production app from silently falling back to temporary filesystem storage.

## Security notes

- Rotate any admin password that has ever been committed to Git.
- Removing a credential from the latest commit does not remove it from Git history. Treat it as compromised and rotate it; rewrite history only if needed and coordinated with collaborators.
- The production backend stores sessions and login rate-limit counters in MongoDB, not Express's in-memory session store.
- Review the Atlas database user for least privilege and restrict Atlas network access to the deployment's supported access path. Avoid broad network access unless it is a temporary, understood requirement.
- Verify production behavior on a preview deployment before assigning a live domain.
