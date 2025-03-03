import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gameId, prompt, gameType, modelType = "smart", imageUrl, stream = false, userId } = await req.json();
    
    // Log the request payload
    console.log("Processing generation request:", { 
      gameId, 
      gameType, 
      modelType, 
      stream,
      imageLength: prompt?.length || 0,
      hasImage: !!imageUrl,
      hasUserId: !!userId
    });

    // Validate required parameters
    if (!gameId || !prompt || !gameType) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: gameId, prompt, or gameType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Choose the appropriate API service based on modelType
    let apiService;
    if (modelType === "smart") {
      // Use Anthropic (Claude)
      const response = await callAnthropicApi(prompt, gameType, imageUrl, stream);
      
      // If streaming, return the response directly
      if (stream) {
        const headers = {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        };
        return new Response(response.body, { headers });
      }
      
      // Otherwise, get the response content
      const responseData = await response.json();
      return new Response(
        JSON.stringify({ content: responseData.content }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Use Groq LLM API (faster)
      const content = await callGroqApi(prompt, gameType);
      return new Response(
        JSON.stringify({ content }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Error in generate-game function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Function to call Anthropic's Claude API
async function callAnthropicApi(prompt: string, gameType: string, imageUrl?: string, stream = false) {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  console.log("Image URL provided:", imageUrl ? "Yes" : "No");

  // Construct the messages array with appropriate content
  const messages = [];
  
  // Add system instructions based on game type
  messages.push({
    role: "system",
    content: getSystemInstructions(gameType)
  });

  // Create the user message
  let userMessage: any = {
    role: "user",
    content: []
  };

  // Add text content
  userMessage.content.push({
    type: "text",
    text: prompt
  });

  // Add image if provided
  if (imageUrl) {
    userMessage.content.push({
      type: "image",
      source: {
        type: "url",
        url: imageUrl
      }
    });
  }

  messages.push(userMessage);

  // Prepare request options
  const requestOptions = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-opus-20240229",
      messages,
      max_tokens: 4000,
      stream,
      temperature: 0.7,
      system: getSystemInstructions(gameType)
    })
  };

  return fetch("https://api.anthropic.com/v1/messages", requestOptions);
}

// Function to call Groq's API
async function callGroqApi(prompt: string, gameType: string) {
  const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set");
  }

  const requestOptions = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: "llama3-70b-8192",
      messages: [
        {
          role: "system",
          content: getSystemInstructions(gameType)
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 4000
    })
  };

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", requestOptions);
  const data = await response.json();
  
  if (!response.ok) {
    console.error("Groq API error:", data);
    throw new Error(data.error?.message || "Error calling Groq API");
  }
  
  return data.choices[0].message.content;
}

// Get system instructions based on game type
function getSystemInstructions(gameType: string): string {
  // Default instructions for web design
  let instructions = `You are a master web designer and programmer. Your job is to create visually appealing, interactive web designs based on the user's description. 
  
Your response should ONLY include the full HTML, CSS, and JavaScript code needed to create the described design. Do not include any explanations, markdown code blocks, or anything other than the raw code.
  
Create responsive designs that work well on both desktop and mobile. Use modern CSS techniques like flexbox and grid. Write clean, well-commented code.`;

  // Customize based on game type
  switch (gameType) {
    case "game":
      instructions = `You are a master game developer. Your job is to create fun, playable web games based on the user's description.
      
Your response should ONLY include the full HTML, CSS, and JavaScript code needed to create the described game. Do not include any explanations, markdown code blocks, or anything other than the raw code.
      
Create games that are interactive, have clear goals, and provide feedback to the player. Make them visually appealing and intuitive to play. Write clean, well-commented code.`;
      break;
    case "chart":
      instructions = `You are a data visualization expert. Your job is to create informative, interactive charts and graphs based on the user's description.
      
Your response should ONLY include the full HTML, CSS, and JavaScript code needed to create the described visualization. Do not include any explanations, markdown code blocks, or anything other than the raw code.
      
Use libraries like Chart.js or D3.js to create your visualizations. Make them visually appealing and easy to understand. Write clean, well-commented code.`;
      break;
    case "svg":
      instructions = `You are a master SVG artist and programmer. Your job is to create visually appealing, potentially interactive SVG illustrations based on the user's description.
      
Your response should ONLY include the full SVG code wrapped in basic HTML. Do not include any explanations, markdown code blocks, or anything other than the raw code.
      
Create detailed, visually interesting SVGs that match the user's requirements. Use appropriate viewBox settings and consider adding simple animations or interactions if appropriate. Write clean, well-commented code.`;
      break;
    // Add more game types as needed
    default:
      // Use default web design instructions
      break;
  }

  return instructions;
}
