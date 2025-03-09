import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.5.0";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NETLIFY_API_KEY = Deno.env.get('NETLIFY_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

// Simple regex-based HTML parsing functions since DOMParser is not available in Deno
function extractStylesFromHTML(html: string): string {
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match;
  let styles = '';
  
  while ((match = styleRegex.exec(html)) !== null) {
    styles += match[1] + '\n';
  }
  
  return styles;
}

function extractScriptsFromHTML(html: string): string {
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let scripts = '';
  
  while ((match = scriptRegex.exec(html)) !== null) {
    scripts += match[1] + '\n';
  }
  
  return scripts;
}

function removeTagsFromHTML(html: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>[\\s\\S]*?<\\/${tagName}>`, 'gi');
  return html.replace(regex, '');
}

function addLinkToHead(html: string, rel: string, href: string): string {
  const headCloseIndex = html.indexOf('</head>');
  if (headCloseIndex === -1) return html;
  
  const linkTag = `<link rel="${rel}" href="${href}">`;
  return html.slice(0, headCloseIndex) + linkTag + html.slice(headCloseIndex);
}

function addScriptToBody(html: string, src: string): string {
  const bodyCloseIndex = html.indexOf('</body>');
  if (bodyCloseIndex === -1) return html;
  
  const scriptTag = `<script src="${src}"></script>`;
  return html.slice(0, bodyCloseIndex) + scriptTag + html.slice(bodyCloseIndex);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (!NETLIFY_API_KEY) {
    console.error('NETLIFY_API_KEY is not set');
    return new Response(
      JSON.stringify({ error: 'NETLIFY_API_KEY is not set' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const requestData = await req.json();
    const { gameId, versionId, siteTitle, siteId, siteName } = requestData;
    
    if (!gameId || !versionId) {
      return new Response(
        JSON.stringify({ error: 'Game ID and Version ID are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get the version data
    const { data: versionData, error: versionError } = await supabase
      .from('game_versions')
      .select('code')
      .eq('id', versionId)
      .single();
    
    if (versionError) {
      console.error('Error fetching version data:', versionError);
      return new Response(
        JSON.stringify({ error: `Failed to fetch version data: ${versionError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!versionData || !versionData.code) {
      return new Response(
        JSON.stringify({ error: 'No code found for this version' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Generate a unique site name with random number to avoid conflicts
    const randomSuffix = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    // Use provided siteName if available, otherwise generate a new one
    const generatedSiteName = siteName || `fantasy-code-${versionId.split('-')[0]}-${randomSuffix}`;
    
    // Create a zip file with the code
    const zip = new JSZip();
    
    // Extract and separate CSS
    const styles = extractStylesFromHTML(versionData.code);
    if (styles) {
      versionData.code = removeTagsFromHTML(versionData.code, 'style');
    }
    
    // Extract and separate JavaScript
    const scripts = extractScriptsFromHTML(versionData.code);
    if (scripts) {
      versionData.code = removeTagsFromHTML(versionData.code, 'script');
    }
    
    // Ensure HTML has proper structure
    if (!versionData.code.includes('<!DOCTYPE html>')) {
      // If the HTML doesn't have a doctype, wrap it in a proper HTML structure
      const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fantasy Code Creator - ${versionId}</title>
  ${styles ? '<link rel="stylesheet" href="styles.css">' : ''}
  ${scripts ? '<script src="script.js" defer></script>' : ''}
</head>
<body>
  ${versionData.code}
</body>
</html>`;
      versionData.code = fullHTML;
    } else {
      // If it already has a doctype, just make sure it has the CSS and JS links
      if (styles && !versionData.code.includes('<link rel="stylesheet" href="styles.css">')) {
        versionData.code = versionData.code.replace('</head>', '<link rel="stylesheet" href="styles.css"></head>');
      }
      
      if (scripts && !versionData.code.includes('<script src="script.js"')) {
        versionData.code = versionData.code.replace('</head>', '<script src="script.js" defer></script></head>');
      }
    }
    
    // Update HTML to reference external files
    if (styles) {
      versionData.code = addLinkToHead(versionData.code, 'stylesheet', './styles.css');
    }
    
    if (scripts) {
      versionData.code = addScriptToBody(versionData.code, './script.js');
    }
    
    // Create a proper file structure in the ZIP
    zip.file('index.html', versionData.code);
    if (styles) {
      zip.file('styles.css', styles);
    }
    if (scripts) {
      zip.file('script.js', scripts);
    }

    // Add a netlify.toml file with basic configuration
    const netlifyConfig = `
[build]
  publish = "/"

# Ensure all routes are handled by index.html for SPA
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`;
    zip.file('netlify.toml', netlifyConfig);
    
    // Check if this version has already been deployed
    const { data: existingDeployment, error: lookupError } = await supabase
      .from('deployments')
      .select('*')
      .eq('version_id', versionId)
      .eq('provider', 'netlify')
      .maybeSingle();

    if (lookupError) {
      console.error('Error looking up existing deployment:', lookupError);
    }

    // Generate zip content as binary
    const zipContent = await zip.generateAsync({ type: 'uint8array' });
    
    let siteData;
    
    // If we already have a deployment, update it instead of creating a new one
    if (existingDeployment) {
      console.log('Found existing deployment, updating site:', existingDeployment.site_id);
      siteData = {
        id: existingDeployment.site_id,
        name: existingDeployment.site_name,
        url: existingDeployment.site_url,
        admin_url: `https://app.netlify.com/sites/${existingDeployment.site_name}/overview`
      };
    } else if (siteId && siteName) {
      // If siteId and siteName are provided, use them for redeployment
      console.log('Using provided site ID for redeployment:', siteId);
      siteData = {
        id: siteId,
        name: siteName,
        url: `https://${siteName}.netlify.app`,
        admin_url: `https://app.netlify.com/sites/${siteName}/overview`
      };
    } else {
      // First, create a new site on Netlify
      const createSiteResponse = await fetch('https://api.netlify.com/api/v1/sites', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NETLIFY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: generatedSiteName,
          // Add these flags to ensure proper deployment
          processing_settings: {
            html: { pretty_urls: true },
            css: { bundle: true, minify: true },
            js: { bundle: true, minify: true },
            images: { optimize: true }
          }
        })
      });
      
      if (!createSiteResponse.ok) {
        const errorText = await createSiteResponse.text();
        console.error('Netlify site creation error:', errorText);
        return new Response(
          JSON.stringify({ error: `Netlify site creation failed: ${createSiteResponse.status} ${createSiteResponse.statusText}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      siteData = await createSiteResponse.json();
      console.log('Site created successfully:', siteData.name, siteData.id);
    }
    
    // Now deploy the files to the site using the direct deploy API with ZIP upload
    const deployEndpoint = `https://api.netlify.com/api/v1/sites/${siteData.id}/deploys`;
    
    console.log('Deploying to Netlify site:', siteData.name, siteData.id);
    
    // According to Netlify API docs, we should send the ZIP directly as binary data
    // with Content-Type: application/zip
    const deployResponse = await fetch(deployEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NETLIFY_API_KEY}`,
        'Content-Type': 'application/zip'
      },
      body: zipContent
    });
    
    if (!deployResponse.ok) {
      const errorText = await deployResponse.text();
      console.error('Netlify deploy error:', errorText);
      return new Response(
        JSON.stringify({ error: `Netlify deploy failed: ${deployResponse.status} ${deployResponse.statusText}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const deployData = await deployResponse.json();
    console.log('Deploy initiated:', deployData.id);
    
    // Poll the deployment status until it's ready or fails
    let deployStatus = deployData.state;
    let pollAttempts = 0;
    const maxPollAttempts = 20;
    
    while (deployStatus !== 'ready' && deployStatus !== 'error' && pollAttempts < maxPollAttempts) {
      // Wait 3 seconds between polls
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check deployment status
      const statusResponse = await fetch(`https://api.netlify.com/api/v1/deploys/${deployData.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${NETLIFY_API_KEY}`
        }
      });
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        deployStatus = statusData.state;
        console.log('Current deploy status:', deployStatus, 'Attempt:', pollAttempts + 1, 'of', maxPollAttempts);
        
        // If the deployment is in processing state, we'll continue polling
        if (deployStatus === 'processing' || deployStatus === 'uploading') {
          // Continue polling
        } else if (deployStatus === 'ready') {
          // Deployment is successful
          console.log('Deployment completed successfully!');
          break;
        } else if (deployStatus === 'error') {
          // Deployment failed
          console.error('Deployment failed with error state');
          break;
        } else {
          // Unknown state
          console.warn('Deployment in unknown state:', deployStatus);
        }
      } else {
        console.error('Error checking deploy status:', statusResponse.status);
        break;
      }
      
      pollAttempts++;
    }
    
    // If we've reached max attempts but deployment isn't ready yet, return the site info anyway
    if (deployStatus !== 'ready') {
      console.warn('Deployment did not reach ready state within the polling period');
      
      // Return partial success with site info so the user can check the status later
      return new Response(
        JSON.stringify({
          status: 'pending',
          message: 'Deployment initiated but not yet complete. You can check the status on Netlify.',
          siteInfo: {
            name: siteData.name,
            url: siteData.ssl_url || siteData.url,
            admin_url: `https://app.netlify.com/sites/${siteData.name}/overview`
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Deploy successful:', deployData.id, 'Final status:', deployStatus);
    
    // Save the deployment info to the database
    if (existingDeployment) {
      // Update existing deployment
      const { error: updateError } = await supabase
        .from('deployments')
        .update({
          site_id: siteData.id,
          site_name: siteData.name,
          site_url: siteData.ssl_url || siteData.url,
          provider: 'netlify'
        })
        .eq('version_id', versionId)
        .eq('provider', 'netlify');
      
      if (updateError) {
        console.error('Error updating deployment info:', updateError);
      }
    } else {
      // Insert new deployment
      const { error: insertError } = await supabase
        .from('deployments')
        .insert({
          game_id: gameId,
          version_id: versionId,
          site_id: siteData.id,
          site_name: siteData.name,
          site_url: siteData.ssl_url || siteData.url,
          provider: 'netlify'
        });
      
      if (insertError) {
        console.error('Error saving deployment info:', insertError);
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        deployment: {
          siteId: siteData.id,
          siteName: siteData.name,
          siteUrl: siteData.ssl_url || siteData.url,
          adminUrl: siteData.admin_url
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in deploy-to-netlify function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
