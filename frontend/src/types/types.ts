export type HasilAnalisa = "MS" | "TMS" | "OP" | "N/A"
export type StatusRM = "Reject" | "Release" | "On Progress" | "N/A"
export type StatusProject = "Done" | "Drop" | "On Progress"
export type JenisScaleUp = "Pilot Scale" | "Commercial Scale"
export type Division = "Admin" | "CPro" | "QC" | "TS" | "Andev"

// Master Item
export interface MasterItem {
  id: number
  kodeItem: string
  namaMaterial: string
  manufacture: string | null
}

export interface MasterProduct {
  id: number
  kodeProduk: string
}

// Diversifikasi RM
export interface DiversifikasiProduk {
  id?: number
  diversifikasiRmId?: number

  kodeProduk: string
  produkTglKirimQC: string | null
  produkTglKeluarHasil: string | null
  produkFisik: HasilAnalisa | ""
  produkKimia: HasilAnalisa | ""
  produkMikrobiologi: HasilAnalisa | ""
  produkSensori: HasilAnalisa | ""
  produkCekKarakteristik: HasilAnalisa | ""

  stabtestFisik: HasilAnalisa | ""
  stabtestKimia: HasilAnalisa | ""
  stabtestMikrobiologi: HasilAnalisa | ""
  stabtestSensoriDFCT: HasilAnalisa | ""
  stabtestStatus: StatusRM | ""
  keterangan: string
}

export interface DiversifikasiRM {
  id?: number
  nomorRM: string
  revision: number
  parentId?: number | null
  statusProject: StatusProject | ""

  // Informasi Umum
  tglKirimCPro: string | null
  tglTerimaTS: string | null
  kodeItem: string
  namaMaterial: string
  manufacture: string
  noBatchMaterial: string

  // Raw Material
  rmTglKirimQC: string | null
  rmTglKeluarHasilAnalisa: string | null
  rmFisik: HasilAnalisa | ""
  rmKimia: HasilAnalisa | ""
  rmMikrobiologi: HasilAnalisa | ""
  rmSensoriMaterial: HasilAnalisa | ""
  rmCekKarakteristik: HasilAnalisa | ""
  rmStatus: StatusRM | ""

  // Andev
  perluAnalisaAndev: "Yes" | "No" | ""
  andevKimia: HasilAnalisa | ""
  andevVerifikasiMA: HasilAnalisa | ""
  andevStatus: StatusRM | ""

  // Scale Up
  scaleUpKodeProduk: string
  noBatchScaleUp: string
  scaleUpStatus: StatusRM | ""
  tglDilakukanScaleUp: string | null
  scaleUpTglKirimQC: string | null
  scaleUpTglKeluarHasilAnalisa: string | null
  linkFileDiversifikasi: string
  kesimpulan: string

  products?: DiversifikasiProduk[]
  revisions?: DiversifikasiRM[]
}

// Diversifikasi PM
export interface DiversifikasiProdukPM {
  id?: number
  diversifikasiPmId?: number

  kodeProduk: string
  produkTglKirimQC: string | null
  produkTglKeluarHasil: string | null
  evaluasiAsKemasan: HasilAnalisa | ""
  produkFisik: HasilAnalisa | ""
  produkKimia: HasilAnalisa | ""
  produkMikrobiologi: HasilAnalisa | ""
  produkSensori: HasilAnalisa | ""
  produkCekKarakteristik: HasilAnalisa | ""

  stabtestFisik: HasilAnalisa | ""
  stabtestKimia: HasilAnalisa | ""
  stabtestMikrobiologi: HasilAnalisa | ""
  stabtestSensoriDFCT: HasilAnalisa | ""
  stabtestKeterangan: string
  stabtestStatus: StatusRM | ""
}

export interface DiversifikasiPM {
  id?: number
  nomorPM: string
  revision: number
  parentId?: number | null
  statusProject: StatusProject | ""

  // Informasi Umum
  tglPenerimaan: string | null
  kodeItem: string
  namaMaterial: string
  manufacture: string
  noBatchMaterial: string

  // Packaging Material
  pmTglAnalisa: string | null
  pmTglReport: string | null
  pmHasilAnalisa: StatusRM | ""
  pmKeterangan: string

  // Trial Mesin
  trialKodeProduk: string
  trialNoBatch: string
  trialHasilFinal: HasilAnalisa | ""
  linkFileDiversifikasi: string
  kesimpulan: string

  products?: DiversifikasiProdukPM[]
  revisions?: DiversifikasiPM[]
}

// User
export interface User {
  id: number
  name: string
  email: string
  division: Division
  password: string
}

export interface diversifikasiRM {
  id: number
  kodeItem: string
  namaMaterial: string
  batch: string
  kondisiPenyimpanan: string
  usiaPenyimpanan: string
}