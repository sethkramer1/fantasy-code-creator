import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Team } from "@/types/team";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchTeams = useCallback(async () => {
    if (!user || !user.id) {
      console.log("No authenticated user found, skipping team fetch");
      setTeams([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log("Fetching teams for user:", user.id);
      
      // Get all team memberships for the current user
      const { data: memberships, error: memberError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id);
        
      if (memberError) {
        console.error("Error fetching team memberships:", memberError);
        throw memberError;
      }
      
      console.log("Team memberships found:", memberships?.length || 0);
      
      // If user has no team memberships, return empty array
      if (!memberships || memberships.length === 0) {
        setTeams([]);
        setLoading(false);
        return;
      }
      
      // Get all team IDs the user is a member of
      const teamIds = memberships.map(membership => membership.team_id);
      
      // Fetch the actual team data for those IDs
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .in('id', teamIds);
        
      if (teamsError) {
        console.error("Error fetching team details:", teamsError);
        throw teamsError;
      }
      
      console.log("Teams fetched:", teamsData?.length || 0);
      setTeams(teamsData || []);
    } catch (error: any) {
      console.error("Error in fetchTeams:", error);
      setError(error.message || "Failed to load teams");
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const createTeam = async (name: string, description?: string) => {
    try {
      // Validate inputs and user auth
      if (!user || !user.id) {
        const errorMsg = "You must be logged in to create a team";
        console.error(errorMsg);
        toast({
          title: "Authentication required",
          description: errorMsg,
          variant: "destructive",
        });
        return null;
      }

      if (!name.trim()) {
        const errorMsg = "Team name cannot be empty";
        console.error(errorMsg);
        toast({
          title: "Validation Error",
          description: errorMsg,
          variant: "destructive",
        });
        return null;
      }

      // Start creating team
      setIsCreating(true);
      setError(null);
      console.log(`Creating team "${name}" for user ${user.id}`);
      
      // Simple, direct team creation
      const { data: newTeam, error: createError } = await supabase
        .from('teams')
        .insert({
          name: name.trim(),
          description: description ? description.trim() : null,
          created_by: user.id
        })
        .select()
        .single();
      
      if (createError) {
        console.error("Team creation error:", createError);
        throw new Error(`Failed to create team: ${createError.message}`);
      }
      
      if (!newTeam) {
        throw new Error("Team creation returned no data");
      }
      
      console.log("Team created successfully:", newTeam);
      
      // Manually ensure the user is added as a team member
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: newTeam.id,
          user_id: user.id,
          role: 'admin'
        });
      
      if (memberError) {
        console.error("Error adding user as team member:", memberError);
        // Continue anyway, the team was created
      } else {
        console.log("User added as team member");
      }
      
      // Add to local state and show success
      setTeams(prev => [...prev, newTeam]);
      
      toast({
        title: "Success",
        description: `Team "${name}" created successfully.`,
      });
      
      // Refresh teams to ensure we have latest data
      await fetchTeams();
      
      return newTeam;
    } catch (error: any) {
      console.error("Error creating team:", error);
      setError(error.message || "Failed to create team");
      toast({
        title: "Error",
        description: error.message || "Failed to create team",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsCreating(false);
    }
  };

  const updateTeam = async (teamId: string, updates: Partial<Team>) => {
    try {
      const { error } = await supabase
        .from('teams')
        .update(updates)
        .eq('id', teamId);
        
      if (error) throw error;
      
      await fetchTeams();
      
      toast({
        title: "Success",
        description: "Team updated successfully.",
      });
      
      return true;
    } catch (error: any) {
      console.error("Error updating team:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update team. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteTeam = async (teamId: string) => {
    try {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);
        
      if (error) throw error;
      
      await fetchTeams();
      
      toast({
        title: "Success",
        description: "Team deleted successfully.",
      });
      
      return true;
    } catch (error: any) {
      console.error("Error deleting team:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete team. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    const loadTeams = async () => {
      if (user && user.id && isMounted) {
        console.log("Initial teams fetch for user:", user.id);
        await fetchTeams();
      } else if (!user && isMounted) {
        console.log("No user detected, clearing teams");
        setTeams([]);
        setLoading(false);
      }
    };
    
    loadTeams();
    
    return () => {
      isMounted = false;
    };
  }, [user, fetchTeams]);

  return {
    teams,
    loading,
    error,
    isCreating,
    fetchTeams,
    createTeam,
    updateTeam,
    deleteTeam
  };
}
