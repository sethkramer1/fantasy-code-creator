
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TeamMember } from "@/types/team";
import { useToast } from "@/hooks/use-toast";

export function useTeamMembers(teamId?: string) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchMembers = async () => {
    if (!teamId) return;
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamId)
        .order('joined_at', { ascending: true });
        
      if (error) throw error;
      
      // Ensure the role property is always "admin" or "member" 
      const typedMembers = data?.map(member => ({
        ...member,
        role: member.role === 'admin' ? 'admin' : 'member'
      })) as TeamMember[];
      
      setMembers(typedMembers || []);
    } catch (error) {
      console.error("Error fetching team members:", error);
      toast({
        title: "Error",
        description: "Failed to load team members. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isTeamAdmin = async (userId: string) => {
    try {
      if (!teamId) return false;
      
      const { data, error } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', userId)
        .single();
        
      if (error) return false;
      
      return data.role === 'admin';
    } catch (error) {
      console.error("Error checking admin status:", error);
      return false;
    }
  };

  const updateMemberRole = async (memberId: string, role: 'admin' | 'member') => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ role })
        .eq('id', memberId);
        
      if (error) throw error;
      
      await fetchMembers();
      
      toast({
        title: "Success",
        description: "Member role updated successfully.",
      });
      
      return true;
    } catch (error) {
      console.error("Error updating member role:", error);
      toast({
        title: "Error",
        description: "Failed to update member role. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);
        
      if (error) throw error;
      
      await fetchMembers();
      
      toast({
        title: "Success",
        description: "Member removed successfully.",
      });
      
      return true;
    } catch (error) {
      console.error("Error removing team member:", error);
      toast({
        title: "Error",
        description: "Failed to remove team member. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  // Fetch members when teamId changes
  useEffect(() => {
    if (teamId) {
      fetchMembers();
    }
  }, [teamId]);

  return {
    members,
    loading,
    fetchMembers,
    isTeamAdmin,
    updateMemberRole,
    removeMember
  };
}
