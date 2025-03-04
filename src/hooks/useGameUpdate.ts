
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GameData, GameVersion } from "./usePlayGameData";
import { Message } from "@/components/game-chat/types";

export function useGameUpdate(gameId: string | undefined, game: GameData | null, gameVersions: GameVersion[], fetchGame: () => Promise<void>) {

  const addSystemMessage = async (message: string, response: string) => {
    if (!gameId) return;
    
    try {
      await supabase
        .from('game_messages')
        .insert({
          game_id: gameId,
          message,
          response,
          is_system: true
        });
    } catch (error) {
      console.error("Error adding system message:", error);
    }
  };

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
        addSystemMessage(
          "Error", 
          `❌ Error saving new game version: ${newVersionError.message}`
        );
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
        addSystemMessage(
          "Error", 
          `❌ Error updating game: ${updateError.message}`
        );
        return;
      }

      console.log("Game updated successfully, fetching latest data");
      
      // Fetch the updated game versions
      await fetchGame();

      addSystemMessage(
        "Game updated", 
        "✅ The game has been updated successfully."
      );
    } catch (error) {
      console.error("Error updating game:", error);
      addSystemMessage(
        "Error", 
        `❌ Error updating game: ${error instanceof Error ? error.message : "An unexpected error occurred"}`
      );
    }
  };

  const revertToVersion = async (versionId: string) => {
    try {
      if (!gameId || !game) {
        throw new Error("Game not available");
      }

      // Find the version in our list
      const versionToRevert = gameVersions.find(v => v.id === versionId);
      if (!versionToRevert) {
        throw new Error("Version not found");
      }

      // Determine the next version number
      const nextVersionNumber = gameVersions.length > 0 ? Math.max(...gameVersions.map(v => v.version_number)) + 1 : 1;

      // Create a new version based on the old one
      const { data: newVersion, error: newVersionError } = await supabase
        .from('game_versions')
        .insert([{
          game_id: gameId,
          code: versionToRevert.code,
          instructions: versionToRevert.instructions,
          version_number: nextVersionNumber
        }])
        .select()
        .single();

      if (newVersionError) {
        console.error("Error creating new version from revert:", newVersionError);
        throw newVersionError;
      }

      // Update the game with the reverted code and instructions
      const { error: updateError } = await supabase
        .from('games')
        .update({
          code: versionToRevert.code,
          instructions: versionToRevert.instructions,
          current_version: nextVersionNumber
        })
        .eq('id', gameId);

      if (updateError) {
        console.error("Error updating game after revert:", updateError);
        throw updateError;
      }

      // Fetch the updated game versions
      await fetchGame();

      addSystemMessage(
        "Version restored",
        `✅ Reverted to version ${versionToRevert.version_number} as a new version (${nextVersionNumber}).`
      );
    } catch (error) {
      console.error("Error in revertToVersion:", error);
      addSystemMessage(
        "Error", 
        "❌ Failed to revert to the selected version."
      );
      throw error;
    }
  };

  const revertToMessageVersion = async (message: Message) => {
    try {
      if (!message.version_id) {
        addSystemMessage(
          "Error", 
          "❌ Cannot revert to this version. This message doesn't have an associated version."
        );
        return;
      }

      await revertToVersion(message.version_id);
    } catch (error) {
      console.error("Error in revertToMessageVersion:", error);
      addSystemMessage(
        "Error", 
        "❌ Failed to revert to the selected version."
      );
    }
  };

  return {
    handleGameUpdate,
    revertToMessageVersion,
    revertToVersion
  };
}
