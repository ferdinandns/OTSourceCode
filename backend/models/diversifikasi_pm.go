package models

import "time"

type DiversifikasiPM struct {
	ID       int    `json:"id"       db:"id"`
	NomorPM  string `json:"nomorPM"  db:"nomor_pm"`
	Revision int    `json:"revision" db:"revision"`
	ParentID *int   `json:"parentId" db:"parent_id"`

	StatusProject string `json:"statusProject" db:"status_project"`

	TglPenerimaan   *time.Time `json:"tglPenerimaan"   db:"tgl_penerimaan"`
	KodeItem        string     `json:"kodeItem"        db:"kode_item"`
	NamaMaterial    string     `json:"namaMaterial"    db:"nama_material"`
	Manufacture     string     `json:"manufacture"     db:"manufacture"`
	NoBatchMaterial string     `json:"noBatchMaterial" db:"no_batch_material"`

	PmTglAnalisa   *time.Time `json:"pmTglAnalisa"   db:"pm_tgl_analisa"`
	PmTglReport    *time.Time `json:"pmTglReport"    db:"pm_tgl_report"`
	PmHasilAnalisa string     `json:"pmHasilAnalisa" db:"pm_hasil_analisa"`
	PmKeterangan   string     `json:"pmKeterangan"   db:"pm_keterangan"`

	TrialKodeProduk       string `json:"trialKodeProduk"       db:"trial_kode_produk"`
	TrialNoBatch          string `json:"trialNoBatch"          db:"trial_no_batch"`
	TrialHasilFinal       string `json:"trialHasilFinal"       db:"trial_hasil_final"`
	LinkFileDiversifikasi string `json:"linkFileDiversifikasi" db:"link_file_diversifikasi"`
	Kesimpulan            string `json:"kesimpulan"            db:"kesimpulan"`

	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
	CreatedBy *string   `json:"createdBy" db:"created_by"`
	UpdatedBy *string   `json:"updatedBy" db:"updated_by"`
}

