
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useTeams } from "@/hooks/useTeams";
import { TeamCard } from "@/components/team/TeamCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/AuthContext";
import { Header } from "@/components/game-creator/Header";

export default function TeamsPage() {
  const { teams, loading, createTeam } = useTeams();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { user } = useAuth();
  
  useEffect(() => {
    console.log("TeamsPage - User:", user?.id);
    console.log("TeamsPage - Teams loaded:", teams.length);
    console.log("TeamsPage - Teams data:", teams);
  }, [teams, user]);
  
  const handleCreateTeam = async () => {
    if (!teamName.trim()) return;
    
    setIsCreating(true);
    try {
      console.log("Creating team with name:", teamName);
      const team = await createTeam(teamName, teamDescription);
      console.log("Team created:", team);
      setTeamName('');
      setTeamDescription('');
      setIsDialogOpen(false);
    } finally {
      setIsCreating(false);
    }
  };
  
  return (
    <div className="container mx-auto py-8 px-4">
      <Header 
        title="My Teams" 
        description="Create and manage your teams to collaborate on projects."
      />
      
      <div className="flex justify-end mb-8 mt-6">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>Create Team</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a New Team</DialogTitle>
              <DialogDescription>
                Create a team to collaborate on projects with other users.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="team-name">Team Name</Label>
                <Input 
                  id="team-name"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Enter team name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="team-description">Description (Optional)</Label>
                <Textarea 
                  id="team-description"
                  value={teamDescription}
                  onChange={(e) => setTeamDescription(e.target.value)}
                  placeholder="Describe the purpose of this team"
                  rows={3}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button 
                onClick={handleCreateTeam}
                disabled={!teamName.trim() || isCreating}
              >
                {isCreating ? 'Creating...' : 'Create Team'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      <Separator className="mb-8" />
      
      {loading ? (
        <div className="text-center py-8">Loading teams...</div>
      ) : teams.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">You don't have any teams yet.</p>
          <Button onClick={() => setIsDialogOpen(true)}>Create Your First Team</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map(team => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      )}
    </div>
  );
}
