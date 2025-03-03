
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

    // Fetch game details to understand context
    const { data: gameData, error: gameError } = await supabaseAdmin
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (gameError) {
      throw new Error(`Error fetching game data: ${gameError.message}`);
    }

    // Fetch previous messages for context
    const { data: messagesData, error: messagesError } = await supabaseAdmin
      .from('game_messages')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      throw new Error(`Error fetching messages: ${messagesError.message}`);
    }

    // Create messages history format for the AI context
    const messagesHistory = messagesData.map(msg => ({
      role: "user",
      content: msg.message
    }));

    // Get game code - the current state of the project
    const { data: gameVersions, error: versionsError } = await supabaseAdmin
      .from('game_versions')
      .select('*')
      .eq('game_id', gameId)
      .order('version_number', { ascending: false })
      .limit(1);

    if (versionsError) {
      throw new Error(`Error fetching game versions: ${versionsError.message}`);
    }

    if (!gameVersions || gameVersions.length === 0) {
      throw new Error("No game versions found");
    }

    const currentCode = gameVersions[0].code;

    // Build the prompt for Groq
    const systemPrompt = `You are an advanced AI code assistant that specializes in improving and modifying HTML, CSS, and JavaScript code based on user requests. You are given an existing HTML document and need to modify it according to the user's instructions.

The following is an HTML document that includes HTML, CSS (in style tags), and JavaScript (in script tags). Your job is to:

1. Understand the current structure and functionality of the code
2. Apply the requested changes from the user
3. Return the COMPLETE, MODIFIED HTML document with all changes incorporated
4. Make sure to preserve all existing functionality unless directly asked to change it

IMPORTANT GUIDELINES:
- Return ONLY the modified code, without explanations or markdown formatting
- Include DOCTYPE, html, head, and body tags in your response
- Make your changes minimal and focused on what the user requested
- Do not remove existing features or functionality
- Keep the same overall document structure
- Ensure all script and style blocks are preserved as they were
- Assume the document will be viewed in various browsers and should be responsive
- If you need placeholder images, use placeholder.com URLs with appropriate dimensions`;

    // Add any external file or image references if provided
    const imageContext = imageUrl 
      ? `\n\nThe user has also uploaded an image that you should incorporate in your modifications. The image is available at: ${imageUrl}` 
      : '';

    // Build the complete prompt
    const userPrompt = `Here is the current HTML document:

\`\`\`html
${currentCode}
\`\`\`

User's request: ${message}${imageContext}

Please modify the document according to the user's request and return the complete, updated HTML document.`;

    console.log("Connecting to Groq API...");
    
    // Make the Groq API request - non-streaming version
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "mixtral-8x7b-32768",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
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
      } else if (content.includes("```")) {
        const codeMatch = content.match(/```\s*([\s\S]*?)```/);
        if (codeMatch && codeMatch[1]) {
          content = codeMatch[1].trim();
        }
      }
      
      console.log("Final content length:", content.length);
    } else {
      throw new Error("No valid content in Groq response");
    }

    // Store the generated content as a new version
    const { data: currentVersion } = await supabaseAdmin
      .from('game_versions')
      .select('version_number')
      .eq('game_id', gameId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    const newVersionNumber = currentVersion ? currentVersion.version_number + 1 : 1;

    // Create a new version with the generated content
    const { error: newVersionError } = await supabaseAdmin
      .from('game_versions')
      .insert([{
        game_id: gameId,
        code: content,
        version_number: newVersionNumber,
        instructions: "Generated with Groq model"
      }]);

    if (newVersionError) {
      throw new Error(`Error creating new version: ${newVersionError.message}`);
    }

    // Update the game with the latest version
    const { error: updateGameError } = await supabaseAdmin
      .from('games')
      .update({
        code: content,
        current_version: newVersionNumber
      })
      .eq('id', gameId);

    if (updateGameError) {
      throw new Error(`Error updating game: ${updateGameError.message}`);
    }

    // Return the generated content
    return new Response(
      JSON.stringify({ 
        content,
        status: 'success'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error("Error in process-game-update-with-groq:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error', 
        status: 'error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
