export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      reservation_status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
      time_block_type: "AVAILABLE" | "BLOCKED";
    };
    CompositeTypes: Record<string, never>;
  };
};
