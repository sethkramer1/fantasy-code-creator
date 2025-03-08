import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GamesList } from "./GamesList";
import { useAuth } from "@/context/AuthContext";

interface DesignsGalleryProps {
  games: any[];
  gamesLoading: boolean;
  deleteGame: (id: string) => Promise<boolean>;
}

export function DesignsGallery({ games, gamesLoading, deleteGame }: DesignsGalleryProps) {
  const [activeTab, setActiveTab] = useState<string>("community");
  const { user } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    // Only set default tab on initial load, not when switching tabs
    if (!activeTab) {
      const userGames = games.filter(game => game.user_id === user?.id);
      
      if (!user || userGames.length === 0) {
        setActiveTab("community");
      } else if (userGames.length > 0) {
        setActiveTab("my");
      }
    }
  }, [user, games]);

  return (
    <div className="max-w-7xl mx-auto px-6 pb-16">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-gray-700" />
          <h2 className="text-xl font-medium text-black">From the Community</h2>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full flex justify-start mb-8 bg-transparent border-b border-gray-200 p-0 h-auto">
          <TabsTrigger 
            value="community" 
            className="px-6 py-3 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none"
          >
            Community
          </TabsTrigger>
          {user && (
            <TabsTrigger 
              value="my" 
              className="px-6 py-3 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none"
            >
              Your Designs
            </TabsTrigger>
          )}
        </TabsList>
            
        <TabsContent value="community" className="mt-0">
          <GamesList
            games={games}
            isLoading={gamesLoading}
            onGameClick={(id) => navigate(`/play/${id}`)}
            onGameDelete={deleteGame}
            filter="public"
            itemsPerPage={8}
          />
        </TabsContent>
            
        {user && (
          <TabsContent value="my" className="mt-0">
            <GamesList
              games={games}
              isLoading={gamesLoading}
              onGameClick={(id) => navigate(`/play/${id}`)}
              onGameDelete={deleteGame}
              filter="my"
              itemsPerPage={8}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
