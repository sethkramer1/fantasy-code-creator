import React from 'react';
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";

interface TeamPageHeaderProps {
  onCreateTeam: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export function TeamPageHeader({ onCreateTeam, onRefresh, isLoading }: TeamPageHeaderProps) {
  return (
    <div className="flex justify-between items-center mb-8">
      <div>
        <h1 className="text-3xl font-bold">My Teams</h1>
        <p className="text-gray-500 mt-1">Create and manage your teams to collaborate on projects.</p>
      </div>
      
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          onClick={onRefresh} 
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          {isLoading ? "Loading..." : "Refresh"}
        </Button>
        
        <Button onClick={onCreateTeam} disabled={isLoading}>
          <Plus className="h-4 w-4 mr-2" />
          Create Team
        </Button>
      </div>
    </div>
  );
} 