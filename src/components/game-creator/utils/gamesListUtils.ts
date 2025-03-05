// If this file is read-only, this code won't be applied, but we still need to ensure
// the prepareIframeContent function is properly implemented

export const prepareIframeContent = (code: string): string => {
  if (!code || code === "Generating...") {
    return `<html><body><div style="display:flex;justify-content:center;align-items:center;height:100%;font-family:sans-serif;color:#888;">Loading preview...</div></body></html>`;
  }

  try {
    // Basic validation to ensure we have HTML content
    if (!code.includes('<html') && !code.includes('<!DOCTYPE') && !code.includes('<body')) {
      // Wrap code in basic HTML structure if it doesn't include proper HTML tags
      return `<!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <base target="_self">
          <style>
            html, body { height: 100%; margin: 0; overflow: auto; }
          </style>
        </head>
        <body>${code}</body>
        </html>`;
    }
    
    // If code already has HTML structure, enhance it with base target
    if (!code.includes('<base')) {
      code = code.replace('<head>', 
        `<head>
          <base target="_self">
          <style>
            html, body {
              height: 100%;
              overflow: auto;
            }
          </style>`);
    }
    
    return code;
  } catch (error) {
    console.error("Error in prepareIframeContent:", error);
    return `<html><body><div style="padding:20px;font-family:sans-serif;color:red;">Error preparing content</div></body></html>`;
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
