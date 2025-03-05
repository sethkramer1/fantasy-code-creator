import { useRef, useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { GamePreview } from "@/components/game-player/GamePreview";
import { PlayNavbar } from "@/components/game-player/PlayNavbar";
import { SidebarChat } from "@/components/game-player/SidebarChat";
import { GenerationTerminal } from "@/components/game-creator/GenerationTerminal";
import { usePlayGameData } from "@/hooks/usePlayGameData";
import { useGameUpdate } from "@/hooks/useGameUpdate";
import { usePlayTerminal } from "@/hooks/usePlayTerminal";
import { useToast } from "@/components/ui/use-toast";
import { ViewToggle } from "@/components/game-player/ViewToggle";
import { VersionHistory } from "@/components/game-player/components/VersionHistory";
import { useAuth } from "@/context/AuthContext";
import { forceTokenTracking } from "@/services/generation/tokenTrackingService";
import { supabase } from "@/integrations/supabase/client";
import { generateGameName } from "@/services/generation/anthropicService";
import JSZip from 'jszip';
import { Button } from "@/components/ui/button";

const Play = () => {
  const { id: gameId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [showCode, setShowCode] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();
  const contentInitializedRef = useRef(false);
  const tokenCheckPerformedRef = useRef(false);
  const { user } = useAuth();
  
  const generating = searchParams.get("generating") === "true";
  const initialType = searchParams.get("type") || "webdesign";
  const initialModelType = searchParams.get("modelType") || "smart";
  const initialImageUrl = searchParams.get("imageUrl") || "";
  const promptFromUrl = searchParams.get("prompt") || "";
  
  const generationHandledRef = useRef(false);
  
  const { 
    game, 
    currentVersion, 
    gameVersions, 
    fetchGame,
    isLoading: gameDataLoading,
    accessDenied,
    setGame
  } = usePlayGameData(gameId);
  
  // Check if the current user is the creator of the game
  const isCreator = user?.id && game?.user_id === user.id;
  
  // Check if the user owns this game based on local storage
  const checkLocalOwnership = () => {
    if (!gameId) return false;
    const ownedGames = JSON.parse(localStorage.getItem('ownedGames') || '{}');
    return !!ownedGames[gameId];
  };
  
  // Combined check for creator status
  const isOwner = isCreator || checkLocalOwnership();
  
  const { 
    handleGameUpdate, 
    revertToMessageVersion, 
    revertToVersion 
  } = useGameUpdate(
    gameId, game, gameVersions, fetchGame
  );
  
  const initialPrompt = promptFromUrl || (game?.prompt || "Loading...");
  
  const {
    generationInProgress,
    terminalOutput,
    showTerminal,
    thinkingTime,
    handleTerminalStatusChange,
    setShowTerminal,
    generationError
  } = usePlayTerminal(gameId, generating, initialPrompt, initialType, initialModelType, initialImageUrl);

  const displayedVersion = useCallback(() => {
    if (selectedVersionId) {
      const selectedVersion = gameVersions.find(v => v.id === selectedVersionId);
      return selectedVersion || currentVersion;
    }
    return currentVersion;
  }, [selectedVersionId, gameVersions, currentVersion]);

  const hasValidContent = useCallback(() => {
    const version = displayedVersion();
    return version?.code && 
           version.code !== "Generating..." && 
           version.code.length > 100;
  }, [displayedVersion]);

  const checkForTokenData = useCallback(async () => {
    if (!gameId || !game || tokenCheckPerformedRef.current || generationInProgress) {
      return;
    }
    
    try {
      tokenCheckPerformedRef.current = true;
      console.log("[TOKEN TRACKING] Checking for existing token data for game:", gameId);
      
      const { data, error } = await supabase
        .from('token_usage')
        .select('id, input_tokens, output_tokens')
        .eq('game_id', gameId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (error) {
        console.error("[TOKEN TRACKING] Error checking for token data:", error);
        return;
      }
      
      if (!data) {
        console.log("[TOKEN TRACKING] No token data found, creating backup record");
        
        if (game.code && game.prompt) {
          const estimatedInputTokens = Math.ceil(game.prompt.length / 4);
          const estimatedOutputTokens = Math.ceil(game.code.length / 4);
          
          console.log(`[TOKEN TRACKING] Creating backup token record with estimated values - Input: ${estimatedInputTokens}, Output: ${estimatedOutputTokens}`);
          
          await forceTokenTracking(
            gameId,
            user?.id,
            game.prompt,
            game.model_type || 'smart',
            estimatedInputTokens,
            estimatedOutputTokens
          );
          
          console.log("[TOKEN TRACKING] Backup token record created");
        }
      } else {
        console.log("[TOKEN TRACKING] Found existing token data:", data);
      }
    } catch (checkError) {
      console.error("[TOKEN TRACKING] Error in token data check:", checkError);
    }
  }, [gameId, game, user?.id, generationInProgress]);

  useEffect(() => {
    console.log("Play component loaded with gameId:", gameId);
  }, [gameId]);

  useEffect(() => {
    generationHandledRef.current = false;
    contentInitializedRef.current = false;
    tokenCheckPerformedRef.current = false;
    setSelectedVersionId(null);
  }, [gameId]);

  useEffect(() => {
    if (generating && !generationInProgress && !generationHandledRef.current) {
      generationHandledRef.current = true;
      console.log("Generation process complete, navigating to standard view");
      
      const loadContent = async () => {
        try {
          await fetchGame();
          navigate(`/play/${gameId}`, { replace: true });
        } catch (error) {
          console.error("Error refreshing game data after generation:", error);
          navigate(`/play/${gameId}`, { replace: true });
        }
      };
      
      loadContent();
    }
    
    if (generationError && !generationHandledRef.current) {
      generationHandledRef.current = true;
      console.error("Generation error occurred:", generationError);
      
      if (generating) {
        navigate(`/play/${gameId}`, { replace: true });
      }
      
      // Provide more specific error messages for Anthropic API issues
      let errorTitle = "Generation Error";
      let errorMessage = generationError || "Failed to generate content. Please try again.";
      
      if (generationError && (
          generationError.includes("Anthropic API") || 
          generationError.includes("token limit") ||
          generationError.includes("rate limit") ||
          generationError.includes("timed out") ||
          generationError.includes("service unavailable")
      )) {
        errorTitle = "Anthropic API Error";
        // Keep the original error message as it should be more specific now
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive"
      });
    }
  }, [generationInProgress, gameId, fetchGame, navigate, toast, generating, generationError]);

  useEffect(() => {
    if (hasValidContent() && !contentInitializedRef.current) {
      contentInitializedRef.current = true;
      console.log("Content initialized successfully");
      
      if (game && gameId && !tokenCheckPerformedRef.current) {
        checkForTokenData();
      }
    }
  }, [hasValidContent, game, gameId, checkForTokenData]);

  useEffect(() => {
    setSelectedVersionId(null);
  }, [gameVersions.length]);

  const handleDownload = () => {
    if (displayedVersion()) {
      const zip = new JSZip();
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(displayedVersion()?.code || "", 'text/html');
        const styles = Array.from(doc.getElementsByTagName('style')).map(style => style.textContent).join('\n');
        if (styles) {
          zip.file('styles.css', styles);
          doc.querySelectorAll('style').forEach(style => style.remove());
        }
        const scripts = Array.from(doc.getElementsByTagName('script')).map(script => script.textContent).join('\n');
        if (scripts) {
          zip.file('script.js', scripts);
          doc.querySelectorAll('script').forEach(script => script.remove());
        }
        if (styles) {
          const linkTag = doc.createElement('link');
          linkTag.rel = 'stylesheet';
          linkTag.href = './styles.css';
          doc.head.appendChild(linkTag);
        }
        if (scripts) {
          const scriptTag = doc.createElement('script');
          scriptTag.src = './script.js';
          doc.body.appendChild(scriptTag);
        }
        zip.file('index.html', doc.documentElement.outerHTML);
        
        zip.generateAsync({ type: 'blob' }).then((content) => {
          const url = URL.createObjectURL(content);
          const a = document.createElement('a');
          a.href = url;
          a.download = `version-${displayedVersion()?.version_number || 'latest'}.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          toast({
            title: "Files downloaded",
            description: "The HTML, CSS, and JS files have been downloaded as a ZIP file."
          });
        });
      } catch (error) {
        console.error("Error downloading files:", error);
        toast({
          title: "Download failed",
          description: "There was an error downloading the files. Please try again.",
          variant: "destructive"
        });
      }
    } else {
      toast({
        title: "No content to download",
        description: "There is no content available to download.",
        variant: "destructive"
      });
    }
  };
  
  const handleVisibilityChange = async (newVisibility: string) => {
    if (!gameId || !user) return;
    
    try {
      // Check if user is the owner of the game
      if (game?.user_id !== user.id) {
        toast({
          title: "Permission denied",
          description: "You can only change visibility of your own designs",
          variant: "destructive"
        });
        return;
      }
      
      // Validate visibility value
      if (!['public', 'private', 'unlisted'].includes(newVisibility)) {
        toast({
          title: "Invalid visibility setting",
          description: "Visibility must be public, private, or unlisted",
          variant: "destructive"
        });
        return;
      }
      
      // Update visibility in database
      const { error } = await supabase
        .from('games')
        .update({ visibility: newVisibility })
        .eq('id', gameId)
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      // Update local game state
      if (game) {
        setGame({
          ...game,
          visibility: newVisibility
        });
      }
      
    } catch (error) {
      console.error("Error changing visibility:", error);
      toast({
        title: "Error changing visibility",
        description: "Please try again later",
        variant: "destructive"
      });
    }
  };

  // Add a test function for name generation - FOR DEBUGGING ONLY
  const testNameGeneration = async () => {
    if (!game?.prompt) return;
    
    toast({
      title: "Testing name generation",
      description: "Generating a name for this game design..."
    });
    
    try {
      const name = await generateGameName(game.prompt);
      console.log("Generated name:", name);
      
      if (name && gameId) {
        // Update the game with the new name
        // Use type assertion to bypass TypeScript type checking
        const { error } = await supabase
          .from('games')
          .update({ 
            // Use type assertion to bypass TypeScript type checking
            name: name 
          } as any)
          .eq('id', gameId);
          
        if (error) {
          console.error("Error updating game name:", error);
          toast({
            title: "Error updating name",
            description: error.message,
            variant: "destructive"
          });
        } else {
          toast({
            title: "Name generated",
            description: `Generated name: "${name}"`
          });
          
          // Refresh the game data
          await fetchGame();
        }
      } else {
        toast({
          title: "Name generation failed",
          description: "Could not generate a name",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error in test name generation:", error);
      toast({
        title: "Error generating name",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  };
  
  // Add a function to run the SQL migration - FOR DEBUGGING ONLY
  const runSqlMigration = async () => {
    toast({
      title: "Running SQL migration",
      description: "Adding name column to games table..."
    });
    
    try {
      // Execute SQL directly using the SQL API
      const response = await fetch('https://nvutcgbgthjeetclfibd.supabase.co/rest/v1/rpc/execute_sql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`
        },
        body: JSON.stringify({
          query: `
            -- Add name column to games table
            ALTER TABLE games 
            ADD COLUMN IF NOT EXISTS name TEXT;
            
            -- Update existing records to have a name based on the prompt
            UPDATE games
            SET name = SUBSTRING(prompt, 1, 50)
            WHERE name IS NULL;
          `
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SQL execution failed: ${errorText}`);
      }
      
      toast({
        title: "SQL migration completed",
        description: "Name column added to games table"
      });
      
      // Refresh the game data
      await fetchGame();
    } catch (error) {
      console.error("Error in SQL migration:", error);
      toast({
        title: "Error running SQL migration",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  if (!gameId) {
    console.error("No game ID provided in URL params");
    return (
      <div className="h-screen flex items-center justify-center">
        <p>No game ID provided</p>
      </div>
    );
  }

  const isDeletedGame = game?.deleted === true;
  
  if (isDeletedGame) {
    return (
      <div className="h-screen flex flex-col items-center justify-center px-4 text-center">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md">
          <h2 className="text-xl font-semibold text-red-700 mb-2">Design Unavailable</h2>
          <p className="text-gray-700 mb-4">This design has been deleted and is no longer available.</p>
          <button 
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  if (gameDataLoading && !generationInProgress && !contentInitializedRef.current) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mr-3"></div>
        <p>Loading game data...</p>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            This content is private and can only be viewed by its creator.
          </p>
          <Button onClick={() => navigate("/")} variant="default">
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-white">
      <PlayNavbar
        gameId={gameId}
        gameName={(game as any)?.name || (initialPrompt !== "Loading..." ? initialPrompt : (game?.prompt || "Loading..."))}
        gameUserId={game?.user_id}
        visibility={game?.visibility || 'public'}
        onVisibilityChange={handleVisibilityChange}
        onDownload={handleDownload}
        showCodeEditor={showCode}
        onShowCodeEditorChange={setShowCode}
      />

      <div className="flex flex-grow w-full overflow-hidden">
        <SidebarChat
          gameId={gameId}
          generationInProgress={generationInProgress}
          onGameUpdate={handleGameUpdate}
          onTerminalStatusChange={handleTerminalStatusChange}
          onRevertToMessageVersion={revertToMessageVersion}
          gameVersions={gameVersions.map(version => ({
            ...version,
            user_id: game?.user_id
          }))}
          initialPrompt={initialPrompt}
          isCreator={isOwner}
        />
        
        <div className="flex-1 h-full overflow-hidden bg-gray-50">
          {generationInProgress ? (
            <GenerationTerminal
              open={showTerminal}
              onOpenChange={setShowTerminal}
              output={terminalOutput}
              thinkingTime={thinkingTime}
              loading={generationInProgress}
              asModal={false}
            />
          ) : (
            <div className="h-full flex flex-col">
              <div className="flex justify-between items-center p-3 bg-white border-b border-gray-200">
                <ViewToggle showCode={showCode} onToggle={setShowCode} />
                <VersionHistory 
                  gameVersions={gameVersions} 
                  currentVersionId={currentVersion?.id}
                  onRevertToVersion={revertToVersion}
                  onVersionSelect={setSelectedVersionId}
                  selectedVersionId={selectedVersionId}
                  isCreator={isOwner}
                />
              </div>
              <div className="flex-1 overflow-hidden bg-white">
                <GamePreview
                  key={`preview-${displayedVersion()?.id || 'loading'}`}
                  currentVersion={displayedVersion()}
                  showCode={showCode}
                  ref={iframeRef}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Play;
