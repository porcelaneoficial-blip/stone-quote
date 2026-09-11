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
      audit_log: {
        Row: {
          changed_by_id: string | null
          changed_by_name: string | null
          created_at: string
          description: string | null
          entity_id: string
          entity_type: string
          field: string | null
          id: string
          kind: string
          new_value: Json | null
          old_value: Json | null
          user_id: string
        }
        Insert: {
          changed_by_id?: string | null
          changed_by_name?: string | null
          created_at?: string
          description?: string | null
          entity_id: string
          entity_type: string
          field?: string | null
          id?: string
          kind: string
          new_value?: Json | null
          old_value?: Json | null
          user_id: string
        }
        Update: {
          changed_by_id?: string | null
          changed_by_name?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string
          entity_type?: string
          field?: string | null
          id?: string
          kind?: string
          new_value?: Json | null
          old_value?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      authorized_emails: {
        Row: {
          active: boolean
          allowed_modules: string[]
          cpf: string | null
          created_at: string
          email: string
          name: string | null
          role: string
          seller_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          allowed_modules?: string[]
          cpf?: string | null
          created_at?: string
          email: string
          name?: string | null
          role?: string
          seller_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          allowed_modules?: string[]
          cpf?: string | null
          created_at?: string
          email?: string
          name?: string | null
          role?: string
          seller_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "authorized_emails_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_snapshots: {
        Row: {
          created_at: string
          id: string
          storage_path: string
          tables: Json
          total_rows: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          storage_path: string
          tables?: Json
          total_rows?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          storage_path?: string
          tables?: Json
          total_rows?: number
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          active: boolean
          address: string | null
          cep: string | null
          city: string | null
          created_at: string
          doc: string | null
          email: string | null
          id: string
          name: string
          neighborhood: string | null
          notes: string | null
          phone: string | null
          site_address: string | null
          site_cep: string | null
          site_city: string | null
          site_complement: string | null
          site_neighborhood: string | null
          site_number: string | null
          site_reference: string | null
          site_same_as_client: boolean
          site_state: string | null
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          cep?: string | null
          city?: string | null
          created_at?: string
          doc?: string | null
          email?: string | null
          id?: string
          name: string
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          site_address?: string | null
          site_cep?: string | null
          site_city?: string | null
          site_complement?: string | null
          site_neighborhood?: string | null
          site_number?: string | null
          site_reference?: string | null
          site_same_as_client?: boolean
          site_state?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          address?: string | null
          cep?: string | null
          city?: string | null
          created_at?: string
          doc?: string | null
          email?: string | null
          id?: string
          name?: string
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          site_address?: string | null
          site_cep?: string | null
          site_city?: string | null
          site_complement?: string | null
          site_neighborhood?: string | null
          site_number?: string | null
          site_reference?: string | null
          site_same_as_client?: boolean
          site_state?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      commission_payees: {
        Row: {
          account_holder: string | null
          active: boolean
          bank_account: string | null
          bank_agency: string | null
          bank_name: string | null
          created_at: string
          doc: string | null
          email: string | null
          id: string
          kind: string
          name: string
          notes: string | null
          phone: string | null
          pix_key: string | null
          pix_key_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_holder?: string | null
          active?: boolean
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          created_at?: string
          doc?: string | null
          email?: string | null
          id?: string
          kind?: string
          name: string
          notes?: string | null
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_holder?: string | null
          active?: boolean
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          created_at?: string
          doc?: string | null
          email?: string | null
          id?: string
          kind?: string
          name?: string
          notes?: string | null
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      commission_rules: {
        Row: {
          active: boolean
          created_at: string
          id: string
          max_value: number | null
          min_value: number
          percent: number
          scope: string
          seller_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          max_value?: number | null
          min_value?: number
          percent?: number
          scope: string
          seller_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          max_value?: number | null
          min_value?: number
          percent?: number
          scope?: string
          seller_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_rules_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          amount: number
          base_value: number
          beneficiary_name: string
          created_at: string
          id: string
          notes: string
          order_id: string | null
          paid_at: string | null
          paid_method: string | null
          percent: number
          receipt_path: string | null
          scope: string
          seller_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          base_value?: number
          beneficiary_name?: string
          created_at?: string
          id?: string
          notes?: string
          order_id?: string | null
          paid_at?: string | null
          paid_method?: string | null
          percent?: number
          receipt_path?: string | null
          scope?: string
          seller_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          base_value?: number
          beneficiary_name?: string
          created_at?: string
          id?: string
          notes?: string
          order_id?: string | null
          paid_at?: string | null
          paid_method?: string | null
          percent?: number
          receipt_path?: string | null
          scope?: string
          seller_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          cep: string | null
          cnpj: string | null
          company_name: string | null
          created_at: string
          default_beneficiamento: number
          default_coleta: number
          default_prazo_dias: number
          default_validity_days: number | null
          default_waste_pct: number
          email: string | null
          inscricao_estadual: string | null
          instagram: string | null
          logo_url: string | null
          neighborhood: string | null
          phone: string | null
          pix_beneficiary_name: string | null
          pix_city: string | null
          pix_key: string | null
          quote_terms: string | null
          razao_social: string | null
          updated_at: string
          user_id: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          cep?: string | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string
          default_beneficiamento?: number
          default_coleta?: number
          default_prazo_dias?: number
          default_validity_days?: number | null
          default_waste_pct?: number
          email?: string | null
          inscricao_estadual?: string | null
          instagram?: string | null
          logo_url?: string | null
          neighborhood?: string | null
          phone?: string | null
          pix_beneficiary_name?: string | null
          pix_city?: string | null
          pix_key?: string | null
          quote_terms?: string | null
          razao_social?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          cep?: string | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string
          default_beneficiamento?: number
          default_coleta?: number
          default_prazo_dias?: number
          default_validity_days?: number | null
          default_waste_pct?: number
          email?: string | null
          inscricao_estadual?: string | null
          instagram?: string | null
          logo_url?: string | null
          neighborhood?: string | null
          phone?: string | null
          pix_beneficiary_name?: string | null
          pix_city?: string | null
          pix_key?: string | null
          quote_terms?: string | null
          razao_social?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      employee_documents: {
        Row: {
          created_at: string
          employee_id: string
          file_url: string | null
          id: string
          kind: string
          notes: string | null
          reference_date: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          file_url?: string | null
          id?: string
          kind?: string
          notes?: string | null
          reference_date?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          file_url?: string | null
          id?: string
          kind?: string
          notes?: string | null
          reference_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean
          bank_info: Json | null
          base_salary: number
          commission_type: string
          commission_value: number
          cpf: string | null
          created_at: string
          custom_password: string | null
          email: string | null
          hire_date: string | null
          id: string
          login: string | null
          name: string
          notes: string | null
          phone: string | null
          pin: string | null
          pix_key: string | null
          productivity_type: string
          productivity_value: number
          role: Database["public"]["Enums"]["employee_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          bank_info?: Json | null
          base_salary?: number
          commission_type?: string
          commission_value?: number
          cpf?: string | null
          created_at?: string
          custom_password?: string | null
          email?: string | null
          hire_date?: string | null
          id?: string
          login?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          pin?: string | null
          pix_key?: string | null
          productivity_type?: string
          productivity_value?: number
          role: Database["public"]["Enums"]["employee_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          bank_info?: Json | null
          base_salary?: number
          commission_type?: string
          commission_value?: number
          cpf?: string | null
          created_at?: string
          custom_password?: string | null
          email?: string | null
          hire_date?: string | null
          id?: string
          login?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          pin?: string | null
          pix_key?: string | null
          productivity_type?: string
          productivity_value?: number
          role?: Database["public"]["Enums"]["employee_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      finish_types: {
        Row: {
          active: boolean
          color: string
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          color?: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          color?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      installation_photos: {
        Row: {
          created_at: string
          description: string | null
          id: string
          order_id: string
          uploaded_by_name: string | null
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          order_id: string
          uploaded_by_name?: string | null
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string
          uploaded_by_name?: string | null
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installation_photos_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      library_finish_measures: {
        Row: {
          created_at: string
          finish_id: string
          id: string
          name: string
          notes: string | null
          position: number
          unit: string
          updated_at: string
          user_id: string
          value: number | null
        }
        Insert: {
          created_at?: string
          finish_id: string
          id?: string
          name: string
          notes?: string | null
          position?: number
          unit?: string
          updated_at?: string
          user_id: string
          value?: number | null
        }
        Update: {
          created_at?: string
          finish_id?: string
          id?: string
          name?: string
          notes?: string | null
          position?: number
          unit?: string
          updated_at?: string
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "library_finish_measures_finish_id_fkey"
            columns: ["finish_id"]
            isOneToOne: false
            referencedRelation: "library_finishes"
            referencedColumns: ["id"]
          },
        ]
      }
      library_finish_versions: {
        Row: {
          created_at: string
          finish_id: string
          id: string
          snapshot: Json
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          finish_id: string
          id?: string
          snapshot?: Json
          user_id: string
          version: number
        }
        Update: {
          created_at?: string
          finish_id?: string
          id?: string
          snapshot?: Json
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "library_finish_versions_finish_id_fkey"
            columns: ["finish_id"]
            isOneToOne: false
            referencedRelation: "library_finishes"
            referencedColumns: ["id"]
          },
        ]
      }
      library_finish_views: {
        Row: {
          created_at: string
          finish_id: string
          id: string
          image_url: string | null
          notes: string | null
          position: number
          storage_path: string | null
          title: string | null
          updated_at: string
          user_id: string
          view_type: string
        }
        Insert: {
          created_at?: string
          finish_id: string
          id?: string
          image_url?: string | null
          notes?: string | null
          position?: number
          storage_path?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          view_type?: string
        }
        Update: {
          created_at?: string
          finish_id?: string
          id?: string
          image_url?: string | null
          notes?: string | null
          position?: number
          storage_path?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          view_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_finish_views_finish_id_fkey"
            columns: ["finish_id"]
            isOneToOne: false
            referencedRelation: "library_finishes"
            referencedColumns: ["id"]
          },
        ]
      }
      library_finishes: {
        Row: {
          active: boolean
          category: string
          code: string | null
          created_at: string
          description: string | null
          drawing_svg: string | null
          id: string
          image_url: string | null
          manufacturer: string | null
          name: string
          notes: string | null
          params: Json
          plan_svg: string | null
          subcategory: string | null
          template: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          active?: boolean
          category: string
          code?: string | null
          created_at?: string
          description?: string | null
          drawing_svg?: string | null
          id?: string
          image_url?: string | null
          manufacturer?: string | null
          name: string
          notes?: string | null
          params?: Json
          plan_svg?: string | null
          subcategory?: string | null
          template?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          active?: boolean
          category?: string
          code?: string | null
          created_at?: string
          description?: string | null
          drawing_svg?: string | null
          id?: string
          image_url?: string | null
          manufacturer?: string | null
          name?: string
          notes?: string | null
          params?: Json
          plan_svg?: string | null
          subcategory?: string | null
          template?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      library_objects: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          height_cm: number
          id: string
          image_url: string | null
          kind: string
          length_cm: number
          model_url: string | null
          name: string
          notes: string | null
          subkind: string | null
          updated_at: string
          user_id: string
          width_cm: number
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          height_cm?: number
          id?: string
          image_url?: string | null
          kind: string
          length_cm?: number
          model_url?: string | null
          name: string
          notes?: string | null
          subkind?: string | null
          updated_at?: string
          user_id: string
          width_cm?: number
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          height_cm?: number
          id?: string
          image_url?: string | null
          kind?: string
          length_cm?: number
          model_url?: string | null
          name?: string
          notes?: string | null
          subkind?: string | null
          updated_at?: string
          user_id?: string
          width_cm?: number
        }
        Relationships: []
      }
      library_textures: {
        Row: {
          active: boolean
          category: string
          created_at: string
          id: string
          material_id: string | null
          name: string
          prompt: string | null
          storage_path: string | null
          texture_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          id?: string
          material_id?: string | null
          name: string
          prompt?: string | null
          storage_path?: string | null
          texture_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          id?: string
          material_id?: string | null
          name?: string
          prompt?: string | null
          storage_path?: string | null
          texture_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_textures_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_romaneios: {
        Row: {
          address: string
          architect: string
          city: string
          client_name: string
          client_phone: string
          created_at: string
          id: string
          items: Json
          notes: string
          number: number
          order_id: string | null
          receiver_name: string | null
          receiver_signature: string | null
          receiver_signed_at: string | null
          romaneio_date: string
          salesperson: string
          supplies: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string
          architect?: string
          city?: string
          client_name?: string
          client_phone?: string
          created_at?: string
          id?: string
          items?: Json
          notes?: string
          number?: number
          order_id?: string | null
          receiver_name?: string | null
          receiver_signature?: string | null
          receiver_signed_at?: string | null
          romaneio_date?: string
          salesperson?: string
          supplies?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          architect?: string
          city?: string
          client_name?: string
          client_phone?: string
          created_at?: string
          id?: string
          items?: Json
          notes?: string
          number?: number
          order_id?: string | null
          receiver_name?: string | null
          receiver_signature?: string | null
          receiver_signed_at?: string | null
          romaneio_date?: string
          salesperson?: string
          supplies?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_romaneios_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          active: boolean
          category: string
          created_at: string
          finish: string | null
          id: string
          indication: string | null
          name: string
          porosity: string | null
          price_m2: number
          texture_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          finish?: string | null
          id?: string
          indication?: string | null
          name: string
          porosity?: string | null
          price_m2?: number
          texture_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          finish?: string | null
          id?: string
          indication?: string | null
          name?: string
          porosity?: string | null
          price_m2?: number
          texture_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      measurements: {
        Row: {
          address: string | null
          client_name: string | null
          created_at: string
          id: string
          notes: string | null
          order_id: string | null
          scheduled_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          client_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          scheduled_at: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          client_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          scheduled_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "measurements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_attachments: {
        Row: {
          client_visible: boolean
          created_at: string
          id: string
          kind: string
          mime_type: string | null
          name: string
          order_id: string
          size_bytes: number | null
          storage_path: string
          user_id: string
        }
        Insert: {
          client_visible?: boolean
          created_at?: string
          id?: string
          kind?: string
          mime_type?: string | null
          name: string
          order_id: string
          size_bytes?: number | null
          storage_path: string
          user_id: string
        }
        Update: {
          client_visible?: boolean
          created_at?: string
          id?: string
          kind?: string
          mime_type?: string | null
          name?: string
          order_id?: string
          size_bytes?: number | null
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_attachments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_revisions: {
        Row: {
          changes: Json
          created_at: string
          created_by_name: string | null
          data: Json
          id: string
          kind: string
          order_id: string
          reason: string | null
          seq: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          changes?: Json
          created_at?: string
          created_by_name?: string | null
          data?: Json
          id?: string
          kind?: string
          order_id: string
          reason?: string | null
          seq?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          changes?: Json
          created_at?: string
          created_by_name?: string | null
          data?: Json
          id?: string
          kind?: string
          order_id?: string
          reason?: string | null
          seq?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_revisions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          order_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          approved_at: string | null
          approved_snapshot: Json | null
          approved_total: number | null
          client_name: string | null
          commercial_locked: boolean
          commission_locked: boolean
          created_at: string
          data: Json
          delivery_kind: string | null
          diretoria_autorizado_at: string | null
          diretoria_autorizado_by: string | null
          id: string
          is_direct: boolean
          number: number
          quote_id: string | null
          received: number | null
          receiver_name: string | null
          receiver_signature: string | null
          receiver_signed_at: string | null
          status: string
          total: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_snapshot?: Json | null
          approved_total?: number | null
          client_name?: string | null
          commercial_locked?: boolean
          commission_locked?: boolean
          created_at?: string
          data?: Json
          delivery_kind?: string | null
          diretoria_autorizado_at?: string | null
          diretoria_autorizado_by?: string | null
          id?: string
          is_direct?: boolean
          number: number
          quote_id?: string | null
          received?: number | null
          receiver_name?: string | null
          receiver_signature?: string | null
          receiver_signed_at?: string | null
          status?: string
          total?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_snapshot?: Json | null
          approved_total?: number | null
          client_name?: string | null
          commercial_locked?: boolean
          commission_locked?: boolean
          created_at?: string
          data?: Json
          delivery_kind?: string | null
          diretoria_autorizado_at?: string | null
          diretoria_autorizado_by?: string | null
          id?: string
          is_direct?: boolean
          number?: number
          quote_id?: string | null
          received?: number | null
          receiver_name?: string | null
          receiver_signature?: string | null
          receiver_signed_at?: string | null
          status?: string
          total?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          active: boolean
          commission_type: string
          commission_value: number
          created_at: string
          document: string | null
          email: string | null
          id: string
          kind: string
          name: string
          notes: string | null
          phone: string | null
          pix_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          commission_type?: string
          commission_value?: number
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          kind?: string
          name: string
          notes?: string | null
          phone?: string | null
          pix_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          commission_type?: string
          commission_value?: number
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          kind?: string
          name?: string
          notes?: string | null
          phone?: string | null
          pix_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payables: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string
          due_date: string
          id: string
          method: string | null
          notes: string
          paid_amount: number
          paid_at: string | null
          receipt_path: string | null
          status: string
          supplier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          description?: string
          due_date: string
          id?: string
          method?: string | null
          notes?: string
          paid_amount?: number
          paid_at?: string | null
          receipt_path?: string | null
          status?: string
          supplier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          method?: string | null
          notes?: string
          paid_amount?: number
          paid_at?: string | null
          receipt_path?: string | null
          status?: string
          supplier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payslips: {
        Row: {
          base_salary: number
          breakdown: Json
          commissions_total: number
          created_at: string
          deductions: number
          employee_id: string
          extras: number
          id: string
          includes_productivity: boolean
          net_total: number
          paid_at: string | null
          payable_id: string | null
          reference_month: number
          reference_year: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_salary?: number
          breakdown?: Json
          commissions_total?: number
          created_at?: string
          deductions?: number
          employee_id: string
          extras?: number
          id?: string
          includes_productivity?: boolean
          net_total?: number
          paid_at?: string | null
          payable_id?: string | null
          reference_month: number
          reference_year: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_salary?: number
          breakdown?: Json
          commissions_total?: number
          created_at?: string
          deductions?: number
          employee_id?: string
          extras?: number
          id?: string
          includes_productivity?: boolean
          net_total?: number
          paid_at?: string | null
          payable_id?: string | null
          reference_month?: number
          reference_year?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      productivity_config: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["employee_role"]
          type: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["employee_role"]
          type?: string
          updated_at?: string
          user_id: string
          value?: number
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["employee_role"]
          type?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      productivity_entries: {
        Row: {
          base_value: number | null
          commission_value: number
          created_at: string
          discount_pct: number | null
          employee_id: string
          env_id: string
          env_material: string | null
          env_name: string | null
          gross_value: number | null
          id: string
          kind: string
          notes: string | null
          order_id: string
          paid_at: string | null
          payout_status: string
          service_id: string | null
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          base_value?: number | null
          commission_value?: number
          created_at?: string
          discount_pct?: number | null
          employee_id: string
          env_id: string
          env_material?: string | null
          env_name?: string | null
          gross_value?: number | null
          id?: string
          kind: string
          notes?: string | null
          order_id: string
          paid_at?: string | null
          payout_status?: string
          service_id?: string | null
          updated_at?: string
          user_id: string
          value?: number
        }
        Update: {
          base_value?: number | null
          commission_value?: number
          created_at?: string
          discount_pct?: number | null
          employee_id?: string
          env_id?: string
          env_material?: string | null
          env_name?: string | null
          gross_value?: number | null
          id?: string
          kind?: string
          notes?: string | null
          order_id?: string
          paid_at?: string | null
          payout_status?: string
          service_id?: string | null
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "productivity_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productivity_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productivity_entries_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "productivity_services"
            referencedColumns: ["id"]
          },
        ]
      }
      productivity_services: {
        Row: {
          active: boolean
          applies_to: string
          created_at: string
          id: string
          material_type: string | null
          name: string
          notes: string | null
          pricing_kind: string
          unit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          applies_to: string
          created_at?: string
          id?: string
          material_type?: string | null
          name: string
          notes?: string | null
          pricing_kind?: string
          unit_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          applies_to?: string
          created_at?: string
          id?: string
          material_type?: string | null
          name?: string
          notes?: string | null
          pricing_kind?: string
          unit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      quote_attachments: {
        Row: {
          created_at: string
          id: string
          mime_type: string | null
          name: string
          quote_id: string
          size_bytes: number | null
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type?: string | null
          name: string
          quote_id: string
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string | null
          name?: string
          quote_id?: string
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_attachments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          additive_of_order_id: string | null
          additive_seq: number | null
          client_name: string | null
          created_at: string
          data: Json
          id: string
          number: number
          status: string
          total: number | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          additive_of_order_id?: string | null
          additive_seq?: number | null
          client_name?: string | null
          created_at?: string
          data?: Json
          id?: string
          number: number
          status?: string
          total?: number | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          additive_of_order_id?: string | null
          additive_seq?: number | null
          client_name?: string | null
          created_at?: string
          data?: Json
          id?: string
          number?: number
          status?: string
          total?: number | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_additive_of_order_id_fkey"
            columns: ["additive_of_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      receivables: {
        Row: {
          amount: number
          client_name: string
          created_at: string
          description: string
          due_date: string
          id: string
          installment_no: number
          installment_total: number
          method: string | null
          notes: string
          order_id: string | null
          paid_amount: number
          paid_at: string | null
          pix_txid: string | null
          receipt_path: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          client_name?: string
          created_at?: string
          description?: string
          due_date: string
          id?: string
          installment_no?: number
          installment_total?: number
          method?: string | null
          notes?: string
          order_id?: string | null
          paid_amount?: number
          paid_at?: string | null
          pix_txid?: string | null
          receipt_path?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          client_name?: string
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          installment_no?: number
          installment_total?: number
          method?: string | null
          notes?: string
          order_id?: string | null
          paid_amount?: number
          paid_at?: string | null
          pix_txid?: string | null
          receipt_path?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivables_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      remuneration_params: {
        Row: {
          finisher_percent: number
          note_cut_m2: number
          note_finish_m2: number
          updated_at: string
          user_id: string
          value_per_m2: number
          value_special: number
        }
        Insert: {
          finisher_percent?: number
          note_cut_m2?: number
          note_finish_m2?: number
          updated_at?: string
          user_id: string
          value_per_m2?: number
          value_special?: number
        }
        Update: {
          finisher_percent?: number
          note_cut_m2?: number
          note_finish_m2?: number
          updated_at?: string
          user_id?: string
          value_per_m2?: number
          value_special?: number
        }
        Relationships: []
      }
      sellers: {
        Row: {
          active: boolean
          commission_pct: number
          created_at: string
          id: string
          kind: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          commission_pct?: number
          created_at?: string
          id?: string
          kind?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          commission_pct?: number
          created_at?: string
          id?: string
          kind?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          pays_production: boolean
          price: number
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          pays_production?: boolean
          price?: number
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          pays_production?: boolean
          price?: number
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      supplies: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          price: number
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          price?: number
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          price?: number
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tech_documents: {
        Row: {
          created_at: string
          created_by_name: string | null
          env_id: string
          env_name: string | null
          id: string
          kind: string
          notes: string | null
          order_id: string
          order_number: number | null
          pdf_path: string | null
          responsible: string | null
          snapshot: Json
          status: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by_name?: string | null
          env_id: string
          env_name?: string | null
          id?: string
          kind: string
          notes?: string | null
          order_id: string
          order_number?: number | null
          pdf_path?: string | null
          responsible?: string | null
          snapshot?: Json
          status?: string
          updated_at?: string
          user_id: string
          version: number
        }
        Update: {
          created_at?: string
          created_by_name?: string | null
          env_id?: string
          env_name?: string | null
          id?: string
          kind?: string
          notes?: string | null
          order_id?: string
          order_number?: number | null
          pdf_path?: string | null
          responsible?: string | null
          snapshot?: Json
          status?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "tech_documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      tech_measurers: {
        Row: {
          active: boolean
          commission_pct: number
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          commission_pct?: number
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          commission_pct?: number
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      terms_clauses: {
        Row: {
          active: boolean
          content: string
          created_at: string
          id: string
          position: number
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          content: string
          created_at?: string
          id?: string
          position?: number
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          content?: string
          created_at?: string
          id?: string
          position?: number
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          accuracy: number | null
          address: string | null
          created_at: string
          employee_id: string
          id: string
          kind: string
          lat: number | null
          lng: number | null
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          address?: string | null
          created_at?: string
          employee_id: string
          id?: string
          kind: string
          lat?: number | null
          lng?: number | null
          user_id: string
        }
        Update: {
          accuracy?: number | null
          address?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          kind?: string
          lat?: number | null
          lng?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      trello_integrations: {
        Row: {
          card_id: string | null
          card_url: string | null
          created_at: string
          documents: Json
          entered_installation_at: string | null
          error: string | null
          id: string
          order_id: string
          order_number: number | null
          sent_at: string | null
          status: string
          trello_list_id: string | null
          triggered_by_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          card_id?: string | null
          card_url?: string | null
          created_at?: string
          documents?: Json
          entered_installation_at?: string | null
          error?: string | null
          id?: string
          order_id: string
          order_number?: number | null
          sent_at?: string | null
          status?: string
          trello_list_id?: string | null
          triggered_by_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          card_id?: string | null
          card_url?: string | null
          created_at?: string
          documents?: Json
          entered_installation_at?: string | null
          error?: string | null
          id?: string
          order_id?: string
          order_number?: number | null
          sent_at?: string | null
          status?: string
          trello_list_id?: string | null
          triggered_by_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trello_integrations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_module_permissions: {
        Row: {
          allowed: boolean
          created_at: string
          id: string
          module: string
          target_user_id: string
          updated_at: string
        }
        Insert: {
          allowed?: boolean
          created_at?: string
          id?: string
          module: string
          target_user_id: string
          updated_at?: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          id?: string
          module?: string
          target_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          target_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
      value_change_log: {
        Row: {
          changed_by: string
          changed_by_name: string | null
          created_at: string
          entity_id: string
          entity_type: string
          field_label: string | null
          field_path: string
          id: string
          new_value: number | null
          old_value: number | null
          reason: string | null
          user_id: string
        }
        Insert: {
          changed_by: string
          changed_by_name?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          field_label?: string | null
          field_path: string
          id?: string
          new_value?: number | null
          old_value?: number | null
          reason?: string | null
          user_id: string
        }
        Update: {
          changed_by?: string
          changed_by_name?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          field_label?: string | null
          field_path?: string
          id?: string
          new_value?: number | null
          old_value?: number | null
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _compute_env_value_and_commission: {
        Args: { p_discount_pct?: number; p_kind: string; v_env: Json }
        Returns: Record<string, unknown>
      }
      _order_discount_pct: { Args: { v_data: Json }; Returns: number }
      admin_create_user: {
        Args: {
          p_name: string
          p_password: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_username: string
        }
        Returns: string
      }
      employee_add_document_cpf: {
        Args: {
          p_cpf: string
          p_file_url: string
          p_kind: string
          p_notes?: string
          p_password: string
          p_reference_date?: string
          p_title: string
        }
        Returns: string
      }
      employee_add_productivity: {
        Args: {
          p_env_id: string
          p_kind: string
          p_login: string
          p_order_id: string
          p_pin: string
        }
        Returns: string
      }
      employee_add_productivity_cpf: {
        Args: {
          p_cpf: string
          p_env_id: string
          p_kind: string
          p_order_id: string
          p_password: string
        }
        Returns: string
      }
      employee_add_productivity_pin: {
        Args: {
          p_env_id: string
          p_kind: string
          p_order_id: string
          p_pin: string
          p_role: Database["public"]["Enums"]["employee_role"]
        }
        Returns: string
      }
      employee_auth: {
        Args: { p_login: string; p_pin: string }
        Returns: {
          id: string
          name: string
          productivity_type: string
          productivity_value: number
          role: Database["public"]["Enums"]["employee_role"]
          user_id: string
        }[]
      }
      employee_auth_pin: {
        Args: {
          p_pin: string
          p_role: Database["public"]["Enums"]["employee_role"]
        }
        Returns: {
          id: string
          name: string
          role: Database["public"]["Enums"]["employee_role"]
          user_id: string
        }[]
      }
      employee_clock_cpf: {
        Args: {
          p_accuracy?: number
          p_address?: string
          p_cpf: string
          p_kind: string
          p_lat?: number
          p_lng?: number
          p_password: string
        }
        Returns: string
      }
      employee_find_order: {
        Args: { p_login: string; p_number: number; p_pin: string }
        Returns: {
          client_name: string
          data: Json
          number: number
          order_id: string
        }[]
      }
      employee_find_order_cpf: {
        Args: { p_cpf: string; p_number: number; p_password: string }
        Returns: {
          client_name: string
          data: Json
          number: number
          order_id: string
        }[]
      }
      employee_find_order_pin: {
        Args: {
          p_number: number
          p_pin: string
          p_role: Database["public"]["Enums"]["employee_role"]
        }
        Returns: {
          client_name: string
          data: Json
          number: number
          order_id: string
        }[]
      }
      employee_get_productivity: {
        Args: { p_from: string; p_login: string; p_pin: string; p_to: string }
        Returns: {
          client_name: string
          commission_value: number
          created_at: string
          env_material: string
          env_name: string
          id: string
          kind: string
          order_id: string
          order_number: number
          value: number
        }[]
      }
      employee_get_productivity_pin: {
        Args: {
          p_from: string
          p_pin: string
          p_role: Database["public"]["Enums"]["employee_role"]
          p_to: string
        }
        Returns: {
          client_name: string
          commission_value: number
          created_at: string
          env_material: string
          env_name: string
          id: string
          kind: string
          order_id: string
          order_number: number
          value: number
        }[]
      }
      employee_list_available_orders_cpf: {
        Args: { p_cpf: string; p_password: string }
        Returns: {
          client_name: string
          data: Json
          env_count: number
          number: number
          order_id: string
          updated_at: string
        }[]
      }
      employee_list_documents_cpf: {
        Args: { p_cpf: string; p_password: string }
        Returns: {
          created_at: string
          file_url: string
          id: string
          kind: string
          notes: string
          reference_date: string
          status: string
          title: string
        }[]
      }
      employee_list_payslips_cpf: {
        Args: { p_cpf: string; p_password: string }
        Returns: {
          base_salary: number
          breakdown: Json
          commissions_total: number
          created_at: string
          deductions: number
          extras: number
          id: string
          net_total: number
          paid_at: string
          reference_month: number
          reference_year: number
          status: string
        }[]
      }
      employee_list_time_entries_cpf: {
        Args: {
          p_cpf: string
          p_from: string
          p_password: string
          p_to: string
        }
        Returns: {
          accuracy: number
          address: string
          created_at: string
          id: string
          kind: string
          lat: number
          lng: number
        }[]
      }
      employee_login_cpf: {
        Args: { p_cpf: string; p_password: string }
        Returns: {
          id: string
          name: string
          role: Database["public"]["Enums"]["employee_role"]
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      login_by_cpf: {
        Args: { p_cpf: string }
        Returns: {
          email: string
          employee_id: string
          modules: Json
          name: string
          role: string
          seller_id: string
          source: string
          user_id: string
        }[]
      }
      manager_list_production: {
        Args: { p_cpf: string; p_password: string }
        Returns: {
          client_name: string
          data: Json
          number: number
          order_id: string
          status: string
          updated_at: string
        }[]
      }
      manager_list_team_productivity: {
        Args: {
          p_cpf: string
          p_from: string
          p_password: string
          p_to: string
        }
        Returns: {
          acab_commission: number
          acab_value: number
          corte_commission: number
          corte_m2: number
          employee_id: string
          employee_name: string
          role: Database["public"]["Enums"]["employee_role"]
          total_commission: number
        }[]
      }
      mark_productivity_paid: { Args: { p_ids: string[] }; Returns: number }
      next_additive_seq: { Args: { _order_id: string }; Returns: number }
      norm_company_pw: { Args: { p: string }; Returns: string }
      norm_cpf: { Args: { p: string }; Returns: string }
      rh_generate_payroll: {
        Args: { p_month: number; p_year: number }
        Returns: {
          employee_id: string
          employee_name: string
          net_total: number
          payable_id: string
        }[]
      }
      seed_user_catalog: { Args: { _user_id: string }; Returns: undefined }
      unaccent: { Args: { "": string }; Returns: string }
      username_to_email: { Args: { p_username: string }; Returns: string }
    }
    Enums: {
      app_role:
        | "admin"
        | "producao"
        | "vendedor"
        | "vendas"
        | "supervisor"
        | "cortador"
        | "acabador"
        | "parceiro"
      employee_role:
        | "tecnico"
        | "corte"
        | "acabamento"
        | "expedicao"
        | "instalador"
        | "administrativo"
        | "gerente_producao"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "admin",
        "producao",
        "vendedor",
        "vendas",
        "supervisor",
        "cortador",
        "acabador",
        "parceiro",
      ],
      employee_role: [
        "tecnico",
        "corte",
        "acabamento",
        "expedicao",
        "instalador",
        "administrativo",
        "gerente_producao",
      ],
    },
  },
} as const
