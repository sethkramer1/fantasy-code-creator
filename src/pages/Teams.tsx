
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
import { AlertCircle, RefreshCw, LogIn } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function TeamsPage() {
  const navigate = useNavigate();
  const { teams, loading, error, isCreating, createTeam, fetchTeams } = useTeams();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  // Redirect if not authenticated
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
  
  // Log state for debugging
  useEffect(() => {
    console.log("TeamsPage - Auth state:", user ? "Logged in" : "Not logged in");
    console.log("TeamsPage - User ID:", user?.id);
    console.log("TeamsPage - Teams loaded:", teams.length);
    console.log("TeamsPage - Teams loading state:", loading);
    console.log("TeamsPage - Teams error:", error);
  }, [teams, user, loading, error]);
  
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
    
    try {
      console.log("Creating team with name:", teamName);
      const team = await createTeam(teamName, teamDescription);
      
      if (team) {
        console.log("Team created successfully:", team);
        setTeamName('');
        setTeamDescription('');
        setIsDialogOpen(false);
      } else {
        console.log("Team creation failed - no team returned");
      }
    } catch (error) {
      console.error("Team creation error:", error);
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
  
  // Determine UI states
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
          disabled={isInitialLoading || isCreating}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${(isInitialLoading || isCreating) ? "animate-spin" : ""}`} />
          {isInitialLoading ? "Loading..." : isCreating ? "Creating..." : "Refresh Teams"}
        </Button>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!isCreating) setIsDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button disabled={!user || authLoading || isCreating}>Create Team</Button>
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
                  disabled={isCreating}
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
                  disabled={isCreating}
                />
              </div>
            </div>
            
            {isCreating && (
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Creating your team</AlertTitle>
                <AlertDescription>
                  Please wait while we set up your team...
                </AlertDescription>
              </Alert>
            )}
            
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
      
      {/* User Authentication Status */}
      {!user && !authLoading && (
        <Alert className="mb-6">
          <LogIn className="h-4 w-4" />
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>
            You need to be logged in to view and create teams.
            <div className="mt-2">
              <Button onClick={() => navigate("/auth")} variant="outline" size="sm">
                Log In
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {hasError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-2">
              <Button onClick={handleManualRefresh} variant="outline" size="sm">
                Try Again
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {isInitialLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-6">
              <Skeleton className="h-6 w-3/4 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex justify-end gap-2 mt-4">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-24" />
              </div>
            </div>
          ))}
        </div>
      )}
      
      {isCreating && !isInitialLoading && (
        <Alert className="mb-6">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <AlertTitle>Creating Team</AlertTitle>
          <AlertDescription>
            Please wait while we set up your team...
          </AlertDescription>
        </Alert>
      )}
      
      {hasNoTeams && !hasError && !isCreating && (
        <div className="text-center py-8 border rounded-lg bg-gray-50">
          <p className="text-gray-500 mb-4">
            {user ? "You don't have any teams yet." : "Please log in to view your teams."}
          </p>
          {user && (
            <Button onClick={() => setIsDialogOpen(true)} size="lg" disabled={isCreating}>
              Create Your First Team
            </Button>
          )}
        </div>
      )}
      
      {hasTeams && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map(team => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      )}
      
      {/* Auth Debug Panel (only in dev) */}
      {import.meta.env.DEV && (
        <div className="mt-8 p-4 border rounded bg-gray-50">
          <details>
            <summary className="cursor-pointer font-medium">Authentication Debug Info</summary>
            <div className="mt-2 text-xs font-mono overflow-auto max-h-40">
              <p>User Authenticated: {user ? "Yes" : "No"}</p>
              <p>User ID: {user?.id || "None"}</p>
              <p>Loading Auth: {authLoading ? "Yes" : "No"}</p>
              <p>Loading Teams: {loading ? "Yes" : "No"}</p>
              <p>Creating Team: {isCreating ? "Yes" : "No"}</p>
              <p>Team Count: {teams.length}</p>
              <p>Error: {error || "None"}</p>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
