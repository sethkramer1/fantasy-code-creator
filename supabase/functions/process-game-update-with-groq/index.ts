
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// CORS headers for the response
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// For handling preflight requests
function handleCors(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      },
    });
  }
  return null;
}

serve(async (req) => {
  try {
    // Handle CORS
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    // Parse request body
    const { gameId, message, imageUrl, stream = true } = await req.json();
    console.log(`Processing update with Groq for game: ${gameId}\n`);

    // Validate required parameters
    if (!gameId) {
      return new Response(
        JSON.stringify({ error: "Missing game ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Missing message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch game data
    const gameResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/rest/v1/games?id=eq.${gameId}&select=*`,
      {
        headers: {
          "Content-Type": "application/json",
          "apikey": Deno.env.get("SUPABASE_ANON_KEY") || "",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          "Prefer": "return=representation",
        },
      }
    );

    if (!gameResponse.ok) {
      console.error("Error fetching game:", await gameResponse.text());
      return new Response(
        JSON.stringify({ error: "Failed to fetch game data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const games = await gameResponse.json();
    if (!games || games.length === 0) {
      return new Response(
        JSON.stringify({ error: "Game not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const game = games[0];
    console.log(`Found game: ${game.id}, type: ${game.type}`);

    // Build enhanced prompt
    let enhancedPrompt = "";
    
    // Add type-specific context
    if (game.type === 'webdesign') {
      enhancedPrompt = `You are a web design expert. I'll show you the current HTML/CSS/JS code, and I'd like you to update it based on my request.
      
Current code:
\`\`\`html
${game.code}
\`\`\`

My request: ${message}

Please provide the FULL updated HTML with all changes integrated. Return ONLY the complete, updated HTML/CSS/JS code. No explanation, comments, or code snippets - just the full code as a single HTML document that includes all necessary styling and JavaScript. The document must be fully functional and standalone.`;
    } else if (game.type === 'game') {
      enhancedPrompt = `You are a JavaScript game development expert. I'll show you the current HTML5 game code, and I'd like you to update it based on my request.
      
Current game code:
\`\`\`html
${game.code}
\`\`\`

My request: ${message}

Please provide the FULL updated HTML/JS game with all changes integrated. Return ONLY the complete, updated code as a single HTML document that includes all necessary styling and JavaScript. Make sure the game functions correctly and includes proper event handling, state management, and appropriate game mechanics. The document must be fully functional and standalone.`;
    } else if (game.type === 'svg') {
      enhancedPrompt = `You are an SVG graphics expert. I'll show you the current SVG code, and I'd like you to update it based on my request.
      
Current SVG code:
\`\`\`html
${game.code}
\`\`\`

My request: ${message}

Please provide the FULL updated HTML document with the SVG integrated. Return ONLY the complete, updated code as a single HTML document that includes the SVG and any necessary styling. The document must be fully functional and standalone.`;
    } else if (game.type === 'dataviz') {
      enhancedPrompt = `You are a data visualization expert. I'll show you the current visualization code, and I'd like you to update it based on my request.
      
Current visualization code:
\`\`\`html
${game.code}
\`\`\`

My request: ${message}

Please provide the FULL updated HTML document with all visualization changes integrated. Return ONLY the complete, updated code as a single HTML document that includes all necessary styling, data, and JavaScript for the visualization. The document must be fully functional and standalone.`;
    } else {
      enhancedPrompt = `You are a web development expert. I'll show you the current HTML/CSS/JS code, and I'd like you to update it based on my request.
      
Current code:
\`\`\`html
${game.code}
\`\`\`

My request: ${message}

Please provide the FULL updated HTML with all changes integrated. Return ONLY the complete, updated HTML/CSS/JS code. No explanation, comments, or code snippets - just the full code as a single HTML document that includes all necessary styling and JavaScript. The document must be fully functional and standalone.`;
    }

    // Add image if provided
    if (imageUrl) {
      enhancedPrompt += `\n\nPlease incorporate this image into your response: ${imageUrl}`;
    }

    // Prepare to call Groq API
    console.log("Preparing to call Groq API");
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    
    if (!GROQ_API_KEY) {
      console.error("Missing GROQ_API_KEY environment variable");
      return new Response(
        JSON.stringify({ error: "Server configuration error: Missing API key" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a readable stream for streaming responses
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    
    // Start sending the response immediately to establish the stream
    const responseInit = {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    };
    
    // Create a response with the stream
    const response = new Response(stream.readable, responseInit);
    
    // Call Groq API asynchronously and pipe to client
    (async () => {
      try {
        // Set up the request to Groq
        const groqRequest = {
          model: "mixtral-8x7b-32768",
          messages: [
            {
              role: "system",
              content: "You are an expert who writes clean, complete HTML/CSS/JS code. Your task is to create or update web content based on the user's request. Always return ONLY the full HTML document, without explanations. The code must be complete, self-contained, and functional."
            },
            {
              role: "user",
              content: enhancedPrompt
            }
          ],
          stream: true,
          temperature: 0.5,
          max_tokens: 32768,
        };
        
        console.log(`Calling Groq API with model: ${groqRequest.model}`);
        
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(groqRequest),
        });
        
        if (!groqResponse.ok) {
          const errorText = await groqResponse.text();
          console.error(`Groq API error (${groqResponse.status}):`, errorText);
          
          // Send error to client
          await writer.write(encoder.encode(JSON.stringify({
            error: `Groq API error: ${groqResponse.status} ${groqResponse.statusText}`,
            details: errorText
          }) + "\n"));
          
          await writer.close();
          return;
        }
        
        console.log("Groq API response received, streaming to client...");
        
        // Process the Groq streaming response and relay it to our client
        const reader = groqResponse.body?.getReader();
        if (!reader) {
          throw new Error("Failed to get reader from Groq response");
        }
        
        const encoder = new TextEncoder();
        
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log("Groq stream complete");
            break;
          }
          
          // Decode the chunk and relay it to the client
          const chunk = new TextDecoder().decode(value);
          
          // Log sample of the chunk for debugging
          if (chunk.length > 0) {
            console.log(`Received chunk from Groq (${chunk.length} bytes): ${chunk.substring(0, Math.min(100, chunk.length))}...`);
          }
          
          // Send the chunk to the client
          await writer.write(value);
        }
      } catch (error) {
        console.error("Error in Groq API processing:", error);
        
        // Send error to client
        const encoder = new TextEncoder();
        await writer.write(encoder.encode(JSON.stringify({
          error: `Error processing Groq response: ${error.message || "Unknown error"}`
        }) + "\n"));
      } finally {
        await writer.close();
        console.log("Stream closed");
      }
    })();
    
    return response;
  } catch (error) {
    console.error("Unexpected error:", error);
    
    return new Response(
      JSON.stringify({ error: `Unexpected error: ${error.message || "Unknown error"}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
