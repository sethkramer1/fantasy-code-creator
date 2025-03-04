
import { contentTypes } from "@/types/game";
import { Game } from "@/types/game";

// Function to get type label and badge color
export function getTypeInfo(type?: string) {
  if (!type) return { label: 'Unknown', badgeColor: 'bg-gray-100 text-gray-800' };
  
  const contentType = contentTypes.find(t => t.id === type);
  const label = contentType ? contentType.label : 'Unknown';
  
  const badgeColors: Record<string, string> = {
    'game': 'bg-blue-100 text-blue-800',
    'svg': 'bg-pink-100 text-pink-800',
    'webdesign': 'bg-indigo-100 text-indigo-800',
    'dataviz': 'bg-green-100 text-green-800',
    'diagram': 'bg-orange-100 text-orange-800',
    'infographic': 'bg-yellow-100 text-yellow-800'
  };
  
  return { 
    label, 
    badgeColor: badgeColors[type] || 'bg-gray-100 text-gray-800'
  };
}

// Helper function to prepare iframe content
export const prepareIframeContent = (html: string) => {
  // Add helper script to make iframes work better
  const helperScript = `
    <script>
      document.addEventListener('DOMContentLoaded', function() {
        // Fix links to prevent navigation
        document.querySelectorAll('a').forEach(link => {
          link.addEventListener('click', function(e) {
            e.preventDefault();
          });
        });
        
        // Disable all form submissions
        document.querySelectorAll('form').forEach(form => {
          form.addEventListener('submit', function(e) {
            e.preventDefault();
          });
        });
      });
    </script>
  `;

  // Check if the document has a <head> tag
  if (html.includes('<head>')) {
    return html.replace('<head>', '<head>' + helperScript);
  } else if (html.includes('<html')) {
    // If it has <html> but no <head>, insert head after html opening tag
    return html.replace(/<html[^>]*>/, '$&<head>' + helperScript + '</head>');
  } else {
    // If neither, just prepend the script
    return helperScript + html;
  }
};

// Filter games based on the provided filter criteria
export const filterGames = (games: Game[], filter: string, userId?: string): Game[] => {
  if (!games || games.length === 0) {
    return [];
  }

  switch (filter) {
    case 'my':
      // Only show games created by the current user
      return games.filter(game => game.user_id === userId);
    case 'public':
      // Only show public games
      return games.filter(game => game.visibility === 'public');
    case 'private':
      // Only show private games created by the current user
      return games.filter(game => game.visibility !== 'public' && game.user_id === userId);
    default:
      // Show all games the user has access to
      if (userId) {
        // If user is logged in, show their games plus public games
        return games.filter(game => game.user_id === userId || game.visibility === 'public');
      } else {
        // If not logged in, only show public games
        return games.filter(game => game.visibility === 'public');
      }
  }
};
