
export interface Team {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  created_by: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
}

export interface TeamInvitation {
  id: string;
  team_id: string;
  invitation_code: string;
  created_at: string;
  created_by: string;
}
