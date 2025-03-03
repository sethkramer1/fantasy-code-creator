
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface NetlifyTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const url = new URL(req.url);
    const path = url.searchParams.get("path");
    const gameId = url.searchParams.get("gameId");

    if (!path) {
      return new Response(
        JSON.stringify({ error: "Missing path parameter" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Netlify OAuth credentials
    const clientId = Deno.env.get("NETLIFY_CLIENT_ID");
    const clientSecret = Deno.env.get("NETLIFY_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: "Netlify credentials not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Netlify API base URL
    const netlifyApiUrl = "https://api.netlify.com/api/v1";

    // Handle different routes
    switch (path) {
      case "start-oauth": {
        if (!gameId) {
          return new Response(
            JSON.stringify({ error: "Missing gameId parameter" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Generate a unique state for OAuth security
        const state = crypto.randomUUID();
        
        // Store the state and game ID in the database
        await supabaseClient.from("netlify_auth_state").insert({
          state,
          game_id: gameId,
        });

        // Redirect URL for OAuth callback
        const redirectUri = `${Deno.env.get("SITE_URL") || "http://localhost:3000"}/netlify-callback`;
        
        // Build the Netlify OAuth URL
        const authUrl = `https://app.netlify.com/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

        return new Response(
          JSON.stringify({ authUrl }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "exchange-code": {
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");

        if (!code || !state) {
          return new Response(
            JSON.stringify({ error: "Missing code or state parameter" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Look up the game ID from the state
        const { data: stateData, error: stateError } = await supabaseClient
          .from("netlify_auth_state")
          .select("game_id")
          .eq("state", state)
          .single();

        if (stateError || !stateData) {
          return new Response(
            JSON.stringify({ error: "Invalid state" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const gameId = stateData.game_id;

        // Exchange code for token using Netlify API
        const redirectUri = `${Deno.env.get("SITE_URL") || "http://localhost:3000"}/netlify-callback`;
        
        const tokenResponse = await fetch("https://api.netlify.com/oauth/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
          }),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          return new Response(
            JSON.stringify({ error: `Failed to exchange code: ${errorText}` }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const tokenData: NetlifyTokenResponse = await tokenResponse.json();
        
        // Calculate expiration time
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

        // Store the token in the database
        const { error: tokenError } = await supabaseClient
          .from("netlify_tokens")
          .upsert({
            game_id: gameId,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            token_type: tokenData.token_type,
            expires_at: expiresAt.toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (tokenError) {
          return new Response(
            JSON.stringify({ error: "Failed to store token" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Clean up the state entry
        await supabaseClient
          .from("netlify_auth_state")
          .delete()
          .eq("state", state);

        return new Response(
          JSON.stringify({ success: true, gameId }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "check-token": {
        if (!gameId) {
          return new Response(
            JSON.stringify({ error: "Missing gameId parameter" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Check if we have a valid token for this game
        const { data: tokenData, error: tokenError } = await supabaseClient
          .from("netlify_tokens")
          .select("access_token, expires_at")
          .eq("game_id", gameId)
          .single();

        if (tokenError || !tokenData) {
          return new Response(
            JSON.stringify({ authorized: false }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Check if token is expired
        const expiresAt = new Date(tokenData.expires_at);
        const now = new Date();
        const isExpired = expiresAt <= now;

        return new Response(
          JSON.stringify({ authorized: !isExpired }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "deploy": {
        if (req.method !== "POST") {
          return new Response(
            JSON.stringify({ error: "Method not allowed" }),
            {
              status: 405,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        try {
          const { gameId, siteName } = await req.json();

          if (!gameId || !siteName) {
            return new Response(
              JSON.stringify({ error: "Missing gameId or siteName" }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }

          // Get the game code
          const { data: gameData, error: gameError } = await supabaseClient
            .from("games")
            .select("code")
            .eq("id", gameId)
            .single();

          if (gameError || !gameData) {
            return new Response(
              JSON.stringify({ error: "Game not found" }),
              {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }

          // Get the Netlify token
          const { data: tokenData, error: tokenError } = await supabaseClient
            .from("netlify_tokens")
            .select("access_token, token_type")
            .eq("game_id", gameId)
            .single();

          if (tokenError || !tokenData) {
            return new Response(
              JSON.stringify({ error: "Netlify token not found" }),
              {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }

          // Create a site on Netlify
          const createSiteResponse = await fetch(`${netlifyApiUrl}/sites`, {
            method: "POST",
            headers: {
              Authorization: `${tokenData.token_type} ${tokenData.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: siteName,
            }),
          });

          if (!createSiteResponse.ok) {
            const errorText = await createSiteResponse.text();
            return new Response(
              JSON.stringify({ error: `Failed to create site: ${errorText}` }),
              {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }

          const siteData = await createSiteResponse.json();
          const siteId = siteData.id;
          
          // Parse the HTML code to prepare for deployment
          // Extract styles and scripts to separate files
          const code = gameData.code;
          const parser = new DOMParser();
          const doc = parser.parseFromString(code, "text/html");
          
          // Extract styles
          const styles = Array.from(doc.getElementsByTagName("style"))
            .map((style) => style.textContent)
            .join("\n");
          
          // Extract scripts
          const scripts = Array.from(doc.getElementsByTagName("script"))
            .map((script) => script.textContent)
            .join("\n");
          
          // Remove original styles and scripts
          doc.querySelectorAll("style").forEach((style) => style.remove());
          doc.querySelectorAll("script").forEach((script) => script.remove());
          
          // Add links to the extracted files
          if (styles) {
            const linkTag = doc.createElement("link");
            linkTag.rel = "stylesheet";
            linkTag.href = "./styles.css";
            doc.head.appendChild(linkTag);
          }
          
          if (scripts) {
            const scriptTag = doc.createElement("script");
            scriptTag.src = "./script.js";
            doc.body.appendChild(scriptTag);
          }
          
          // Create a ZIP file in memory
          const fileMap = new Map();
          fileMap.set("index.html", doc.documentElement.outerHTML);
          if (styles) {
            fileMap.set("styles.css", styles);
          }
          if (scripts) {
            fileMap.set("script.js", scripts);
          }
          
          // Deploy to Netlify using their deploy API
          // Create form data with files
          const formData = new FormData();
          
          // Add files to the form
          for (const [filename, content] of fileMap.entries()) {
            const blob = new Blob([content], { type: "text/plain" });
            formData.append(`file${filename}`, blob, filename);
          }
          
          // Deploy to Netlify
          const deployResponse = await fetch(
            `${netlifyApiUrl}/sites/${siteId}/deploys`,
            {
              method: "POST",
              headers: {
                Authorization: `${tokenData.token_type} ${tokenData.access_token}`,
              },
              body: formData,
            }
          );
          
          if (!deployResponse.ok) {
            const errorText = await deployResponse.text();
            return new Response(
              JSON.stringify({ error: `Failed to deploy: ${errorText}` }),
              {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
          
          const deployData = await deployResponse.json();
          
          return new Response(
            JSON.stringify({
              success: true,
              site_id: siteId,
              site_name: siteData.name,
              site_url: siteData.ssl_url || siteData.url,
              deploy_id: deployData.id,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        } catch (error) {
          return new Response(
            JSON.stringify({ error: `Deploy failed: ${error.message}` }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid path" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
