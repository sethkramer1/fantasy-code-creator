
import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GameVersion {
  id: string;
  version_number: number;
  code: string;
  instructions: string | null;
  created_at: string;
}

interface VersionSelectorProps {
  gameVersions: GameVersion[];
  selectedVersion: string;
  onVersionChange: (versionId: string) => void;
  onRevertToVersion?: (version: GameVersion) => Promise<void>;
  isLatestVersion: boolean;
}

export function VersionSelector({ 
  gameVersions, 
  selectedVersion, 
  onVersionChange,
  onRevertToVersion,
  isLatestVersion 
}: VersionSelectorProps) {
  if (gameVersions.length === 0) return null;
  
  const currentVersion = gameVersions.find(v => v.id === selectedVersion);
  
  return (
    <div className="flex items-center gap-2">
      {!isLatestVersion && onRevertToVersion && currentVersion && (
        <Button 
          variant="subtle" 
          size="sm" 
          className="h-8 gap-1 text-sm"
          onClick={() => onRevertToVersion(currentVersion)}
        >
          <RotateCcw size={14} />
          Revert to this version
        </Button>
      )}
      
      <div className="flex items-center gap-2">
        <History size={16} className="text-gray-500" />
        <Select value={selectedVersion} onValueChange={onVersionChange}>
          <SelectTrigger className="w-[140px] h-8 bg-white border-gray-200 text-sm">
            <SelectValue placeholder="Select version" />
          </SelectTrigger>
          <SelectContent>
            {gameVersions.map(version => (
              <SelectItem key={version.id} value={version.id} className="flex items-center justify-between">
                <span>Version {version.version_number}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
