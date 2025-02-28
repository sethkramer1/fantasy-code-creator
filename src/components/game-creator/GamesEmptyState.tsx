
import { contentTypes } from "@/types/game";

interface GamesEmptyStateProps {
  selectedType: string;
  searchQuery: string;
  fetchError: string | null;
}

export function GamesEmptyState({ selectedType, searchQuery, fetchError }: GamesEmptyStateProps) {
  if (fetchError) {
    return (
      <div className="text-center py-12 px-4 bg-gray-50 rounded-xl border border-gray-100">
        <p className="text-gray-500 mb-2">Error loading game versions.</p>
        <p className="text-gray-600 font-medium">{fetchError}</p>
      </div>
    );
  }
  
  return (
    <div className="text-center py-12 px-4 bg-gray-50 rounded-xl border border-gray-100">
      <p className="text-gray-500 mb-2">
        {selectedType 
          ? `No ${contentTypes.find(t => t.id === selectedType)?.label || selectedType} projects found.` 
          : "No projects have been created yet."}
      </p>
      <p className="text-gray-600 font-medium">
        {searchQuery ? "Try a different search term." : "Create your first project by filling out the form above!"}
      </p>
    </div>
  );
}