type DiversifikasiProdukPM struct {
	ID                int `json:"id"                db:"id"`
	DiversifikasiPMID int `json:"diversifikasiPmId" db:"diversifikasi_pm_id"`

	KodeProduk             string     `json:"kodeProduk"             db:"kode_produk"`
	ProdukTglKirimQC       *time.Time `json:"produkTglKirimQC"       db:"produk_tgl_kirim_qc"`
	ProdukTglKeluarHasil   *time.Time `json:"produkTglKeluarHasil"   db:"produk_tgl_keluar_hasil"`
	EvaluasiAsKemasan      string     `json:"evaluasiAsKemasan"      db:"evaluasi_as_kemasan"`
	ProdukFisik            string     `json:"produkFisik"            db:"produk_fisik"`
	ProdukKimia            string     `json:"produkKimia"            db:"produk_kimia"`
	ProdukMikrobiologi     string     `json:"produkMikrobiologi"     db:"produk_mikrobiologi"`
	ProdukSensori          string     `json:"produkSensori"          db:"produk_sensori"`
	ProdukCekKarakteristik string     `json:"produkCekKarakteristik" db:"produk_cek_karakteristik"`

	StabtestFisik        string `json:"stabtestFisik"        db:"stabtest_fisik"`
	StabtestKimia        string `json:"stabtestKimia"        db:"stabtest_kimia"`
	StabtestMikrobiologi string `json:"stabtestMikrobiologi" db:"stabtest_mikrobiologi"`
	StabtestSensoriDFCT  string `json:"stabtestSensoriDFCT"  db:"stabtest_sensori_dfct"`
	StabtestKeterangan   string `json:"stabtestKeterangan"   db:"stabtest_keterangan"`
	StabtestStatus       string `json:"stabtestStatus"       db:"stabtest_status"`

	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

type DiversifikasiPMWithProducts struct {
	ID            int    `json:"id"`
	NomorPM       string `json:"nomorPM"`
	Revision      int    `json:"revision"`
	ParentID      *int   `json:"parentId"`
	StatusProject string `json:"statusProject"`

	TglPenerimaan   *time.Time `json:"tglPenerimaan"`
	KodeItem        string     `json:"kodeItem"`
	NamaMaterial    string     `json:"namaMaterial"`
	Manufacture     string     `json:"manufacture"`
	NoBatchMaterial string     `json:"noBatchMaterial"`

	PmTglAnalisa   *time.Time `json:"pmTglAnalisa"`
	PmTglReport    *time.Time `json:"pmTglReport"`
	PmHasilAnalisa string     `json:"pmHasilAnalisa"`
	PmKeterangan   string     `json:"pmKeterangan"`

	TrialKodeProduk       string `json:"trialKodeProduk"`
	TrialNoBatch          string `json:"trialNoBatch"`
	TrialHasilFinal       string `json:"trialHasilFinal"`
	LinkFileDiversifikasi string `json:"linkFileDiversifikasi"`
	Kesimpulan            string `json:"kesimpulan"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
	CreatedBy *string   `json:"createdBy"`
	UpdatedBy *string   `json:"updatedBy"`

	Products  []DiversifikasiProdukPM       `json:"products"`
	Revisions []DiversifikasiPMWithProducts `json:"revisions"`
}

type DiversifikasiPMResponse struct {
	ID            int    `json:"id"`
	NomorPM       string `json:"nomorPM"`
	KodeItem      string `json:"kodeItem"`
	NamaMaterial  string `json:"namaMaterial"`
	Manufacture   string `json:"manufacture"`
	StatusProject string `json:"statusProject"`
	CreatedAt     string `json:"createdAt"`
	UpdatedAt     string `json:"updatedAt"`
}

type DiversifikasiProdukPMResponse struct {
	ID                     int     `json:"id"`
	DiversifikasiPMID      int     `json:"diversifikasiPmId"`
	KodeProduk             string  `json:"kodeProduk"`
	ProdukTglKirimQC       *string `json:"produkTglKirimQC"`
	ProdukTglKeluarHasil   *string `json:"produkTglKeluarHasil"`
	EvaluasiAsKemasan      string  `json:"evaluasiAsKemasan"`
	ProdukFisik            string  `json:"produkFisik"`
	ProdukKimia            string  `json:"produkKimia"`
	ProdukMikrobiologi     string  `json:"produkMikrobiologi"`
	ProdukSensori          string  `json:"produkSensori"`
	ProdukCekKarakteristik string  `json:"produkCekKarakteristik"`
	StabtestFisik          string  `json:"stabtestFisik"`
	StabtestKimia          string  `json:"stabtestKimia"`
	StabtestMikrobiologi   string  `json:"stabtestMikrobiologi"`
	StabtestSensoriDFCT    string  `json:"stabtestSensoriDFCT"`
	StabtestKeterangan     string  `json:"stabtestKeterangan"`
	StabtestStatus         string  `json:"stabtestStatus"`
	CreatedAt              string  `json:"createdAt"`
	UpdatedAt              string  `json:"updatedAt"`
}

type CreateDiversifikasiPMRequest struct {
	ParentID      *int   `json:"parentId"`
	StatusProject string `json:"statusProject"`

	TglPenerimaan   *time.Time `json:"tglPenerimaan"`
	KodeItem        string     `json:"kodeItem"`
	NamaMaterial    string     `json:"namaMaterial"`
	Manufacture     string     `json:"manufacture"`
	NoBatchMaterial string     `json:"noBatchMaterial"`

	PmTglAnalisa   *time.Time `json:"pmTglAnalisa"`
	PmTglReport    *time.Time `json:"pmTglReport"`
	PmHasilAnalisa string     `json:"pmHasilAnalisa"`
	PmKeterangan   string     `json:"pmKeterangan"`

	TrialKodeProduk       string `json:"trialKodeProduk"`
	TrialNoBatch          string `json:"trialNoBatch"`
	TrialHasilFinal       string `json:"trialHasilFinal"`
	LinkFileDiversifikasi string `json:"linkFileDiversifikasi"`
	Kesimpulan            string `json:"kesimpulan"`

	CreatedBy string                  `json:"createdBy"`
	Products  []DiversifikasiProdukPM `json:"products"`
}

type UpdateDiversifikasiPMRequest struct {
	StatusProject string `json:"statusProject"`

	TglPenerimaan   *time.Time `json:"tglPenerimaan"`
	KodeItem        string     `json:"kodeItem"`
	NamaMaterial    string     `json:"namaMaterial"`
	Manufacture     string     `json:"manufacture"`
	NoBatchMaterial string     `json:"noBatchMaterial"`

	PmTglAnalisa   *time.Time `json:"pmTglAnalisa"`
	PmTglReport    *time.Time `json:"pmTglReport"`
	PmHasilAnalisa string     `json:"pmHasilAnalisa"`
	PmKeterangan   string     `json:"pmKeterangan"`

	TrialKodeProduk       string `json:"trialKodeProduk"`
	TrialNoBatch          string `json:"trialNoBatch"`
	TrialHasilFinal       string `json:"trialHasilFinal"`
	LinkFileDiversifikasi string `json:"linkFileDiversifikasi"`
	Kesimpulan            string `json:"kesimpulan"`

	UpdatedBy string                  `json:"updatedBy"`
	Products  []DiversifikasiProdukPM `json:"products"`
}

type MasterItemPM struct {
	ID           int       `json:"id"           db:"id"`
	KodeItem     string    `json:"kodeItem"     db:"kode_item"`
	NamaMaterial string    `json:"namaMaterial" db:"nama_material"`
	Manufacture  *string   `json:"manufacture"  db:"manufacture"`
	CreatedAt    time.Time `json:"createdAt"    db:"created_at"`
	UpdatedAt    time.Time `json:"updatedAt"    db:"updated_at"`
}

type DiversifikasiPMListItem struct {
	ID            int    `json:"id"`
	NomorPM       string `json:"nomorPM"`
	ParentID      *int   `json:"parentId"`
	StatusProject string `json:"statusProject"`

	TglPenerimaan   *string `json:"tglPenerimaan"`
	KodeItem        string  `json:"kodeItem"`
	NamaMaterial    string  `json:"namaMaterial"`
	Manufacture     string  `json:"manufacture"`
	NoBatchMaterial string  `json:"noBatchMaterial"`

	PmTglAnalisa   *string `json:"pmTglAnalisa"`
	PmTglReport    *string `json:"pmTglReport"`
	PmHasilAnalisa string  `json:"pmHasilAnalisa"`
	PmKeterangan   string  `json:"pmKeterangan"`

	TrialKodeProduk       string `json:"trialKodeProduk"`
	TrialNoBatch          string `json:"trialNoBatch"`
	TrialHasilFinal       string `json:"trialHasilFinal"`
	LinkFileDiversifikasi string `json:"linkFileDiversifikasi"`
	Kesimpulan            string `json:"kesimpulan"`

	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`

	Products  []DiversifikasiProdukPM       `json:"products"`
	Revisions []DiversifikasiPMWithProducts `json:"revisions,omitempty"`
}
