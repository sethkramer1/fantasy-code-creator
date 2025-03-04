
// If this file is read-only, this code won't be applied, but we still need to ensure
// the prepareIframeContent function is properly implemented

export const prepareIframeContent = (code: string): string => {
  // Sanitize and prepare code for iframe display
  try {
    if (!code || typeof code !== 'string') {
      console.error("Invalid code provided to prepareIframeContent:", code);
      return '<html><body><p>Error: No content available</p></body></html>';
    }
    
    // If it's already HTML, make sure it has the right viewport settings
    if (code.includes('<html') || code.includes('<!DOCTYPE')) {
      // Add viewport meta tag if it doesn't exist
      if (!code.includes('<meta name="viewport"')) {
        code = code.replace('<head>', 
          `<head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <base target="_self">
            <style>
              html, body {
                height: 100%;
                overflow: auto;
                scroll-behavior: smooth;
              }
            </style>`);
      }
      return code;
    }
    
    // If it's just a fragment, wrap it in a proper HTML structure
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <style>
    html, body {
      height: 100%;
      margin: 0;
      padding: 1rem;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
  </style>
</head>
<body>
  ${code}
</body>
</html>`;
  } catch (error) {
    console.error("Error in prepareIframeContent:", error);
    return '<html><body><p>Error processing content</p></body></html>';
  }
};

export const filterGames = (games, filter, userId) => {
  if (!games || !Array.isArray(games)) return [];
  
  switch (filter) {
    case 'my':
      return games.filter(game => game.user_id === userId);
    case 'public':
      return games.filter(game => game.visibility === 'public');
    case 'private':
      return games.filter(game => game.visibility === 'private' && game.user_id === userId);
    case 'all':
    default:
      return games;
  }
};

export const getTypeInfo = (type) => {
  switch (type) {
    case 'game':
      return { label: 'Game', badgeColor: 'bg-blue-100 text-blue-800' };
    case 'web':
      return { label: 'Web App', badgeColor: 'bg-purple-100 text-purple-800' };
    case 'dashboard':
      return { label: 'Dashboard', badgeColor: 'bg-green-100 text-green-800' };
    case 'landing':
      return { label: 'Landing', badgeColor: 'bg-yellow-100 text-yellow-800' };
    default:
      return { label: 'Design', badgeColor: 'bg-gray-100 text-gray-800' };
  }
};
