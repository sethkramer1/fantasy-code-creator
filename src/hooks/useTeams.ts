
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Team } from "@/types/team";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchTeams = useCallback(async () => {
    try {
      if (!user) {
        console.log("No user found, cannot fetch teams");
        setTeams([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      console.log("Fetching teams for user:", user.id);
      
      // Try direct query on teams table first
      const { data: myCreatedTeams, error: createdTeamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('created_by', user.id);
        
      if (createdTeamsError) {
        console.error("Error fetching created teams:", createdTeamsError);
        throw createdTeamsError;
      }
      
      console.log("Teams created by user:", myCreatedTeams?.length || 0, myCreatedTeams);
      
      // Fetch teams where user is a member
      const { data: memberTeamsJoins, error: memberError } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', user.id);
        
      if (memberError) {
        console.error("Error fetching team memberships:", memberError);
        throw memberError;
      }
      
      console.log("Team memberships found:", memberTeamsJoins?.length || 0, memberTeamsJoins);
      
      // Get unique team IDs (from both created teams and memberships)
      const createdTeamIds = (myCreatedTeams || []).map(team => team.id);
      const memberTeamIds = (memberTeamsJoins || []).map(tm => tm.team_id);
      
      // Combine and deduplicate IDs
      const allTeamIds = [...new Set([...createdTeamIds, ...memberTeamIds])];
      console.log("All team IDs to fetch:", allTeamIds);
      
      if (allTeamIds.length === 0) {
        console.log("No teams found for user");
        setTeams([]);
        setLoading(false);
        return;
      }
      
      // Get all team details
      const { data: allTeams, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .in('id', allTeamIds);
        
      if (teamsError) {
        console.error("Error fetching team details:", teamsError);
        throw teamsError;
      }
      
      console.log("Final teams data:", allTeams);
      
      // Ensure every team created by the user has them as a member
      if (myCreatedTeams && myCreatedTeams.length > 0) {
        for (const team of myCreatedTeams) {
          const isMember = memberTeamsJoins?.some(m => m.team_id === team.id);
          
          if (!isMember) {
            console.log(`Adding user as admin to their own team ${team.id}`);
            
            // Add the creator as a team member with admin role
            const { error: addMemberError } = await supabase
              .from('team_members')
              .insert([{
                team_id: team.id,
                user_id: user.id,
                role: 'admin'
              }]);
              
            if (addMemberError) {
              console.error("Error adding creator as team member:", addMemberError);
            }
          }
        }
      }
      
      setTeams(allTeams || []);
      setError(null);
    } catch (error: any) {
      console.error("Error in fetchTeams:", error);
      setError(error.message || "Failed to load teams");
      toast({
        title: "Error",
        description: "Failed to load teams. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const createTeam = async (name: string, description?: string) => {
    try {
      if (!user) {
        throw new Error("User not authenticated");
      }

      console.log("Creating team with name:", name, "by user:", user.id);
      
      // Step 1: Create the team
      const { data, error } = await supabase
        .from('teams')
        .insert([
          { 
            name, 
            description, 
            created_by: user.id 
          }
        ])
        .select()
        .single();
        
      if (error) {
        console.error("Error creating team:", error);
        throw error;
      }
      
      console.log("Team created successfully:", data);
      
      // Step 2: Add the creator as a team member with admin role
      const { error: memberError } = await supabase
        .from('team_members')
        .insert([{
          team_id: data.id,
          user_id: user.id,
          role: 'admin'
        }]);
        
      if (memberError) {
        console.error("Error adding creator as team member:", memberError);
        throw memberError;
      }
      
      console.log("Creator added as team member with admin role");
      
      // Step 3: Refresh the teams list
      await fetchTeams();
      
      toast({
        title: "Success",
        description: "Team created successfully.",
      });
      
      return data;
    } catch (error: any) {
      console.error("Error creating team:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create team. Please try again.",
        variant: "destructive",
      });
      return null;
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
    if (user) {
      console.log("User detected, fetching teams", user.id);
      fetchTeams();
    } else {
      console.log("No user detected, clearing teams");
      setTeams([]);
      setLoading(false);
    }
  }, [user, fetchTeams]);

  return {
    teams,
    loading,
    error,
    fetchTeams,
    createTeam,
    updateTeam,
    deleteTeam
  };
}
