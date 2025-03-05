// If this file is read-only, this code won't be applied, but we still need to ensure
// the prepareIframeContent function is properly implemented

export const prepareIframeContent = (code: string): string => {
  if (!code || code === "Generating..." || code.length < 20) {
    return `<html><body><div style="display:flex;justify-content:center;align-items:center;height:100%;color:#888;">Preview loading...</div></body></html>`;
  }
  
  // If the code already includes HTML structure, use it as is
  if (code.includes('<html') || code.includes('<!DOCTYPE html')) {
    return code;
  }
  
  // Otherwise, wrap it in a basic HTML structure
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { 
      margin: 0; 
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    }
  </style>
</head>
<body>${code}</body>
</html>`;
};

export const filterGames = (games, filter, userId) => {
  if (!games || !Array.isArray(games)) return [];
  
  switch (filter) {
    case 'my':
      return games.filter(game => game.user_id === userId);
    case 'public':
      // Ensure we're only showing games with public visibility
      return games.filter(game => game.visibility === 'public');
    case 'private':
      return games.filter(game => game.visibility === 'private' && game.user_id === userId);
    case 'unlisted':
      // Only show unlisted games owned by the user
      return games.filter(game => game.visibility === 'unlisted' && game.user_id === userId);
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

export const getVisibilityInfo = (visibility: string) => {
  switch (visibility) {
    case 'public':
      return {
        label: 'Public',
        icon: 'Globe',
        description: 'Anyone can view'
      };
    case 'unlisted':
      return {
        label: 'Unlisted',
        icon: 'Link2',
        description: 'Anyone with the link can view'
      };
    case 'private':
    default:
      return {
        label: 'Private',
        icon: 'Lock',
        description: 'Only you can view'
      };
  }
};
