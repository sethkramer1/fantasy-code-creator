
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { GameData, GameVersion } from "./usePlayGameData";
import { Message } from "@/components/game-chat/types";

export function useGameUpdate(gameId: string | undefined, game: GameData | null, gameVersions: GameVersion[], fetchGame: () => Promise<void>) {
  const { toast } = useToast();

  const handleGameUpdate = async (newCode: string, newInstructions: string) => {
    if (!gameId || !game) return;

    try {
      // Determine the next version number
      const nextVersionNumber = gameVersions.length > 0 ? Math.max(...gameVersions.map(v => v.version_number)) + 1 : 1;

      // Insert the new version into the game_versions table
      const { data: newVersion, error: newVersionError } = await supabase
        .from('game_versions')
        .insert([{
          game_id: gameId,
          code: newCode,
          instructions: newInstructions,
          version_number: nextVersionNumber
        }])
        .select()
        .single();

      if (newVersionError) {
        console.error("Error saving new game version:", newVersionError);
        toast({
          title: "Error saving new game version",
          description: newVersionError.message,
          variant: "destructive",
        });
        return;
      }

      // Update the game with the new code and instructions
      const { error: updateError } = await supabase
        .from('games')
        .update({
          code: newCode,
          instructions: newInstructions,
          current_version: nextVersionNumber
        })
        .eq('id', gameId);

      if (updateError) {
        console.error("Error updating game:", updateError);
        toast({
          title: "Error updating game",
          description: updateError.message,
          variant: "destructive",
        });
        return;
      }

      // Fetch the updated game versions
      fetchGame();

      toast({
        title: "Game updated",
        description: "The game has been updated successfully.",
      });
    } catch (error) {
      console.error("Error updating game:", error);
      toast({
        title: "Error updating game",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const revertToMessageVersion = async (message: Message) => {
    try {
      if (!message.version_id) {
        toast({
          title: "Cannot revert to this version",
          description: "This message doesn't have an associated version",
          variant: "destructive"
        });
        return;
      }

      const { data: versionData, error: versionError } = await supabase
        .from('game_versions')
        .select('*')
        .eq('id', message.version_id)
        .single();

      if (versionError || !versionData) {
        console.error("Error fetching version data:", versionError);
        toast({
          title: "Error reverting to version",
          description: "Could not find the version data",
          variant: "destructive"
        });
        return;
      }

      // Update the game with this version
      const { error: updateError } = await supabase
        .from('games')
        .update({
          code: versionData.code,
          instructions: versionData.instructions,
          current_version: versionData.version_number
        })
        .eq('id', gameId);

      if (updateError) {
        console.error("Error updating game:", updateError);
        toast({
          title: "Error reverting to version",
          description: updateError.message,
          variant: "destructive"
        });
        return;
      }

      // Refresh game data
      fetchGame();
      
      toast({
        title: "Success",
        description: `Reverted to version from ${new Date(message.created_at).toLocaleString()}`,
      });
    } catch (error) {
      console.error("Error in revertToMessageVersion:", error);
      toast({
        title: "Error",
        description: "Failed to revert to the selected version",
        variant: "destructive"
      });
    }
  };

  return {
    handleGameUpdate,
    revertToMessageVersion
  };
}
