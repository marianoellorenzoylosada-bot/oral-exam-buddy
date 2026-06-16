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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      calibration_examples: {
        Row: {
          approved_at: string
          case_id: string
          examiner_id: string
          id: string
          level: string
          original_gold: Json
          rationale_differences: Json
          score_differences: Json
          senior_corrections: Json
          senior_notes: string
          task_type: string
          transcript: string
        }
        Insert: {
          approved_at?: string
          case_id: string
          examiner_id: string
          id?: string
          level: string
          original_gold?: Json
          rationale_differences?: Json
          score_differences?: Json
          senior_corrections?: Json
          senior_notes?: string
          task_type?: string
          transcript: string
        }
        Update: {
          approved_at?: string
          case_id?: string
          examiner_id?: string
          id?: string
          level?: string
          original_gold?: Json
          rationale_differences?: Json
          score_differences?: Json
          senior_corrections?: Json
          senior_notes?: string
          task_type?: string
          transcript?: string
        }
        Relationships: []
      }
      cambridge_reference_material: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          level_code: string
          source_url: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          level_code: string
          source_url?: string
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          level_code?: string
          source_url?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      exams: {
        Row: {
          areas_for_improvement: Json
          audio_expires_at: string | null
          audio_path: string | null
          candidate_name: string | null
          candidates: number | null
          created_at: string
          criteria: Json
          exam_context: Json
          examiner_notes: string | null
          group: string | null
          id: string
          institution: string | null
          language: string
          level_code: string
          overall_band: string
          overall_score: number
          phase_marks: Json | null
          previous_analyses: Json
          regrade_count: number
          speaker_map: Json | null
          status: string
          strengths: Json
          title: string
          transcript: string | null
          user_id: string | null
          words_json: Json | null
        }
        Insert: {
          areas_for_improvement?: Json
          audio_expires_at?: string | null
          audio_path?: string | null
          candidate_name?: string | null
          candidates?: number | null
          created_at?: string
          criteria?: Json
          exam_context?: Json
          examiner_notes?: string | null
          group?: string | null
          id?: string
          institution?: string | null
          language: string
          level_code: string
          overall_band: string
          overall_score: number
          phase_marks?: Json | null
          previous_analyses?: Json
          regrade_count?: number
          speaker_map?: Json | null
          status?: string
          strengths?: Json
          title: string
          transcript?: string | null
          user_id?: string | null
          words_json?: Json | null
        }
        Update: {
          areas_for_improvement?: Json
          audio_expires_at?: string | null
          audio_path?: string | null
          candidate_name?: string | null
          candidates?: number | null
          created_at?: string
          criteria?: Json
          exam_context?: Json
          examiner_notes?: string | null
          group?: string | null
          id?: string
          institution?: string | null
          language?: string
          level_code?: string
          overall_band?: string
          overall_score?: number
          phase_marks?: Json | null
          previous_analyses?: Json
          regrade_count?: number
          speaker_map?: Json | null
          status?: string
          strengths?: Json
          title?: string
          transcript?: string | null
          user_id?: string | null
          words_json?: Json | null
        }
        Relationships: []
      }
      groups: {
        Row: {
          created_at: string
          id: string
          institution: string
          language: string
          level_code: string
          name: string
          notes: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution?: string
          language?: string
          level_code?: string
          name: string
          notes?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          institution?: string
          language?: string
          level_code?: string
          name?: string
          notes?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          institution: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          institution?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          institution?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          created_at: string
          full_name: string
          group_id: string
          id: string
          notes: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          group_id: string
          id?: string
          notes?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          group_id?: string
          id?: string
          notes?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
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
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "educator"
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
    Enums: {
      app_role: ["admin", "educator"],
    },
  },
} as const
