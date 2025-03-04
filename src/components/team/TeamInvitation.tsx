
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTeamInvitations } from "@/hooks/useTeamInvitations";
import { useToast } from "@/hooks/use-toast";

interface TeamInvitationProps {
  teamId: string;
}

export function TeamInvitation({ teamId }: TeamInvitationProps) {
  const { invitations, createInvitation, fetchInvitations } = useTeamInvitations(teamId);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const { toast } = useToast();

  const baseUrl = window.location.origin;
  
  const handleCreateInvitation = async () => {
    setIsCreating(true);
    try {
      await createInvitation();
      await fetchInvitations();
    } finally {
      setIsCreating(false);
    }
  };
  
  const copyInvitationLink = (invitationCode: string) => {
    const link = `${baseUrl}/join-team/${invitationCode}`;
    navigator.clipboard.writeText(link);
    setCopied(invitationCode);
    
    toast({
      title: "Link copied",
      description: "Invitation link copied to clipboard",
    });
    
    setTimeout(() => setCopied(null), 3000);
  };
  
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Team Invitations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {invitations && invitations.length > 0 ? (
            <div className="space-y-4">
              <h4 className="font-medium">Active Invitation Links</h4>
              {invitations.map(invitation => {
                const inviteLink = `${baseUrl}/join-team/${invitation.invitation_code}`;
                return (
                  <div key={invitation.id} className="flex items-center gap-2">
                    <Input 
                      value={inviteLink} 
                      readOnly 
                      className="flex-grow"
                    />
                    <Button
                      variant="outline"
                      onClick={() => copyInvitationLink(invitation.invitation_code)}
                    >
                      {copied === invitation.invitation_code ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500">No active invitation links</p>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleCreateInvitation}
          disabled={isCreating}
        >
          {isCreating ? 'Creating...' : 'Create New Invitation'}
        </Button>
      </CardFooter>
    </Card>
  );
}
