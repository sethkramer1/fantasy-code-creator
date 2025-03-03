
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

// Create a Supabase client with the admin key
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const netlifyClientId = Deno.env.get('NETLIFY_CLIENT_ID') ?? ''
const netlifyClientSecret = Deno.env.get('NETLIFY_CLIENT_SECRET') ?? ''
const siteUrl = Deno.env.get('SITE_URL') ?? ''

const supabase = createClient(supabaseUrl, supabaseKey)

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  try {
    // Get request body
    const body = await req.json()
    const { path, gameId, code, state, siteName } = body

    console.log(`Function called with path: ${path}, gameId: ${gameId}`)

    if (!path) {
      throw new Error('Path is required')
    }

    // START OAUTH FLOW
    if (path === 'start-oauth') {
      if (!gameId) {
        throw new Error('Game ID is required')
      }

      if (!netlifyClientId) {
        throw new Error('Netlify client ID is not configured')
      }

      if (!siteUrl) {
        throw new Error('Site URL is not configured')
      }

      // Generate a random state for OAuth security
      const stateId = crypto.randomUUID()

      // Store state and game ID in the database
      const { error: insertError } = await supabase
        .from('netlify_auth_state')
        .insert({
          state: stateId,
          game_id: gameId,
        })

      if (insertError) {
        console.error('Error storing auth state:', insertError)
        throw new Error('Failed to store auth state')
      }

      // Generate Netlify OAuth URL
      const redirectUri = `${siteUrl}/netlify-callback`
      const authUrl = `https://app.netlify.com/authorize?response_type=code&client_id=${netlifyClientId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&state=${stateId}`

      console.log('Generated auth URL with redirect to:', redirectUri)

      return new Response(
        JSON.stringify({
          authUrl,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // EXCHANGE CODE FOR TOKEN
    if (path === 'exchange-code') {
      if (!code || !state) {
        throw new Error('Code and state are required')
      }

      // Verify the state from the callback
      const { data: stateData, error: stateError } = await supabase
        .from('netlify_auth_state')
        .select('game_id')
        .eq('state', state)
        .single()

      if (stateError || !stateData) {
        console.error('Error verifying state:', stateError)
        throw new Error('Invalid state parameter')
      }

      // Get the game ID associated with the state
      const gameId = stateData.game_id

      // Exchange the code for an access token
      const redirectUri = `${siteUrl}/netlify-callback`
      const tokenResponse = await fetch('https://api.netlify.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: netlifyClientId,
          client_secret: netlifyClientSecret,
          redirect_uri: redirectUri,
        }),
      })

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text()
        console.error('Netlify token exchange error:', errorText)
        throw new Error(`Failed to exchange token: ${tokenResponse.status} ${errorText}`)
      }

      const tokenData = await tokenResponse.json()

      // Calculate token expiration
      const expiresAt = new Date()
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in)

      // Store the tokens in the database
      const { error: tokenInsertError } = await supabase
        .from('netlify_tokens')
        .upsert({
          game_id: gameId,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_type: tokenData.token_type,
          expires_at: expiresAt.toISOString(),
        })

      if (tokenInsertError) {
        console.error('Error storing token:', tokenInsertError)
        throw new Error('Failed to store access token')
      }

      // Clean up the auth state
      await supabase.from('netlify_auth_state').delete().eq('state', state)

      return new Response(
        JSON.stringify({
          success: true,
          gameId,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // CHECK TOKEN
    if (path === 'check-token') {
      if (!gameId) {
        throw new Error('Game ID is required')
      }

      const { data: tokenData, error: tokenError } = await supabase
        .from('netlify_tokens')
        .select('*')
        .eq('game_id', gameId)
        .single()

      if (tokenError) {
        if (tokenError.code === 'PGRST116') {
          // No token found
          return new Response(
            JSON.stringify({
              authorized: false,
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          )
        }
        throw tokenError
      }

      // Check if token is expired
      const now = new Date()
      const expiresAt = new Date(tokenData.expires_at)
      const isExpired = now > expiresAt

      if (isExpired) {
        // TODO: Implement token refresh
        // For now, just return not authorized
        return new Response(
          JSON.stringify({
            authorized: false,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      return new Response(
        JSON.stringify({
          authorized: true,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // DEPLOY
    if (path === 'deploy') {
      if (!gameId || !siteName) {
        throw new Error('Game ID and site name are required')
      }

      // Get access token
      const { data: tokenData, error: tokenError } = await supabase
        .from('netlify_tokens')
        .select('*')
        .eq('game_id', gameId)
        .single()

      if (tokenError || !tokenData) {
        console.error('Error retrieving token:', tokenError)
        throw new Error('No Netlify access token found')
      }

      // Get the game version (HTML)
      const { data: gameVersionData, error: gameVersionError } = await supabase
        .from('game_versions')
        .select('*')
        .eq('game_id', gameId)
        .order('version_number', { ascending: false })
        .limit(1)
        .single()

      if (gameVersionError || !gameVersionData) {
        console.error('Error retrieving game version:', gameVersionError)
        throw new Error('Game version not found')
      }

      const htmlContent = gameVersionData.code

      // Extract CSS and JS
      const parser = new DOMParser()
      const doc = parser.parseFromString(htmlContent, 'text/html')

      const styles = Array.from(doc.getElementsByTagName('style'))
        .map((style) => style.textContent)
        .join('\n')
      doc.querySelectorAll('style').forEach((style) => style.remove())

      const scripts = Array.from(doc.getElementsByTagName('script'))
        .map((script) => script.textContent)
        .join('\n')
      doc.querySelectorAll('script').forEach((script) => script.remove())

      // Add link to CSS file
      if (styles) {
        const linkTag = doc.createElement('link')
        linkTag.rel = 'stylesheet'
        linkTag.href = './styles.css'
        doc.head.appendChild(linkTag)
      }

      // Add script tag to JS file
      if (scripts) {
        const scriptTag = doc.createElement('script')
        scriptTag.src = './script.js'
        doc.body.appendChild(scriptTag)
      }

      // Create deployment package
      const files = {
        'index.html': doc.documentElement.outerHTML,
      }

      if (styles) {
        files['styles.css'] = styles
      }

      if (scripts) {
        files['script.js'] = scripts
      }

      // Create or update site
      try {
        // First check if the site exists
        const accessToken = tokenData.access_token
        let siteId = null

        // List user sites
        const sitesResponse = await fetch('https://api.netlify.com/api/v1/sites', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        if (!sitesResponse.ok) {
          throw new Error(`Failed to list sites: ${sitesResponse.status}`)
        }

        const sites = await sitesResponse.json()
        const existingSite = sites.find((site) => site.name === siteName)

        if (existingSite) {
          siteId = existingSite.id
          console.log(`Found existing site: ${siteName} with ID: ${siteId}`)
        } else {
          // Create new site
          const createSiteResponse = await fetch('https://api.netlify.com/api/v1/sites', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: siteName,
            }),
          })

          if (!createSiteResponse.ok) {
            const errorText = await createSiteResponse.text()
            throw new Error(`Failed to create site: ${createSiteResponse.status} ${errorText}`)
          }

          const newSite = await createSiteResponse.json()
          siteId = newSite.id
          console.log(`Created new site: ${siteName} with ID: ${siteId}`)
        }

        // Deploy files to site
        const deployUrl = `https://api.netlify.com/api/v1/sites/${siteId}/deploys`
        const formData = new FormData()

        // Add files to form data
        const fileBlob = new Blob([JSON.stringify(files)], { type: 'application/json' })
        formData.append('file', fileBlob, 'files.json')
        formData.append('function_name', 'deploy-to-netlify') // For logging

        const deployResponse = await fetch(deployUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          body: formData,
        })

        if (!deployResponse.ok) {
          const errorText = await deployResponse.text()
          throw new Error(`Failed to deploy: ${deployResponse.status} ${errorText}`)
        }

        const deployResult = await deployResponse.json()
        console.log('Deployment successful:', deployResult)

        return new Response(
          JSON.stringify({
            success: true,
            site_url: deployResult.ssl_url || deployResult.url,
            deploy_id: deployResult.id,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      } catch (deployError) {
        console.error('Deployment error:', deployError)
        throw new Error(`Deployment failed: ${deployError.message}`)
      }
    }

    throw new Error(`Unknown path: ${path}`)
  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
