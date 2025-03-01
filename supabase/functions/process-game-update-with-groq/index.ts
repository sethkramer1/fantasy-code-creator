
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log("Request content type:", req.headers.get("content-type"));
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }

  try {
    // Parse request body
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(`Expected content-type: application/json but received: ${contentType}`);
    }
    
    const requestData = await req.json();
    
    // Extract request parameters
    const { gameId, message, imageUrl, stream = true } = requestData;
    
    if (!gameId) {
      throw new Error('Missing required parameter: gameId');
    }
    
    if (!message && !imageUrl) {
      throw new Error('At least one of message or imageUrl must be provided');
    }
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Fetch the game content
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('code, prompt, current_version')
      .eq('id', gameId)
      .single();
    
    if (gameError || !gameData) {
      throw new Error(`Failed to fetch game data: ${gameError?.message || 'Game not found'}`);
    }
    
    // Create a streaming response
    const encoder = new TextEncoder();
    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    
    // Start the AI request in the background
    processWithGroq(gameData, message, imageUrl, writer, stream)
      .catch(async (error) => {
        console.error('Error in AI processing:', error);
        try {
          // Send error message to the client
          const errorMsg = JSON.stringify({
            error: true,
            message: `Error: ${error.message || 'Unknown error in AI processing'}`
          });
          await writer.write(encoder.encode(errorMsg + '\n'));
        } catch (e) {
          console.error('Error sending error message to client:', e);
        } finally {
          await writer.close();
        }
      });
    
    // Return the stream to the client
    return new Response(responseStream.readable, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
    
  } catch (error) {
    console.error('Request error:', error);
    return new Response(
      JSON.stringify({
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error processing request',
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 400,
      }
    );
  }
});

async function processWithGroq(
  gameData: { code: string; prompt: string; current_version: number },
  message: string,
  imageUrl: string | undefined,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  stream: boolean
) {
  const encoder = new TextEncoder();
  
  try {
    // Prepare the system prompt with context about the game
    const systemPrompt = `You are an expert web developer specializing in HTML, CSS, and JavaScript. Help the user modify their interactive web content based on their requests.
    
Current web content:
\`\`\`html
${gameData.code.substring(0, 7500)}
... [content truncated for brevity] ...
\`\`\`

Original prompt that created this content: "${gameData.prompt}"

Instructions:
1. Understand the user's request and make appropriate changes to the HTML/CSS/JS code.
2. Always provide the complete updated code as an HTML file that can run standalone.
3. Ensure your updates are fully functional and maintain or improve the existing design.
4. If the request is unclear, make your best judgment for the changes.
5. Only add functionality described in the user's message. Do not add anything extra.`;

    let userPrompt = message;
    
    if (imageUrl) {
      userPrompt = `I'm sharing a screenshot/image for reference. ${message}`;
    }
    
    // Construct the request to Groq
    const messages = [
      { 
        role: "system", 
        content: systemPrompt
      },
      { 
        role: "user", 
        content: [
          { type: "text", text: userPrompt },
        ]
      }
    ];
    
    // Add image to user message if provided
    if (imageUrl) {
      messages[1].content.push({
        type: "image_url",
        image_url: { url: imageUrl }
      });
    }
    
    const groqRequest = {
      messages: messages,
      model: "mixtral-8x7b-32768",
      temperature: 0.7,
      max_tokens: 32000,
      top_p: 1,
      stream: true, // Always stream for better UX
      stop: null
    };
    
    // Get GROQ API key
    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY environment variable is not set');
    }
    
    // Call the Groq API
    console.log("Calling Groq API with streaming:", stream);
    
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify(groqRequest)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API error (${response.status}): ${errorText}`);
    }
    
    if (!response.body) {
      throw new Error("Response body is null");
    }
    
    // Process the streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    let completeResponse = '';
    let buffer = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log("Stream complete");
          break;
        }
        
        // Decode the chunk and add to buffer
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Process complete lines from buffer
        let lineEnd;
        while ((lineEnd = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, lineEnd);
          buffer = buffer.slice(lineEnd + 1);
          
          if (!line || line.trim() === '') continue;
          
          try {
            // Parse the line as JSON (Groq format)
            const data = JSON.parse(line);
            
            // Extract content from Groq response (if available)
            if (data.choices && data.choices[0]?.delta?.content) {
              const content = data.choices[0].delta.content;
              completeResponse += content;
              
              // Stream the chunk to the client
              if (stream) {
                await writer.write(encoder.encode(line + '\n'));
              }
            }
            
            // Check for completion
            if (data.choices && data.choices[0]?.finish_reason) {
              console.log(`Generation ${data.choices[0].finish_reason}`);
            }
          } catch (e) {
            console.warn('Error parsing JSON:', e);
            console.log('Raw line:', line);
          }
        }
      }
      
      // Send any remaining buffer if not empty
      if (buffer.trim().length > 0) {
        try {
          const data = JSON.parse(buffer);
          if (data.choices && data.choices[0]?.delta?.content) {
            const content = data.choices[0].delta.content;
            completeResponse += content;
            
            if (stream) {
              await writer.write(encoder.encode(buffer + '\n'));
            }
          }
        } catch (e) {
          console.warn('Error parsing remaining buffer:', e);
        }
      }
      
      console.log("Received complete response, length:", completeResponse.length);
      
      // If not streaming, send the complete response at once
      if (!stream && completeResponse) {
        const finalResponse = {
          choices: [{
            message: { content: completeResponse },
            finish_reason: "stop"
          }]
        };
        await writer.write(encoder.encode(JSON.stringify(finalResponse) + '\n'));
      }
      
      // Update game version in Supabase
      const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Extract HTML content
      let htmlContent = completeResponse;
      
      // Check if the response contains a code block
      if (htmlContent.includes('```html')) {
        const match = htmlContent.match(/```html\s*([\s\S]*?)```/);
        if (match && match[1]) {
          htmlContent = match[1].trim();
        }
      }
      
      // Create a new version of the game
      const newVersionNumber = gameData.current_version + 1;
      
      // First, update the games table with new current_version
      const { error: gameUpdateError } = await supabase
        .from('games')
        .update({ current_version: newVersionNumber, code: htmlContent })
        .eq('id', gameId);
      
      if (gameUpdateError) {
        throw new Error(`Failed to update game: ${gameUpdateError.message}`);
      }
      
      // Then create a new version record
      const { error: versionError } = await supabase
        .from('game_versions')
        .insert([{
          game_id: gameId,
          version_number: newVersionNumber,
          code: htmlContent,
          instructions: "Updated via Groq API"
        }]);
      
      if (versionError) {
        throw new Error(`Failed to create version: ${versionError.message}`);
      }
      
      console.log(`Successfully updated game to version ${newVersionNumber}`);
      
    } finally {
      // Always close the writer when done
      await writer.close();
    }
  } catch (error) {
    console.error('Error in processWithGroq:', error);
    throw error;
  }
}
