import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting Groq generation request");
    const requestData = await req.json();
    const { prompt, imageUrl, contentType, stream = false } = requestData;

    // Added initial validation to fail fast if parameters are missing
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Missing prompt parameter" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Set up connection to Groq API with optimized parameters
    // Reduce the timeout to 30s default - adjust based on requirements
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    // Prepare the request body with improved parameters
    const requestBody: any = {
      model: "mixtral-8x7b-32768", // Use Mixtral model for fast responses
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 10000
    };
    
    // Add image if provided
    if (imageUrl) {
      requestBody.messages[0].content = [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: imageUrl } }
      ];
    }

    // Set streaming parameter based on request
    if (stream) {
      requestBody.stream = true;
    }

    console.log("Sending request to Groq API");

    // Use keep-alive connection for better performance
    const fetchOptions: RequestInit = {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
        "Connection": "keep-alive"
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    };

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", fetchOptions);
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Groq API Error:", errorData);
      return new Response(
        JSON.stringify({ 
          error: "Failed to generate content", 
          details: errorData
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log("Response received from Groq API");

    // If streaming is requested, set up a TransformStream to handle the streaming properly
    if (stream) {
      const reader = response.body?.getReader();
      const encoder = new TextEncoder();
      
      if (!reader) {
        throw new Error("No reader available from Groq response");
      }

      const stream = new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              const chunk = new TextDecoder().decode(value);
              controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
          } catch (error) {
            console.error("Error processing stream:", error);
            controller.error(error);
          }
        }
      });

      return new Response(stream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    } else {
      // For non-streaming response, parse and return the data
      const data = await response.json();
      const content = data.choices[0]?.message?.content || "";
      
      return new Response(
        JSON.stringify({ content }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error("Error in generate-with-groq function:", error.message);
    
    if (error.name === 'AbortError') {
      return new Response(
        JSON.stringify({ error: "Request timeout - generation took too long" }),
        { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate content" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
