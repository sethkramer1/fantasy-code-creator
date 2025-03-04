
import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Team } from "@/types/team";
import { useNavigate } from "react-router-dom";

interface TeamCardProps {
  team: Team;
}

export function TeamCard({ team }: TeamCardProps) {
  const navigate = useNavigate();
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{team.name}</CardTitle>
        {team.description && (
          <CardDescription>{team.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500">
          Created on {new Date(team.created_at).toLocaleDateString()}
        </p>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button 
          variant="outline" 
          onClick={() => navigate(`/teams/${team.id}/projects`)}
        >
          View Projects
        </Button>
        <Button onClick={() => navigate(`/teams/${team.id}`)}>
          Manage Team
        </Button>
      </CardFooter>
    </Card>
  );
}
