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
          archived: boolean
          areas_for_improvement: Json
          attempt_id: string | null
          audio_expires_at: string | null
          audio_path: string | null
          candidate_id: string | null
          candidate_name: string | null
          candidates: number | null
          confirmed_at: string | null
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
          overall_summary: string | null
          part_feedback: Json | null
          phase_marks: Json | null
          previous_analyses: Json
          regrade_count: number
          revision: number
          revision_reason: string | null
          session_id: string | null
          speaker_map: Json | null
          status: string
          strengths: Json
          title: string
          transcript: string | null
          user_id: string | null
          words_json: Json | null
        }
        Insert: {
          archived?: boolean
          areas_for_improvement?: Json
          attempt_id?: string | null
          audio_expires_at?: string | null
          audio_path?: string | null
          candidate_id?: string | null
          candidate_name?: string | null
          candidates?: number | null
          confirmed_at?: string | null
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
          overall_summary?: string | null
          part_feedback?: Json | null
          phase_marks?: Json | null
          previous_analyses?: Json
          regrade_count?: number
          revision?: number
          revision_reason?: string | null
          session_id?: string | null
          speaker_map?: Json | null
          status?: string
          strengths?: Json
          title: string
          transcript?: string | null
          user_id?: string | null
          words_json?: Json | null
        }
        Update: {
          archived?: boolean
          areas_for_improvement?: Json
          attempt_id?: string | null
          audio_expires_at?: string | null
          audio_path?: string | null
          candidate_id?: string | null
          candidate_name?: string | null
          candidates?: number | null
          confirmed_at?: string | null
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
          overall_summary?: string | null
          part_feedback?: Json | null
          phase_marks?: Json | null
          previous_analyses?: Json
          regrade_count?: number
          revision?: number
          revision_reason?: string | null
          session_id?: string | null
          speaker_map?: Json | null
          status?: string
          strengths?: Json
          title?: string
          transcript?: string | null
          user_id?: string | null
          words_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "exams_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "session_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "speaking_sessions"
            referencedColumns: ["id"]
          },
        ]
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
      session_attempts: {
        Row: {
          analysis_result: Json | null
          audio_path: string
          candidate_ids: Json
          candidate_names: Json
          created_at: string
          duration_seconds: number | null
          id: string
          live_transcript: string
          live_words: Json | null
          recorded_at: string
          session_id: string
          speaker_map: Json | null
          status: string
          transcript: string
          transcription_mode: Database["public"]["Enums"]["transcription_mode"]
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_result?: Json | null
          audio_path?: string
          candidate_ids?: Json
          candidate_names?: Json
          created_at?: string
          duration_seconds?: number | null
          id?: string
          live_transcript?: string
          live_words?: Json | null
          recorded_at?: string
          session_id: string
          speaker_map?: Json | null
          status?: string
          transcript?: string
          transcription_mode?: Database["public"]["Enums"]["transcription_mode"]
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_result?: Json | null
          audio_path?: string
          candidate_ids?: Json
          candidate_names?: Json
          created_at?: string
          duration_seconds?: number | null
          id?: string
          live_transcript?: string
          live_words?: Json | null
          recorded_at?: string
          session_id?: string
          speaker_map?: Json | null
          status?: string
          transcript?: string
          transcription_mode?: Database["public"]["Enums"]["transcription_mode"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "speaking_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_materials: {
        Row: {
          ai_description: string
          created_at: string
          description: string
          id: string
          image_path: string
          kind: string
          session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_description?: string
          created_at?: string
          description?: string
          id?: string
          image_path?: string
          kind: string
          session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_description?: string
          created_at?: string
          description?: string
          id?: string
          image_path?: string
          kind?: string
          session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_materials_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "speaking_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      speaking_sessions: {
        Row: {
          created_at: string
          id: string
          language: string
          level_code: string
          notes: string
          status: string
          title: string
          transcription_mode: Database["public"]["Enums"]["transcription_mode"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          language?: string
          level_code: string
          notes?: string
          status?: string
          title: string
          transcription_mode?: Database["public"]["Enums"]["transcription_mode"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          language?: string
          level_code?: string
          notes?: string
          status?: string
          title?: string
          transcription_mode?: Database["public"]["Enums"]["transcription_mode"]
          updated_at?: string
          user_id?: string
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
      fill_missing_part_feedback: {
        Args: {
          _exam_id: string
          _overall_summary?: string
          _part_feedback: Json
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "educator" | "senior"
      transcription_mode: "live" | "manual"
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
      app_role: ["admin", "educator", "senior"],
      transcription_mode: ["live", "manual"],
    },
  },
} as const
