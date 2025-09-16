export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      escrows: {
        Row: {
          amount_usdc: number
          client_wallet: string
          created_at: string | null
          escrow_account: string | null
          freelancer_wallet: string | null
          funded_at: string | null
          id: string
          platform_fee: number
          project_id: string | null
          released_at: string | null
          solana_program_id: string | null
          status: string | null
          total_locked: number
          transaction_signature: string | null
        }
        Insert: {
          amount_usdc: number
          client_wallet: string
          created_at?: string | null
          escrow_account?: string | null
          freelancer_wallet?: string | null
          funded_at?: string | null
          id?: string
          platform_fee: number
          project_id?: string | null
          released_at?: string | null
          solana_program_id?: string | null
          status?: string | null
          total_locked: number
          transaction_signature?: string | null
        }
        Update: {
          amount_usdc?: number
          client_wallet?: string
          created_at?: string | null
          escrow_account?: string | null
          freelancer_wallet?: string | null
          funded_at?: string | null
          id?: string
          platform_fee?: number
          project_id?: string | null
          released_at?: string | null
          solana_program_id?: string | null
          status?: string | null
          total_locked?: number
          transaction_signature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escrows_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean | null
          recipient_id: string
          sender_id: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          recipient_id: string
          sender_id: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          recipient_id?: string
          sender_id?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      milestones: {
        Row: {
          amount_usdc: number
          approved_at: string | null
          created_at: string | null
          deliverable_urls: string[] | null
          description: string | null
          due_date: string | null
          escrow_id: string | null
          id: string
          project_id: string | null
          status: string | null
          submitted_at: string | null
          title: string
          work_description: string | null
        }
        Insert: {
          amount_usdc: number
          approved_at?: string | null
          created_at?: string | null
          deliverable_urls?: string[] | null
          description?: string | null
          due_date?: string | null
          escrow_id?: string | null
          id?: string
          project_id?: string | null
          status?: string | null
          submitted_at?: string | null
          title: string
          work_description?: string | null
        }
        Update: {
          amount_usdc?: number
          approved_at?: string | null
          created_at?: string | null
          deliverable_urls?: string[] | null
          description?: string | null
          due_date?: string | null
          escrow_id?: string | null
          id?: string
          project_id?: string | null
          status?: string | null
          submitted_at?: string | null
          title?: string
          work_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milestones_escrow_id_fkey"
            columns: ["escrow_id"]
            isOneToOne: false
            referencedRelation: "escrows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          availability_status: string | null
          bio: string | null
          certifications: string[] | null
          completed_projects: number | null
          created_at: string | null
          education: string | null
          experience_years: number | null
          full_name: string | null
          hourly_rate: number | null
          id: string
          languages: string[] | null
          location: string | null
          portfolio_url: string | null
          project_count: number | null
          rating: number | null
          response_time: string | null
          skills: string[] | null
          timezone: string | null
          total_earned: number | null
          updated_at: string | null
          username: string | null
          wallet_address: string | null
        }
        Insert: {
          availability_status?: string | null
          bio?: string | null
          certifications?: string[] | null
          completed_projects?: number | null
          created_at?: string | null
          education?: string | null
          experience_years?: number | null
          full_name?: string | null
          hourly_rate?: number | null
          id?: string
          languages?: string[] | null
          location?: string | null
          portfolio_url?: string | null
          project_count?: number | null
          rating?: number | null
          response_time?: string | null
          skills?: string[] | null
          timezone?: string | null
          total_earned?: number | null
          updated_at?: string | null
          username?: string | null
          wallet_address?: string | null
        }
        Update: {
          availability_status?: string | null
          bio?: string | null
          certifications?: string[] | null
          completed_projects?: number | null
          created_at?: string | null
          education?: string | null
          experience_years?: number | null
          full_name?: string | null
          hourly_rate?: number | null
          id?: string
          languages?: string[] | null
          location?: string | null
          portfolio_url?: string | null
          project_count?: number | null
          rating?: number | null
          response_time?: string | null
          skills?: string[] | null
          timezone?: string | null
          total_earned?: number | null
          updated_at?: string | null
          username?: string | null
          wallet_address?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          budget_usdc: number
          category: string
          client_id: string
          completed_at: string | null
          created_at: string | null
          description: string
          freelancer_id: string | null
          id: string
          required_skills: string[] | null
          started_at: string | null
          status: string | null
          timeline: string
          title: string
          updated_at: string | null
        }
        Insert: {
          budget_usdc: number
          category: string
          client_id: string
          completed_at?: string | null
          created_at?: string | null
          description: string
          freelancer_id?: string | null
          id?: string
          required_skills?: string[] | null
          started_at?: string | null
          status?: string | null
          timeline: string
          title: string
          updated_at?: string | null
        }
        Update: {
          budget_usdc?: number
          category?: string
          client_id?: string
          completed_at?: string | null
          created_at?: string | null
          description?: string
          freelancer_id?: string | null
          id?: string
          required_skills?: string[] | null
          started_at?: string | null
          status?: string | null
          timeline?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          cover_letter: string
          created_at: string | null
          estimated_timeline: string
          freelancer_id: string | null
          id: string
          milestones: Json | null
          project_id: string | null
          proposed_budget: number
        }
        Insert: {
          cover_letter: string
          created_at?: string | null
          estimated_timeline: string
          freelancer_id?: string | null
          id?: string
          milestones?: Json | null
          project_id?: string | null
          proposed_budget: number
        }
        Update: {
          cover_letter?: string
          created_at?: string | null
          estimated_timeline?: string
          freelancer_id?: string | null
          id?: string
          milestones?: Json | null
          project_id?: string | null
          proposed_budget?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposals_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_freelancer_earnings: {
        Args: { input_freelancer_wallet: string }
        Returns: number
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
