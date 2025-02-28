
// @ts-ignore
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { prompt, imageUrl, contentType } = await req.json()

    // Validate the request
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get API Key from environment variable
    const groqApiKey = Deno.env.get('GROQ_API_KEY')
    if (!groqApiKey) {
      console.error('GROQ_API_KEY is not set')
      return new Response(
        JSON.stringify({ error: 'API key configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Generating content with Groq for content type: ${contentType}`)
    
    // Define the model to use based on content type
    // LLM-3-70B-Chat is a bit faster than Mixtral
    let model = "llama3-70b-8192"
    
    // Call the Groq API to generate content
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { 
            role: 'system', 
            content: 'You are an AI that generates HTML, CSS, and JavaScript content based on user prompts.' 
          },
          { 
            role: 'user', 
            content: prompt + (imageUrl ? ` (Reference image provided)` : '')
          }
        ],
        temperature: 0.7,
        max_tokens: 4096,
        stream: true
      })
    })

    // Stream the response back to the client
    return new Response(response.body, {
      headers: { 
        ...corsHeaders,
        'Content-Type': 'text/event-stream' 
      }
    })
  } catch (error) {
    console.error('Error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
