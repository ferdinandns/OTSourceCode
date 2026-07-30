package models

import "time"

type DiversifikasiRM struct {
	ID       int    `json:"id" db:"id"`
	NomorRM  string `json:"nomorRM" db:"nomor_rm"`
	Revision int    `json:"revision" db:"revision"`
	ParentID *int   `json:"parentId" db:"parent_id"`

	StatusProject string `json:"statusProject" db:"status_project"`

	TglKirimCPro    *time.Time `json:"tglKirimCPro" db:"tgl_kirim_cpro"`
	TglTerimaTS     *time.Time `json:"tglTerimaTS" db:"tgl_terima_ts"`
	KodeItem        string     `json:"kodeItem" db:"kode_item"`
	NamaMaterial    string     `json:"namaMaterial" db:"nama_material"`
	Manufacture     string     `json:"manufacture" db:"manufacture"`
	NoBatchMaterial string     `json:"noBatchMaterial" db:"no_batch_material"`

	RmTglKirimQC            *time.Time `json:"rmTglKirimQC" db:"rm_tgl_kirim_qc"`
	RmTglKeluarHasilAnalisa *time.Time `json:"rmTglKeluarHasilAnalisa" db:"rm_tgl_keluar_hasil_analisa"`
	RmFisik                 string     `json:"rmFisik" db:"rm_fisik"`
	RmKimia                 string     `json:"rmKimia" db:"rm_kimia"`
	RmMikrobiologi          string     `json:"rmMikrobiologi" db:"rm_mikrobiologi"`
	RmSensoriMaterial       string     `json:"rmSensoriMaterial" db:"rm_sensori_material"`
	RmCekKarakteristik      string     `json:"rmCekKarakteristik" db:"rm_cek_karakteristik"`
	RmStatus                string     `json:"rmStatus" db:"rm_status"`

	PerluAnalisaAndev string `json:"perluAnalisaAndev" db:"perlu_analisa_andev"`
	AndevKimia        string `json:"andevKimia" db:"andev_kimia"`
	AndevVerifikasiMA string `json:"andevVerifikasiMA" db:"andev_verifikasi_ma"`
	AndevStatus       string `json:"andevStatus" db:"andev_status"`

	ScaleUpKodeProduk            string     `json:"scaleUpKodeProduk" db:"scale_up_kode_produk"`
	NoBatchScaleUp               string     `json:"noBatchScaleUp" db:"no_batch_scale_up"`
	ScaleUpStatus                string     `json:"scaleUpStatus" db:"scale_up_status"`
	TglDilakukanScaleUp          *time.Time `json:"tglDilakukanScaleUp" db:"tgl_dilakukan_scale_up"`
	ScaleUpTglKirimQC            *time.Time `json:"scaleUpTglKirimQC" db:"scale_up_tgl_kirim_qc"`
	ScaleUpTglKeluarHasilAnalisa *time.Time `json:"scaleUpTglKeluarHasilAnalisa" db:"scale_up_tgl_keluar_hasil_analisa"`
	LinkFileDiversifikasi        string     `json:"linkFileDiversifikasi" db:"link_file_diversifikasi"`
	Kesimpulan                   string     `json:"kesimpulan" db:"kesimpulan"`

	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
	CreatedBy *string   `json:"createdBy" db:"created_by"`
	UpdatedBy *string   `json:"updatedBy" db:"updated_by"`
}

