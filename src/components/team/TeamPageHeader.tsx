import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";

interface TeamPageHeaderProps {
  onCreateTeam: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export function TeamPageHeader({ onCreateTeam, onRefresh, isLoading }: TeamPageHeaderProps) {
  return (
    <div className="pb-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Teams</h2>
          <p className="text-muted-foreground mt-2">
            Create and manage your game development teams
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={onCreateTeam}>
            <Plus className="h-4 w-4 mr-2" />
            Create Team
          </Button>
        </div>
      </div>
    </div>
  );
} 