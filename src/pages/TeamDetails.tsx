
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { useTeams } from "@/hooks/useTeams";
import { TeamMembersList } from "@/components/team/TeamMembersList";
import { TeamInvitation } from "@/components/team/TeamInvitation";
import { Team } from "@/types/team";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

export default function TeamDetailsPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { teams, loading, updateTeam, deleteTeam } = useTeams();
  const [team, setTeam] = useState<Team | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  useEffect(() => {
    if (!loading && teamId) {
      const foundTeam = teams.find(t => t.id === teamId);
      if (foundTeam) {
        setTeam(foundTeam);
        setEditName(foundTeam.name);
        setEditDescription(foundTeam.description || '');
      } else {
        toast({
          title: "Team Not Found",
          description: "The requested team could not be found.",
          variant: "destructive",
        });
        navigate('/teams');
      }
    }
  }, [loading, teams, teamId]);
  
  const handleSaveTeam = async () => {
    if (!teamId || !editName.trim()) return;
    
    setIsSaving(true);
    try {
      const success = await updateTeam(teamId, {
        name: editName,
        description: editDescription || null
      });
      
      if (success) {
        setIsEditing(false);
      }
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDeleteTeam = async () => {
    if (!teamId) return;
    
    if (window.confirm("Are you sure you want to delete this team? This action cannot be undone.")) {
      setIsDeleting(true);
      try {
        const success = await deleteTeam(teamId);
        if (success) {
          navigate('/teams');
        }
      } finally {
        setIsDeleting(false);
      }
    }
  };
  
  if (loading || !team) {
    return <div className="container mx-auto py-8 px-4 text-center">Loading team details...</div>;
  }
  
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => navigate('/teams')}
          >
            Back to Teams
          </Button>
          <Button 
            variant="outline" 
            onClick={() => navigate(`/teams/${teamId}/projects`)}
          >
            View Projects
          </Button>
        </div>
      </div>
      
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Team Details</CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Team Name</Label>
                <Input 
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description (Optional)</Label>
                <Textarea 
                  id="edit-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                />
              </div>
              
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsEditing(false);
                    setEditName(team.name);
                    setEditDescription(team.description || '');
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSaveTeam}
                  disabled={!editName.trim() || isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-2xl font-bold mb-2">{team.name}</h2>
              {team.description && (
                <p className="text-gray-600 mb-4">{team.description}</p>
              )}
              <p className="text-sm text-gray-500 mb-4">
                Created on {new Date(team.created_at).toLocaleDateString()}
              </p>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditing(true)}
                >
                  Edit Team
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleDeleteTeam}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Team'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Separator className="my-8" />
      
      <TeamMembersList teamId={teamId} />
      
      <Separator className="my-8" />
      
      <TeamInvitation teamId={teamId} />
    </div>
  );
}
