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
      
      const { data: membershipCheck, error: membershipCheckError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .limit(1);
        
      if (membershipCheckError) {
        console.error("Error checking team memberships:", membershipCheckError);
      }
      
      const { data: myCreatedTeams, error: createdTeamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('created_by', user.id);
        
      if (createdTeamsError) {
        console.error("Error fetching created teams:", createdTeamsError);
        throw createdTeamsError;
      }
      
      console.log("Teams created by user:", myCreatedTeams?.length || 0);
      
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
      
      const createdButNotMember = myCreatedTeams
        ? myCreatedTeams.filter(team => !memberTeamIds.includes(team.id))
        : [];
      
      let memberTeams: Team[] = [];
      if (memberTeamIds.length > 0) {
        const { data: fetchedMemberTeams, error: teamsError } = await supabase
          .from('teams')
          .select('*')
          .in('id', memberTeamIds);
          
        if (teamsError) {
          console.error("Error fetching member teams details:", teamsError);
          throw teamsError;
        }
        
        memberTeams = fetchedMemberTeams || [];
      }
      
      for (const team of createdButNotMember) {
        console.log(`Adding user as admin to their own team ${team.id}`);
        
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
      
      const allTeams = [...memberTeams, ...createdButNotMember];
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

      setLoading(true);
      console.log("Creating team with name:", name, "by user:", user.id);
      
      const { data, error } = await supabase
        .from('teams')
        .insert([{ 
            name, 
            description, 
            created_by: user.id 
        }])
        .select()
        .single();
        
      if (error) {
        console.error("Error creating team:", error);
        throw error;
      }
      
      if (!data) {
        throw new Error("Team was created but no data was returned");
      }
      
      console.log("Team created successfully:", data);
      
      const { error: memberError } = await supabase
        .from('team_members')
        .insert([{
          team_id: data.id,
          user_id: user.id,
          role: 'admin'
        }]);
        
      if (memberError) {
        console.error("Error adding creator as team member:", memberError);
      }
      
      console.log("Creator added as team member with admin role");
      
      setTeams(prev => [...prev, data]);
      
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
    } finally {
      await fetchTeams();
      setLoading(false);
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
    fetchTeams,
    createTeam,
    updateTeam,
    deleteTeam
  };
}
