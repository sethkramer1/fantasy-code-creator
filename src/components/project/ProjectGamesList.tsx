
import React from 'react';
import { Button } from "@/components/ui/button";
import { useProjectGames } from "@/hooks/useProjectGames";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface ProjectGamesListProps {
  projectId: string;
}

export function ProjectGamesList({ projectId }: ProjectGamesListProps) {
  const { projectGames, loading, removeGameFromProject } = useProjectGames(projectId);
  const navigate = useNavigate();
  
  if (loading) {
    return <div className="text-center my-8">Loading games...</div>;
  }
  
  const handleRemoveGame = async (projectGameId: string) => {
    if (window.confirm("Are you sure you want to remove this game from the project?")) {
      await removeGameFromProject(projectGameId);
    }
  };
  
  return (
    <div className="my-6">
      <h3 className="text-xl font-medium mb-4">Games in this Project</h3>
      
      {projectGames.length === 0 ? (
        <p className="text-gray-500 my-4">No games added to this project yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {projectGames.map(({ game, projectGame }) => (
            <Card key={projectGame.id} className="w-full">
              <CardHeader>
                <CardTitle className="truncate">{game.prompt || "Untitled Game"}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">
                  Type: {game.type || "Game"}
                </p>
                <p className="text-sm text-gray-500">
                  Added on {new Date(projectGame.added_at).toLocaleDateString()}
                </p>
              </CardContent>
              <CardFooter className="flex justify-between gap-2">
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => handleRemoveGame(projectGame.id)}
                >
                  Remove from Project
                </Button>
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/play/${game.id}`)}
                >
                  Open Game
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
