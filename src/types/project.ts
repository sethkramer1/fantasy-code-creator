
export interface Project {
  id: string;
  name: string;
  description: string | null;
  team_id: string;
  created_at: string;
  created_by: string;
}

export interface ProjectGame {
  id: string;
  project_id: string;
  game_id: string;
  added_at: string;
  added_by: string;
}
