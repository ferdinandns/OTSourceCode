// src/types/index.ts

export interface SimpleData {
    id: number | string;
    no_batch: string;
    kode_ruah: string;
    recipe_ruah?: string;
    kode_produk: string;
    leadtime: number;
    status_lead?: string;
    mesin_filling?: string;
    setor_br_date?: string;
    tanggal_setor?: string;
    waktu_kirim?: string;
    jumlah_material?: number;
    total_label_closed?: number;
}

export interface QcTerimaSampleData {
    id: number;
    kode_ruah: string;
    kode_produk: string;
    no_batch: string;
    mixing_tank?: string;
    storage_tank?: string;
    tanggal_kirim_ke_qc?: string;
    leadtime?: number; // Menit
    status_lead: string;
}

export interface ScanStorageData {
  id: number;
  kode_ruah: string;
  kode_produk: string;
  no_batch: string;
  mixing_tank?: string;
  storage_tank?: string;
  status_lead?:string
  kirim_ke_filling: string; 
}

export interface QcAnalisaCompleteData {
  id: number;
  kode_ruah: string;
  kode_produk: string;
  no_batch: string;
  mixing_tank: string;
  storage_tank: string;
  tanggal_qc_analisa: string; 
}

export interface EndPackagingData {
  id: number;
  kode_ruah: string;
  kode_produk: string;
  no_batch: string;
  no_wo_ruah: string;
  kirim_ke_end_packaging: string; 
}

export interface SerahTerimaBppData {
  id: number;
  kode_ruah: string;
  kode_produk: string;
  no_batch: string;
  no_wo_ruah: string;
  kirim_ke_serah_terima_bpp: string; 
}

export interface QcReleaseData {
  id: number;
  kode_ruah: string;
  kode_produk: string;
  no_batch: string;
  mixing_tank?: string;
  storage_tank?: string;
}

export interface FillingData {
  id: number;
  kode_ruah: string;
  kode_produk: string;
  no_batch: string;
  mesin_filling?: string;
  kirim_ke_filling?: string; // Tanggal & waktu (ISO string)
  leadtime: number; // Durasi dalam menit
  status_lead: string;
}

export interface QaReleaseData {
  id: number;
  kode_ruah: string;
  kode_produk: string;
  no_batch: string;
  setor_br_date?: string;
  status_setor_br: string; // 'done' atau lainnya
  setor_rap_date?: string;
  status_setor_rap: string; // 'done' atau lainnya
  status_qc_release: string; // 'approve' atau lainnya
}

export interface ShipmentData {
  id: number;
  kode_ruah: string;
  kode_produk: string;
  no_batch: string;
  qa_release_date: string; // ISO date string
  shipment_received_at: string | null; // Null jika belum diterima
  leadtime?: number; // Opsional, untuk menampilkan "115.0 Hari"
}

export interface UserAccountData {
  id: number;
  created_date: string;
  nik: string;
  name: string;
  username: string;
  // Khusus Administrator
  department?: string;
  level?: string;
  status?: "active" | "inactive";
  // Khusus Manager / Supervisor
  detail_area?: string;
}

export interface AuditTrailData {
  id: number;
  tanggal: string; // Format ISO atau YYYY-MM-DD
  jam: string;
  alamat_ip: string;
  nama: string;
  area: string;
  kegiatan: string;
}

export interface ThresholdData {
  id: number;
  batas_treshold: string;
  limit_bawah_pharma_hari: number;
  limit_atas_pharma_hari: number;
  limit_bawah_herbal_hari: number;
  limit_atas_herbal_hari: number;
}

export interface ProductAlertData {
  id: number;
  kode_produk: string;
  kategori: string;
  sediaan: string;
  // Ini disederhanakan dengan Record (key-value) karena ada 20 kolom threshold
  thresholds: Record<string, number>; 
}

export interface MixingTankRef {
  id: number;
  nama: string;
  ruangan: string;
}

export interface ProductData {
  id: number;
  kode_produk: string;
  kategori: string;
  produksi_auto_rilis: "Ya" | "Tidak";
  auto_rilis_update_by?: string;
  auto_rilis_update_time?: string; // ISO String
  mixing_tanks: PivotMixingTank[];
  tank_update_by?: string;
  tank_update_time?: string; // ISO String
  status: "listing" | "delisting";
}

export interface PivotMixingTank {
    update_by: string;
    update_time: string;
    mixing_tank: MixingTankRef;
}