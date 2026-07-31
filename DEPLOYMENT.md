# Production Deployment Guide: CineVault

This guide covers deploying the CineVault Full Stack Application.

## Automatic licensed movie imports

The production deployment calls `/api/cron/import-movies?limit=3` once per day.
The importer checks Wikimedia Commons first and Internet Archive as a fallback.
It only accepts items carrying verifiable Creative Commons or public-domain
metadata, selects a full-length video, checks that the file responds, and then
creates the movie and its direct download link together.

Set a long random `CRON_SECRET` in Vercel for Production. For a manual local run:

```bash
curl -X POST http://localhost:3000/api/movies/import-licensed \
  -H "Content-Type: application/json" \
  -d '{"limit": 3}'
```

Vercel's `/tmp` SQLite database is ephemeral. For a durable production catalog,
connect a persistent SQLite-compatible database such as Turso before relying on
the cron job for long-term storage.

## Architecture
- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Express containerized OR Vercel Serverless (using `vercel.json`)
- **Database & Auth**: Supabase (PostgreSQL)

## Deployment Options

### Option 1: Vercel (Recommended for Next.js / Frontend)
1. Fork or clone the repository to your GitHub account.
2. Log into [Vercel](https://vercel.com) and click Add New Project. 
3. Import your GitHub repository.
4. Add the Environment Variables required to run the project.
5. Deploy. Vercel will automatically read `vercel.json` and deploy your Vite application along with the API routes.

### Option 2: Docker / DigitalOcean App Platform / Railway
The project comes with start scripts prepared for containerized Node.js execution.

1. Create a generic Node application in App Platform or Railway.
2. The platform will read `package.json` and automatically run `npm run build`.
3. The platform will start the server using `npm start`.

## Environment Variables

Ensure the following secrets are configured in your hosting provider:

```env
# Supabase Configuration
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key-here"

# (Optional) Cloud Settings
APP_URL="https://your-deployed-domain.com"
```

## Database Initialization
Before users can access the application, you must apply the SQL Schema.
1. Open the [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to the SQL Editor.
3. Paste the contents of `supabase/schema.sql` into the editor.
4. Run the query to generate all required tables, Row Level Security rules, and the storage buckets.

## Storage Configuration
The `media` bucket receives movie posters and covers via the Admin CMS. Ensure the bucket has "Public" access enabled in the Supabase Storage dashboard. Default policies exist in `schema.sql` to enforce that only users with the `admin` or `editor` role can upload media.
