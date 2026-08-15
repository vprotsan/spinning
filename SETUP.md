# Setup

This app needs three things you'll need to create yourself: a Spotify
Developer app, a Supabase Postgres database, and (when you're ready to ship)
a Vercel project. None of these can be created on your behalf — they all
require your own accounts/credentials.

## 1. Spotify Developer app

1. Go to https://developer.spotify.com/dashboard and log in with your Spotify
   account.
2. Click **Create app**. Fill in any name/description.
3. Add a **Redirect URI**: for local development, use
   `http://127.0.0.1:3000/api/auth/callback` (Spotify requires `127.0.0.1`,
   not `localhost`, for loopback redirects). Add your production URL's
   equivalent later (e.g. `https://your-app.vercel.app/api/auth/callback`).
4. Save. Copy the **Client ID** and **Client Secret** — you'll need both.
5. Note: your Spotify account (and any account that logs in while the app is
   in Development Mode) must be Premium, per the requirements doc — the app
   needs Premium for the Web Playback SDK (Mark Start/Mark End, playlist
   playback).
6. While the app is in Spotify's "Development Mode" (the default for new
   apps), only Spotify accounts you explicitly add under **Users and Access**
   in the dashboard can log in. Add your own account (and anyone else
   testing) there.

## 2. Supabase Postgres

1. Create a project at https://supabase.com.
2. In your project, go to **Project Settings → Database → Connection string**
   and copy the **URI** under the **Transaction pooler** tab (port 6543) —
   this is the one to use for `DATABASE_URL`, since serverless/Vercel
   functions need pooled connections.
3. You'll only use Supabase for its Postgres database here — the app handles
   its own auth via Spotify OAuth, not Supabase Auth.

## 3. Environment variables

Copy `.env.example` to `.env.local` and fill in the real values:

```bash
cp .env.example .env.local
```

- `DATABASE_URL` — the Supabase connection string from step 2.
- `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` — from step 1.
- `SPOTIFY_REDIRECT_URI` — must exactly match a Redirect URI registered on
  the Spotify app (step 1.3).
- `SESSION_SECRET` — any long random string, e.g. `openssl rand -base64 32`.
- `NEXT_PUBLIC_APP_URL` — your app's base URL (no trailing slash).

## 4. Install dependencies and create the database tables

```bash
npm install
npm run db:generate   # regenerates SQL from src/db/schema.ts if you change it
npm run db:migrate    # applies migrations in ./drizzle to your Supabase database
```

A migration is already checked in at `drizzle/0000_stormy_unicorn.sql` for
the current schema (Section 9 of the v2 requirements doc: users, songs,
notes, playlists, playlist_songs).

## 5. Run it locally

```bash
npm run dev
```

Visit http://127.0.0.1:3000 and log in with Spotify.

## 6. Deploying to Vercel

1. Push this repo to GitHub (or GitLab/Bitbucket) and import it into Vercel.
2. Add the same environment variables from `.env.local` in the Vercel
   project's **Settings → Environment Variables** — but set
   `SPOTIFY_REDIRECT_URI` and `NEXT_PUBLIC_APP_URL` to your production URL
   (e.g. `https://your-app.vercel.app`).
3. Add that production redirect URI to the Spotify app's **Redirect URIs**
   list too (step 1.3) — Spotify rejects callbacks to URIs not on the list.
4. Deploy. Run `npm run db:migrate` locally (pointed at the same
   `DATABASE_URL`) before or after the first deploy — Vercel doesn't run
   migrations for you.

## What's implemented vs. what to verify

The core v2 flows are implemented end-to-end (see the v2 requirements doc in
the CyclingMusic project): Spotify OAuth, search/library browsing, My Songs
with optional category tags and time-stamped notes (Mark Start/Mark End via
the Web Playback SDK), multiple flat/reorderable playlists, and
save/re-save to Spotify per playlist. Section 10 (Track Transitions /
"Smooth Transitions") has a UI toggle and a `smoothTransitions` field wired
up end-to-end, but the actual fade-out/fade-in playback logic described in
Section 10.2 is **not yet implemented** — per the requirements doc, it's
explicitly deferred until the rest of the app is built and tested.

This code has not been run against a live Spotify Premium account (the
sandbox this was built in has no browser or real Spotify credentials to test
with) — so the OAuth flow and the Web Playback SDK integration in particular
are implemented per Spotify's documented API/SDK behavior but unverified
end-to-end. Test those first once you have real credentials plugged in, and
open an issue/fix forward if anything doesn't match Spotify's current
behavior.
