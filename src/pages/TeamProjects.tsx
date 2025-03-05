import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { useTeams } from "@/hooks/useTeams";
import { useProjects } from "@/hooks/useProjects";
import { ProjectCard } from "@/components/project/ProjectCard";
import { Team } from "@/types/team";
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
import { useToast } from "@/hooks/use-toast";
import { Navbar } from "@/components/layout/Navbar";

export default function TeamProjectsPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { teams, loading: teamsLoading } = useTeams();
  const { projects, loading: projectsLoading, createProject } = useProjects(teamId);
  const [team, setTeam] = useState<Team | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  useEffect(() => {
    if (!teamsLoading && teamId) {
      const foundTeam = teams.find(t => t.id === teamId);
      if (foundTeam) {
        setTeam(foundTeam);
      } else {
        toast({
          title: "Team Not Found",
          description: "The requested team could not be found.",
          variant: "destructive",
        });
        navigate('/teams');
      }
    }
  }, [teamsLoading, teams, teamId]);
  
  const handleCreateProject = async () => {
    if (!teamId || !projectName.trim()) return;
    
    setIsCreating(true);
    try {
      const result = await createProject(projectName, projectDescription);
      if (result) {
        setProjectName('');
        setProjectDescription('');
        setIsDialogOpen(false);
      }
    } finally {
      setIsCreating(false);
    }
  };
  
  const loading = teamsLoading || projectsLoading;
  
  return (
    <div>
      <Navbar />
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={() => navigate('/teams')}
            >
              Back to Teams
            </Button>
            {team && (
              <Button 
                variant="outline" 
                onClick={() => navigate(`/teams/${teamId}`)}
              >
                Manage Team
              </Button>
            )}
          </div>
        </div>
        
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">
            {team ? `${team.name} - Projects` : 'Team Projects'}
          </h1>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>Create Project</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a New Project</DialogTitle>
                <DialogDescription>
                  Create a project to organize related games.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="project-name">Project Name</Label>
                  <Input 
                    id="project-name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Enter project name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="project-description">Description (Optional)</Label>
                  <Textarea 
                    id="project-description"
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder="Describe the purpose of this project"
                    rows={3}
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button 
                  onClick={handleCreateProject}
                  disabled={!projectName.trim() || isCreating}
                >
                  {isCreating ? 'Creating...' : 'Create Project'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        
        <Separator className="mb-8" />
        
        {loading ? (
          <div className="text-center py-8">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">This team doesn't have any projects yet.</p>
            <Button onClick={() => setIsDialogOpen(true)}>Create Your First Project</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => (
              <ProjectCard key={project.id} project={project} teamId={teamId || ''} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
