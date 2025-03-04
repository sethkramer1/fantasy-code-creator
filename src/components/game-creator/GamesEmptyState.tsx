
import { contentTypes } from "@/types/game";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface GamesEmptyStateProps {
  selectedType: string;
  searchQuery: string;
  fetchError: string | null;
  viewMode?: "user" | "community";
  isLoggedIn?: boolean;
}

export function GamesEmptyState({ 
  selectedType, 
  searchQuery, 
  fetchError, 
  viewMode = "community",
  isLoggedIn = false
}: GamesEmptyStateProps) {
  const navigate = useNavigate();

  if (fetchError) {
    return (
      <div className="text-center py-12 px-4 bg-gray-50 rounded-xl border border-gray-100">
        <p className="text-gray-500 mb-2">Error loading game versions.</p>
        <p className="text-gray-600 font-medium">{fetchError}</p>
      </div>
    );
  }
  
  // User is viewing their designs but doesn't have any
  if (viewMode === "user" && isLoggedIn) {
    return (
      <div className="text-center py-12 px-6 bg-gray-50 rounded-xl border border-gray-100">
        <h3 className="text-lg font-medium text-gray-800 mb-2">You haven't created any designs yet</h3>
        <p className="text-gray-500 mb-6">Get started by creating your first design</p>
        <Button 
          onClick={() => navigate("/")} 
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
        >
          <PlusCircle size={18} className="mr-2" />
          Create Your First Design
        </Button>
      </div>
    );
  }
  
  // Community designs with filters
  if (selectedType || searchQuery) {
    return (
      <div className="text-center py-12 px-4 bg-gray-50 rounded-xl border border-gray-100">
        <p className="text-gray-500 mb-2">
          {selectedType 
            ? `No ${contentTypes.find(t => t.id === selectedType)?.label || selectedType} projects found.` 
            : "No projects match your search."}
        </p>
        <p className="text-gray-600 font-medium">
          {searchQuery ? "Try a different search term or filter." : "Try a different filter."}
        </p>
      </div>
    );
  }
  
  // Default empty state (no projects at all)
  return (
    <div className="text-center py-12 px-4 bg-gray-50 rounded-xl border border-gray-100">
      <p className="text-gray-500 mb-2">
        {viewMode === "community" 
          ? "No public designs available yet."
          : "No designs have been created yet."}
      </p>
      <p className="text-gray-600 font-medium">
        {isLoggedIn 
          ? "Be the first to create and share a design!"
          : "Sign in to create your own designs or check back later for community designs."}
      </p>
    </div>
  );
}
