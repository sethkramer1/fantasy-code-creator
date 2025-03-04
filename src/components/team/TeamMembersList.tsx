
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { TeamMember } from "@/types/team";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TeamMembersListProps {
  teamId: string;
}

interface UserInfo {
  id: string;
  email: string;
}

export function TeamMembersList({ teamId }: TeamMembersListProps) {
  const { members, loading, removeMember, updateMemberRole, isTeamAdmin } = useTeamMembers(teamId);
  const [userInfo, setUserInfo] = useState<Record<string, UserInfo>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
  
  useEffect(() => {
    const fetchUserData = async () => {
      // Get current user
      const { data: userData } = await supabase.auth.getUser();
      if (userData && userData.user) {
        setCurrentUserId(userData.user.id);
        
        // Check if current user is admin
        const adminStatus = await isTeamAdmin(userData.user.id);
        setIsCurrentUserAdmin(adminStatus);
      }
      
      // Get info for all members
      const userIds = members.map(member => member.user_id);
      if (userIds.length === 0) return;
      
      // Since we can't query auth.users directly with the client,
      // we're using a workaround to get user emails from the authentication context
      // In a real app, you'd want to create a profiles table to store this info
      const users: Record<string, UserInfo> = {};
      
      members.forEach(member => {
        users[member.user_id] = {
          id: member.user_id,
          email: `User ${member.user_id.substring(0, 8)}` // Just a placeholder
        };
      });
      
      setUserInfo(users);
    };
    
    fetchUserData();
  }, [members, teamId]);
  
  const handleRemoveMember = async (memberId: string, userId: string) => {
    if (userId === currentUserId) {
      if (window.confirm("Are you sure you want to leave this team?")) {
        await removeMember(memberId);
      }
    } else {
      if (window.confirm("Are you sure you want to remove this member?")) {
        await removeMember(memberId);
      }
    }
  };
  
  const handleRoleUpdate = async (memberId: string, userId: string, currentRole: string) => {
    if (!isCurrentUserAdmin) return;
    
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    
    if (window.confirm(`Are you sure you want to change this member's role to ${newRole}?`)) {
      await updateMemberRole(memberId, newRole as 'admin' | 'member');
    }
  };
  
  if (loading) {
    return <div className="text-center my-8">Loading team members...</div>;
  }
  
  return (
    <div className="my-6">
      <h3 className="text-lg font-medium mb-4">Team Members</h3>
      
      {members.length === 0 ? (
        <p className="text-gray-500">No members found</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map(member => (
              <TableRow key={member.id}>
                <TableCell>{userInfo[member.user_id]?.email || member.user_id}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded text-xs ${
                    member.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100'
                  }`}>
                    {member.role}
                  </span>
                </TableCell>
                <TableCell>{new Date(member.joined_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {isCurrentUserAdmin && member.user_id !== currentUserId && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleRoleUpdate(member.id, member.user_id, member.role)}
                      >
                        {member.role === 'admin' ? 'Make Member' : 'Make Admin'}
                      </Button>
                    )}
                    
                    {(isCurrentUserAdmin || member.user_id === currentUserId) && (
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleRemoveMember(member.id, member.user_id)}
                      >
                        {member.user_id === currentUserId ? 'Leave' : 'Remove'}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
