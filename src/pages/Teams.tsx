import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeams } from "@/hooks/useTeams";
import { TeamCard } from "@/components/team/TeamCard";
import { CreateTeamDialog } from "@/components/team/CreateTeamDialog";
import { TeamPageHeader } from "@/components/team/TeamPageHeader";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function TeamsPage() {
  const navigate = useNavigate();
  const { teams, loading, fetchTeams } = useTeams();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  // Redirect if not authenticated
  useEffect(() => {
    if (!user && !authLoading) {
      toast({
        title: "Authentication Required",
        description: "Please log in to view and create teams.",
        variant: "destructive",
      });
      navigate("/auth");
    }
  }, [user, authLoading, navigate, toast]);
  
  const handleRefresh = () => {
    if (user) {
      fetchTeams();
      toast({
        title: "Refreshing Teams",
        description: "Refreshing your teams list."
      });
    } else {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to view teams.",
        variant: "destructive"
      });
      navigate("/auth");
    }
  };
  
  // Determine UI states
  const isInitialLoading = authLoading || loading;
  
  return (
    <div>
      <Navbar />
      <div className="container mx-auto py-8 px-4">
        <TeamPageHeader
          onCreateTeam={() => setIsDialogOpen(true)}
          onRefresh={handleRefresh}
          isLoading={isInitialLoading}
        />
        
        {isInitialLoading ? (
          <div className="text-center py-8">Loading teams...</div>
        ) : teams.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">You haven't created or joined any teams yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            {teams.map(team => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        )}
        
        <CreateTeamDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onSuccess={fetchTeams}
        />
      </div>
    </div>
  );
}
