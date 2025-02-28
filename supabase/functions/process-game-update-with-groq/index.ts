
// @ts-ignore
import { serve } from 'std/server'
import { createClient } from '@supabase/supabase-js'

interface RequestPayload {
  gameId: string;
  prompt: string;
  imageUrl?: string;
  modelType?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const groqApiKey = Deno.env.get('GROQ_API_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }

    if (!groqApiKey) {
      throw new Error('Missing GROQ_API_KEY environment variable')
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse the request payload
    const payload: RequestPayload = await req.json()
    const { gameId, prompt, imageUrl } = payload
    
    if (!gameId || !prompt) {
      throw new Error('Missing required fields: gameId and prompt')
    }

    // Set up streaming response
    const responseHeaders = {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }

    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()

    // Start the response
    const response = new Response(readable, {
      headers: responseHeaders,
    })

    // Helper for sending SSE format data
    const sendSSE = async (data: any) => {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
    }

    // Send initial message
    await sendSSE({ type: 'message_start' })

    // Get the current game data
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()

    if (gameError) {
      throw new Error(`Failed to get game: ${gameError.message}`)
    }

    // Start a thinking block
    await sendSSE({ type: 'content_block_start', content_block: { type: 'thinking' } })
    await sendSSE({ type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'Starting Groq Mixtral 8x7B model' } })
    await sendSSE({ type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'Analyzing current content...' } })

    // Send progress updates
    await sendSSE({ type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'Preparing request with current content and user prompt' } })

    // Build the prompt for Groq
    const systemMessage = `
You are a web application editor that creates and modifies HTML, CSS, and JavaScript code based on user requests.
You'll be given the current HTML code of an application and a request from the user to modify it.
Your task is to return the updated HTML code with the requested changes implemented.

IMPORTANT GUIDELINES:
1. Return the entire updated HTML file contents, not just the modified parts
2. Don't include markdown formatting, explanations or code blocks - just return the raw HTML code
3. Make sure the code is valid, complete, and properly formatted
4. Include all necessary CSS and JavaScript in the HTML file
5. Implement exactly what the user asked for, maintaining the existing structure and functionality
6. Don't remove existing features unless explicitly asked
7. Your output should be directly usable as a complete HTML file

Here is the current HTML code of the application:
${gameData.code}

Now, implement the following change request:
${prompt}`;

    // Create Groq payload
    const groqPayload = {
      "messages": [
        {
          "role": "user",
          "content": systemMessage
        }
      ],
      "model": "mixtral-8x7b-32768",
      "temperature": 0.7,
      "max_completion_tokens": 32000,
      "top_p": 1,
      "stream": true
    };

    if (imageUrl) {
      await sendSSE({ type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'Including image in the request' } });
      // Update the payload to include the image if provided
      // For Groq, we'd need to handle this differently as they might not support images
      // in the same way as Anthropic. This is a placeholder for how we might handle it.
    }

    await sendSSE({ type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'Sending request to Groq API...' } });

    // Call Groq API
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`
      },
      body: JSON.stringify(groqPayload)
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      throw new Error(`Groq API error: ${groqResponse.status} - ${errorText}`);
    }

    await sendSSE({ type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'Connected to Groq API, processing response...' } });
    
    // End thinking phase
    await sendSSE({ type: 'content_block_stop', content_block: { type: 'thinking' } });
    
    // Start content block
    await sendSSE({ type: 'content_block_start', content_block: { type: 'text' } });

    // Process streaming response from Groq
    const reader = groqResponse.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get reader from Groq response');
    }

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
      console.error('Error processing Groq stream:', error);
    }

    if (!fullContent.trim()) {
      throw new Error('No content received from Groq API');
    }

    // Clean up the generated HTML code if needed
    let finalHtml = fullContent.trim();
    
    // Sometimes the model might include code block markers or explanations
    if (finalHtml.startsWith('```html')) {
      finalHtml = finalHtml.replace(/^```html\n/, '').replace(/```$/, '');
    } else if (finalHtml.startsWith('```')) {
      finalHtml = finalHtml.replace(/^```\n/, '').replace(/```$/, '');
    }

    // Check if it's valid HTML
    if (!finalHtml.includes('<!DOCTYPE html>') && !finalHtml.includes('<html')) {
      throw new Error('Generated content is not valid HTML');
    }

    // Signal content completion
    await sendSSE({ type: 'content_block_stop', content_block: { type: 'text' } });
    await sendSSE({ type: 'message_delta', delta: { stop_reason: 'complete' } });
    await sendSSE({ type: 'message_stop' });

    // Create a new version
    const { data: versions } = await supabase
      .from('game_versions')
      .select('version_number')
      .eq('game_id', gameId)
      .order('version_number', { ascending: false })
      .limit(1);

    const newVersionNumber = versions && versions.length > 0 ? versions[0].version_number + 1 : 1;

    const { error: versionError } = await supabase
      .from('game_versions')
      .insert([{
        game_id: gameId,
        version_number: newVersionNumber,
        code: finalHtml,
        instructions: 'Updated via Groq API'
      }]);

    if (versionError) {
      throw new Error(`Error saving version: ${versionError.message}`);
    }

    // Update game with new version
    const { error: updateError } = await supabase
      .from('games')
      .update({
        code: finalHtml,
        current_version: newVersionNumber,
        instructions: 'Updated via Groq API'
      })
      .eq('id', gameId);

    if (updateError) {
      throw new Error(`Error updating game: ${updateError.message}`);
    }

    // Close the writer to end the stream
    await writer.close();
    
    return response;
  } catch (error) {
    console.error('Error:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message || 'An unknown error occurred'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});
