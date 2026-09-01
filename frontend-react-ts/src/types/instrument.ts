export interface UISchemaField {
  field: string;
  label: string;
  input: "text" | "number" | "select" | "date";
  decimal?: number;
  options?: string[];
}

export interface InstrumentSchema {
  id: number;
  name: string;
  type: string;
  ui_schema: UISchemaField[];

  reader: {
    mode: "tcp" | "serial" | "file";
    interval_ms: number;
  };
}

export interface LiveDataResponse {
  raw: string;
  parsed: Record<string, any>;
}

export interface UnifiedHistoryItem {
  type: 'usage' | 'verification';
  id: number;
  timestamp: string;
  user: string;
  status: string;
  is_exported?: boolean;
  download_count?: number;
  valid_until?: string;
  room_temp?: number;
  room_humidity?: number;
  notes?: string;
}

// ✅ ADD: InstrumentConfig interface
export interface InstrumentConfig {
  id: number;
  
  // Serial Configuration
  baud_rate?: number;
  data_bits?: number;
  stop_bits?: number;
  parity?: string;
  com_port?: string;
  
  // TCP/IP Configuration
  ip_address?: string;
  tcp_port?: number;
  timeout?: number;
  
  // Data Processing
  regex_pattern?: string;
  
  // ✅ NEW: Multi-line support and filtering
  lines_per_item: number;          // Number of lines per measurement (default: 1)
  regex_filter_enabled: boolean;   // Reject non-matching data (default: false)
  
  // File Paths
  file_path?: string;
  file_path_2?: string;
  
  // Commands & Schema
  custom_commands?: string;
  read_command?: string;
  reading_mode?: string;
  needs_batch?: boolean;
  needs_sample?: boolean;
  reading_schema?: any;
  
  // PDF Configuration
  pdf_columns?: any;
}

// ✅ ADD: Instrument detail response
export interface InstrumentDetail {
  id: number;
  nama_instrument: string;
  nomor_kontrol: string;
  nomor_seri: string;
  nama_merk: string;
  type: string;
  lokasi_instrument: string;
  lokasi_site: string;
  status: string;
  tanggal_kalibrasi: string;
  ed_kalibrasi: string;
  kalibrasi_color_code: string;
  pic_instrument: {
    id: number;
    name: string;
  };
  massa_ant?: number;
  configuration?: InstrumentConfig;
  unified_history?: UnifiedHistoryItem[];
}

// Add these types to your existing instrument.ts file or create a new file

export type ResultStatus = "approved" | "pending" | "awaiting_approval" | "rejected";

export interface RereadRequest {
  batch_number: string;
  item_number?: number | null;
  reason: string;
  // REMOVED: supervisor_id - no longer needed
}

export interface ChangedItem {
  item_number: number;
  original_value: string;
  reread_value: string;
  difference?: number;
  original_status: string;
  reread_status: string;
  value_changed: boolean;
  status_changed: boolean;
  unit?: string;
}

export interface ComparisonData {
  has_changes: boolean;
  changed_items: ChangedItem[];
  original_final_condition: string;
  reread_final_condition: string;
  condition_changed: boolean;
}

export interface ReadingData {
  usage_id: number;
  read_at: string;
  final_condition: string;
  results: UsageResult[];
  user_name: string;
}

export interface PendingApproval {
  usage_id: number;
  instrument_id: number;
  instrument_name: string;
  instrument_code: string;
  user_name: string;
  user_id: number;
  reason: string;
  requested_at: string;
  submitted_at: string;
  completed_at?: string;        // may be absent
  batch_number: string;
  kategori_sampel: string;
  result_count: number;
  result_status: string;
  reread_type: "item" | "batch";
  item_number?: number;
  has_changes: boolean;
  changed_items: ChangedItem[];
  // ✅ Nested comparison data (populated by backend)
  original_reading?: {
    usage_id: number;
    read_at: string;
    user_name: string;
    final_condition: string;
    results: Array<{ item_number: number; value: string; unit?: string; status: string }>;
  };
  reread_result?: {
    usage_id: number;
    read_at: string;
    user_name: string;
    final_condition: string;
    results: Array<{ item_number: number; value: string; unit?: string; status: string }>;
  };
  comparison?: {
    has_changes: boolean;
    changed_items: ChangedItem[];
    condition_changed: boolean;
    original_final_condition?: string;
    reread_final_condition?: string;
  };
}

export interface AfterReadingResponse {
  usage_id: number;
  instrument_id: number;
  instrument_name: string;
  kategori_sampel: string;
  sampel: string[];
  no_qc_batch: string[];
  status: string;
  batch_results: BatchResult[];
  reread_history: RereadHistory[];
  can_export: boolean;
  requires_approval: boolean;
  
  // Re-read status fields
  is_reread: boolean;
  result_status: ResultStatus;
  parent_usage_id?: number;
  reread_reason?: string;
  approved_by?: number;
  approved_at?: string;
  rejected_by?: number;
  rejected_at?: string;
  reject_notes?: string;
}

export interface UsageResult {
  id: number;
  item_number: number;
  value: string;
  unit: string;
  status: string;
  no_qc_batch: string;
}

export interface BatchResult {
  no_qc_batch: string;
  final_condition: string;
  results: UsageResult[];
}

export interface RereadHistory {
  usage_id: number;
  created_at: string;
  reason: string;
  status: ResultStatus;
  approved_by?: number;
  approved_at?: string;
  rejected_by?: number;
  rejected_at?: string;
}

// Request/Response types
export interface RequestRereadResponse {
  new_usage_id: number;
  message: string;
  redirect_to: string;
}

export interface ApproveRereadRequest {
  approved: boolean;
  notes: string;
}

export interface ApprovalAction {
  approved: boolean;
  notes?: string;
}