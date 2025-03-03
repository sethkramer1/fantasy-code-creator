
-- Create table to store OAuth state
CREATE TABLE IF NOT EXISTS public.netlify_auth_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state UUID NOT NULL UNIQUE,
  game_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table to store Netlify OAuth tokens
CREATE TABLE IF NOT EXISTS public.netlify_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE public.netlify_auth_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.netlify_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies for the auth state table (only service role can access)
CREATE POLICY "Service role can read auth state" 
  ON public.netlify_auth_state
  FOR SELECT 
  USING (true);

CREATE POLICY "Service role can insert auth state" 
  ON public.netlify_auth_state
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Service role can delete auth state" 
  ON public.netlify_auth_state
  FOR DELETE 
  USING (true);

-- Create policies for the tokens table (only service role can access)
CREATE POLICY "Service role can read tokens" 
  ON public.netlify_tokens
  FOR SELECT 
  USING (true);

CREATE POLICY "Service role can insert tokens" 
  ON public.netlify_tokens
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Service role can update tokens" 
  ON public.netlify_tokens
  FOR UPDATE 
  USING (true);

CREATE POLICY "Service role can delete tokens" 
  ON public.netlify_tokens
  FOR DELETE 
  USING (true);
