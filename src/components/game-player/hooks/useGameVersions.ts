
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export interface GameVersion {
  id: string;
  version_number: number;
  code: string;
  instructions: string | null;
  created_at: string;
}

export function useGameVersions(id: string | undefined) {
  const [gameVersions, setGameVersions] = useState<GameVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [initialPrompt, setInitialPrompt] = useState<string>("");
  const { toast } = useToast();

  const fetchGame = async () => {
    if (!id) return;
    
    try {
      const { data, error } = await supabase.from('games').select(`
          id,
          current_version,
          prompt,
          game_versions (
            id,
            version_number,
            code,
            instructions,
            created_at
          )
        `).eq('id', id).single();
      if (error) throw error;
      if (!data) throw new Error("Content not found");
      
      setInitialPrompt(data.prompt);
      
      const sortedVersions = data.game_versions.sort((a, b) => b.version_number - a.version_number);
      setGameVersions(sortedVersions);
      
      if (sortedVersions.length > 0) {
        setSelectedVersion(sortedVersions[0].id);
        
        if (sortedVersions[0].code !== "Generating...") {
          return false; // Return false to indicate no generating state
        } else {
          return true; // Return true to indicate generating state
        }
      }
      return false;
    } catch (error) {
      toast({
        title: "Error loading content",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleVersionChange = (versionId: string) => {
    setSelectedVersion(versionId);
  };

  const handleGameUpdate = async (newCode: string, newInstructions: string) => {
    if (!id) return;
    
    try {
      const newVersionNumber = gameVersions.length > 0 ? gameVersions[0].version_number + 1 : 1;
      
      const { data: versionData, error: versionError } = await supabase
        .from('game_versions')
        .insert({
          game_id: id,
          version_number: newVersionNumber,
          code: newCode,
          instructions: newInstructions
        })
        .select()
        .single();
        
      if (versionError) throw versionError;
      if (!versionData) throw new Error("Failed to save new version");
      
      const { error: gameError } = await supabase
        .from('games')
        .update({ 
          current_version: newVersionNumber,
          code: newCode,
          instructions: newInstructions
        })
        .eq('id', id);
        
      if (gameError) throw gameError;
      
      const newVersion: GameVersion = {
        id: versionData.id,
        version_number: versionData.version_number,
        code: versionData.code,
        instructions: versionData.instructions,
        created_at: versionData.created_at
      };
      
      setGameVersions(prev => [newVersion, ...prev]);
      setSelectedVersion(newVersion.id);
      
    } catch (error) {
      console.error("Error saving new version:", error);
      toast({
        title: "Error saving version",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
    }
  };

  const handleRevertToVersion = async (version: GameVersion) => {
    if (!id) return;
    
    try {
      const highestVersionNumber = gameVersions.length > 0 
        ? Math.max(...gameVersions.map(v => v.version_number))
        : 0;
      
      const newVersionNumber = highestVersionNumber + 1;
      
      const { data: newVersionData, error: versionError } = await supabase
        .from('game_versions')
        .insert({
          game_id: id,
          version_number: newVersionNumber,
          code: version.code,
          instructions: `Reverted to version ${version.version_number}`
        })
        .select()
        .single();
      
      if (versionError) throw versionError;
      if (!newVersionData) throw new Error("Failed to create new version");
      
      const { error: updateError } = await supabase
        .from('games')
        .update({
          current_version: newVersionNumber,
          code: version.code,
          instructions: `Reverted to version ${version.version_number}`
        })
        .eq('id', id);
      
      if (updateError) throw updateError;
      
      const newVersion: GameVersion = {
        id: newVersionData.id,
        version_number: newVersionData.version_number,
        code: newVersionData.code,
        instructions: newVersionData.instructions,
        created_at: newVersionData.created_at
      };
      
      setGameVersions(prev => [newVersion, ...prev]);
      setSelectedVersion(newVersion.id);
      
    } catch (error) {
      console.error("Error reverting version:", error);
      toast({
        title: "Error reverting to version",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    }
  };

  const handleRevertToMessageVersion = async (message: any) => {
    if (!gameVersions.length || !id) return;
    
    try {
      const messageTime = new Date(message.created_at).getTime();
      
      let versionsAfterMessage = gameVersions
        .filter(v => new Date(v.created_at).getTime() > messageTime)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      if (versionsAfterMessage.length === 0) {
        const sortedVersions = [...gameVersions]
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        if (sortedVersions.length > 0) {
          await handleRevertToVersion(sortedVersions[0]);
          return;
        }
      } else if (versionsAfterMessage.length > 0) {
        await handleRevertToVersion(versionsAfterMessage[0]);
        return;
      }
      
      throw new Error("No suitable version found for this game");
    } catch (error) {
      console.error("Error reverting to message version:", error);
      toast({
        title: "Error reverting version",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    }
  };

  return {
    gameVersions,
    setGameVersions,
    selectedVersion,
    setSelectedVersion,
    loading,
    initialPrompt,
    fetchGame,
    handleVersionChange,
    handleGameUpdate,
    handleRevertToVersion,
    handleRevertToMessageVersion
  };
}
