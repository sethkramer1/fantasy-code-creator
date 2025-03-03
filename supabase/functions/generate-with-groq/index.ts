
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
      console.error("Missing prompt parameter");
      return new Response(JSON.stringify({ error: "Missing prompt parameter" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!GROQ_API_KEY) {
      console.error("GROQ_API_KEY is not set in environment variables");
      return new Response(JSON.stringify({ error: "API configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Set up connection to Groq API with optimized parameters
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    console.log("Preparing Groq API request:", {
      hasImage: !!imageUrl,
      promptLength: prompt?.length || 0,
      contentType,
      stream
    });

    // Prepare the request body with improved parameters
    const requestBody: any = {
      model: "llama3-70b-8192", // Use Llama model for better quality
      messages: [
        {
          role: "system",
          content: getSystemInstructions(contentType)
        },
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
      console.log("Image URL provided, adding to request");
      requestBody.messages[1].content = [
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
      
      if (!data.choices || !data.choices[0]?.message?.content) {
        console.error("Invalid response format from Groq API:", data);
        return new Response(
          JSON.stringify({ 
            error: "Failed to parse Groq response",
            details: "Invalid response format" 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const content = data.choices[0].message.content;
      
      // Validate the content
      if (!content || content.length < 100) {
        console.error("Groq API returned too short content:", content?.substring(0, 100));
        return new Response(
          JSON.stringify({ 
            error: "Received empty or invalid content from Groq",
            details: content?.substring(0, 100) || "Empty content"
          }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log("Successfully generated content, returning response");
      
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
      JSON.stringify({ 
        error: error.message || "Failed to generate content",
        details: error.stack || "No stack trace available"
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to get system instructions based on content type
function getSystemInstructions(contentType: string): string {
  // Default instructions for web design
  let instructions = `You are a master web designer and programmer. Your job is to create visually appealing, interactive web designs based on the user's description. 
  
Your response should ONLY include the full HTML, CSS, and JavaScript code needed to create the described design. Do not include any explanations, markdown code blocks, or anything other than the raw code.
  
Create responsive designs that work well on both desktop and mobile. Use modern CSS techniques like flexbox and grid. Write clean, well-commented code.`;

  // Customize based on content type
  switch (contentType) {
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
  }

  return instructions;
}
