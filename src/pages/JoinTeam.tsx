
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useTeamInvitations } from "@/hooks/useTeamInvitations";
import { supabase } from "@/integrations/supabase/client";

export default function JoinTeamPage() {
  const { invitationCode } = useParams<{ invitationCode: string }>();
  const { joinTeamWithInvitation } = useTeamInvitations();
  const [isJoining, setIsJoining] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const navigate = useNavigate();
  
  useEffect(() => {
    const checkAuth = async () => {
      setIsChecking(true);
      const { data } = await supabase.auth.getSession();
      setIsAuthenticated(!!data.session);
      setIsChecking(false);
    };
    
    checkAuth();
  }, []);
  
  const handleJoinTeam = async () => {
    if (!invitationCode) return;
    
    setIsJoining(true);
    try {
      const teamId = await joinTeamWithInvitation(invitationCode);
      if (teamId) {
        navigate(`/teams/${teamId}`);
      }
    } finally {
      setIsJoining(false);
    }
  };
  
  if (isChecking) {
    return (
      <div className="container mx-auto py-16 px-4 flex justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Checking Authentication Status</CardTitle>
            <CardDescription>Please wait...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto py-16 px-4 flex justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>You need to sign in to join a team</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="mb-4">Please sign in or create an account to join this team.</p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={() => navigate('/auth')}>Sign In / Sign Up</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-16 px-4 flex justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Join Team</CardTitle>
          <CardDescription>You're about to join a team using an invitation link</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="mb-4">Click the button below to join the team.</p>
        </CardContent>
        <CardFooter className="flex justify-center space-x-4">
          <Button variant="outline" onClick={() => navigate('/teams')}>
            Cancel
          </Button>
          <Button 
            onClick={handleJoinTeam}
            disabled={isJoining}
          >
            {isJoining ? 'Joining...' : 'Join Team'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
