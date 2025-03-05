import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { useProjects } from "@/hooks/useProjects";
import { ProjectGamesList } from "@/components/project/ProjectGamesList";
import { AddGameToProject } from "@/components/project/AddGameToProject";
import { Project } from "@/types/project";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Navbar } from "@/components/layout/Navbar";

export default function ProjectDetailsPage() {
  const { teamId, projectId } = useParams<{ teamId: string, projectId: string }>();
  const { projects, loading, updateProject, deleteProject } = useProjects(teamId);
  const [project, setProject] = useState<Project | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  useEffect(() => {
    if (!loading && projectId) {
      const foundProject = projects.find(p => p.id === projectId);
      if (foundProject) {
        setProject(foundProject);
        setEditName(foundProject.name);
        setEditDescription(foundProject.description || '');
      } else {
        toast({
          title: "Project Not Found",
          description: "The requested project could not be found.",
          variant: "destructive",
        });
        navigate(`/teams/${teamId}/projects`);
      }
    }
  }, [loading, projects, projectId, teamId]);
  
  const handleSaveProject = async () => {
    if (!projectId || !editName.trim()) return;
    
    setIsSaving(true);
    try {
      const success = await updateProject(projectId, {
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
  
  const handleDeleteProject = async () => {
    if (!projectId) return;
    
    if (window.confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      setIsDeleting(true);
      try {
        const success = await deleteProject(projectId);
        if (success) {
          navigate(`/teams/${teamId}/projects`);
        }
      } finally {
        setIsDeleting(false);
      }
    }
  };
  
  if (loading || !project) {
    return (
      <div>
        <Navbar />
        <div className="container mx-auto py-8 px-4 text-center">Loading project details...</div>
      </div>
    );
  }
  
  return (
    <div>
      <Navbar />
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={() => navigate(`/teams/${teamId}/projects`)}
            >
              Back to Projects
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate(`/teams/${teamId}`)}
            >
              Manage Team
            </Button>
          </div>
        </div>
        
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Project Name</Label>
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
                      setEditName(project.name);
                      setEditDescription(project.description || '');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSaveProject}
                    disabled={!editName.trim() || isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-2xl font-bold mb-2">{project.name}</h2>
                {project.description && (
                  <p className="text-gray-600 mb-4">{project.description}</p>
                )}
                <p className="text-sm text-gray-500 mb-4">
                  Created on {new Date(project.created_at).toLocaleDateString()}
                </p>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsEditing(true)}
                  >
                    Edit Project
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={handleDeleteProject}
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete Project'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Separator className="my-8" />
        
        <ProjectGamesList projectId={projectId} />
        
        <Separator className="my-8" />
        
        <AddGameToProject projectId={projectId} />
      </div>
    </div>
  );
}
