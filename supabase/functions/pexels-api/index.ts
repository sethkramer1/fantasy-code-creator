import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.5.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PEXELS_API_KEY = Deno.env.get('PEXELS_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (!PEXELS_API_KEY) {
    console.error('PEXELS_API_KEY is not set');
    return new Response(
      JSON.stringify({ error: 'PEXELS_API_KEY is not set' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const requestData = await req.json();
    const { query, perPage = 10, page = 1, orientation = 'landscape' } = requestData;
    
    console.log("Received request with query:", query);
    
    if (!query || typeof query !== 'string' || query.trim() === "") {
      console.error('Invalid or empty query received:', query);
      return new Response(
        JSON.stringify({ 
          error: 'Valid query is required',
          details: 'A non-empty search query is required to find images'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Construct the URL with query parameters
    const url = new URL('https://api.pexels.com/v1/search');
    url.searchParams.append('query', query);
    url.searchParams.append('per_page', perPage.toString());
    url.searchParams.append('page', page.toString());
    
    if (orientation) {
      url.searchParams.append('orientation', orientation);
    }

    // Make the request to Pexels API
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': PEXELS_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Pexels API error response:', errorText);
      throw new Error(`Pexels API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    // Format the response to include only the data we need
    const formattedResponse = {
      total_results: data.total_results,
      page: data.page,
      per_page: data.per_page,
      photos: data.photos.map((photo: any) => ({
        id: photo.id,
        width: photo.width,
        height: photo.height,
        url: photo.url,
        photographer: photo.photographer,
        photographer_url: photo.photographer_url,
        avg_color: photo.avg_color,
        src: {
          original: photo.src.original,
          large: photo.src.large,
          medium: photo.src.medium,
          small: photo.src.small,
          portrait: photo.src.portrait,
          landscape: photo.src.landscape,
          tiny: photo.src.tiny
        },
        alt: photo.alt
      }))
    };

    return new Response(
      JSON.stringify(formattedResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
