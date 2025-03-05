
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { useTeams } from "@/hooks/useTeams";
import { TeamCard } from "@/components/team/TeamCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/AuthContext";
import { Header } from "@/components/game-creator/Header";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function TeamsPage() {
  const navigate = useNavigate();
  const { teams, loading, error, createTeam, fetchTeams } = useTeams();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  // Redirect to login if not authenticated after auth loading completes
  useEffect(() => {
    if (!user && !authLoading) {
      console.log("TeamsPage - User not authenticated, redirecting to auth");
      toast({
        title: "Authentication Required",
        description: "Please log in to view and create teams.",
        variant: "destructive",
      });
      navigate("/auth");
    }
  }, [user, authLoading, navigate, toast]);
  
  // Debug logging
  useEffect(() => {
    console.log("TeamsPage - Auth state:", user ? "Logged in" : "Not logged in");
    console.log("TeamsPage - Auth loading:", authLoading);
    console.log("TeamsPage - User ID:", user?.id);
    console.log("TeamsPage - Teams loaded:", teams.length);
    console.log("TeamsPage - Teams loading state:", loading);
    console.log("TeamsPage - Teams error:", error);
    
    // Check if user is authenticated but we have no teams
    if (user && !authLoading && teams.length === 0 && !loading) {
      console.log("TeamsPage - User is logged in but no teams found, will wait for fetchTeams to complete");
    }
  }, [teams, user, authLoading, loading, error]);
  
  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      toast({
        title: "Error",
        description: "Team name is required",
        variant: "destructive"
      });
      return;
    }
    
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to create a team.",
        variant: "destructive"
      });
      navigate("/auth");
      return;
    }
    
    setIsCreating(true);
    try {
      console.log("Creating team with name:", teamName);
      const team = await createTeam(teamName, teamDescription);
      console.log("Team creation result:", team);
      
      if (team) {
        toast({
          title: "Team Created",
          description: `Your team "${teamName}" has been created successfully.`
        });
        
        setTeamName('');
        setTeamDescription('');
        setIsDialogOpen(false);
        
        // Force refresh after a short delay to ensure DB updates are reflected
        setTimeout(() => {
          fetchTeams();
        }, 1000);
      }
    } catch (error) {
      console.error("Team creation caught error:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleManualRefresh = () => {
    if (user) {
      console.log("Manually refreshing teams...");
      fetchTeams();
      toast({
        title: "Refreshing Teams",
        description: "Attempting to refresh your teams list."
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
  
  // Determine the actual content state
  const isInitialLoading = authLoading || loading;
  const hasNoTeams = !isInitialLoading && teams.length === 0;
  const hasTeams = !isInitialLoading && teams.length > 0;
  const hasError = !isInitialLoading && error;
  
  return (
    <div className="container mx-auto py-8 px-4">
      <Header 
        title="My Teams" 
        description="Create and manage your teams to collaborate on projects."
      />
      
      <div className="flex justify-between mb-8 mt-6">
        <Button 
          variant="outline" 
          onClick={handleManualRefresh} 
          disabled={isInitialLoading}
        >
          {isInitialLoading ? "Loading..." : "Refresh Teams"}
        </Button>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={!user || authLoading}>Create Team</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a New Team</DialogTitle>
              <DialogDescription>
                Create a team to collaborate on projects with other users.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="team-name">Team Name</Label>
                <Input 
                  id="team-name"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Enter team name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="team-description">Description (Optional)</Label>
                <Textarea 
                  id="team-description"
                  value={teamDescription}
                  onChange={(e) => setTeamDescription(e.target.value)}
                  placeholder="Describe the purpose of this team"
                  rows={3}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button 
                onClick={handleCreateTeam}
                disabled={!teamName.trim() || isCreating}
              >
                {isCreating ? 'Creating...' : 'Create Team'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      <Separator className="mb-8" />
      
      {/* Debug information */}
      <div className="mb-4 p-4 bg-gray-100 rounded">
        <p className="text-sm text-gray-500">Auth Status: {authLoading ? "Loading Auth" : (user ? "Logged In" : "Not Logged In")}</p>
        <p className="text-sm text-gray-500">User ID: {user?.id || "No User"}</p>
        <p className="text-sm text-gray-500">Teams Count: {teams.length}</p>
        <p className="text-sm text-gray-500">Teams Loading: {loading ? "Yes" : "No"}</p>
        <p className="text-sm text-gray-500">Auth Loading: {authLoading ? "Yes" : "No"}</p>
        {error && <p className="text-sm text-red-500">Error: {error}</p>}
      </div>
      
      {/* Loading state */}
      {isInitialLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-6">
              <Skeleton className="h-6 w-3/4 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      )}
      
      {/* Error state */}
      {hasError && (
        <div className="text-center py-8 bg-red-50 rounded-lg border border-red-200">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={handleManualRefresh} variant="outline" size="sm">
            Try Again
          </Button>
        </div>
      )}
      
      {/* Empty state */}
      {hasNoTeams && !hasError && (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">
            {user ? "You don't have any teams yet." : "Please log in to view your teams."}
          </p>
          {user && (
            <Button onClick={() => setIsDialogOpen(true)} size="lg">
              Create Your First Team
            </Button>
          )}
        </div>
      )}
      
      {/* Teams display */}
      {hasTeams && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map(team => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      )}
    </div>
  );
}
