export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      events: {
        Row: {
          id: string;
          host_id: string;
          event_code: string;
          title: string;
          description: string | null;
          date_start: string;
          date_end: string;
          daily_start_time: string;
          daily_end_time: string;
          timezone: string;
          buffer_time_minutes: number;
          is_buffer_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          host_id: string;
          event_code?: string;
          title: string;
          description?: string | null;
          date_start: string;
          date_end: string;
          daily_start_time: string;
          daily_end_time: string;
          timezone?: string;
          buffer_time_minutes?: number;
          is_buffer_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          host_id?: string;
          event_code?: string;
          title?: string;
          description?: string | null;
          date_start?: string;
          date_end?: string;
          daily_start_time?: string;
          daily_end_time?: string;
          timezone?: string;
          buffer_time_minutes?: number;
          is_buffer_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "events_host_id_fkey";
            columns: ["host_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      time_blocks: {
        Row: {
          id: string;
          event_id: string;
          start_at: string;
          end_at: string;
          type: Database["public"]["Enums"]["time_block_type"];
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          start_at: string;
          end_at: string;
          type: Database["public"]["Enums"]["time_block_type"];
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          start_at?: string;
          end_at?: string;
          type?: Database["public"]["Enums"]["time_block_type"];
          note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "time_blocks_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      reservations: {
        Row: {
          id: string;
          event_id: string;
          creator_id: string | null;
          reservation_access_code: string;
          password_hash: string | null;
          headcount: number;
          status: Database["public"]["Enums"]["reservation_status"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          creator_id?: string | null;
          reservation_access_code?: string;
          password_hash?: string | null;
          headcount: number;
          status?: Database["public"]["Enums"]["reservation_status"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          creator_id?: string | null;
          reservation_access_code?: string;
          password_hash?: string | null;
          headcount?: number;
          status?: Database["public"]["Enums"]["reservation_status"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reservations_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservations_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      reservation_participants: {
        Row: {
          id: string;
          reservation_id: string;
          user_id: string | null;
          guest_name: string;
          is_creator: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          reservation_id: string;
          user_id?: string | null;
          guest_name: string;
          is_creator?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          reservation_id?: string;
          user_id?: string | null;
          guest_name?: string;
          is_creator?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reservation_participants_reservation_id_fkey";
            columns: ["reservation_id"];
            isOneToOne: false;
            referencedRelation: "reservations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservation_participants_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      reservation_slots: {
        Row: {
          id: string;
          event_id: string;
          reservation_id: string;
          start_at: string;
          end_at: string;
          is_confirmed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          reservation_id: string;
          start_at: string;
          end_at: string;
          is_confirmed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          reservation_id?: string;
          start_at?: string;
          end_at?: string;
          is_confirmed?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reservation_slots_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservation_slots_reservation_id_fkey";
            columns: ["reservation_id"];
            isOneToOne: false;
            referencedRelation: "reservations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      reservation_status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
      time_block_type: "AVAILABLE" | "BLOCKED";
    };
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];

export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];
