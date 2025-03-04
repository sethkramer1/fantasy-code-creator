
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TeamInvitation } from "@/types/team";
import { useToast } from "@/hooks/use-toast";

export function useTeamInvitations(teamId?: string) {
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchInvitations = async () => {
    if (!teamId) return;
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('team_invitations')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      setInvitations(data || []);
    } catch (error) {
      console.error("Error fetching team invitations:", error);
      toast({
        title: "Error",
        description: "Failed to load invitations. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createInvitation = async () => {
    if (!teamId) return null;
    
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;
      if (!userData.user) throw new Error("User not authenticated");

      // Generate a random invitation code
      const invitationCode = Math.random().toString(36).substring(2, 15) + 
                             Math.random().toString(36).substring(2, 15);
      
      const { data, error } = await supabase
        .from('team_invitations')
        .insert([
          { 
            team_id: teamId,
            invitation_code: invitationCode,
            created_by: userData.user.id 
          }
        ])
        .select()
        .single();
        
      if (error) throw error;
      
      await fetchInvitations();
      
      toast({
        title: "Success",
        description: "Invitation created successfully.",
      });
      
      return data;
    } catch (error) {
      console.error("Error creating invitation:", error);
      toast({
        title: "Error",
        description: "Failed to create invitation. Please try again.",
        variant: "destructive",
      });
      return null;
    }
  };

  const deleteInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('team_invitations')
        .delete()
        .eq('id', invitationId);
        
      if (error) throw error;
      
      await fetchInvitations();
      
      toast({
        title: "Success",
        description: "Invitation deleted successfully.",
      });
      
      return true;
    } catch (error) {
      console.error("Error deleting invitation:", error);
      toast({
        title: "Error",
        description: "Failed to delete invitation. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  const joinTeamWithInvitation = async (invitationCode: string) => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;
      if (!userData.user) throw new Error("User not authenticated");

      // Find the invitation
      const { data: invitationData, error: invitationError } = await supabase
        .from('team_invitations')
        .select('team_id')
        .eq('invitation_code', invitationCode)
        .single();
        
      if (invitationError) throw new Error("Invalid invitation code");
      
      // Check if user is already a member
      const { data: existingMember, error: memberCheckError } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', invitationData.team_id)
        .eq('user_id', userData.user.id)
        .maybeSingle();
        
      if (memberCheckError) throw memberCheckError;
      
      if (existingMember) {
        toast({
          title: "Already a member",
          description: "You are already a member of this team.",
        });
        return invitationData.team_id;
      }
      
      // Add user to team
      const { error: joinError } = await supabase
        .from('team_members')
        .insert([
          { 
            team_id: invitationData.team_id,
            user_id: userData.user.id,
            role: 'member'
          }
        ]);
        
      if (joinError) throw joinError;
      
      toast({
        title: "Success",
        description: "You have joined the team successfully.",
      });
      
      return invitationData.team_id;
    } catch (error) {
      console.error("Error joining team:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to join team. Please try again.",
        variant: "destructive",
      });
      return null;
    }
  };

  return {
    invitations,
    loading,
    fetchInvitations,
    createInvitation,
    deleteInvitation,
    joinTeamWithInvitation
  };
}
