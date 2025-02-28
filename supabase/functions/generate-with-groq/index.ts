
// @ts-ignore
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Define the expected request payload shape
interface RequestPayload {
  prompt: string;
  imageUrl?: string;
  contentType?: string;
}

// GROQ API endpoint
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

serve(async (req: Request) => {
  try {
    // Set up CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }

    // Handle preflight CORS requests
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    // Get GROQ API key from environment variable
    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY environment variable not set');
    }

    // Parse the request payload
    const payload: RequestPayload = await req.json();
    const { prompt, imageUrl, contentType } = payload;

    if (!prompt) {
      throw new Error('Missing prompt in request');
    }

    // Log the request details for debugging
    console.log(`Generating content using Groq. Content type: ${contentType || 'not specified'}, Image: ${imageUrl ? 'yes' : 'no'}`);

    // Set up the response with proper headers for SSE (Server-Sent Events)
    const responseHeaders = {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    };

    // Create a TransformStream for streaming the response
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Start the response immediately to set up streaming
    const response = new Response(readable, {
      headers: responseHeaders,
    });

    // Helper function to send SSE format data
    const sendSSE = async (data: any) => {
      const encoder = new TextEncoder();
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    };

    // Send initial message to client indicating start of process
    await sendSSE({ type: 'message_start' });
    await sendSSE({ type: 'content_block_start', content_block: { type: 'thinking' } });

    // Simulate a thinking message for better UX
    await sendSSE({ 
      type: 'content_block_delta', 
      delta: { 
        type: 'thinking_delta', 
        thinking: 'Starting Groq model (Mixtral 8x7B)' 
      } 
    });

    // Create request payload for Groq API
    const groqRequestBody = {
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      model: "mixtral-8x7b-32768",
      temperature: 0.7,
      max_completion_tokens: 24000, // Using a slightly lower value than max
      top_p: 1,
      stream: true
    };

    // Prepare the request for Groq API
    const groqRequest = new Request(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify(groqRequestBody)
    });

    // Log that we're making the request to Groq
    await sendSSE({ 
      type: 'content_block_delta', 
      delta: { 
        type: 'thinking_delta', 
        thinking: 'Sending request to Groq API...' 
      }
    });

    // Make the request to Groq API
    const groqResponse = await fetch(groqRequest);
    
    if (!groqResponse.ok || !groqResponse.body) {
      const errorText = await groqResponse.text();
      console.error('Groq API error:', errorText);
      throw new Error(`Groq API error: ${groqResponse.status} - ${errorText}`);
    }

    await sendSSE({ 
      type: 'content_block_delta', 
      delta: { 
        type: 'thinking_delta', 
        thinking: 'Connected to Groq, processing response stream...' 
      } 
    });

    // Close the thinking content block
    await sendSSE({ type: 'content_block_stop', content_block: { type: 'thinking' } });

    // Start a content block for the actual response
    await sendSSE({ type: 'content_block_start', content_block: { type: 'text' } });

    // Process the streaming response from Groq
    const reader = groqResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode the chunk and add it to our buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines from the buffer
        let lineEnd;
        while ((lineEnd = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, lineEnd).trim();
          buffer = buffer.slice(lineEnd + 1);

          if (!line || line === 'data: [DONE]') continue;

          // Parse the SSE data line
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(5));
              
              // Extract content from Groq's response format
              const content = data.choices?.[0]?.delta?.content;
              
              if (content) {
                fullContent += content;
                
                // Send content in the format expected by the client
                await sendSSE({
                  type: 'content_block_delta',
                  delta: {
                    type: 'text_delta',
                    text: content
                  }
                });
              }
            } catch (e) {
              console.error('Error parsing Groq SSE:', e, line);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error reading from Groq stream:', error);
      await sendSSE({
        type: 'error',
        error: {
          message: `Error streaming from Groq: ${error.message}`
        }
      });
    }

    // Check if we received any content
    if (!fullContent.trim()) {
      throw new Error('No content received from Groq API');
    }

    // Signal completion
    await sendSSE({ type: 'content_block_stop', content_block: { type: 'text' } });
    await sendSSE({ type: 'message_delta', delta: { stop_reason: 'complete' } });
    await sendSSE({ type: 'message_stop' });

    // Close the writer to end the stream
    await writer.close();
    
    return response;
  } catch (error) {
    console.error('Error in generate-with-groq function:', error);
    
    // If we haven't started streaming yet, return a regular error response
    return new Response(
      JSON.stringify({
        error: error.message || 'Unknown error occurred'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        }
      }
    );
  }
})
