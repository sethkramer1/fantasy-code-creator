
import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, MessageSquare, X, History, RotateCcw } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { GameChat } from "@/components/GameChat";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface GameVersion {
  id: string;
  version_number: number;
  code: string;
  instructions: string | null;
  created_at: string;
}

const Play = () => {
  const { id } = useParams();
  const [gameVersions, setGameVersions] = useState<GameVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ([
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        " ",
        "PageUp",
        "PageDown",
        "Home",
        "End",
      ].includes(e.key)) {
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, []);

  useEffect(() => {
    const fetchGame = async () => {
      try {
        const { data, error } = await supabase
          .from('games')
          .select(`
            id,
            current_version,
            game_versions (
              id,
              version_number,
              code,
              instructions,
              created_at
            )
          `)
          .eq('id', id)
          .single();

        if (error) throw error;
        if (!data) throw new Error("Game not found");
        
        // Sort versions by number descending
        const sortedVersions = data.game_versions.sort((a, b) => b.version_number - a.version_number);
        setGameVersions(sortedVersions);
        
        // Set current version as selected
        const currentVersion = sortedVersions.find(v => v.version_number === data.current_version);
        if (currentVersion) {
          setSelectedVersion(currentVersion.id);
        }
      } catch (error) {
        toast({
          title: "Error loading game",
          description: error instanceof Error ? error.message : "Please try again",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchGame();
  }, [id, toast]);

  // Auto-focus the iframe when the game loads
  useEffect(() => {
    if (!loading && iframeRef.current) {
      iframeRef.current.focus();
    }
  }, [loading]);

  const handleGameUpdate = (newCode: string, newInstructions: string) => {
    // Create new version object
    const newVersion: GameVersion = {
      id: crypto.randomUUID(),
      version_number: gameVersions[0].version_number + 1,
      code: newCode,
      instructions: newInstructions,
      created_at: new Date().toISOString(),
    };

    setGameVersions(prev => [newVersion, ...prev]);
    setSelectedVersion(newVersion.id);
  };

  const handleVersionChange = (versionId: string) => {
    setSelectedVersion(versionId);
  };

  const handleRevertToVersion = async (version: GameVersion) => {
    try {
      // Create new version based on the selected version
      const newVersion: GameVersion = {
        id: crypto.randomUUID(),
        version_number: gameVersions[0].version_number + 1,
        code: version.code,
        instructions: version.instructions,
        created_at: new Date().toISOString(),
      };

      // Save the new version to the database
      const { error } = await supabase
        .from('game_versions')
        .insert({
          id: newVersion.id,
          game_id: id,
          version_number: newVersion.version_number,
          code: newVersion.code,
          instructions: newVersion.instructions,
        });

      if (error) throw error;

      // Update local state
      setGameVersions(prev => [newVersion, ...prev]);
      setSelectedVersion(newVersion.id);

      toast({
        title: "Version reverted",
        description: `Created new version ${newVersion.version_number} based on version ${version.version_number}`,
      });
    } catch (error) {
      toast({
        title: "Error reverting version",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  const currentVersion = gameVersions.find(v => v.id === selectedVersion);

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-[1200px] mx-auto space-y-4 md:space-y-8">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Back to Generator</span>
          </Link>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <History size={20} className="text-gray-500" />
              <Select value={selectedVersion} onValueChange={handleVersionChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent>
                  {gameVersions.map((version) => (
                    <SelectItem 
                      key={version.id} 
                      value={version.id}
                      className="flex items-center justify-between group"
                    >
                      <span>Version {version.version_number}</span>
                      {version.id !== gameVersions[0].id && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRevertToVersion(version);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-blue-500 hover:text-blue-700 flex items-center space-x-1"
                        >
                          <RotateCcw size={14} />
                          <span className="text-xs">Revert</span>
                        </button>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <button
              onClick={() => setShowChat(!showChat)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <MessageSquare size={20} />
              <span>{showChat ? 'Hide Chat' : 'Show Chat'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {currentVersion && (
              <div className="glass-panel rounded-xl p-4 md:p-6 space-y-6">
                <div 
                  className="relative w-full" 
                  style={{ paddingTop: '75%' }}
                  onClick={() => iframeRef.current?.focus()}
                >
                  <iframe
                    ref={iframeRef}
                    srcDoc={currentVersion.code}
                    className="absolute top-0 left-0 w-full h-full rounded-lg border border-gray-200"
                    sandbox="allow-scripts"
                    title="Generated Game"
                    tabIndex={0}
                  />
                </div>

                {currentVersion.instructions && (
                  <div className="bg-white bg-opacity-50 backdrop-blur-sm p-4 rounded-lg border border-gray-200">
                    <h2 className="text-xl font-semibold mb-2">How to Play</h2>
                    <div className="text-gray-700 prose prose-sm max-w-none">
                      <ReactMarkdown>{currentVersion.instructions}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {showChat && (
            <div className="glass-panel rounded-xl p-4 h-[600px] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Game Chat</h2>
                <button
                  onClick={() => setShowChat(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <GameChat gameId={id!} onGameUpdate={handleGameUpdate} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Play;
