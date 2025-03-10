
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
    <div className="flex items-center gap-3">
      {!isLatestVersion && onRevertToVersion && currentVersion && (
        <Button 
          variant="outline" 
          size="sm" 
          className="h-9 gap-1.5 text-sm rounded-full bg-white border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200"
          onClick={() => onRevertToVersion(currentVersion)}
        >
          <RotateCcw size={14} className="text-indigo-600" />
          <span>Create new version from this</span>
        </Button>
      )}
      
      <div className="flex items-center gap-2 bg-white rounded-full pl-3 pr-1 py-1 border border-gray-200 shadow-sm">
        <History size={16} className="text-indigo-600" />
        <Select value={selectedVersion} onValueChange={onVersionChange}>
          <SelectTrigger className="min-w-[140px] h-7 bg-transparent border-0 focus:ring-0 focus:ring-offset-0 text-sm">
            <SelectValue placeholder="Select version" />
          </SelectTrigger>
          <SelectContent className="rounded-lg border-gray-200 shadow-md">
            {gameVersions.map(version => (
              <SelectItem 
                key={version.id} 
                value={version.id} 
                className="text-sm rounded-md focus:bg-indigo-50 focus:text-indigo-700 data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-700"
              >
                <span>Version {version.version_number}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
