export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      deployments: {
        Row: {
          created_at: string | null
          game_id: string | null
          id: string
          provider: string
          site_id: string
          site_name: string
          site_url: string
          version_id: string | null
        }
        Insert: {
          created_at?: string | null
          game_id?: string | null
          id?: string
          provider: string
          site_id: string
          site_name: string
          site_url: string
          version_id?: string | null
        }
        Update: {
          created_at?: string | null
          game_id?: string | null
          id?: string
          provider?: string
          site_id?: string
          site_name?: string
          site_url?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deployments_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployments_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "game_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_submissions: {
        Row: {
          created_at: string | null
          email: string
          game_id: string
          id: string
          metadata: Json | null
          name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          game_id: string
          id?: string
          metadata?: Json | null
          name?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          game_id?: string
          id?: string
          metadata?: Json | null
          name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_submissions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_messages: {
        Row: {
          created_at: string
          game_id: string
          id: string
          image_url: string | null
          is_system: boolean | null
          message: string
          model_type: string | null
          response: string | null
          suggestions: Json | null
          version_id: string | null
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          image_url?: string | null
          is_system?: boolean | null
          message: string
          model_type?: string | null
          response?: string | null
          suggestions?: Json | null
          version_id?: string | null
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          image_url?: string | null
          is_system?: boolean | null
          message?: string
          model_type?: string | null
          response?: string | null
          suggestions?: Json | null
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_messages_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_messages_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "game_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      game_versions: {
        Row: {
          code: string
          created_at: string
          game_id: string
          id: string
          instructions: string | null
          version_number: number
        }
        Insert: {
          code: string
          created_at?: string
          game_id: string
          id?: string
          instructions?: string | null
          version_number: number
        }
        Update: {
          code?: string
          created_at?: string
          game_id?: string
          id?: string
          instructions?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_versions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          code: string
          created_at: string
          current_version: number | null
          deleted: boolean
          id: string
          instructions: string | null
          metadata: Json | null
          model_type: string | null
          name: string | null
          prompt: string
          type: string | null
          user_id: string | null
          visibility: string
        }
        Insert: {
          code: string
          created_at?: string
          current_version?: number | null
          deleted?: boolean
          id?: string
          instructions?: string | null
          metadata?: Json | null
          model_type?: string | null
          name?: string | null
          prompt: string
          type?: string | null
          user_id?: string | null
          visibility?: string
        }
        Update: {
          code?: string
          created_at?: string
          current_version?: number | null
          deleted?: boolean
          id?: string
          instructions?: string | null
          metadata?: Json | null
          model_type?: string | null
          name?: string | null
          prompt?: string
          type?: string | null
          user_id?: string | null
          visibility?: string
        }
        Relationships: []
      }
      netlify_auth_state: {
        Row: {
          created_at: string | null
          game_id: string
          id: string
          state: string
        }
        Insert: {
          created_at?: string | null
          game_id: string
          id?: string
          state: string
        }
        Update: {
          created_at?: string | null
          game_id?: string
          id?: string
          state?: string
        }
        Relationships: []
      }
      netlify_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string
          game_id: string
          id: string
          refresh_token: string
          token_type: string
          updated_at: string | null
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at: string
          game_id: string
          id?: string
          refresh_token: string
          token_type: string
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string
          game_id?: string
          id?: string
          refresh_token?: string
          token_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      project_games: {
        Row: {
          added_at: string
          added_by: string
          game_id: string
          id: string
          project_id: string
        }
        Insert: {
          added_at?: string
          added_by: string
          game_id: string
          id?: string
          project_id: string
        }
        Update: {
          added_at?: string
          added_by?: string
          game_id?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_games_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_games_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          team_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          team_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          invitation_code: string
          team_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          invitation_code: string
          team_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          invitation_code?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          joined_at: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      token_usage: {
        Row: {
          created_at: string
          game_id: string
          id: string
          input_tokens: number
          message_id: string | null
          model_type: string
          output_tokens: number
          prompt: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          input_tokens?: number
          message_id?: string | null
          model_type: string
          output_tokens?: number
          prompt: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          input_tokens?: number
          message_id?: string | null
          model_type?: string
          output_tokens?: number
          prompt?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "token_usage_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_usage_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "game_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          user_id: string
          role: string
        }
        Returns: boolean
      }
      increment_version: {
        Args: {
          game_id_param: string
        }
        Returns: undefined
      }
      is_team_admin: {
        Args: {
          team_id: string
          user_id?: string
        }
        Returns: boolean
      }
      is_team_member: {
        Args: {
          team_id: string
          user_id?: string
        }
        Returns: boolean
      }
      update_initial_generation_message: {
        Args: {
          game_id_param: string
        }
        Returns: boolean
      }
      update_message_suggestions: {
        Args: {
          p_message_id: string
          p_suggestions: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
