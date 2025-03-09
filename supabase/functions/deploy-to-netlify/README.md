# Deploy to Netlify Function

This Supabase Edge Function allows you to deploy projects directly to Netlify using their API.

## Setup

1. Add your Netlify API key to your Supabase project's environment variables:

```bash
supabase secrets set NETLIFY_API_KEY=your_netlify_api_key
```

2. Deploy the function to your Supabase project:

```bash
supabase functions deploy deploy-to-netlify
```

## How It Works

The function:

1. Accepts a game ID, version ID, and optional site title
2. Fetches the game version code from the database
3. Extracts and separates HTML, CSS, and JavaScript
4. Deploys the files to Netlify using their API
5. Saves the deployment information to your database

## API

### Request

```json
{
  "gameId": "your-game-id",
  "versionId": "your-version-id",
  "siteTitle": "optional-site-title"
}
```

### Response

```json
{
  "success": true,
  "deployment": {
    "siteId": "netlify-site-id",
    "siteName": "netlify-site-name",
    "siteUrl": "https://your-site-url.netlify.app",
    "adminUrl": "https://app.netlify.com/sites/your-site-name"
  }
}
```

## Database Schema

This function expects a `deployments` table with the following schema:

```sql
create table deployments (
  id uuid primary key default uuid_generate_v4(),
  game_id uuid references games(id) on delete cascade,
  version_id uuid references game_versions(id) on delete cascade,
  site_id text not null,
  site_name text not null,
  site_url text not null,
  provider text not null,
  created_at timestamp with time zone default now()
);
```

## Error Handling

The function includes comprehensive error handling and will return detailed error messages if something goes wrong during the deployment process.
