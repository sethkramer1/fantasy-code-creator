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
      
      const { data: memberTeamsJoins, error: memberError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id);
        
      if (memberError) {
        console.error("Error fetching team memberships:", memberError);
        throw memberError;
      }
      
      console.log("Team memberships found:", memberTeamsJoins?.length || 0);
      
      const memberTeamIds = (memberTeamsJoins || []).map(tm => tm.team_id);
      
      let allTeams: Team[] = [];
      
      if (memberTeamIds.length > 0) {
        const { data: memberTeams, error: teamsError } = await supabase
          .from('teams')
          .select('*')
          .in('id', memberTeamIds);
          
        if (teamsError) {
          console.error("Error fetching member teams details:", teamsError);
          throw teamsError;
        }
        
        allTeams = memberTeams || [];
      }
      
      console.log("Final combined teams:", allTeams.length);
      
      setTeams(allTeams);
      setError(null);
    } catch (error: any) {
      console.error("Error in fetchTeams:", error);
      setError(error.message || "Failed to load teams");
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const createTeam = async (name: string, description?: string) => {
    try {
      if (!user || !user.id) {
        throw new Error("You must be logged in to create a team");
      }

      setIsCreating(true);
      console.log("Creating team with name:", name, "by user:", user.id);
      
      const { data: newTeam, error: teamError } = await supabase
        .from('teams')
        .insert([{ 
            name, 
            description, 
            created_by: user.id 
        }])
        .select()
        .single();
        
      if (teamError) {
        console.error("Error creating team:", teamError);
        throw new Error(`Failed to create team: ${teamError.message}`);
      }
      
      if (!newTeam) {
        throw new Error("Team was created but no data was returned");
      }
      
      console.log("Team created successfully:", newTeam);
      
      const { error: memberError } = await supabase
        .from('team_members')
        .insert([{
          team_id: newTeam.id,
          user_id: user.id,
          role: 'admin'
        }]);
        
      if (memberError) {
        console.error("Error adding creator as team member:", memberError);
        
        const { error: deleteError } = await supabase
          .from('teams')
          .delete()
          .eq('id', newTeam.id);
          
        if (deleteError) {
          console.error("Error cleaning up team after membership error:", deleteError);
        }
        
        throw new Error(`Failed to add you as team admin: ${memberError.message}`);
      }
      
      console.log("Creator added as team member with admin role");
      
      const { data: verifyTeam, error: verifyError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', newTeam.id)
        .single();
        
      if (verifyError || !verifyTeam) {
        console.error("Team verification failed:", verifyError);
        throw new Error("Team creation could not be verified");
      }
      
      console.log("Team creation verified:", verifyTeam);
      
      setTeams(prev => [...prev, newTeam]);
      
      toast({
        title: "Success",
        description: `Team "${name}" created successfully.`,
      });
      
      return newTeam;
    } catch (error: any) {
      console.error("Error creating team:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create team. Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsCreating(false);
      await fetchTeams();
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
