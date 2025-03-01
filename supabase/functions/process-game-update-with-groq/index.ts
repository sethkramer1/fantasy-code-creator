
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    })
  }
  
  try {
    // Validate the request
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Parse the request body
    const contentType = req.headers.get('content-type') || '';
    
    // Log the content type for debugging
    console.log("Request content type:", contentType);
    
    if (!contentType.includes('application/json')) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid content type',
          expected: 'application/json',
          received: contentType
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    const body = await req.json()
    
    // Validate required parameters
    const { gameId, message, modelType = 'groq' } = body
    
    if (!gameId || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: gameId and message are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const groqApiKey = Deno.env.get('GROQ_API_KEY') || ''
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase credentials' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    if (!groqApiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Groq API key' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Get the game's code and other data
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()
      
    if (gameError) {
      return new Response(
        JSON.stringify({ error: 'Game not found', details: gameError }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    // Get the chat history for context
    const { data: chatHistory, error: chatError } = await supabase
      .from('game_messages')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at', { ascending: true })
      .limit(10)
      
    if (chatError) {
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve chat history', details: chatError }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    // Prepare conversation history
    const chatContext = chatHistory.map(msg => {
      return {
        role: 'user',
        content: msg.message,
        ...(msg.response ? { response: msg.response } : {})
      }
    }).slice(0, -1) // Exclude the latest message since we'll add it separately
    
    const currentCode = gameData.code || ''
    
    // Prepare prompt for Groq
    const systemPrompt = `You are an expert web development AI assistant who can make changes to a game or web application's code. You will receive a current codebase and a user request to modify it.

IMPORTANT OUTPUT FORMAT:
You should respond with a single HTML document that contains the complete updated code. 
This should be a full HTML file starting with <!DOCTYPE html> and containing all necessary CSS and JavaScript.
Do not add any explanations, markdown formatting, or code blocks.
Simply return the raw HTML code that should be rendered.

Suggestions for creating high-quality HTML content:
- Make sure your HTML, CSS and JavaScript are valid
- Include viewport meta tags for responsive design
- Use semantic HTML
- Make designs responsive with mobile-first approach
- Include comments to explain complex logic
- Don't make up image URLs - use placeholder services if needed
- Use SVG or emoji for icons where possible
- Ensure proper indentation for readability
- Test interactive elements and ensure they work
- Clean up any unused CSS or JavaScript
- Focus on modern, visually appealing design
- Ensure content is appropriately sized for the container

CURRENT CODE:
${currentCode}

USER REQUEST:
${message}

Analyze the current code carefully and apply the requested changes while maintaining overall functionality.`

    const stream = body.stream === true

    console.log("Making request to Groq API...")
    console.log(`Stream mode: ${stream ? 'enabled' : 'disabled'}`)
    
    // Make the request to the Groq API
    const groqRequest = {
      model: "mixtral-8x7b-32768",
      messages: [
        {
          role: "system",
          content: systemPrompt
        }
      ],
      stream: stream,
      max_tokens: 32768,
      temperature: 0.5
    }
    
    console.log("Groq request prepared:", JSON.stringify(groqRequest).substring(0, 200) + "...")
    
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(groqRequest)
    })
    
    if (!groqResponse.ok) {
      const errorText = await groqResponse.text()
      console.error("Groq API error:", groqResponse.status, errorText)
      
      return new Response(
        JSON.stringify({ 
          error: 'Groq API error', 
          status: groqResponse.status,
          details: errorText
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    console.log("Groq API response received, status:", groqResponse.status)
    
    // For streaming responses
    if (stream) {
      // Initialize a TransformStream
      const encoder = new TextEncoder()
      const decoder = new TextDecoder()
      
      // Set up streaming
      const { readable, writable } = new TransformStream()
      const writer = writable.getWriter()
      
      // Process the stream
      const processStream = async () => {
        try {
          const reader = groqResponse.body?.getReader()
          if (!reader) {
            throw new Error("No reader available from Groq response")
          }
          
          console.log("Processing Groq stream...")
          
          while (true) {
            const { done, value } = await reader.read()
            
            if (done) {
              console.log("Stream complete")
              await writer.close()
              break
            }
            
            const chunk = decoder.decode(value, {stream: true})
            console.log("Chunk received, size:", chunk.length)
            
            // Groq returns newline-delimited JSON
            const lines = chunk.split('\n').filter(line => line.trim())
            
            for (const line of lines) {
              if (line.includes('data: [DONE]')) {
                continue
              }
              
              try {
                // Forward the raw line as-is
                await writer.write(encoder.encode(line + '\n'))
              } catch (e) {
                console.error("Error processing line:", e)
              }
            }
          }
        } catch (error) {
          console.error("Stream processing error:", error)
          const errorMsg = JSON.stringify({
            error: 'Stream processing error',
            message: error instanceof Error ? error.message : String(error)
          })
          await writer.write(encoder.encode(errorMsg))
          await writer.close()
        }
      }
      
      // Start processing in the background
      processStream()
      
      // Return the stream to the client
      return new Response(readable, {
        headers: { 
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      })
    } else {
      // Non-streaming mode
      const data = await groqResponse.json()
      
      const htmlContent = data.choices[0].message.content
      
      // Update the game with the new content
      const { error: updateError } = await supabase
        .from('games')
        .update({ code: htmlContent })
        .eq('id', gameId)
        
      if (updateError) {
        return new Response(
          JSON.stringify({ error: 'Failed to update game', details: updateError }),
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
      
      // Return the success response
      return new Response(
        JSON.stringify({ 
          success: true,
          content: htmlContent
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
  } catch (error) {
    console.error("Unhandled error:", error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Unhandled error',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
