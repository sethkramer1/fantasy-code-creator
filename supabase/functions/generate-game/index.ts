
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
      promptLength: prompt?.length || 0,
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
    let response;
    let content;
    
    if (modelType === "smart") {
      // Use Anthropic (Claude)
      console.log("Calling Anthropic API for smart model generation");
      response = await callAnthropicApi(prompt, gameType, imageUrl, stream);
      
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
      content = responseData.content;
      
    } else {
      // Use Groq LLM API (faster)
      console.log("Calling Groq API for fast model generation");
      content = await callGroqApi(prompt, gameType, imageUrl);
    }
    
    // Validate content before returning
    if (!content || content.length < 100) {
      console.error("Generated content validation failed:", content?.substring(0, 100));
      return new Response(
        JSON.stringify({ 
          error: "Received empty or invalid content from generation",
          details: "Content is either empty or too short"
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Create a Supabase client to update game record
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Create or update game record
    try {
      if (gameId) {
        console.log(`Updating existing game ${gameId} via edge function`);
        
        const { error: updateError } = await supabaseAdmin
          .from('games')
          .update({ 
            code: content,
            instructions: "Content generated successfully",
            user_id: userId || null
          })
          .eq('id', gameId);
        
        if (updateError) {
          console.error("Error updating game record:", updateError);
        } else {
          console.log("Game record updated successfully");
        }
        
        // Also update the game version
        const { error: versionError } = await supabaseAdmin
          .from('game_versions')
          .update({
            code: content,
            instructions: "Content generated successfully"
          })
          .eq('game_id', gameId)
          .eq('version_number', 1);
        
        if (versionError) {
          console.error("Error updating game version:", versionError);
        } else {
          console.log("Game version updated successfully");
        }
      }
    } catch (dbError) {
      console.error("Database operation error:", dbError);
      // We'll still return the content even if DB operations fail
    }
    
    console.log("Generation successful, returning content");
    
    return new Response(
      JSON.stringify({ content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-game function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "An unexpected error occurred",
        details: error.stack || "No stack trace available"
      }),
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

  console.log("Calling Anthropic API:", {
    hasImage: !!imageUrl,
    promptLength: prompt?.length || 0,
    streaming: stream,
    gameType
  });

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

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", requestOptions);
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error("Anthropic API error response:", errorData);
      throw new Error(`Anthropic API error: ${response.status} - ${errorData}`);
    }
    
    return response;
  } catch (error) {
    console.error("Error calling Anthropic API:", error);
    throw error;
  }
}

// Function to call Groq's API
async function callGroqApi(prompt: string, gameType: string, imageUrl?: string) {
  const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set");
  }

  console.log("Calling Groq API:", {
    hasImage: !!imageUrl,
    promptLength: prompt?.length || 0,
    gameType
  });

  // Enhanced messages array with image if provided
  const messages = [
    {
      role: "system",
      content: getSystemInstructions(gameType)
    }
  ];

  // Add user message with image if provided
  if (imageUrl) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: imageUrl } }
      ]
    });
  } else {
    messages.push({
      role: "user",
      content: prompt
    });
  }

  const requestOptions = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: "llama3-70b-8192",
      messages,
      temperature: 0.7,
      max_tokens: 4000
    })
  };

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", requestOptions);
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error("Groq API error response:", errorData);
      throw new Error(`Groq API error: ${response.status} - ${errorData}`);
    }
    
    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error("Invalid response format from Groq API:", data);
      throw new Error("Invalid response format from Groq API");
    }
    
    const content = data.choices[0].message.content;
    
    if (!content || content.length < 100) {
      console.error("Groq API returned invalid content:", content?.substring(0, 100));
      throw new Error("Received empty or invalid content from Groq");
    }
    
    return content;
  } catch (error) {
    console.error("Error calling Groq API:", error);
    throw error;
  }
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
  }

  return instructions;
}
