
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useGames } from "@/hooks/useGames";
import { useProjectGames } from "@/hooks/useProjectGames";
import { Game } from "@/types/game";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AddGameToProjectProps {
  projectId: string;
}

export function AddGameToProject({ projectId }: AddGameToProjectProps) {
  const { games, gamesLoading } = useGames();
  const { projectGames, addGameToProject } = useProjectGames(projectId);
  const [selectedGameId, setSelectedGameId] = useState<string>("");
  const [availableGames, setAvailableGames] = useState<Game[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  
  useEffect(() => {
    if (games && projectGames) {
      // Filter out games that are already in the project
      const existingGameIds = projectGames.map(pg => pg.game.id);
      const filtered = games.filter(game => !existingGameIds.includes(game.id));
      setAvailableGames(filtered);
      
      // Reset selection if the current selected game is no longer available
      if (selectedGameId && !filtered.some(g => g.id === selectedGameId)) {
        setSelectedGameId("");
      }
    }
  }, [games, projectGames, selectedGameId]);
  
  const handleAddGame = async () => {
    if (!selectedGameId) return;
    
    setIsAdding(true);
    try {
      await addGameToProject(selectedGameId);
      setSelectedGameId("");
    } finally {
      setIsAdding(false);
    }
  };
  
  if (gamesLoading) {
    return <div className="text-center my-4">Loading games...</div>;
  }
  
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Add Game to Project</CardTitle>
      </CardHeader>
      <CardContent>
        {availableGames.length === 0 ? (
          <p className="text-gray-500">No available games to add. Either create new games or all games are already added to this project.</p>
        ) : (
          <div className="space-y-4">
            <Select
              value={selectedGameId}
              onValueChange={setSelectedGameId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a game to add" />
              </SelectTrigger>
              <SelectContent>
                {availableGames.map(game => (
                  <SelectItem key={game.id} value={game.id}>
                    {game.prompt || "Untitled Game"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleAddGame}
          disabled={!selectedGameId || isAdding || availableGames.length === 0}
        >
          {isAdding ? 'Adding...' : 'Add Game to Project'}
        </Button>
      </CardFooter>
    </Card>
  );
}
