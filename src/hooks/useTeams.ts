
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Team } from "@/types/team";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchTeams = useCallback(async () => {
    try {
      if (!user) {
        console.log("No user found, cannot fetch teams");
        setTeams([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      console.log("Fetching teams for user:", user.id);
      
      // First, let's check if we can see the team_members table at all
      const { data: testMembers, error: testError } = await supabase
        .from('team_members')
        .select('count')
        .limit(1);
      
      if (testError) {
        console.error("Test query failed:", testError);
      } else {
        console.log("Test query successful, team_members table is accessible");
      }
      
      // Fetch teams where user is a member (including those they created)
      const { data: memberTeamsJoins, error: memberError } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', user.id);
        
      if (memberError) {
        console.error("Error fetching team memberships:", memberError);
        throw memberError;
      }
      
      console.log("Team memberships found:", memberTeamsJoins?.length || 0);
      console.log("Membership data:", memberTeamsJoins);
      
      const teamIds = memberTeamsJoins?.map(tm => tm.team_id) || [];
      console.log("User is a member of teams with IDs:", teamIds);
      
      let teamsData: Team[] = [];
      
      if (teamIds.length > 0) {
        const { data, error } = await supabase
          .from('teams')
          .select('*')
          .in('id', teamIds);
          
        if (error) {
          console.error("Error fetching teams by IDs:", error);
          throw error;
        }
        
        teamsData = data || [];
        console.log("Teams fetched by membership:", teamsData);
      } else {
        // Fallback: try to fetch teams created by the user directly
        // This is useful if for some reason the team_members entry wasn't created
        console.log("No team memberships found, trying direct creator lookup");
        const { data: createdTeams, error: createdError } = await supabase
          .from('teams')
          .select('*')
          .eq('created_by', user.id);
          
        if (createdError) {
          console.error("Error fetching created teams:", createdError);
          throw createdError;
        }
        
        if (createdTeams && createdTeams.length > 0) {
          console.log("Found teams created by user:", createdTeams);
          
          // For each team the user created but isn't a member of, let's add them as admin
          for (const team of createdTeams) {
            const existingMembership = memberTeamsJoins?.find(m => m.team_id === team.id);
            
            if (!existingMembership) {
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
          
          teamsData = createdTeams;
        }
      }
      
      console.log("Final teams data to display:", teamsData);
      setTeams(teamsData);
    } catch (error) {
      console.error("Error in fetchTeams:", error);
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
        .insert([
          {
            team_id: data.id,
            user_id: user.id,
            role: 'admin'
          }
        ]);
        
      if (memberError) {
        console.error("Error adding creator as team member:", memberError);
        throw memberError;
      }
      
      console.log("Creator added as team member with admin role");
      
      await fetchTeams(); // Refresh the teams list
      
      toast({
        title: "Success",
        description: "Team created successfully.",
      });
      
      return data;
    } catch (error) {
      console.error("Error creating team:", error);
      toast({
        title: "Error",
        description: "Failed to create team. Please try again.",
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
    } catch (error) {
      console.error("Error updating team:", error);
      toast({
        title: "Error",
        description: "Failed to update team. Please try again.",
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
    } catch (error) {
      console.error("Error deleting team:", error);
      toast({
        title: "Error",
        description: "Failed to delete team. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    if (user) {
      console.log("User detected, fetching teams");
      fetchTeams();
    } else {
      console.log("No user detected, clearing teams");
      setTeams([]);
      setLoading(false);
    }
  }, [user?.id, fetchTeams]);

  return {
    teams,
    loading,
    fetchTeams,
    createTeam,
    updateTeam,
    deleteTeam
  };
}
