
// @ts-ignore
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set");
    return new Response(
      JSON.stringify({
        error: "Server configuration error: ANTHROPIC_API_KEY not set"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { prompt, contentType } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid or missing prompt parameter" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Enhancing prompt for content type: ${contentType}`);
    console.log(`Original prompt: ${prompt.substring(0, 50)}...`);

    // Prepare system instructions based on content type
    let systemPrompt = `You are an AI assistant that helps improve and enhance user prompts for creating ${contentType || 'content'}.
Your task is to take the user's basic prompt and make it more detailed, specific, and effective.
Focus on adding clarity, specific details, and creative elements that will result in better output.
Do not completely change the user's intent - just enhance and improve their original idea.
Return ONLY the enhanced prompt text with no explanations, introductions, or other text.`;

    // Make the request to Anthropic Claude API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-sonnet-20240229",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Please enhance this prompt for creating ${contentType || 'content'}:\n\n${prompt}`
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Anthropic API error: ${response.status}`, errorText);
      
      return new Response(
        JSON.stringify({
          error: `Error from AI service: ${response.status} ${response.statusText}`,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    
    if (!data.content || !data.content[0] || !data.content[0].text) {
      console.error("Unexpected response format from Anthropic:", JSON.stringify(data));
      return new Response(
        JSON.stringify({
          error: "Received unexpected response format from AI service",
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const enhancedPrompt = data.content[0].text.trim();
    console.log(`Enhanced prompt: ${enhancedPrompt.substring(0, 50)}...`);

    // Return the enhanced prompt
    return new Response(
      JSON.stringify({ enhancedPrompt }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in enhance-prompt function:", error);
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unknown error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
