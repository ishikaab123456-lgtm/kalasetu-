# KalaSetu AI — Supabase Setup

Your final project already contains the Supabase integration.  
The app also has a **local JSON fallback**, so it runs even before you create the Supabase account.

## What Supabase stores

- `profiles` — Artisan / Consumer profile
- `products` — Marketplace product catalogue
- `artisan_profiles` — Artisan profile/craft story
- `consumer_preferences` — What each consumer likes
- `interactions` — Views, wishlist actions and enquiries used by the recommendation engine
- `enquiries` — Consumer order/enquiry requests

## One-time setup

### 1. Create Supabase project

Create a Supabase project from the Supabase dashboard.

### 2. Create the database tables

Open:

`SQL Editor → New query`

Copy everything from:

`supabase/schema.sql`

Run it once.

### 3. Get your backend keys

Supabase:

`Project Settings → API`

Copy:
- Project URL
- `service_role` key

Never expose the `service_role` key in browser JavaScript or GitHub.

### 4. Create `.env`

Copy `.env.example` to `.env`.

Change:

```env
USE_SUPABASE=true
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_REAL_SERVICE_ROLE_KEY
```

### 5. Start KalaSetu

Double-click:

`START_KALASETU.bat`

or:

```powershell
npm install
npm start
```

Open:

`http://localhost:4000`

## How to confirm it is connected

Open:

`http://localhost:4000/api/database-status`

When Supabase is correctly configured:

```json
{
  "mode": "supabase",
  "configured": true
}
```

Without Supabase credentials it shows:

```json
{
  "mode": "local-json-fallback",
  "configured": false
}
```

That fallback is intentional so the SIH demo never becomes unusable.
