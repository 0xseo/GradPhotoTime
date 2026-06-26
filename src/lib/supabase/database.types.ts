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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      event_active_dates: {
        Row: {
          active_date: string
          created_at: string
          event_id: string
          id: string
        }
        Insert: {
          active_date: string
          created_at?: string
          event_id: string
          id?: string
        }
        Update: {
          active_date?: string
          created_at?: string
          event_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_active_dates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_buffer_overrides: {
        Row: {
          created_at: string
          custom_end_at: string | null
          custom_start_at: string | null
          event_id: string
          id: string
          is_active: boolean
          reservation_slot_id: string
          side: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_end_at?: string | null
          custom_start_at?: string | null
          event_id: string
          id?: string
          is_active?: boolean
          reservation_slot_id: string
          side: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_end_at?: string | null
          custom_start_at?: string | null
          event_id?: string
          id?: string
          is_active?: boolean
          reservation_slot_id?: string
          side?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_buffer_overrides_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_buffer_overrides_reservation_slot_id_fkey"
            columns: ["reservation_slot_id"]
            isOneToOne: false
            referencedRelation: "reservation_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          buffer_time_minutes: number
          created_at: string
          daily_end_time: string
          daily_start_time: string
          date_end: string
          date_start: string
          description: string | null
          event_code: string
          host_id: string
          id: string
          is_buffer_active: boolean
          is_buffer_after_active: boolean
          is_buffer_before_active: boolean
          timezone: string
          title: string
          updated_at: string
        }
        Insert: {
          buffer_time_minutes?: number
          created_at?: string
          daily_end_time: string
          daily_start_time: string
          date_end: string
          date_start: string
          description?: string | null
          event_code?: string
          host_id: string
          id?: string
          is_buffer_active?: boolean
          is_buffer_after_active?: boolean
          is_buffer_before_active?: boolean
          timezone?: string
          title: string
          updated_at?: string
        }
        Update: {
          buffer_time_minutes?: number
          created_at?: string
          daily_end_time?: string
          daily_start_time?: string
          date_end?: string
          date_start?: string
          description?: string | null
          event_code?: string
          host_id?: string
          id?: string
          is_buffer_active?: boolean
          is_buffer_after_active?: boolean
          is_buffer_before_active?: boolean
          timezone?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      reservation_participants: {
        Row: {
          created_at: string
          guest_name: string
          id: string
          is_creator: boolean
          reservation_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          guest_name: string
          id?: string
          is_creator?: boolean
          reservation_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          guest_name?: string
          id?: string
          is_creator?: boolean
          reservation_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservation_participants_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_slots: {
        Row: {
          confirmed_end_at: string | null
          confirmed_start_at: string | null
          created_at: string
          end_at: string
          event_id: string
          id: string
          is_confirmed: boolean
          priority_order: number
          reservation_id: string
          start_at: string
        }
        Insert: {
          confirmed_end_at?: string | null
          confirmed_start_at?: string | null
          created_at?: string
          end_at: string
          event_id: string
          id?: string
          is_confirmed?: boolean
          priority_order?: number
          reservation_id: string
          start_at: string
        }
        Update: {
          confirmed_end_at?: string | null
          confirmed_start_at?: string | null
          created_at?: string
          end_at?: string
          event_id?: string
          id?: string
          is_confirmed?: boolean
          priority_order?: number
          reservation_id?: string
          start_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_slots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_slots_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          created_at: string
          creator_id: string | null
          event_id: string
          headcount: number
          id: string
          password_hash: string | null
          reservation_access_code: string
          status: Database["public"]["Enums"]["reservation_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id?: string | null
          event_id: string
          headcount: number
          id?: string
          password_hash?: string | null
          reservation_access_code?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string | null
          event_id?: string
          headcount?: number
          id?: string
          password_hash?: string | null
          reservation_access_code?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      time_blocks: {
        Row: {
          created_at: string
          end_at: string
          event_id: string
          id: string
          note: string | null
          start_at: string
          type: Database["public"]["Enums"]["time_block_type"]
        }
        Insert: {
          created_at?: string
          end_at: string
          event_id: string
          id?: string
          note?: string | null
          start_at: string
          type: Database["public"]["Enums"]["time_block_type"]
        }
        Update: {
          created_at?: string
          end_at?: string
          event_id?: string
          id?: string
          note?: string | null
          start_at?: string
          type?: Database["public"]["Enums"]["time_block_type"]
        }
        Relationships: [
          {
            foreignKeyName: "time_blocks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
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
      reservation_status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
      time_block_type: "AVAILABLE" | "BLOCKED"
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
      reservation_status: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
      time_block_type: ["AVAILABLE", "BLOCKED"],
    },
  },
} as const
