# Academy Compass

A school management platform built with:
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Backend**: Node.js + Express (REST API)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (handled on the client side)

## Project Structure

```
academy-compass/
├── frontend/          # React + Vite app
├── backend/           # Express REST API
└── supabase_schema.sql  # Run this in your Supabase SQL editor
```

---

## 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. In the Supabase SQL Editor, run `supabase_schema.sql`
3. Enable the Auth provider you want (Google OAuth, email/password, etc.)
4. Note your **Project URL**, **Anon Key**, and **Service Role Key**

---

## 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Fill in your Supabase values in .env
npm install
npm run dev      # starts on http://localhost:3001
```

### Backend `.env`

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FRONTEND_URL=http://localhost:5173
PORT=3001
```

### Testing the backend

```bash
curl http://localhost:3001/api/health
# → { "status": "ok", "timestamp": "..." }
```

---

## 3. Frontend Setup

```bash
cd frontend
cp .env.example .env
# Fill in your Supabase values in .env
npm install
npm run dev      # starts on http://localhost:5173
```

### Frontend `.env`

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

The Vite dev server proxies `/api/*` to `http://localhost:3001` automatically.

---

## 4. How Auth Works

- The **frontend** handles sign-in via Supabase Auth (OAuth or email/password)
- After signing in, the Supabase session gives a JWT
- Every API request sends this JWT in the `Authorization: Bearer <token>` header
- The **backend** validates the JWT using the Supabase service role key
- On first login, the backend auto-creates a user record in the `users` table

### Sending the Auth Token from the Frontend

The `api.ts` client automatically adds the token. The `useAuth` hook retrieves the
Supabase session and sets it on requests. If you want to manually test with curl:

```bash
# Get a token from Supabase (or from browser localStorage → sb-auth-token)
TOKEN="your-jwt-token"
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/auth/me
```

---

## 5. Production Deployment

### Backend
Deploy to Railway, Render, Fly.io, or any Node.js host. Set the environment variables.

### Frontend
```bash
cd frontend
npm run build    # outputs to dist/
```
Deploy `dist/` to Vercel, Netlify, or any static host.

In production, set `VITE_API_URL=https://your-api.example.com/api` in the frontend's
environment (or configure your hosting to proxy `/api` to the backend).

---

## API Overview

All endpoints are prefixed with `/api`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/me` | Current user |
| POST | `/auth/logout` | Sign out |
| GET | `/users` | List users |
| GET | `/users/:id/scorecard` | User scorecard |
| GET | `/projects` | List projects |
| GET | `/projects?stats=true` | Projects with task counts |
| POST | `/projects` | Create project |
| GET | `/tasks` | List all tasks |
| GET | `/tasks?projectId=N` | Tasks by project |
| GET | `/tasks?calendar=true` | Tasks for calendar |
| GET | `/tasks?archived=true` | Archived tasks |
| GET | `/tasks/search?q=...` | Search tasks |
| POST | `/tasks` | Create task |
| PATCH | `/tasks/:id` | Update task |
| POST | `/tasks/:id/archive` | Archive task |
| POST | `/tasks/bulk-delete` | Bulk archive |
| GET | `/tasks/:id/subtasks` | List subtasks |
| GET | `/tasks/:id/comments` | List comments |
| GET | `/dashboard/stats` | Dashboard stats |
| GET | `/milestones?calendar=true` | Milestones for calendar |
| GET | `/strategic-organizer` | Strategic organizer data |
| GET | `/announcements` | List announcements |
| GET | `/notifications/preview-digest` | Preview digest |
| GET | `/api/health` | Health check |
