
import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Project } from "@/types/project";
import { useNavigate } from "react-router-dom";

interface ProjectCardProps {
  project: Project;
  teamId: string;
}

export function ProjectCard({ project, teamId }: ProjectCardProps) {
  const navigate = useNavigate();
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{project.name}</CardTitle>
        {project.description && (
          <CardDescription>{project.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500">
          Created on {new Date(project.created_at).toLocaleDateString()}
        </p>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button onClick={() => navigate(`/teams/${teamId}/projects/${project.id}`)}>
          View Project
        </Button>
      </CardFooter>
    </Card>
  );
}
