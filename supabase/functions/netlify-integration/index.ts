
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import * as uuid from "https://deno.land/std@0.132.0/uuid/mod.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Netlify API base URL
const NETLIFY_API_URL = "https://api.netlify.com/api/v1";
const NETLIFY_AUTH_URL = "https://app.netlify.com/authorize";
// Redirect URL after authorization (replace with your actual domain in production)
const REDIRECT_URL = Deno.env.get("REDIRECT_URL") || "http://localhost:5173";
const CLIENT_ID = Deno.env.get("NETLIFY_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("NETLIFY_CLIENT_SECRET");

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Handle CORS preflight requests
const handleCors = (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
};

// Start OAuth flow
const startOAuth = async (req: Request) => {
  const url = new URL(req.url);
  const gameId = url.searchParams.get("gameId");
  
  if (!gameId) {
    return new Response(JSON.stringify({ error: "Game ID is required" }), { 
      status: 400, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  
  if (!CLIENT_ID) {
    return new Response(JSON.stringify({ error: "Netlify Client ID is not configured" }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // Generate a state parameter to prevent CSRF
  const state = uuid.v4.generate();
  
  // Store the state and game ID in Supabase
  const { error } = await supabase
    .from('netlify_auth_state')
    .insert([{ state, game_id: gameId }]);
  
  if (error) {
    console.error("Error storing state:", error);
    return new Response(JSON.stringify({ error: "Failed to initiate OAuth flow" }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  
  // Construct OAuth URL
  const authUrl = new URL(NETLIFY_AUTH_URL);
  authUrl.searchParams.append("client_id", CLIENT_ID);
  authUrl.searchParams.append("redirect_uri", `${REDIRECT_URL}/netlify-callback`);
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("state", state);
  authUrl.searchParams.append("scope", "sites");
  
  return new Response(JSON.stringify({ authUrl: authUrl.toString() }), { 
    status: 200, 
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};

// Exchange code for token
const exchangeCodeForToken = async (code: string) => {
  try {
    const params = new URLSearchParams();
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("client_id", CLIENT_ID!);
    params.append("client_secret", CLIENT_SECRET!);
    params.append("redirect_uri", `${REDIRECT_URL}/netlify-callback`);
    
    const response = await fetch(`${NETLIFY_API_URL}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Token exchange error:", errorText);
      throw new Error(`Failed to exchange code: ${response.status} ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Token exchange error:", error);
    throw error;
  }
};

// Handle OAuth callback
const handleCallback = async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  
  if (!code || !state) {
    return new Response(JSON.stringify({ error: "Invalid callback parameters" }), { 
      status: 400, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  
  try {
    // Verify state parameter
    const { data, error } = await supabase
      .from('netlify_auth_state')
      .select('*')
      .eq('state', state)
      .single();
    
    if (error || !data) {
      console.error("State verification error:", error);
      return new Response(JSON.stringify({ error: "Invalid state parameter" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // Get game ID from state record
    const gameId = data.game_id;
    
    // Exchange code for access token
    const tokenData = await exchangeCodeForToken(code);
    
    // Store token in Supabase (securely)
    const { error: tokenError } = await supabase
      .from('netlify_tokens')
      .upsert([{ 
        game_id: gameId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_type: tokenData.token_type,
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      }]);
    
    if (tokenError) {
      console.error("Token storage error:", tokenError);
      return new Response(JSON.stringify({ error: "Failed to store token" }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // Clean up state record
    await supabase
      .from('netlify_auth_state')
      .delete()
      .eq('state', state);
    
    return new Response(JSON.stringify({ 
      success: true, 
      gameId, 
      message: "Authorization successful"
    }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Callback error:", error);
    return new Response(JSON.stringify({ error: "Failed to process callback" }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
};

// Deploy site to Netlify
const deploySite = async (req: Request) => {
  try {
    const { gameId, siteName } = await req.json();
    
    if (!gameId || !siteName) {
      return new Response(JSON.stringify({ error: "Game ID and site name are required" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // Get the token for this game
    const { data: tokenData, error: tokenError } = await supabase
      .from('netlify_tokens')
      .select('*')
      .eq('game_id', gameId)
      .single();
    
    if (tokenError || !tokenData) {
      console.error("Token retrieval error:", tokenError);
      return new Response(JSON.stringify({ error: "Authentication required" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // Get the game code
    const { data: gameData, error: gameError } = await supabase
      .from('game_versions')
      .select('code')
      .eq('game_id', gameId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();
    
    if (gameError || !gameData) {
      console.error("Game data retrieval error:", gameError);
      return new Response(JSON.stringify({ error: "Failed to retrieve game data" }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // Parse the code
    const { html, css, js } = parseGameCode(gameData.code);
    
    // Package into a deployable format
    const siteZip = await packageSite(html, css, js);
    
    // Create site on Netlify
    const site = await createNetlifySite(tokenData.access_token, siteName);
    
    // Deploy to the site
    const deployment = await deploySiteToNetlify(tokenData.access_token, site.id, siteZip);
    
    return new Response(JSON.stringify({ 
      success: true, 
      site_id: site.id,
      site_name: site.name,
      site_url: site.ssl_url || site.url,
      deploy_id: deployment.id,
      deploy_url: deployment.deploy_ssl_url || deployment.deploy_url
    }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Deployment error:", error);
    return new Response(JSON.stringify({ error: "Deployment failed" }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
};

// Parse game code into HTML, CSS, and JS
const parseGameCode = (code: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(code, 'text/html');
  
  // Extract CSS
  const styles = Array.from(doc.getElementsByTagName('style')).map(style => style.textContent).join('\n');
  
  // Extract JS
  const scripts = Array.from(doc.getElementsByTagName('script')).map(script => script.textContent).join('\n');
  
  // Remove style and script tags from HTML
  doc.querySelectorAll('style').forEach(style => style.remove());
  doc.querySelectorAll('script').forEach(script => script.remove());
  
  // Add links to CSS and JS files
  if (styles) {
    const linkTag = doc.createElement('link');
    linkTag.rel = 'stylesheet';
    linkTag.href = './styles.css';
    doc.head.appendChild(linkTag);
  }
  
  if (scripts) {
    const scriptTag = doc.createElement('script');
    scriptTag.src = './script.js';
    doc.body.appendChild(scriptTag);
  }
  
  return {
    html: doc.documentElement.outerHTML,
    css: styles,
    js: scripts
  };
};

// Package site files into a ZIP
const packageSite = async (html: string, css: string, js: string) => {
  const zip = new JSZip();
  
  zip.file('index.html', html);
  if (css) zip.file('styles.css', css);
  if (js) zip.file('script.js', js);
  
  // Generate the ZIP as a blob
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return zipBlob;
};

// Create a new site on Netlify
const createNetlifySite = async (token: string, name: string) => {
  const response = await fetch(`${NETLIFY_API_URL}/sites`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create site: ${response.status} ${errorText}`);
  }
  
  return await response.json();
};

// Deploy files to a Netlify site
const deploySiteToNetlify = async (token: string, siteId: string, zipBlob: Blob) => {
  const formData = new FormData();
  formData.append('file', zipBlob, 'site.zip');
  
  const response = await fetch(`${NETLIFY_API_URL}/sites/${siteId}/deploys`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to deploy site: ${response.status} ${errorText}`);
  }
  
  return await response.json();
};

// Check token status
const checkToken = async (req: Request) => {
  const url = new URL(req.url);
  const gameId = url.searchParams.get("gameId");
  
  if (!gameId) {
    return new Response(JSON.stringify({ error: "Game ID is required" }), { 
      status: 400, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  
  // Check if token exists for this game
  const { data, error } = await supabase
    .from('netlify_tokens')
    .select('*')
    .eq('game_id', gameId)
    .maybeSingle();
  
  if (error) {
    console.error("Token check error:", error);
    return new Response(JSON.stringify({ error: "Failed to check token status" }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  
  return new Response(JSON.stringify({ 
    authorized: !!data,
    expires_at: data?.expires_at
  }), { 
    status: 200, 
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};

// Main request handler
serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  
  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();
  
  try {
    if (req.method === 'GET') {
      if (path === 'start-oauth') {
        return await startOAuth(req);
      } else if (path === 'callback') {
        return await handleCallback(req);
      } else if (path === 'check-token') {
        return await checkToken(req);
      }
    } else if (req.method === 'POST') {
      if (path === 'deploy') {
        return await deploySite(req);
      }
    }
    
    return new Response(JSON.stringify({ error: "Not Found" }), { 
      status: 404, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Request error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
