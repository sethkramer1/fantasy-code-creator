
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, RotateCcw, History } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GameVersion } from "@/hooks/usePlayGameData";
import { formatDistanceToNow } from "date-fns";

interface VersionHistoryProps {
  gameVersions: GameVersion[];
  currentVersionId: string | undefined;
  onRevertToVersion: (versionId: string) => Promise<void>;
  onVersionSelect: (versionId: string | null) => void;
  selectedVersionId: string | null;
}

export function VersionHistory({ 
  gameVersions, 
  currentVersionId,
  onRevertToVersion,
  onVersionSelect,
  selectedVersionId
}: VersionHistoryProps) {
  const [isReverting, setIsReverting] = useState(false);

  const handleRevert = async () => {
    if (!selectedVersionId) return;
    
    setIsReverting(true);
    try {
      await onRevertToVersion(selectedVersionId);
      onVersionSelect(null); // Clear selection after revert
    } catch (error) {
      console.error("Error reverting to version:", error);
    } finally {
      setIsReverting(false);
    }
  };

  // Sort versions by version_number in descending order
  const sortedVersions = [...gameVersions].sort((a, b) => 
    b.version_number - a.version_number
  );

  if (sortedVersions.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 text-sm text-zinc-400">
        <History className="h-4 w-4" />
        <span>History:</span>
      </div>
      
      <Select
        value={selectedVersionId || undefined}
        onValueChange={onVersionSelect}
      >
        <SelectTrigger className="h-9 w-[180px] bg-zinc-800 border-zinc-700 text-zinc-200">
          <SelectValue placeholder="Select version" />
        </SelectTrigger>
        <SelectContent className="bg-zinc-800 border-zinc-700 text-zinc-200">
          {sortedVersions.map((version) => (
            <SelectItem 
              key={version.id} 
              value={version.id}
              className={`${version.id === currentVersionId ? 'bg-zinc-700' : ''}`}
            >
              {`V${version.version_number} - ${formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Button
        size="sm"
        variant="secondary"
        className="h-9 bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700"
        onClick={handleRevert}
        disabled={!selectedVersionId || isReverting || selectedVersionId === currentVersionId}
      >
        <RotateCcw className="h-4 w-4 mr-1" />
        {isReverting ? "Reverting..." : "Revert"}
      </Button>
    </div>
  );
}
