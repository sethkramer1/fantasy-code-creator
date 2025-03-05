import { useEffect } from "react";
import { GenerationTerminal } from "@/components/game-creator/GenerationTerminal";
import { useGameGeneration } from "@/hooks/useGameGeneration";
import { useGames } from "@/hooks/useGames";
import { GenerationPanel } from "@/components/game-creator/GenerationPanel";
import { DesignsGallery } from "@/components/game-creator/DesignsGallery";
import { MainNavigation } from "@/components/common/MainNavigation";

const Index = () => {
  const { games, gamesLoading, deleteGame } = useGames();
  const {
    loading,
    showTerminal,
    setShowTerminal,
    terminalOutput,
    thinkingTime,
    setThinkingTime,
    timerRef
  } = useGameGeneration();

  useEffect(() => {
    if (loading) {
      setThinkingTime(0);
      timerRef.current = setInterval(() => {
        setThinkingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [loading, timerRef, setThinkingTime]);

  return (
    <div className="min-h-screen bg-white">
      <MainNavigation />
      
      <div className="pt-8">
        <GenerationPanel
          loading={loading}
          showTerminal={showTerminal}
          setShowTerminal={setShowTerminal}
          terminalOutput={terminalOutput}
        />
        
        <DesignsGallery 
          games={games}
          gamesLoading={gamesLoading}
          deleteGame={deleteGame}
        />

        <GenerationTerminal
          open={showTerminal}
          onOpenChange={setShowTerminal}
          output={terminalOutput}
          thinkingTime={thinkingTime}
          loading={loading}
        />
      </div>
    </div>
  );
};

export default Index;
