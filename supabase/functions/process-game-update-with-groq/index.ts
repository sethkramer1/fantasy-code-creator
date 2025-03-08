// This Edge Function integrates with Groq's API to generate web content based on a game update request
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../_shared/cors.ts';

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') as string;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') as string;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;

// Create a Supabase client with the service role key for admin rights
const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate content type
  const contentType = req.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    console.error(`Invalid content type: ${contentType}`);
    return new Response(
      JSON.stringify({ 
        error: 'Invalid content type. Expected application/json' 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    // Parse the request body
    const requestData = await req.json();
    console.log("Request received:", JSON.stringify(requestData).substring(0, 500));

    const { gameId, message, imageUrl, modelType } = requestData;

    if (!gameId || !message) {
      throw new Error("Missing required parameters: gameId and message are required");
    }

    // Fetch the game data
    const { data: gameData, error: gameError } = await supabaseAdmin
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (gameError) {
      throw new Error(`Error fetching game: ${gameError.message}`);
    }

    // Fetch the latest game version to get the most current code
    const { data: latestVersion, error: versionError } = await supabaseAdmin
      .from('game_versions')
      .select('*')
      .eq('game_id', gameId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (versionError) {
      console.error('Error fetching latest game version:', versionError);
    }

    // Fetch previous messages for context
    const { data: messagesData, error: messagesError } = await supabaseAdmin
      .from('game_messages')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at', { ascending: true })
      .limit(10);

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
    }

    // Use the latest version's code if available, otherwise fall back to gameData.code
    const currentCode = (latestVersion && latestVersion.code) ? latestVersion.code : (gameData.code || '');

    // Build the messages array with proper conversation history
    let messagesHistory: any[] = [];
    
    // Add conversation history as separate messages
    if (messagesData && messagesData.length > 0) {
      for (const msg of messagesData) {
        // Add user message
        if (msg.imageUrl) {
          messagesHistory.push({
            role: "user",
            content: [
              {
                type: "text",
                text: msg.message
              },
              {
                type: "image_url",
                image_url: {
                  url: msg.imageUrl
                }
              }
            ]
          });
        } else {
          messagesHistory.push({
            role: "user",
            content: msg.message
          });
        }
        
        // Add assistant response if it exists
        if (msg.response) {
          messagesHistory.push({
            role: "assistant",
            content: msg.response
          });
        }
      }
    }

    // Prepare the current message
    let currentUserMessage: any = {
      role: "user",
      content: message
    };

    // Add image to current message if provided
    if (imageUrl) {
      currentUserMessage = {
        role: "user",
        content: [
          {
            type: "text",
            text: message
          },
          {
            type: "image_url",
            image_url: {
              url: imageUrl
            }
          }
        ]
      };
    }

    const messages = [
      {
        role: "system",
        content: `You are a code modification assistant. You will be modifying the following code base:

Current code:
${currentCode}

Original game info:
- Prompt: ${gameData.prompt}
- Type: ${gameData.type || 'Not specified'}

Please make the requested changes while preserving the overall structure and functionality.
Return only the full new HTML code with all needed CSS and JavaScript embedded. Do not include any markdown formatting, explanation, or code blocks - ONLY return the raw HTML.`
      },
      ...messagesHistory,
      currentUserMessage
    ];

    // Add any external file or image references if provided
    const imageContext = imageUrl 
      ? `\n\nThe user has also uploaded an image that you should incorporate in your modifications. The image is available at: ${imageUrl}` 
      : '';

    console.log("Connecting to Groq API...");
    
    // Make the Groq API request - non-streaming version
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "qwen-2.5-coder-32b",
        messages: messages,
        temperature: 0.7,
        max_tokens: 32000
      })
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error("Groq API error:", groqResponse.status, errorText);
      throw new Error(`Groq API error (${groqResponse.status}): ${errorText.substring(0, 200)}`);
    }

    // Process the complete response
    const groqData = await groqResponse.json();
    console.log("Groq response received:", JSON.stringify(groqData).substring(0, 500));

    let content = '';
    
    if (groqData.choices && groqData.choices.length > 0 && groqData.choices[0].message) {
      content = groqData.choices[0].message.content;
      
      // Clean up the content if it's wrapped in code blocks
      if (content.includes("```html")) {
        const htmlMatch = content.match(/```html\s*([\s\S]*?)```/);
        if (htmlMatch && htmlMatch[1]) {
          content = htmlMatch[1].trim();
        }
      } else if (content.includes("```