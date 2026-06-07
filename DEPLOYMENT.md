# Production Deployment Guide: CineVault

This guide covers deploying the CineVault Full Stack Application.

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
