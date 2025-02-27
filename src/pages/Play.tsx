
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
        
        const sortedVersions = data.game_versions.sort((a, b) => b.version_number - a.version_number);
        setGameVersions(sortedVersions);
        
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

  useEffect(() => {
    if (!loading && iframeRef.current) {
      iframeRef.current.focus();
    }
  }, [loading]);

  const handleGameUpdate = (newCode: string, newInstructions: string) => {
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
      const newVersion: GameVersion = {
        id: crypto.randomUUID(),
        version_number: gameVersions[0].version_number + 1,
        code: version.code,
        instructions: version.instructions,
        created_at: new Date().toISOString(),
      };

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
  const selectedVersionNumber = currentVersion?.version_number;
  const isLatestVersion = selectedVersionNumber === gameVersions[0]?.version_number;

  return (
    <div className="min-h-screen flex bg-[#F5F5F5]">
      {/* Chat Sidebar */}
      {showChat && (
        <div className="w-[400px] h-screen flex flex-col bg-white border-r border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Game Chat</h2>
              <button
                onClick={() => setShowChat(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} className="text-gray-400" />
              </button>
            </div>
          </div>
          <div className="flex-1">
            <GameChat gameId={id!} onGameUpdate={handleGameUpdate} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-[1200px] mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft size={18} />
              <span className="text-sm">Back to Generator</span>
            </Link>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {!isLatestVersion && currentVersion && (
                  <button
                    onClick={() => handleRevertToVersion(currentVersion)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <RotateCcw size={16} />
                    <span>Revert to this version</span>
                  </button>
                )}
                <History size={18} className="text-gray-500" />
                <Select value={selectedVersion} onValueChange={handleVersionChange}>
                  <SelectTrigger className="w-[180px] bg-white border-gray-200">
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent>
                    {gameVersions.map((version) => (
                      <SelectItem 
                        key={version.id} 
                        value={version.id}
                        className="flex items-center justify-between"
                      >
                        <span>Version {version.version_number}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!showChat && (
                <button
                  onClick={() => setShowChat(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm"
                >
                  <MessageSquare size={18} />
                  <span>Show Chat</span>
                </button>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {currentVersion && (
              <div className="glass-panel bg-white/80 backdrop-blur-sm border border-gray-100 rounded-xl p-4 md:p-6 space-y-6 shadow-sm">
                <div 
                  className="relative w-full rounded-lg overflow-hidden bg-white"
                  style={{ paddingTop: '75%' }}
                  onClick={() => iframeRef.current?.focus()}
                >
                  <iframe
                    ref={iframeRef}
                    srcDoc={currentVersion.code}
                    className="absolute top-0 left-0 w-full h-full border border-gray-100"
                    sandbox="allow-scripts"
                    title="Generated Game"
                    tabIndex={0}
                  />
                </div>

                {currentVersion.instructions && (
                  <div className="bg-gray-50/80 backdrop-blur-sm p-4 rounded-lg border border-gray-100">
                    <h2 className="text-lg font-medium text-gray-900 mb-2">How to Play</h2>
                    <div className="prose prose-sm max-w-none text-gray-600">
                      <ReactMarkdown>{currentVersion.instructions}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Play;
