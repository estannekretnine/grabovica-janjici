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
      drzavaid: number | null;
      opstinaid: number | null;
      lokacijaid: number | null;
      drzavaidrodio: number | null;
      opstinaidrodio: number | null;
      lokacijaidrodio: number | null;
      email: string | null;
      mob1: string | null;
      mob2: string | null;
      karijera: string | null;
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
      drzavaid?: number | null;
      opstinaid?: number | null;
      lokacijaid?: number | null;
      drzavaidrodio?: number | null;
      opstinaidrodio?: number | null;
      lokacijaidrodio?: number | null;
      email?: string | null;
      mob1?: string | null;
      mob2?: string | null;
      karijera?: string | null;
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
      drzavaid?: number | null;
      opstinaid?: number | null;
      lokacijaid?: number | null;
      drzavaidrodio?: number | null;
      opstinaidrodio?: number | null;
      lokacijaidrodio?: number | null;
      email?: string | null;
      mob1?: string | null;
      mob2?: string | null;
      karijera?: string | null;
    };
  };
  gr_aktivnosti: {
    Row: {
      id: string;
      person_id: string;
      naslov: string;
      opis: string | null;
      datum: string | null;
      veb_link: string | null;
      foto_storage_path: string | null;
      redosled: number;
      napomena: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      person_id: string;
      naslov?: string;
      opis?: string | null;
      datum?: string | null;
      veb_link?: string | null;
      foto_storage_path?: string | null;
      redosled?: number;
      napomena?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      person_id?: string;
      naslov?: string;
      opis?: string | null;
      datum?: string | null;
      veb_link?: string | null;
      foto_storage_path?: string | null;
      redosled?: number;
      napomena?: string | null;
      created_at?: string;
      updated_at?: string;
    };
  };
  klijenti: {
    Row: {
      id: number;
      ime: string | null;
      prezime: string | null;
      firma: string | null;
      email: string | null;
      kontakt: string | null;
      datumupisa: string | null;
      datumpromene: string | null;
      opis: string | null;
      stsarhiviran: boolean | null;
      stsinvestitoraudit: boolean | null;
      source: string | null;
      contactid: string | null;
    };
    Insert: {
      id?: number;
      ime?: string | null;
      prezime?: string | null;
      firma?: string | null;
      email?: string | null;
      kontakt?: string | null;
      datumupisa?: string | null;
      datumpromene?: string | null;
      opis?: string | null;
      stsarhiviran?: boolean | null;
      stsinvestitoraudit?: boolean | null;
      source?: string | null;
      contactid?: string | null;
    };
    Update: {
      id?: number;
      ime?: string | null;
      prezime?: string | null;
      firma?: string | null;
      email?: string | null;
      kontakt?: string | null;
      datumupisa?: string | null;
      datumpromene?: string | null;
      opis?: string | null;
      stsarhiviran?: boolean | null;
      stsinvestitoraudit?: boolean | null;
      source?: string | null;
      contactid?: string | null;
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
  gr_countries: {
    Row: {
      id: string;
      name: string;
      code: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      name: string;
      code?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      name?: string;
      code?: string | null;
      created_at?: string;
    };
  };
  gr_municipalities: {
    Row: {
      id: string;
      country_id: string;
      name: string;
      created_at: string;
    };
    Insert: {
      id?: string;
      country_id: string;
      name: string;
      created_at?: string;
    };
    Update: {
      id?: string;
      country_id?: string;
      name?: string;
      created_at?: string;
    };
  };
  gr_locations: {
    Row: {
      id: string;
      municipality_id: string;
      name: string;
      address: string | null;
      lat: number | null;
      lng: number | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      municipality_id: string;
      name: string;
      address?: string | null;
      lat?: number | null;
      lng?: number | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      municipality_id?: string;
      name?: string;
      address?: string | null;
      lat?: number | null;
      lng?: number | null;
      created_at?: string;
    };
  };
  gr_site_sessions: {
    Row: {
      id: string;
      visitor_id: string;
      ip_address: string | null;
      country_code: string | null;
      country_name: string | null;
      user_agent: string | null;
      entry_path: string;
      current_path: string;
      pages_count: number;
      started_at: string;
      last_seen: string;
      ended_at: string | null;
    };
    Insert: {
      id?: string;
      visitor_id: string;
      ip_address?: string | null;
      country_code?: string | null;
      country_name?: string | null;
      user_agent?: string | null;
      entry_path: string;
      current_path: string;
      pages_count?: number;
      started_at?: string;
      last_seen?: string;
      ended_at?: string | null;
    };
    Update: {
      id?: string;
      visitor_id?: string;
      ip_address?: string | null;
      country_code?: string | null;
      country_name?: string | null;
      user_agent?: string | null;
      entry_path?: string;
      current_path?: string;
      pages_count?: number;
      started_at?: string;
      last_seen?: string;
      ended_at?: string | null;
    };
  };
  gr_site_page_views: {
    Row: {
      id: number;
      session_id: string;
      visitor_id: string;
      path: string;
      viewed_at: string;
      duration_seconds: number | null;
    };
    Insert: {
      id?: number;
      session_id: string;
      visitor_id: string;
      path: string;
      viewed_at?: string;
      duration_seconds?: number | null;
    };
    Update: {
      id?: number;
      session_id?: string;
      visitor_id?: string;
      path?: string;
      viewed_at?: string;
      duration_seconds?: number | null;
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
      get_public_home_person: {
        Args: Record<string, never>;
        Returns: Record<string, unknown> | null;
      };
      get_site_stats: {
        Args: Record<string, never>;
        Returns: {
          total_visits: number;
          currently_online: number;
        }[];
      };
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
