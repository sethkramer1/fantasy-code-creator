import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Types for Pexels API responses
export interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  avg_color: string;
  src: {
    original: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
  alt: string;
}

export interface PexelsSearchResponse {
  total_results: number;
  page: number;
  per_page: number;
  photos: PexelsPhoto[];
}

// Get the Supabase URL and anon key from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create a Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Hook to search for images on Pexels
 */
export function usePexelsImages() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<PexelsPhoto[]>([]);
  const [totalResults, setTotalResults] = useState(0);

  /**
   * Search for images on Pexels based on a query
   */
  const searchImages = async (
    query: string,
    options: {
      perPage?: number;
      page?: number;
      orientation?: 'landscape' | 'portrait' | 'square';
    } = {}
  ) => {
    try {
      setLoading(true);
      setError(null);

      const { perPage = 10, page = 1, orientation = 'landscape' } = options;

      // Call our Supabase Edge Function for the Pexels API
      const { data, error } = await supabase.functions.invoke('pexels-api', {
        body: {
          query,
          perPage,
          page,
          orientation,
        },
      });

      if (error) {
        console.error('Error searching Pexels images:', error);
        setError(`Failed to search Pexels images: ${error.message}`);
        return null;
      }

      const response = data as PexelsSearchResponse;
      setImages(response.photos);
      setTotalResults(response.total_results);
      
      return response;
    } catch (err: any) {
      console.error('Error in searchImages:', err);
      setError(err.message || 'An error occurred while searching for images');
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get a random image from Pexels based on a query
   */
  const getRandomImage = async (
    query: string,
    orientation: 'landscape' | 'portrait' | 'square' = 'landscape'
  ): Promise<PexelsPhoto | null> => {
    try {
      setLoading(true);
      setError(null);

      // Get 10 images to have a good selection to choose from
      const response = await searchImages(query, {
        perPage: 10,
        page: 1,
        orientation,
      });

      if (!response || response.photos.length === 0) {
        return null;
      }

      // Return a random image from the results
      const randomIndex = Math.floor(Math.random() * response.photos.length);
      return response.photos[randomIndex];
    } catch (err: any) {
      console.error('Error in getRandomImage:', err);
      setError(err.message || 'An error occurred while getting a random image');
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Extract image keywords from a prompt
   */
  const extractImageKeywords = (prompt: string): string[] => {
    // Convert to lowercase for easier matching
    const lowerPrompt = prompt.toLowerCase();
    
    // Look for common image-related terms
    const imageTerms = [
      'image', 'picture', 'photo', 'photograph', 'background',
      'banner', 'hero', 'icon', 'logo', 'illustration'
    ];
    
    // Check if any image terms are in the prompt
    const hasImageTerms = imageTerms.some(term => lowerPrompt.includes(term));
    
    if (!hasImageTerms) {
      // If no specific image terms, return a general query based on the prompt
      // Extract nouns and adjectives (simplified approach)
      const words = prompt.split(/\s+/);
      const keywords = words.filter(word => 
        word.length > 3 && 
        !['the', 'and', 'that', 'with', 'for', 'this', 'have'].includes(word.toLowerCase())
      );
      
      // Return up to 3 keywords
      return keywords.slice(0, 3);
    }
    
    // Extract phrases around image terms
    const keywords: string[] = [];
    
    imageTerms.forEach(term => {
      const index = lowerPrompt.indexOf(term);
      if (index !== -1) {
        // Get words around the term
        const start = Math.max(0, lowerPrompt.lastIndexOf(' ', index - 2));
        const end = lowerPrompt.indexOf(' ', index + term.length + 20);
        const phrase = lowerPrompt.substring(
          start, 
          end === -1 ? lowerPrompt.length : end
        );
        
        // Clean up the phrase
        const cleanPhrase = phrase
          .replace(/[^\w\s]/g, '')  // Remove punctuation
          .replace(/\s+/g, ' ')     // Replace multiple spaces with a single space
          .trim();
        
        if (cleanPhrase && !cleanPhrase.includes(term)) {
          keywords.push(cleanPhrase);
        }
      }
    });
    
    return keywords.length > 0 ? keywords : [prompt.split(' ').slice(0, 3).join(' ')];
  };

  return {
    loading,
    error,
    images,
    totalResults,
    searchImages,
    getRandomImage,
    extractImageKeywords,
  };
}

export default usePexelsImages;
