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

type KorisniciRow = {
  id: number;
  naziv: string;
  email: string | null;
  password: string | null;
  brojmob: string | null;
  stsstatus: string | null;
  stsaktivan: string | null;
  datumk: string | null;
  datump: string | null;
  datumpt: string | null;
  adresa: string | null;
};

export type Database = {
  public: {
    Tables: {
      korisnici: {
        Row: KorisniciRow;
        Insert: {
          id?: number;
          naziv: string;
          email?: string | null;
          password?: string | null;
          brojmob?: string | null;
          stsstatus?: string | null;
          stsaktivan?: string | null;
          datumk?: string | null;
          datump?: string | null;
          datumpt?: string | null;
          adresa?: string | null;
        };
        Update: Partial<Omit<KorisniciRow, "id">> & { id?: number };
      };
      drzava: {
        Row: {
          id: number;
          created_at: string;
          opis: string | null;
        };
        Insert: {
          id?: number;
          created_at?: string;
          opis?: string | null;
        };
        Update: {
          id?: number;
          created_at?: string;
          opis?: string | null;
        };
      };
      opstina: {
        Row: {
          id: number;
          created_at: string;
          opis: string | null;
          iddrzava: number | null;
        };
        Insert: {
          id?: number;
          created_at?: string;
          opis?: string | null;
          iddrzava?: number | null;
        };
        Update: {
          id?: number;
          created_at?: string;
          opis?: string | null;
          iddrzava?: number | null;
        };
      };
      lokacija: {
        Row: {
          id: number;
          created_at: string;
          opis: string | null;
          idopstina: number | null;
        };
        Insert: {
          id?: number;
          created_at?: string;
          opis?: string | null;
          idopstina?: number | null;
        };
        Update: {
          id?: number;
          created_at?: string;
          opis?: string | null;
          idopstina?: number | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      login_korisnik: {
        Args: { p_email: string; p_password: string };
        Returns: {
          id: number;
          naziv: string;
          email: string | null;
          stsstatus: string | null;
        }[];
      };
    };
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
