# TDGLTE — separated architecture

This package keeps the existing React design but separates the application into three clear folders:

- `frontend/` — React + Vite UI
- `backend/` — Express API, admin authentication, messages, uploads and content APIs
- `database/` — PostgreSQL schema and initial content seed

## Local development

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Backend defaults to `http://localhost:3001`.

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend defaults to `http://localhost:5173`. During local development, the Vite proxy sends `/api` to port 3001, so `VITE_API_URL` can stay blank.

### 3. PostgreSQL database

Create a PostgreSQL database and run `database/schema.sql`, then set `DATABASE_URL` in `backend/.env`. The backend will also migrate the bundled legacy content into PostgreSQL when the database is initially empty.

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
DATABASE_URL=YOUR-POSTGRES-CONNECTION-STRING
DB_SSL=true
```

`CLIENT_ORIGIN` accepts comma-separated origins when more than one frontend hostname is needed.

For production, configure `DATABASE_URL`. Vercel serverless filesystems are not suitable for permanent content/message storage.