type DiversifikasiProduk struct {
	ID                int `json:"id" db:"id"`
	DiversifikasiRMID int `json:"diversifikasiRmId" db:"diversifikasi_rm_id"`

	KodeProduk             string     `json:"kodeProduk" db:"kode_produk"`
	ProdukTglKirimQC       *time.Time `json:"produkTglKirimQC" db:"produk_tgl_kirim_qc"`
	ProdukTglKeluarHasil   *time.Time `json:"produkTglKeluarHasil" db:"produk_tgl_keluar_hasil"`
	ProdukFisik            string     `json:"produkFisik" db:"produk_fisik"`
	ProdukKimia            string     `json:"produkKimia" db:"produk_kimia"`
	ProdukMikrobiologi     string     `json:"produkMikrobiologi" db:"produk_mikrobiologi"`
	ProdukSensori          string     `json:"produkSensori" db:"produk_sensori"`
	ProdukCekKarakteristik string     `json:"produkCekKarakteristik" db:"produk_cek_karakteristik"`

	StabtestFisik        string `json:"stabtestFisik" db:"stabtest_fisik"`
	StabtestKimia        string `json:"stabtestKimia" db:"stabtest_kimia"`
	StabtestMikrobiologi string `json:"stabtestMikrobiologi" db:"stabtest_mikrobiologi"`
	StabtestSensoriDFCT  string `json:"stabtestSensoriDFCT" db:"stabtest_sensori_dfct"`
	StabtestStatus       string `json:"stabtestStatus" db:"stabtest_status"`
	Keterangan           string `json:"keterangan" db:"keterangan"`

	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

type DiversifikasiRMWithProducts struct {
	ID            int    `json:"id"`
	NomorRM       string `json:"nomorRM"`
	Revision      int    `json:"revision"`
	ParentID      *int   `json:"parentId"`
	StatusProject string `json:"statusProject"`

	TglKirimCPro    *time.Time `json:"tglKirimCPro"`
	TglTerimaTS     *time.Time `json:"tglTerimaTS"`
	KodeItem        string     `json:"kodeItem"`
	NamaMaterial    string     `json:"namaMaterial"`
	Manufacture     string     `json:"manufacture"`
	NoBatchMaterial string     `json:"noBatchMaterial"`

	RmTglKirimQC            *time.Time `json:"rmTglKirimQC"`
	RmTglKeluarHasilAnalisa *time.Time `json:"rmTglKeluarHasilAnalisa"`
	RmFisik                 string     `json:"rmFisik"`
	RmKimia                 string     `json:"rmKimia"`
	RmMikrobiologi          string     `json:"rmMikrobiologi"`
	RmSensoriMaterial       string     `json:"rmSensoriMaterial"`
	RmCekKarakteristik      string     `json:"rmCekKarakteristik"`
	RmStatus                string     `json:"rmStatus"`

	PerluAnalisaAndev string `json:"perluAnalisaAndev"`
	AndevKimia        string `json:"andevKimia"`
	AndevVerifikasiMA string `json:"andevVerifikasiMA"`
	AndevStatus       string `json:"andevStatus"`

	ScaleUpKodeProduk            string     `json:"scaleUpKodeProduk"`
	NoBatchScaleUp               string     `json:"noBatchScaleUp"`
	ScaleUpStatus                string     `json:"scaleUpStatus"`
	TglDilakukanScaleUp          *time.Time `json:"tglDilakukanScaleUp"`
	ScaleUpTglKirimQC            *time.Time `json:"scaleUpTglKirimQC"`
	ScaleUpTglKeluarHasilAnalisa *time.Time `json:"scaleUpTglKeluarHasilAnalisa"`
	LinkFileDiversifikasi        string     `json:"linkFileDiversifikasi"`
	Kesimpulan                   string     `json:"kesimpulan"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
	CreatedBy *string   `json:"createdBy"`
	UpdatedBy *string   `json:"updatedBy"`

	Products  []DiversifikasiProduk         `json:"products"`
	Revisions []DiversifikasiRMWithProducts `json:"revisions"`
}

type CreateDiversifikasiRMRequest struct {
	NomorRM       string `json:"nomorRM"`
	ParentID      *int   `json:"parentId"`
	StatusProject string `json:"statusProject"`

	TglKirimCPro    *time.Time `json:"tglKirimCPro"`
	TglTerimaTS     *time.Time `json:"tglTerimaTS"`
	KodeItem        string     `json:"kodeItem"`
	NamaMaterial    string     `json:"namaMaterial"`
	Manufacture     string     `json:"manufacture"`
	NoBatchMaterial string     `json:"noBatchMaterial"`

	RmTglKirimQC            *time.Time `json:"rmTglKirimQC"`
	RmTglKeluarHasilAnalisa *time.Time `json:"rmTglKeluarHasilAnalisa"`
	RmFisik                 string     `json:"rmFisik"`
	RmKimia                 string     `json:"rmKimia"`
	RmMikrobiologi          string     `json:"rmMikrobiologi"`
	RmSensoriMaterial       string     `json:"rmSensoriMaterial"`
	RmCekKarakteristik      string     `json:"rmCekKarakteristik"`
	RmStatus                string     `json:"rmStatus"`

	PerluAnalisaAndev string `json:"perluAnalisaAndev"`
	AndevKimia        string `json:"andevKimia"`
	AndevVerifikasiMA string `json:"andevVerifikasiMA"`
	AndevStatus       string `json:"andevStatus"`

	ScaleUpKodeProduk            string     `json:"scaleUpKodeProduk"`
	NoBatchScaleUp               string     `json:"noBatchScaleUp"`
	ScaleUpStatus                string     `json:"scaleUpStatus"`
	TglDilakukanScaleUp          *time.Time `json:"tglDilakukanScaleUp"`
	ScaleUpTglKirimQC            *time.Time `json:"scaleUpTglKirimQC"`
	ScaleUpTglKeluarHasilAnalisa *time.Time `json:"scaleUpTglKeluarHasilAnalisa"`
	LinkFileDiversifikasi        string     `json:"linkFileDiversifikasi"`
	Kesimpulan                   string     `json:"kesimpulan"`

	CreatedBy string                `json:"createdBy"`
	Products  []DiversifikasiProduk `json:"products"`
}

type UpdateDiversifikasiRMRequest struct {
	StatusProject string `json:"statusProject"`

	TglKirimCPro    *time.Time `json:"tglKirimCPro"`
	TglTerimaTS     *time.Time `json:"tglTerimaTS"`
	KodeItem        string     `json:"kodeItem"`
	NamaMaterial    string     `json:"namaMaterial"`
	Manufacture     string     `json:"manufacture"`
	NoBatchMaterial string     `json:"noBatchMaterial"`

	RmTglKirimQC            *time.Time `json:"rmTglKirimQC"`
	RmTglKeluarHasilAnalisa *time.Time `json:"rmTglKeluarHasilAnalisa"`
	RmFisik                 string     `json:"rmFisik"`
	RmKimia                 string     `json:"rmKimia"`
	RmMikrobiologi          string     `json:"rmMikrobiologi"`
	RmSensoriMaterial       string     `json:"rmSensoriMaterial"`
	RmCekKarakteristik      string     `json:"rmCekKarakteristik"`
	RmStatus                string     `json:"rmStatus"`

	PerluAnalisaAndev string `json:"perluAnalisaAndev"`
	AndevKimia        string `json:"andevKimia"`
	AndevVerifikasiMA string `json:"andevVerifikasiMA"`
	AndevStatus       string `json:"andevStatus"`

	ScaleUpKodeProduk            string     `json:"scaleUpKodeProduk"`
	NoBatchScaleUp               string     `json:"noBatchScaleUp"`
	ScaleUpStatus                string     `json:"scaleUpStatus"`
	TglDilakukanScaleUp          *time.Time `json:"tglDilakukanScaleUp"`
	ScaleUpTglKirimQC            *time.Time `json:"scaleUpTglKirimQC"`
	ScaleUpTglKeluarHasilAnalisa *time.Time `json:"scaleUpTglKeluarHasilAnalisa"`
	LinkFileDiversifikasi        string     `json:"linkFileDiversifikasi"`
	Kesimpulan                   string     `json:"kesimpulan"`

	UpdatedBy string                `json:"updatedBy"`
	Products  []DiversifikasiProduk `json:"products"`
}

type MasterProduct struct {
	ID         int       `json:"id" db:"id"`
	KodeProduk string    `json:"kodeProduk" db:"kode_produk"`
	CreatedAt  time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt  time.Time `json:"updatedAt" db:"updated_at"`
}

type MasterItem struct {
	ID           int       `json:"id" db:"id"`
	KodeItem     string    `json:"kodeItem" db:"kode_item"`
	NamaMaterial string    `json:"namaMaterial" db:"nama_material"`
	Manufacture  *string   `json:"manufacture" db:"manufacture"`
	CreatedAt    time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time `json:"updatedAt" db:"updated_at"`
}

type DiversifikasiRMListItem struct {
	ID            int    `json:"id"`
	NomorRM       string `json:"nomorRM"`
	ParentID      *int   `json:"parentId"`
	StatusProject string `json:"statusProject"`

	TglKirimCPro    *string `json:"tglKirimCPro"`
	TglTerimaTS     *string `json:"tglTerimaTS"`
	KodeItem        string  `json:"kodeItem"`
	NamaMaterial    string  `json:"namaMaterial"`
	Manufacture     string  `json:"manufacture"`
	NoBatchMaterial string  `json:"noBatchMaterial"`

	RmTglKirimQC            *string `json:"rmTglKirimQC"`
	RmTglKeluarHasilAnalisa *string `json:"rmTglKeluarHasilAnalisa"`
	RmFisik                 string  `json:"rmFisik"`
	RmKimia                 string  `json:"rmKimia"`
	RmMikrobiologi          string  `json:"rmMikrobiologi"`
	RmSensoriMaterial       string  `json:"rmSensoriMaterial"`
	RmCekKarakteristik      string  `json:"rmCekKarakteristik"`
	RmStatus                string  `json:"rmStatus"`

	PerluAnalisaAndev string `json:"perluAnalisaAndev"`
	AndevKimia        string `json:"andevKimia"`
	AndevVerifikasiMA string `json:"andevVerifikasiMA"`
	AndevStatus       string `json:"andevStatus"`

	ScaleUpKodeProduk            string  `json:"scaleUpKodeProduk"`
	NoBatchScaleUp               string  `json:"noBatchScaleUp"`
	ScaleUpStatus                string  `json:"scaleUpStatus"`
	TglDilakukanScaleUp          *string `json:"tglDilakukanScaleUp"`
	ScaleUpTglKirimQC            *string `json:"scaleUpTglKirimQC"`
	ScaleUpTglKeluarHasilAnalisa *string `json:"scaleUpTglKeluarHasilAnalisa"`
	LinkFileDiversifikasi        string  `json:"linkFileDiversifikasi"`
	Kesimpulan                   string  `json:"kesimpulan"`

	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`

	Products  []DiversifikasiProduk         `json:"products"`
	Revisions []DiversifikasiRMWithProducts `json:"revisions,omitempty"`
}
