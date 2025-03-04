
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Team } from "@/types/team";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchTeams = async () => {
    try {
      if (!user) {
        console.log("No user found, cannot fetch teams");
        setTeams([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      console.log("Fetching teams for user:", user.id);
      
      // Method 1: Direct fetch of teams the user created
      const { data: createdTeams, error: createdError } = await supabase
        .from('teams')
        .select('*')
        .eq('created_by', user.id);
        
      if (createdError) {
        console.error("Error fetching created teams:", createdError);
        throw createdError;
      }
      
      console.log("Teams created by user:", createdTeams);
      
      // Method 2: Fetch teams where user is a member (including those they didn't create)
      const { data: memberTeamsJoins, error: memberError } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', user.id);
        
      if (memberError) {
        console.error("Error fetching team memberships:", memberError);
        throw memberError;
      }
      
      const teamIds = memberTeamsJoins?.map(tm => tm.team_id) || [];
      console.log("User is a member of teams with IDs:", teamIds);
      
      let memberTeamsData: Team[] = [];
      if (teamIds.length > 0) {
        const { data, error } = await supabase
          .from('teams')
          .select('*')
          .in('id', teamIds);
          
        if (error) {
          console.error("Error fetching member teams:", error);
          throw error;
        }
        
        memberTeamsData = data || [];
        console.log("Teams user is a member of:", memberTeamsData);
      }
      
      // Combine and deduplicate teams
      const allTeams = [...(createdTeams || []), ...memberTeamsData];
      const uniqueTeams = allTeams.filter((team, index, self) => 
        index === self.findIndex(t => t.id === team.id)
      );
      
      console.log("Total unique teams:", uniqueTeams);
      setTeams(uniqueTeams);
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
  };

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
        
      if (error) throw error;
      
      console.log("Team created successfully:", data);
      
      // Step 2: IMPORTANT - Add the creator as a team member with admin role
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
      fetchTeams();
    } else {
      setTeams([]);
      setLoading(false);
    }
  }, [user?.id]);

  return {
    teams,
    loading,
    fetchTeams,
    createTeam,
    updateTeam,
    deleteTeam
  };
}
