export type Gender = "male" | "female" | "other" | "unknown";
export type RelationSubtype =
  | "biological"
  | "adoptive"
  | "step"
  | "guardian"
  | "other";
export type PartnershipType =
  | "marriage"
  | "civil_union"
  | "domestic_partnership"
  | "other";

type GenealogyTables = {
  gr_family_trees: {
    Row: {
      id: string;
      name: string;
      slug: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      name: string;
      slug?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      name?: string;
      slug?: string | null;
      created_at?: string;
    };
  };
  gr_persons: {
    Row: {
      id: string;
      tree_id: string;
      first_name: string;
      middle_name: string | null;
      last_name: string;
      maiden_name: string | null;
      gender: Gender | null;
      birth_date: string | null;
      death_date: string | null;
      birth_place: string | null;
      death_place: string | null;
      is_living: boolean | null;
      photo_storage_path: string | null;
      notes: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      tree_id?: string;
      first_name?: string;
      middle_name?: string | null;
      last_name?: string;
      maiden_name?: string | null;
      gender?: Gender | null;
      birth_date?: string | null;
      death_date?: string | null;
      birth_place?: string | null;
      death_place?: string | null;
      is_living?: boolean | null;
      photo_storage_path?: string | null;
      notes?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      tree_id?: string;
      first_name?: string;
      middle_name?: string | null;
      last_name?: string;
      maiden_name?: string | null;
      gender?: Gender | null;
      birth_date?: string | null;
      death_date?: string | null;
      birth_place?: string | null;
      death_place?: string | null;
      is_living?: boolean | null;
      photo_storage_path?: string | null;
      notes?: string | null;
      created_at?: string;
      updated_at?: string;
    };
  };
  gr_parent_child: {
    Row: {
      id: string;
      parent_person_id: string;
      child_person_id: string;
      relation_subtype: RelationSubtype;
      notes: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      parent_person_id: string;
      child_person_id: string;
      relation_subtype?: RelationSubtype;
      notes?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      parent_person_id?: string;
      child_person_id?: string;
      relation_subtype?: RelationSubtype;
      notes?: string | null;
      created_at?: string;
    };
  };
  gr_partnerships: {
    Row: {
      id: string;
      person_a_id: string;
      person_b_id: string;
      partnership_type: PartnershipType;
      start_date: string | null;
      end_date: string | null;
      place: string | null;
      notes: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      person_a_id: string;
      person_b_id: string;
      partnership_type?: PartnershipType;
      start_date?: string | null;
      end_date?: string | null;
      place?: string | null;
      notes?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      person_a_id?: string;
      person_b_id?: string;
      partnership_type?: PartnershipType;
      start_date?: string | null;
      end_date?: string | null;
      place?: string | null;
      notes?: string | null;
      created_at?: string;
    };
  };
};

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
  audit: {
    Tables: GenealogyTables;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
