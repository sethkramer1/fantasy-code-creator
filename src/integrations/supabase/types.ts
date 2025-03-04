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
      game_messages: {
        Row: {
          created_at: string
          game_id: string
          id: string
          image_url: string | null
          message: string
          model_type: string | null
          response: string | null
          version_id: string | null
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          image_url?: string | null
          message: string
          model_type?: string | null
          response?: string | null
          version_id?: string | null
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          image_url?: string | null
          message?: string
          model_type?: string | null
          response?: string | null
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
          id: string
          instructions: string | null
          model_type: string | null
          prompt: string
          type: string | null
          user_id: string | null
          visibility: string
        }
        Insert: {
          code: string
          created_at?: string
          current_version?: number | null
          id?: string
          instructions?: string | null
          model_type?: string | null
          prompt: string
          type?: string | null
          user_id?: string | null
          visibility?: string
        }
        Update: {
          code?: string
          created_at?: string
          current_version?: number | null
          id?: string
          instructions?: string | null
          model_type?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
