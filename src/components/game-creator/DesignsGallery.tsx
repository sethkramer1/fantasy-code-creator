
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
    const userGames = games.filter(game => game.user_id === user?.id);
    
    if (!user || userGames.length === 0) {
      setActiveTab("community");
    } else if (activeTab === "my" || userGames.length > 0) {
      setActiveTab("my");
    }
  }, [user, games, activeTab]);

  return (
    <div className="max-w-7xl mx-auto px-6 pb-16">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-gray-700" />
          <h2 className="text-xl font-medium text-black">Designs Gallery</h2>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <Tabs 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="flex flex-col w-full"
        >
          <div className="flex flex-col md:flex-row gap-6">
            <TabsList className="bg-gray-100 w-full md:w-48 h-auto flex md:flex-col flex-shrink-0">
              <TabsTrigger 
                value="community" 
                className="flex-1 md:w-full data-[state=active]:bg-white"
              >
                Community Designs
              </TabsTrigger>
              {user && (
                <TabsTrigger 
                  value="my" 
                  className="flex-1 md:w-full data-[state=active]:bg-white"
                >
                  My Designs
                </TabsTrigger>
              )}
            </TabsList>
            
            <div className="flex-1">
              <TabsContent value="community" className="m-0">
                <GamesList
                  games={games}
                  isLoading={gamesLoading}
                  onGameClick={(id) => navigate(`/play/${id}`)}
                  onGameDelete={deleteGame}
                  filter="public"
                  itemsPerPage={9}
                />
              </TabsContent>
              
              {user && (
                <TabsContent value="my" className="m-0">
                  <GamesList
                    games={games}
                    isLoading={gamesLoading}
                    onGameClick={(id) => navigate(`/play/${id}`)}
                    onGameDelete={deleteGame}
                    filter="my"
                    itemsPerPage={9}
                  />
                </TabsContent>
              )}
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
