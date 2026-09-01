// frontend-react-ts/src/types/checklist.ts

export interface ChecklistItem {
  id: number;
  label: string;
  type: "boolean" | "text" | "number";
  required: boolean;
  critical_ok: boolean;
  help_text?: string;
  placeholder?: string;
  min_value?: number;
  max_value?: number;
}

// ==================== BY NAME TYPES ====================

export interface ChecklistByName {
  id: number;
  instrument_name: string;
  initial_items_count: number;
  final_items_count: number;
  require_all_initial_ok: boolean;
  require_all_final_ok: boolean;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChecklistByNameDetail {
  id: number;
  instrument_name: string;
  initial_checklist_items: ChecklistItem[];
  final_checklist_items: ChecklistItem[];
  require_all_initial_ok: boolean;
  require_all_final_ok: boolean;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InstrumentNameWithStatus {
  instrument_name: string;
  instrument_type: string;
  instrument_count: number;
  has_custom_checklist: boolean;
}

// ==================== INDIVIDUAL INSTRUMENT TYPES ====================

export interface InstrumentWithStatus {
  id: number;
  kode_instrument: string;
  nama: string;
  type: string;
  has_custom_checklist: boolean;
  initial_items_count?: number;
  final_items_count?: number;
}

export interface ConfigDetail {
  instrument_id: number;
  instrument_name: string;
  instrument_type: string;
  has_custom_config: boolean;
  initial_checklist_items: ChecklistItem[];
  final_checklist_items: ChecklistItem[];
  require_all_initial_ok: boolean;
  require_all_final_ok: boolean;
}

// ==================== REQUEST/RESPONSE TYPES ====================

export interface CreateChecklistByNameRequest {
  instrument_name: string;
  initial_checklist_items: ChecklistItem[];
  final_checklist_items: ChecklistItem[];
  require_all_initial_ok: boolean;
  require_all_final_ok: boolean;
  description: string;
}

export interface UpdateChecklistByNameRequest {
  configId: number;
  data: CreateChecklistByNameRequest;
}

export interface UpdateInstrumentChecklistConfigRequest {
  instrumentId: number;
  data: {
    initial_checklist_items?: ChecklistItem[];
    final_checklist_items?: ChecklistItem[];
    require_all_initial_ok?: boolean;
    require_all_final_ok?: boolean;
  };
}