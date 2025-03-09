-- Create deployments table to track Netlify deployments
create table if not exists deployments (
  id uuid primary key default uuid_generate_v4(),
  game_id uuid references games(id) on delete cascade,
  version_id uuid references game_versions(id) on delete cascade,
  site_id text not null,
  site_name text not null,
  site_url text not null,
  provider text not null,
  created_at timestamp with time zone default now()
);

-- Add indexes for faster queries
create index if not exists deployments_game_id_idx on deployments(game_id);
create index if not exists deployments_version_id_idx on deployments(version_id);

-- Add RLS policies
alter table deployments enable row level security;

-- Allow users to view their own deployments
create policy "Users can view their own deployments"
  on deployments for select
  using (
    game_id in (
      select id from games where user_id = auth.uid()
    )
  );

-- Allow service role to insert deployments
create policy "Service role can insert deployments"
  on deployments for insert
  with check (true);
