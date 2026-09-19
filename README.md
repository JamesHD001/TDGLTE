# TDGLTE — separated architecture

This package keeps the existing React design but separates the application into three clear folders:

- `frontend/` — React + Vite UI
- `backend/` — Express API, admin authentication, messages, uploads and MongoDB persistence
- `database/` — MongoDB configuration/reference files and retained legacy PostgreSQL migration material

## Local development

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Backend defaults to `http://localhost:3001`.

Set these MongoDB variables in `backend/.env`:

```env
MONGODB_URI=your-mongodb-connection-string
MONGODB_DB=mysticpenhd
```

If MongoDB is not configured, the backend falls back to the local JSON persistence files.

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend defaults to `http://localhost:5173`. During local development, the Vite proxy sends `/api` to port 3001, so `VITE_API_URL` can stay blank.

## Production / Vercel

Deploy `frontend` and `backend` as separate Vercel projects.

Frontend environment:

```env
VITE_API_URL=https://YOUR-BACKEND-DOMAIN
```

Backend environment:

```env
NODE_ENV=production
CLIENT_ORIGIN=https://YOUR-FRONTEND-DOMAIN
SESSION_SECRET=YOUR-LONG-RANDOM-SECRET
ADMIN_USERNAME=YOUR-ADMIN-USERNAME
ADMIN_PASSWORD=YOUR-STRONG-PASSWORD
MONGODB_URI=YOUR-MONGODB-CONNECTION-STRING
MONGODB_DB=mysticpenhd
```

`CLIENT_ORIGIN` accepts comma-separated origins when more than one frontend hostname is needed.

For production, configure MongoDB. Vercel serverless filesystems are not suitable for permanent content/message storage.
