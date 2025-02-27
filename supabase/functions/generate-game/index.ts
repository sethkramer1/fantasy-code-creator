
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set')
  }

  try {
    const { prompt } = await req.json()
    
    console.log('Generating game with prompt:', prompt)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 20000,
        stream: true,
        thinking: {
          type: "enabled",
          budget_tokens: 16000
        },
        messages: [
          {
            role: 'user',
            content: `Create a simple HTML5 game based on this description: ${prompt}. 

GAME STRUCTURE REQUIREMENTS:
1. Game Logic:
- Use a proper Game class/object to encapsulate all game logic
- Implement clear game states: loading, playing, paused, game over
- All variables must be properly scoped (no globals)
- Use requestAnimationFrame for the game loop
- Include proper event cleanup on game over/restart

2. Core Functionality:
- Start button must initialize game state and assets properly
- Event listeners must be added AND removed appropriately
- Mobile touch events must have proper touch handling (min 44x44px touch areas)
- Score/lives must persist correctly between game states
- Pause functionality must properly freeze game state
- Add console.logs for key game events (start, score changes, game over)

3. Error Prevention:
- Check for undefined game objects before use
- Implement bounds checking for all game entities
- Add frame rate management
- Include checks for browser compatibility features
- Add try-catch blocks around critical game functions

4. User Experience:
- Show clear loading states for assets
- Display game instructions before starting
- Provide visual feedback for ALL player actions
- Show clear game over state with final score
- Include restart functionality
- Add hover/active states for interactive elements
- Load sound effects only after user interaction
- Ensure the game starts when the user presses start

5. Mobile Support:
- Implement responsive design that works on all screen sizes
- Prevent touch events from interfering with page scroll when game is inactive
- Position controls for comfortable thumb reach
- Optimize performance for mobile devices
- Handle device orientation changes gracefully

6. Documentation:
- Add clear comments for game initialization, update, and render functions
- Use descriptive variable and function names
- Document game states and transitions
- Include performance considerations

7. Sizing
- Build a responsive canvas that uses 100% of the container width and at least 80% of the viewport height (80vh). 
- Include the viewport meta tag with width=device-width and initial-scale=1, and use CSS to ensure the game container has no unnecessary margins or padding. 
- Make sure all game elements scale proportionally using relative sizing, with a minimum rendering size of 800x600px that automatically adjusts for both desktop and mobile screens.

The game MUST:
- Work completely standalone with no external dependencies
- Have all code (HTML, CSS, JavaScript) in one file
- Include DOCTYPE and meta tags
- Work immediately when loaded in an iframe

Return ONLY the raw HTML. Do NOT wrap the code in \`\`\`html or any other markdown tags.

Here's a verification checklist - make sure the game meets ALL these criteria before returning:
1. Game starts correctly when clicking Start/Play button
2. All game mechanics work as intended
3. Score/lives system functions properly
4. Game over state is handled correctly
5. Restart functionality works
6. Mobile touch controls work
7. All visual feedback is clear and responsive
8. No console errors occur during gameplay
9. Game properly cleans up resources on exit/restart
10. Performance is smooth on both desktop and mobile`,
          },
        ]
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Anthropic API error:', error)
      throw new Error(`Anthropic API error: ${error}`)
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error('Error in generate-game function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
