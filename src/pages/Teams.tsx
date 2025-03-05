
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
import { AlertCircle, RefreshCw, LogIn, Bug } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

export default function TeamsPage() {
  const navigate = useNavigate();
  const { teams, loading, error, isCreating, createTeam, fetchTeams } = useTeams();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  
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
  
  useEffect(() => {
    console.log("TeamsPage - Auth state:", user ? "Logged in" : "Not logged in");
    console.log("TeamsPage - Auth loading:", authLoading);
    console.log("TeamsPage - User ID:", user?.id);
    console.log("TeamsPage - Teams loaded:", teams.length);
    console.log("TeamsPage - Teams loading state:", loading);
    console.log("TeamsPage - Teams error:", error);
    console.log("TeamsPage - Teams creation state:", isCreating);
    
    if (user && !authLoading && teams.length === 0 && !loading && !isCreating) {
      console.log("TeamsPage - User is logged in but no teams found");
    }
  }, [teams, user, authLoading, loading, error, isCreating]);
  
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
      setIsSubmitting(true);
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
      } else {
        console.log("Team creation failed, keeping dialog open");
      }
    } catch (error) {
      console.error("Team creation caught error:", error);
    } finally {
      setIsSubmitting(false);
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
  
  const runRlsDebug = async () => {
    if (!user) return;
    
    try {
      const results: any = {};
      
      // Check authentication
      const { data: authData, error: authError } = await supabase.auth.getUser();
      results.authCheck = { data: authData, error: authError };
      
      // Try direct read from teams table
      const { data: teamsCheck, error: teamsError } = await supabase
        .from('teams')
        .select('count(*)')
        .limit(1);
      results.teamsRead = { data: teamsCheck, error: teamsError };
      
      // Try direct insert in teams table
      const testName = `Debug Team ${new Date().toISOString()}`;
      const { data: insertCheck, error: insertError } = await supabase
        .from('teams')
        .insert([{
          name: testName,
          created_by: user.id
        }])
        .select()
        .maybeSingle();
      results.teamsInsert = { data: insertCheck, error: insertError };
      
      // Try direct read from team_members table
      const { data: membersCheck, error: membersError } = await supabase
        .from('team_members')
        .select('count(*)')
        .limit(1);
      results.membersRead = { data: membersCheck, error: membersError };
      
      // Display results
      setDebugInfo(results);
      console.log("RLS Debug Results:", results);
    } catch (error) {
      console.error("Debug check failed:", error);
      setDebugInfo({ error });
    }
  };
  
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
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleManualRefresh} 
            disabled={isInitialLoading || isCreating}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${(isInitialLoading || isCreating) ? "animate-spin" : ""}`} />
            {isInitialLoading ? "Loading..." : isCreating ? "Creating..." : "Refresh Teams"}
          </Button>
          
          {import.meta.env.DEV && (
            <Button
              variant="outline"
              onClick={runRlsDebug}
              className="flex items-center gap-2 ml-2"
            >
              <Bug className="h-4 w-4" />
              Debug RLS
            </Button>
          )}
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!isSubmitting && !isCreating) {
            setIsDialogOpen(open);
          }
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
                  disabled={isSubmitting || isCreating}
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
                  disabled={isSubmitting || isCreating}
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
                disabled={!teamName.trim() || isSubmitting || isCreating}
              >
                {isSubmitting || isCreating ? 'Creating...' : 'Create Team'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      <Separator className="mb-8" />
      
      {/* Debug Information Panel (only in development) */}
      {import.meta.env.DEV && (
        <div className="mb-4 p-4 bg-gray-100 rounded text-xs">
          <details>
            <summary className="cursor-pointer font-medium">Debug Information</summary>
            <p className="mt-2 text-gray-500">Auth Status: {authLoading ? "Loading Auth" : (user ? "Logged In" : "Not Logged In")}</p>
            <p className="text-gray-500">User ID: {user?.id || "No User"}</p>
            <p className="text-gray-500">Teams Count: {teams.length}</p>
            <p className="text-gray-500">Teams Loading: {loading ? "Yes" : "No"}</p>
            <p className="text-gray-500">Teams Creating: {isCreating ? "Yes" : "No"}</p>
            <p className="text-gray-500">Form Submitting: {isSubmitting ? "Yes" : "No"}</p>
            <p className="text-gray-500">Auth Loading: {authLoading ? "Yes" : "No"}</p>
            {error && <p className="text-red-500">Error: {error}</p>}
            
            {debugInfo && (
              <div className="mt-3 border-t pt-3">
                <p className="font-medium mb-2">RLS Debug Results:</p>
                <pre className="bg-gray-900 text-white p-2 rounded text-xs overflow-auto max-h-60">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </div>
            )}
          </details>
        </div>
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
    </div>
  );
}
