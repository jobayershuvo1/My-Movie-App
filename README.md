# CineVault 🎬

A full-stack movie download platform with an admin CMS, AI-powered movie metadata autofill, user authentication, ratings, notifications, and download-link management.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 4, React Router 7 |
| State | Zustand 5 |
| Backend | Express 4 (Node.js / TypeScript, served via `tsx` in dev) |
| Database & Auth | Supabase (PostgreSQL + Row Level Security + Realtime) |
| AI | Google Gemini API (`gemini-2.0-flash`) — movie metadata autofill |
| Media scraping | TMDB HTML scraping + YouTube trailer extraction |
| Animation | Framer Motion (`motion`) |
| SEO | `react-helmet-async` |

---

## Features

- **Public**: Browse movies, search, filter by category/genre, view movie detail with trailer embed, download links, star ratings, movie requests
- **Auth**: Register / Login / Forgot Password via Supabase Auth
- **Admin CMS** (roles: `super_admin`, `admin`, `editor`, `moderator`):
  - Movies CRUD with AI autofill (title → poster, cover, trailer, synopsis, genres)
  - Download link management with click tracking and broken-link reporting
  - User management (super_admin only)
  - Activity log viewer
  - Realtime notifications system
- **Notifications**: DB triggers auto-notify users when their movie request is approved/fulfilled/rejected, and broadcast when a new movie is published

---

## Local Development

**Prerequisites:** Node.js 18+

1. Clone:
   ```bash
   git clone https://github.com/jobayershuvo1/My-Movie-App.git
   cd My-Movie-App
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy env file and fill in values:
   ```bash
   cp .env.example .env.local
   ```
   Required variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`

4. Apply the database schema:
   - Open [Supabase Dashboard](https://supabase.com/dashboard) → SQL Editor
   - Paste and run `supabase/schema.sql`

5. Run dev server:
   ```bash
   npm run dev
   ```
   App runs at `http://localhost:3000`

---

## Database Schema

Tables (all with RLS enabled):

| Table | Purpose |
|---|---|
| `profiles` | Extends `auth.users` — stores role, name, avatar |
| `movies` | Movie catalog |
| `categories` | Genres and categories (many-to-many via `movie_categories`) |
| `download_links` | Per-movie download servers with quality labels |
| `movie_requests` | User-submitted movie requests |
| `movie_ratings` | 1-5 star ratings with optional review text |
| `notifications` | Per-user or broadcast (NULL user_id) notifications |
| `activity_logs` | Audit log of all system events |
| `download_reports` | User-reported broken links |

DB triggers handle: auto-create profile on signup, auto-promote designated admin email, notification fanout on request status change and new movie publish, full audit logging for movies/ratings/requests.

---

## Environment Variables

See [.env.example](.env.example) for full reference.

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key for movie autofill |
| `APP_URL` | optional | Deployed URL for OAuth callbacks |
| `VITE_SUPER_ADMIN_EMAIL` | optional | Override the default super-admin email |

---

## Deployment

### Vercel (recommended for frontend + serverless API)

1. Push to GitHub
2. Import repo in [Vercel](https://vercel.com)
3. Add all env vars in Vercel → Project Settings → Environment Variables
4. Deploy — `vercel.json` handles SPA routing and `/api/*` rewrites

### Docker / Railway / Render

```bash
npm run build   # builds Vite frontend + bundles server to dist/server.cjs
npm start       # runs the Express server serving static + API
```

Set all env vars in your platform and deploy. No Dockerfile needed for Railway/Render — they detect `npm run build` + `npm start` automatically.

---

## Security Notes

- All DB tables use Supabase Row Level Security
- Super-admin role is granted server-side (DB trigger on email match) and client-side on login
- `VITE_SUPER_ADMIN_EMAIL` can override the default admin email without code changes
- Admin-only routes are protected at both React Router level and DB RLS level
- Media scraping uses server-side Express route — no API keys exposed to client
- `GEMINI_API_KEY` is server-side only (never prefixed with `VITE_`)
