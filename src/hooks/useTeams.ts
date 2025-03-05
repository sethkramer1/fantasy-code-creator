
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
        console.error("Create team failed: No authenticated user");
        throw new Error("You must be logged in to create a team");
      }

      if (!name.trim()) {
        console.error("Create team failed: Empty team name");
        throw new Error("Team name cannot be empty");
      }

      setIsCreating(true);
      setError(null);
      console.log("Creating team with name:", name, "by user:", user.id);
      
      // Debug - Check if user is authenticated with Supabase
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error("Authentication verification failed:", authError);
        throw new Error(`Authentication error: ${authError.message}`);
      }
      
      if (!authData?.user) {
        console.error("Auth check returned no user");
        throw new Error("Authentication failed: No user found");
      }
      
      console.log("Auth check successful, user:", authData?.user?.id);
      
      // TEST: Verify direct access to teams table (debugging)
      const { data: debugRead, error: debugReadError } = await supabase
        .from('teams')
        .select('count(*)')
        .limit(1);
        
      if (debugReadError) {
        console.error("Debug read test failed:", debugReadError);
        // Don't throw, just log for diagnosis
      } else {
        console.log("Debug read test successful:", debugRead);
      }
      
      // Create team directly - using maybeSingle instead of single to avoid error if no data returned
      const { data: newTeam, error: teamError } = await supabase
        .from('teams')
        .insert([{ 
            name: name.trim(), 
            description: description ? description.trim() : null, 
            created_by: user.id 
        }])
        .select()
        .maybeSingle();
      
      if (teamError) {
        console.error("Error creating team:", teamError);
        // Enhanced debugging for RLS issues
        if (teamError.message.includes("row-level security")) {
          console.error("RLS Policy Error Details:", {
            userId: user.id,
            message: teamError.message,
            code: teamError.code,
            details: teamError.details,
            hint: teamError.hint
          });
          throw new Error(`Row-level security policy prevented team creation. Please ensure you're properly logged in. Error: ${teamError.message}`);
        }
        throw new Error(`Failed to create team: ${teamError.message}`);
      }
      
      if (!newTeam || !newTeam.id) {
        console.error("Team creation returned no data:", newTeam);
        throw new Error("Team creation failed: No team data returned from server");
      }
      
      console.log("Team created successfully:", newTeam);
      
      // The trigger should handle adding the creator as a member
      // But let's verify that it worked properly
      const { data: teamMember, error: memberCheckError } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', newTeam.id)
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (memberCheckError || !teamMember) {
        console.error("Team created but member creation may have failed:", memberCheckError);
        console.log("Attempting manual member creation as fallback");
        
        // Attempt manual member creation as fallback
        const { data: manualMember, error: manualMemberError } = await supabase
          .from('team_members')
          .insert([{
            team_id: newTeam.id,
            user_id: user.id,
            role: 'admin'
          }])
          .select()
          .maybeSingle();
          
        if (manualMemberError) {
          console.error("Error adding creator as team member (manual fallback):", manualMemberError);
          console.warn("Team created but user may not be added as member properly");
        } else {
          console.log("Creator added as team member manually (fallback successful):", manualMember);
        }
      } else {
        console.log("Creator was automatically added as team member via trigger:", teamMember);
      }
      
      // Verify the team exists in database
      const { data: verifyTeam, error: verifyError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', newTeam.id)
        .maybeSingle();
        
      if (verifyError) {
        console.error("Team verification failed:", verifyError);
        console.warn("Team creation could not be verified, but may have succeeded");
      } else if (!verifyTeam) {
        console.error("Team verification failed: No team returned");
        throw new Error("Team creation could not be verified");
      } else {
        console.log("Team creation verified:", verifyTeam);
      }
      
      // Add to local state immediately for UI responsiveness
      setTeams(prev => [...prev, newTeam]);
      
      toast({
        title: "Success",
        description: `Team "${name}" created successfully.`,
      });
      
      return newTeam;
    } catch (error: any) {
      console.error("Error creating team:", error);
      setError(error.message || "Failed to create team. Please try again.");
      toast({
        title: "Error",
        description: error.message || "Failed to create team. Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsCreating(false);
      // Refresh teams to ensure we have the latest data
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
