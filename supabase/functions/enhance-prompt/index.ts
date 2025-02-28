
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, contentType } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Get OpenAI key from environment
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Build the prompt based on content type
    let enhancerPrompt = "";
    switch (contentType) {
      case "game":
        enhancerPrompt = "Enhance this prompt for a game creation AI. Add clear details about game mechanics, visual style, theme, and player experience. Be specific and descriptive. Don't add any prefatory text or formatting instructions - just return the enhanced prompt directly. Prompt:";
        break;
      case "svg":
        enhancerPrompt = "Enhance this prompt for an SVG graphic creation AI. Add clear details about visual elements, style, colors, and layout. Be specific and descriptive. Don't add any prefatory text or formatting instructions - just return the enhanced prompt directly. Prompt:";
        break;
      case "webdesign":
        enhancerPrompt = "Enhance this prompt for a web design creation AI. Add clear details about layout, color scheme, typography, user interface elements, and overall aesthetic. Be specific and descriptive. Don't add any prefatory text or formatting instructions - just return the enhanced prompt directly. Prompt:";
        break;
      case "dataviz":
        enhancerPrompt = "Enhance this prompt for a data visualization creation AI. Add clear details about data types, chart types, colors, labels, and insights to highlight. Be specific and descriptive. Don't add any prefatory text or formatting instructions - just return the enhanced prompt directly. Prompt:";
        break;
      case "diagram":
        enhancerPrompt = "Enhance this prompt for a diagram creation AI. Add clear details about diagram type, elements, connections, layout, and visual style. Be specific and descriptive. Don't add any prefatory text or formatting instructions - just return the enhanced prompt directly. Prompt:";
        break;
      case "infographic":
        enhancerPrompt = "Enhance this prompt for an infographic creation AI. Add clear details about information flow, sections, visual elements, style, and key data points to highlight. Be specific and descriptive. Don't add any prefatory text or formatting instructions - just return the enhanced prompt directly. Prompt:";
        break;
      default:
        enhancerPrompt = "Enhance this prompt with more specific details and clear instructions. Be descriptive and precise. Don't add any prefatory text or formatting instructions - just return the enhanced prompt directly. Prompt:";
    }

    // Call OpenAI API to enhance the prompt
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an AI prompt enhancer that takes user prompts and makes them more detailed, specific, and effective. Your response should be the enhanced prompt only - DO NOT include any prefatory text like 'Here's an enhanced prompt' or explanations before the prompt. Just provide the enhanced prompt text. Always maintain the user's original intent while adding helpful details."
          },
          {
            role: "user",
            content: `${enhancerPrompt} "${prompt}"`
          }
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("OpenAI API error:", errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const enhancedPrompt = data.choices[0].message.content.trim();

    // Remove any common prefatory text patterns using regex
    const cleanedPrompt = enhancedPrompt
      .replace(/^(here('s| is) (an |the )?(enhanced|improved|better|revised|detailed) prompt:?)\s*/i, '')
      .replace(/^(enhanced prompt:?)\s*/i, '')
      .replace(/^(here you go:?)\s*/i, '')
      .replace(/^(with clear layout, style, and user experience considerations:?)\s*/i, '')
      .trim();

    return new Response(
      JSON.stringify({ enhancedPrompt: cleanedPrompt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in enhance-prompt function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
