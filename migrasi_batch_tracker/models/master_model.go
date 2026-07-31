package models

import "time"

type JumlahJenisMaterial struct {
	KodeProduk     string `gorm:"column:Kode Produk" json:"kode_produk"`
	JumlahMaterial int    `gorm:"column:Jumlah Material" json:"jumlah_material"`
}

func (JumlahJenisMaterial) TableName() string {
	return "jumlah_jenis_material"
}

type LogUji struct {
	Id    int       `gorm:"column:primaryKey;autoIncrement" json:"id"`
	Pesan string    `gorm:"column:pesan" json:"pesan"`
	Waktu time.Time `gorm:"column:waktu" json:"waktu" binding:"required"`
}

func (LogUji) TableName() string {
	return "log_uji"
}

type RmVal2 struct {
	Id             int       `gorm:"primaryKey;autoIncrement" json:"id"`
	Barcode        string    `gorm:"column:barcode" json:"barcode" binding:"required"`
	BagCode        string    `gorm:"column:bag_code;index" json:"bag_code" binding:"required"`
	BatchGroup     string    `gorm:"column:batch_group" json:"batch_group" binding:"required"`
	KodeMaterial   string    `gorm:"column:kode_material" json:"kode_material"`
	NomorQC        string    `gorm:"column:nomor_qc" json:"nomor_qc"`
	CreatedAt      time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	Validated      bool      `gorm:"column:validated;default:false" json:"validated" binding:"required;oneof:true false"`
	CreatedBy      string    `gorm:"column:created_by" json:"created_by"`
	Ruangan        string    `gorm:"column:ruangan" json:"ruangan" binding:"required"`
	ValidatedBy    string    `gorm:"column:validated_by" json:"validated_by"`
	ValidationTime time.Time `gorm:"column:validation_time" json:"validation_time"`
}

func (RmVal2) TableName() string {
	return "rm_val_2"
}

type ScanResults struct {
	Id          int       `gorm:"primaryKey;autoIncrement" json:"id"`
	ScannedCode string    `gorm:"column:scanned_code" json:"scanned_code"`
	MidCode     string    `gorm:"column:mid_code" json:"mid_code" binding:"required"`
	Ruangan     string    `gorm:"column:ruangan" json:"ruangan" binding:"required"`
	LogType     string    `gorm:"column:log_type" json:"log_type" binding:"required"`
	CreatedAt   time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at" binding:"required"`
}

func (ScanResults) TableName() string {
	return "scan_results"
}

// AuditTrail merepresentasikan log aktivitas pengguna (audit trail).
// Digunakan secara luas oleh service layer untuk mencatat riwayat perubahan status Work Order.
type AuditTrail struct {
	Id       uint      `gorm:"primaryKey;column:id;<-:false" json:"id"`
	Tanggal  time.Time `gorm:"column:tanggal" json:"tanggal" binding:"required"`
	Jam      string    `gorm:"column:jam" json:"jam" binding:"required"`
	AlamatIP string    `gorm:"column:alamat_ip" json:"alamat_ip" binding:"required"`
	Nama     string    `gorm:"column:nama" json:"nama" binding:"required"`
	Area     string    `gorm:"column:area" json:"area" binding:"required"`
	Kegiatan string    `gorm:"column:kegiatan" json:"kegiatan" binding:"required"`
}

func (AuditTrail) TableName() string {
	return "tb_admin_audit_trail"
}

type BatchReasons struct {
	Id          int       `gorm:"primaryKey;autoIncrement" json:"id"`
	BatchId     int       `gorm:"column:batch_id" json:"batch_id" binding:"required"`
	ProcessName string    `gorm:"column:process_name" json:"process_name" binding:"required"`
	Reason      string    `gorm:"column:reason" json:"reason" binding:"required"`
	Department  string    `gorm:"column:department" json:"department"`
	CreatedBy   string    `gorm:"column:created_by" json:"created_by"`
	Nama        string    `gorm:"column:nama" json:"nama"`
	CreatedAt   time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at" binding:"required"`
	UpdatedAt   time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`
}

func (BatchReasons) TableName() string {
	return "tb_batch_reasons"
}

// CreatedBy menyimpan rekaman relasional tentang pengguna (ID User) mana yang melakukan aksi tertentu pada suatu batch.
// Berisi pointer uint untuk mengizinkan nilai NULL jika tahapan tersebut belum dilakukan.
type CreatedBy struct {
	Id                 *uint `gorm:"primaryKey;autoIncrement" json:"id"`
	KirimBy            *uint `gorm:"column:kirim_by" json:"kirim_by"`
	PotongStockBy      *uint `gorm:"column:potong_stock_by" json:"potong_stock_by"`
	TimbangBy          *uint `gorm:"column:timbang_by" json:"timbang_by"`
	Val1By             *uint `gorm:"column:val1_by" json:"val1_by"`
	Val2By             *uint `gorm:"column:val2_by" json:"val2_by"`
	CompoundingBy      *uint `gorm:"column:compounding_by" json:"compounding_by"`
	KirimKeQCBy        *uint `gorm:"column:kirim_ke_qc_by" json:"kirim_ke_qc_by"`
	QcAnalisaBy        *uint `gorm:"column:qc_analisa_by" json:"qc_analisa_by"`
	QcAnalisCompleteBy *uint `gorm:"column:qc_analis_complete_by" json:"qc_analis_complete_by"`
	QcReleaseBy        *uint `gorm:"column:qc_release_by" json:"qc_release_by"`
	ScanStorageBy      *uint `gorm:"column:scan_storage_by" json:"scan_storage_by"`
	KirimKeFillingBy   *uint `gorm:"column:kirim_ke_filling_by" json:"kirim_ke_filling_by"`
	FillingBy          *uint `gorm:"column:filling_by" json:"filling_by"`
	PackagingBy        *uint `gorm:"column:packaging_by" json:"packaging_by"`
	SerahTerimaBppBy   *uint `gorm:"column:serah_terima_bpp_by" json:"serah_terima_bpp_by"`
	SetorBrBy          *uint `gorm:"column:setor_br_by" json:"setor_br_by"`
	SetorRapBy         *uint `gorm:"column:setor_rap_by" json:"setor_rap_by"`
	TerimaBrBy         *uint `gorm:"column:terima_br_by" json:"terima_br_by"`
	TerimaRapBy        *uint `gorm:"column:terima_rap_by" json:"terima_rap_by"`
	ShipmentBy         *uint `gorm:"column:shipment_by" json:"shipment_by"`
	ReceivedShipmentBy *uint `gorm:"column:received_shipment_by" json:"received_shipment_by"`
}

func (CreatedBy) TableName() string {
	return "tb_created_by"
}

type DetailAreaPPIC struct {
	Id         int       `gorm:"primaryKey;autoIncrement" json:"id"`
	Nama       string    `gorm:"column:nama" json:"nama"`
	Level      string    `gorm:"column:level" json:"level"`
	Area       string    `gorm:"column:area" json:"area"`
	DetailArea string    `gorm:"column:detail_area" json:"detail_area"`
	UpdatedAt  time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updated_at" binding:"required"`
	UpdatedAy  string    `gorm:"column:updated_by" json:"updated_by"`
	SyncDate   time.Time `gorm:"column:sync_date" json:"sync_date"`
}

func (DetailAreaPPIC) TableName() string {
	return "tb_detail_area_ppic"
}

type DetailAreaProduksi struct {
	Id         int       `gorm:"primaryKey;autoIncrement" json:"id"`
	Nama       string    `gorm:"column:nama" json:"nama"`
	Level      string    `gorm:"column:level" json:"level"`
	Area       string    `gorm:"column:area" json:"area"`
	DetailArea string    `gorm:"column:detail_area" json:"detail_area"`
	UpdatedAt  time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updated_at" binding:"required"`
	UpdatedBy  string    `gorm:"column:updated_by" json:"updated_by"`
	SyncDate   time.Time `gorm:"column:sync_date" json:"sync_date"`
}

func (DetailAreaProduksi) TableName() string {
	return "tb_detail_area_produksi"
}

type DetailAreaQA struct {
	Id         int       `gorm:"primaryKey;autoIncrement" json:"id"`
	Nama       string    `gorm:"column:nama" json:"nama"`
	Level      string    `gorm:"column:level" json:"level"`
	Area       string    `gorm:"column:area" json:"area"`
	DetailArea string    `gorm:"column:detail_area" json:"detail_area"`
	UpdatedAt  time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updated_at" binding:"required"`
	UpdatedBy  string    `gorm:"column:updated_by" json:"updated_by"`
	SyncDate   time.Time `gorm:"column:sync_date" json:"sync_date"`
}

func (DetailAreaQA) TableName() string {
	return "tb_detail_area_qa"
}

type DetailAreaQC struct {
	Id         int       `gorm:"primaryKey;autoIncrement" json:"id"`
	Nama       string    `gorm:"column:nama" json:"nama"`
	Level      string    `gorm:"column:level" json:"level"`
	Area       string    `gorm:"column:area" json:"area"`
	DetailArea string    `gorm:"column:detail_area" json:"detail_area"`
	UpdatedAt  time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updated_at" binding:"required"`
	UpdatedBy  string    `gorm:"column:updated_by" json:"updated_by"`
	SyncDate   time.Time `gorm:"column:sync_date" json:"sync_date"`
}

func (DetailAreaQC) TableName() string {
	return "tb_detail_area_qc"
}

type DetailAreaWarehouse struct {
	Id         int       `gorm:"primaryKey;autoIncrement" json:"id"`
	Nama       string    `gorm:"column:nama" json:"nama"`
	Level      string    `gorm:"column:level" json:"level"`
	Area       string    `gorm:"column:area" json:"area"`
	DetailArea string    `gorm:"column:detail_area" json:"detail_area"`
	UpdatedAt  time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updated_at" binding:"required"`
	UpdatedBy  string    `gorm:"column:updated_by" json:"updated_by"`
	SyncDate   time.Time `gorm:"column:sync_date" json:"sync_date"`
}

func (DetailAreaWarehouse) TableName() string {
	return "tb_detail_area_warehouse"
}

// Keterangan menyimpan catatan/komentar opsional yang diberikan oleh pengguna pada setiap tahapan proses batch.
type Keterangan struct {
	Id                          int       `gorm:"primaryKey;autoIncrement" json:"id"`
	Wo_id                       int       `gorm:"column:wo_id" json:"wo_id"`
	Ppic_ket                    *string   `gorm:"column:ppic_ket" json:"ppic_ket"`
	Potong_stock_ket            *string   `gorm:"column:potong_stock_ket" json:"potong_stock_ket"`
	Timbang_ket                 *string   `gorm:"column:timbang_ket" json:"timbang_ket"`
	Produksi_validasi2_ket      *string   `gorm:"column:produksi_validasi2_ket" json:"produksi_validasi2_ket"`
	Compounding_mixing_tank_ket *string   `gorm:"column:compounding_mixing_tank_ket" json:"compounding_mixing_tank_ket"`
	Tf_storage_ket              *string   `gorm:"column:tf_storage_ket" json:"tf_storage_ket"`
	Qc_terima_sample_ket        *string   `gorm:"column:qc_terima_sample_ket" json:"qc_terima_sample_ket"`
	Qc_analisa_complete_ket     *string   `gorm:"column:qc_analisa_complete_ket" json:"qc_analisa_complete_ket"`
	Qc_release_ket              *string   `gorm:"column:qc_release_ket" json:"qc_release_ket"`
	Scan_barcode_storage_ket    *string   `gorm:"column:scan_barcode_storage_ket" json:"scan_barcode_storage_ket"`
	Produksi_filling_powder_ket *string   `gorm:"column:produksi_filling_powder_ket" json:"produksi_filling_powder_ket"`
	Sample_fg_ket               *string   `gorm:"column:sample_fg_ket" json:"sample_fg_ket"`
	End_packaging_ket           *string   `gorm:"column:end_packaging_ket" json:"end_packaging_ket"`
	Serah_terima_bpp_ket        *string   `gorm:"column:serah_terima_bpp_ket" json:"serah_terima_bpp_ket"`
	Terima_br_ket               *string   `gorm:"column:terima_br_ket" json:"terima_br_ket"`
	Terima_rap_ket              *string   `gorm:"column:terima_rap_ket" json:"terima_rap_ket"`
	Qa_release_ket              *string   `gorm:"column:qa_release_ket" json:"qa_release_ket"`
	Shipment_ket                *string   `gorm:"column:shipment_ket" json:"shipment_ket"`
	Created_at                  time.Time `gorm:"column:created_at" json:"created_at"`
	Updated_at                  time.Time `gorm:"column:updated_at" json:"updated_at"`
}

func (Keterangan) TableName() string {
	return "tb_keterangan"
}

type LeadtimeSummary struct {
	Id                      int       `gorm:"primaryKey;autoIncrement" json:"id"`
	NoBatch                 string    `gorm:"column:no_batch" json:"no_batch"`
	KodeProduk              string    `gorm:"column:kode_produk;index" json:"kode_produk"`
	KodeRuah                string    `gorm:"column:kode_ruah" json:"kode_ruah" binding:"required"`
	Kategori                string    `json:"kategori"`
	TanggalWO               string    `gorm:"column:tanggal_wo" json:"tanggal_wo"`
	TanggalPotongStock      string    `json:"tanggal_potong_stock"`
	TanggalTimbang          string    `json:"tanggal_timbang"`
	TanggalTerimaVal1       string    `json:"tanggal_terima_val1"`
	TanggalKirimVal1        string    `json:"tanggal_kirim_val1"`
	TanggalTerimaVal2       string    `json:"tanggal_terima_val2"`
	TanggalKirimCompounding string    `json:"tanggal_kirim_compounding"`
	TanggalKirimKeQC        string    `json:"tanggal_kirim_ke_qc"`
	TanggalQcAnalisa        string    `json:"tanggal_qc_analisa"`
	AnalisaCompleteDate     string    `json:"analisa_complete_date"`
	QcReleaseDate           string    `json:"qc_release_date"`
	TempelLabelReleaseDate  string    `json:"tempel_label_release_date"`
	KirimKeFilling          string    `json:"kirim_ke_filling"`
	KirimKeSampleFG         string    `json:"kirim_ke_sample_fg"`
	KirimKeEndPackaging     string    `json:"kirim_ke_end_packaging"`
	KirimKeSerahTerimaBPP   string    `json:"kirim_ke_serah_terima_bpp"`
	SetorBrDate             string    `json:"setor_br_date"`
	SetorRapDate            string    `json:"setor_rap_date"`
	TerimaBrDate            string    `json:"terima_br_date"`
	TerimaRapDate           string    `json:"terima_rap_date"`
	QaReleaseDate           string    `json:"qa_release_date"`
	ShipmentReceivedAt      string    `json:"shipment_received_at"`
	LeadCWO                 int       `gorm:"column:lead_cwo" json:"lead_cwo"`
	LeadPotongStock         *int      `gorm:"column:lead_potong_stock" json:"lead_potong_stock"`
	LeadPreparasi           *int      `gorm:"column:lead_preparasi" json:"lead_preparasi"`
	LeadTimbang             *int      `gorm:"column:lead_timbang" json:"lead_timbang"`
	LeadValidasi1           *int      `gorm:"column:lead_validasi1" json:"lead_validasi1"`
	LeadValidasi2           *int      `gorm:"column:lead_validasi2" json:"lead_validasi2"`
	LeadCompounding         *int      `gorm:"column:lead_compounding" json:"lead_compounding"`
	LeadTerimaSample        *int      `gorm:"column:lead_terima_sample" json:"lead_terima_sample"`
	LeadAnalisaComplete     *int      `gorm:"column:lead_analisa_complete" json:"lead_analisa_complete"`
	LeadReleaseQC           *int      `gorm:"column:lead_release_qc" json:"lead_release_qc"`
	LeadTempelLabelRilis    *int      `gorm:"column:lead_tempel_label_rilis" json:"lead_tempel_label_rilis"`
	LeadFilling             *int      `gorm:"column:lead_filling" json:"lead_filling"`
	LeadSampleFG            *int      `gorm:"column:lead_sample_fg" json:"lead_sample_fg"`
	LeadEndPackaging        *int      `gorm:"column:lead_end_packaging" json:"lead_end_packaging"`
	LeadSetorBr             *int      `gorm:"column:lead_setor_br" json:"lead_setor_br"`
	LeadSetorRap            *int      `gorm:"column:lead_setor_rap" json:"lead_setor_rap"`
	LeadTerimaBr            *int      `gorm:"column:lead_terima_br" json:"lead_terima_br"`
	LeadTerimaRap           *int      `gorm:"column:lead_terima_rap" json:"lead_terima_rap"`
	QaRelease               *int      `gorm:"column:qa_release" json:"qa_release"`
	LeadShipment            *int      `gorm:"column:lead_shipment" json:"lead_shipment"`
	CreatedAt               time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	UpdatedAt               time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`
	DeleteStatus            string    `gorm:"column:delete_status" json:"delete_status"`
}

func (LeadtimeSummary) TableName() string {
	return "tb_leadtime_summary"
}

type MixingTankProduk struct {
	Id           int        `gorm:"primaryKey;autoIncrement" json:"id"`
	MixingTankId int        `gorm:"column:mixing_tank_id;index" json:"mixing_tank_id" binding:"required"`
	ProdukId     int        `gorm:"column:produk_id;index" json:"produk_id" binding:"required"`
	MixingTank   MixingTank `gorm:"foreignKey:Mixing_tank_id" json:"mixing_tank"`
	UpdateBy     string     `gorm:"column:update_by" json:"update_by"`
	UpdateTime   time.Time  `gorm:"column:update_time;autoUpdateTime" json:"update_time"`
}

func (MixingTankProduk) TableName() string {
	return "tb_mixing_tank_produk"
}

type MixingTank struct {
	Id      int    `gorm:"primaryKey;autoIncrement" json:"id"`
	Nama    string `gorm:"column:nama" json:"nama" binding:"required"`
	Ruangan string `gorm:"column:ruangan" json:"ruangan" binding:"required"`
}

func (MixingTank) TableName() string {
	return "tb_mixing_tanks"
}

type Product struct {
	Id                 int                `gorm:"primaryKey;autoIncrement" json:"id"`
	KodeProduk         string             `gorm:"column:kode_produk" json:"kode_produk" binding:"required"`
	NamaProduk         string             `gorm:"column:nama_produk" json:"nama_produk" binding:"required"`
	Kategori           string             `gorm:"column:kategori;default:Herbal" json:"kategori" binding:"oneof=Herbal Pharma"`
	Sediaan            string             `gorm:"column:sediaan;default:Liquid" json:"sediaan" binding:"required oneof=Liquid Powder"`
	ProduksiAutoRilis  string             `gorm:"column:produksi_auto_rilis" json:"produksi_auto_rilis" binding:"required"`
	UpdateTime         time.Time          `gorm:"column:update_time;autoUpdateTime" json:"update_time" binding:"required"`
	UpdatedBy          string             `gorm:"column:updated_by" json:"updated_by" binding:"required"`
	Status             string             `gorm:"column:status;default:listing" json:"status" binding:"required oneof=listing delisting"`
	MixingTanksProduct []MixingTankProduk `gorm:"foreignKey:ProdukID" json:"mixing_tanks"`
}

func (Product) TableName() string {
	return "tb_produk"
}

type ProdukAlert struct {
	Id                                      int       `gorm:"primaryKey;autoIncrement" json:"id"`
	ProdukId                                int       `gorm:"column:produk_id;unique" json:"produk_id" binding:"required"`
	Product                                 Product   `gorm:"foreignKey:Produk_id" json:"product"`
	ThresholdCwoPotongStock                 int       `gorm:"column:threshold_cwo_potong_stock;default:0" json:"threshold_cwo_potong_stock"`
	ThresholdPotongStockValidasi1           int       `gorm:"column:threshold_potong_stock_validasi_1;default:0" json:"threshold_potong_stock_validasi_1"`
	ThresholdValidasi1Validasi2             int       `gorm:"column:threshold_validasi_1_validasi_2;default:0" json:"threshold_validasi_1_validasi_2"`
	ThresholdValidasi2StartCompounding      int       `gorm:"column:threshold_validasi_2_start_compounding;default:0" json:"threshold_validasi_2_start_compounding"`
	ThresholdStartCompoundingEndCompounding int       `gorm:"column:threshold_start_compounding_end_compunding" json:"threshold_start_compounding_end_compunding" binding:"required"`
	ThresholdEndCompoundingSamplingRuah     int       `gorm:"column:threshold_end_compounding_sampling_ruah" json:"threshold_end_compounding_sampling_ruah" binding:"required"`
	ThresholdSamplingRuahRuahDatang         int       `gorm:"column:threshold_sampling_ruah_ruah_datang" json:"threshold_sampling_ruah_ruah_datang" binding:"required"`
	ThresholdRuahDatangDisposisiRuah        int       `gorm:"column:threshold_ruah_datang_disposisi_ruah" json:"threshold_ruah_datang_disposisi_ruah" binding:"required"`
	ThresholdDisposisiRuahLabelingRuah      int       `gorm:"column:threshold_disposisi_ruah_labeling_ruah" json:"threshold_disposisi_ruah_labeling_ruah" binding:"required"`
	ThresholdLabelingRuahStartFilling       int       `gorm:"column:threshold_labeling_ruah_start_filling" json:"threshold_labeling_ruah_start_filling" binding:"required"`
	ThresholdStartFillingEndPackaging       int       `gorm:"column:threshold_start_filling_end_packaging" json:"threshold_start_filling_end_packaging" binding:"required"`
	ThresholdEndPackagingQaRilis            int       `gorm:"column:threshold_end_packaging_qa_rilis" json:"threshold_end_packaging_qa_rilis" binding:"required"`
	ThresholdEndPackagingSetorBR            int       `gorm:"column:threshold_end_packaging_setor_br" json:"threshold_end_packaging_setor_br" binding:"required"`
	ThresholdSetorBrQaRilis                 int       `gorm:"column:threshold_setor_br_qa_rilis" json:"threshold_setor_br_qa_rilis" binding:"required"`
	ThresholdEndPackagingSetorRAP           int       `gorm:"column:threshold_end_packaging_setor_rap" json:"threshold_end_packaging_setor_rap" binding:"required"`
	ThresholdSetorRapQaRilis                int       `gorm:"column:threshold_setor_rap_qa_rilis" json:"threshold_setor_rap_qa_rilis" binding:"required"`
	ThresholdEndFillingQaRilis              int       `gorm:"column:threshold_end_filling_qa_rilis" json:"threshold_end_filling_qa_rilis" binding:"required"`
	ThresholdEndFillingSetorBR              int       `gorm:"column:threshold_end_filling_setor_br" json:"threshold_end_filling_setor_br" binding:"required"`
	ThresholdEndFillingSetorRAP             int       `gorm:"column:threshold_end_filling_setor_rap" json:"threshold_end_filling_setor_rap" binding:"required"`
	ThresholdQaRilisShipment                int       `gorm:"column:threshold_qa_rilis_shipment" json:"threshold_qa_rilis_shipment" binding:"required"`
	UpdatedBy                               string    `gorm:"column:updated_by" json:"updated_by"`
	UpdateTime                              time.Time `gorm:"column:update_time;autoUpdateTime" json:"update_time" binding:"required"`
}

func (ProdukAlert) TableName() string {
	return "tb_produk_alert"
}

type QcData struct {
	IdWo                   int        `gorm:"primaryKey;autoIncrement" json:"id_wo"`
	IdPpicUniqueCode       string     `gorm:"column:id_ppic_unique_code" json:"id_ppic_unique_code"`
	KodeRuah               string     `gorm:"column:kode_ruah" json:"kode_ruah"`
	DeskripsiProduk        string     `gorm:"column:deskripsi_produk" json:"deskripsi_produk"`
	NoBatch                string     `gorm:"column:no_batch" json:"no_batch"`
	SampleNumber           int        `gorm:"column:sample_number" json:"sample_number"`
	SamplingDate           *time.Time `gorm:"column:sampling_date" json:"sampling_date"`
	SampleArrivalDate      *time.Time `gorm:"column:sample_arrival_date" json:"sample_arrival_date"`
	CompleteDate           *time.Time `gorm:"column:complete_date" json:"complete_date"`
	DispDate               *time.Time `gorm:"column:disp_date" json:"disp_date"`
	LabellingDate          *time.Time `gorm:"column:labelling_date" json:"labelling_date"`
	Pic                    string     `gorm:"column:pic" json:"pic"`
	Shift                  string     `gorm:"column:shift" json:"shift"`
	LeadtimeSamplingHours  float64    `gorm:"column:leadtime_sampling_hours" json:"leadtime_sampling_hours"`
	LeadtimeAnalisaHours   float64    `gorm:"column:leadtime_analisa_hours" json:"leadtime_analisa_hours"`
	LeadtimeLabellingHours float64    `gorm:"column:leadtime_labelling_hours" json:"leadtime_labelling_hours"`
	Keterangan             string     `gorm:"column:keterangan" json:"keterangan"`
	TotalLeadtime          float64    `gorm:"column:total_leadtime" json:"total_leadtime"`
	AdjustmentHours        float64    `gorm:"column:adjustment_hours" json:"adjustment_hours"`
	TerimaSampleAwalIpc    *time.Time `gorm:"column:terima_sample_awal_ipc" json:"terima_sample_awal_ipc"`
}

func (QcData) TableName() string {
	return "tb_qc_data"
}

type QcStep struct {
	WorkOrderId            int        `gorm:"primaryKey;autoIncrement" json:"work_order_id"`
	TanggalKirimkeQc       *time.Time `gorm:"column:tanggal_kirim_ke_qc" json:"tanggal_kirim_ke_qc"`
	TanggalQcAnalisa       *time.Time `gorm:"tanggal_qc_analisa" json:"tanggal_qc_analisa"`
	AnalisaCompleteDate    *time.Time `gorm:"analisa_complete_date" json:"analisa_complete_date"`
	QcReleaseDate          *time.Time `gorm:"qc_release_date" json:"qc_release_date"`
	KeteranganQc           *time.Time `gorm:"keterangan_qc" json:"keterangan_qc"`
	TempelLabelReleaseDate *time.Time `gorm:"tempel_label_release_date" json:"tempel_label_release_date"`
	KirimKeFilling         *time.Time `gorm:"kirim_ke_filling" json:"kirim_ke_filling"`
	KirimKeSampleFg        *time.Time `gorm:"kirim_ke_sample_fg" json:"kirim_ke_sample_fg"`
	NoSample               *time.Time `gorm:"no_sample" json:"no_sample"`
	UserId                 int        `gorm:"column:user_id" json:"user_id"`
	UserName               string     `gorm:"user_name" json:"user_name"`
}

func (QcStep) TableName() string {
	return "tb_qc_step"
}

type SheetPPIC struct {
	Id           string     `gorm:"column:id" json:"id"`
	TanggalCWO   *time.Time `gorm:"column:tanggal_cwo" json:"tanggal_cwo"`
	KodeProduk   string     `gorm:"column:kode_produk" json:"kode_produk" binding:"required"`
	NoBatch      string     `gorm:"column:no_batch" json:"no_batch" binding:"required"`
	NoWoRuah     string     `gorm:"column:no_wo_ruah" json:"no_wo_ruah" binding:"required"`
	NoWoKemas    string     `gorm:"column:no_wo_kemas" json:"no_wo_kemas" binding:"required"`
	RecipeRuah   string     `gorm:"column:recipe_ruah" json:"recipe_ruah" binding:"required"`
	RecipeKemas  string     `gorm:"column:recipe_kemas" json:"recipe_kemas" binding:"required"`
	DeleteStatus string     `gorm:"column:delete_status" json:"delete_status"`
	Ket          string     `gorm:"column:ket" json:"ket"`
}

func (SheetPPIC) TableName() string {
	return "tb_sheet_ppic"
}

type StorageTank struct {
	Id         int    `gorm:"primaryKey;autoIncrement" json:"id"`
	KodeTank   string `gorm:"column:kode_tank" json:"kode_tank"`
	MixingTank string `gorm:"column:mixing_tank" json:"mixing_tank"`
	Ruangan    string `gorm:"column:ruangan" json:"ruangan"`
}

func (StorageTank) TableName() string {
	return "tb_storage_tanks"
}

type Thresholds struct {
	Id               int    `gorm:"primaryKey;autoIncrement" json:"id"`
	BatasTreshold    string `gorm:"column:batas_treshold" json:"batas_treshold" binding:"required"`
	LimitBawahPharma int    `gorm:"column:limit_bawah_pharma" json:"limit_bawah_pharma" binding:"required"`
	LimitAtasPharma  int    `gorm:"column:limit_atas_pharma" json:"limit_atas_pharma" binding:"required"`
	LimitBawahHerbal int    `gorm:"column:limit_bawah_herbal" json:"limit_bawah_herbal" binding:"required"`
	LimitAtasHerbal  int    `gorm:"column:limit_atas_herbal" json:"limit_atas_herbal" binding:"required"`
}

func (Thresholds) TableName() string {
	return ("tb_thresholds")
}

type TriggerIPC struct {
	Id          int       `gorm:"primaryKey;autoIncrement" json:"id"`
	ProductsId  int       `gorm:"column:products_id;index" json:"products_id" binding:"required"`
	Product     Product   `gorm:"foreignKey:Products_id" json:"product"`
	ProductCode string    `gorm:"column:product_code" json:"product_code" binding:"required"`
	Batch       string    `gorm:"column:batch" json:"batch" binding:"required"`
	MachinesId  int       `gorm:"column:machines_id" json:"machines_id" binding:"required"`
	MachineName string    `gorm:"column:machine_name" json:"machine_name" binding:"required"`
	DateTime    time.Time `gorm:"column:date_time;autoUpdateTime" json:"date_time" binding:"required"`
	LastSyncAt  time.Time `gorm:"column:last_sync" json:"last_sync"`
	MatchedAt   time.Time `gorm:"column:matched_at" json:"matched_at"`
}

func (TriggerIPC) TableName() string {
	return "tb_trigger_ipc"
}

// WorkOrders adalah entitas sentral dari aplikasi Batch Tracker.
// Struct ini merepresentasikan satu siklus hidup penuh dari sebuah batch, mulai dari PPIC hingga Shipment.
// Menggunakan GORM tags untuk pemetaan ke tabel `tb_work_orders` dan struct tags JSON untuk serialisasi API.
type WorkOrders struct {
	Id                      uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	NoBatch                 string     `gorm:"no_batch;index" json:"no_batch"`
	NoWoRuah                string     `gorm:"column:no_wo_ruah" json:"no_wo_ruah"`
	NoWoKemas               string     `gorm:"column:no_wo_kemas" json:"no_wo_kemas"`
	KodeProduk              string     `gorm:"column:kode_produk;index" json:"kode_produk"`
	KodeRuah                string     `gorm:"column:kode_ruah;index" json:"kode_ruah"`
	TanggalWO               *time.Time `gorm:"column:tanggal_wo;index" json:"tanggal_wo"`
	PpicSubmitDate          *time.Time `gorm:"column:ppic_submit_date" json:"ppic_submit_date"`
	TanggalPotongStock      *time.Time `gorm:"column:tanggal_potong_stock" json:"tanggal_potong_stock"`
	TanggalTimbang          *time.Time `gorm:"column:tanggal_timbang" json:"tanggal_timbang"`
	TanggalTerimaVal1       *time.Time `gorm:"column:tanggal_terima_val1" json:"tanggal_terima_val1"`
	TanggalKirimVal1        *time.Time `gorm:"column:tanggal_kirim_val1" json:"tanggal_kirim_val1"`
	TanggalTerimaVal2       *time.Time `gorm:"column:tanggal_terima_val2" json:"tanggal_terima_val2"`
	TanggalKirimCompounding *time.Time `gorm:"column:tanggal_kirim_compounding" json:"tanggal_kirim_compounding"`
	MixingTank              *string     `gorm:"column:mixing_tank;index" json:"mixing_tank"`
	StorageTank             *string     `gorm:"column:storage_tank;index" json:"storage_tank"`
	TanggalKirimKeQC        *time.Time `gorm:"column:tanggal_kirim_ke_qc" json:"tanggal_kirim_ke_qc"`
	TanggalQcAnalisa        *time.Time `gorm:"column:tanggal_qc_analisa" json:"tanggal_qc_analisa"`
	AnalisaCompleteDate     *time.Time `gorm:"column:analisa_complete_date" json:"analisa_complete_date"`
	QcReleaseDate           *time.Time `gorm:"column:qc_release_date" json:"qc_release_date"`
	KeteranganQC            string     `gorm:"column:keterangan_qc" json:"keterangan_qc"`
	TempelLabelReleaseDate  *time.Time `gorm:"column:tempel_label_release_date" json:"tempel_label_release_date"`
	KirimKeFilling          *time.Time `gorm:"column:kirim_ke_filling" json:"kirim_ke_filling"`
	MesinFilling            *string     `gorm:"column:mesin_filling;index" json:"mesin_filling"`
	KirimKeSampleFG         *time.Time `gorm:"column:kirim_ke_sample_fg" json:"kirim_ke_sample_fg"`
	KirimKeEndPackaging     *time.Time `gorm:"column:kirim_ke_end_packaging" json:"kirim_ke_end_packaging"`
	KirimKeSerahTerimaBPP   *time.Time `gorm:"column:kirim_ke_serah_terima_bpp" json:"kirim_ke_serah_terima_bpp"`
	BarcodeFull             int        `gorm:"column:barcode_full" json:"barcode_full"`
	SetorRapDate            *time.Time `gorm:"column:setor_rap_date" json:"setor_rap_date"`
	SetorBrDate             *time.Time `gorm:"column:setor_br_date" json:"setor_br_date"`
	TerimaBrDate            *time.Time `gorm:"column:terima_br_date" json:"terima_br_date"`
	TerimaRapDate           *time.Time `gorm:"column:terima_rap_date" json:"terima_rap_date"`
	NoBatchSetorBR          *string     `gorm:"column:no_batch_setor_br" json:"no_batch_setor_br"`
	NoBatchSetorRAP         *string     `gorm:"column:no_batch_setor_rap" json:"no_batch_setor_rap"`
	StatusSetorBR           *string     `gorm:"column:status_setor_br" json:"status_setor_br"`
	StatusSetorRAP          *string     `gorm:"column:status_setor_rap" json:"status_setor_rap"`
	StatusQcRelease         string     `gorm:"column:status_qc_release" json:"status_qc_release"`
	QaReleaseDate           *time.Time `gorm:"column:qa_release_date" json:"qa_release_date"`
	ShipmentReceivedAt      *time.Time `gorm:"column:shipment_received_at" json:"shipment_received_at"`
	CreatedAt               *time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	IsActive                *bool      `gorm:"column:is_active;default:true" json:"is_active" binding:"oneof:true false"`
	UpdatedAt               *time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`
	DeleteStatus            *string     `gorm:"column:delete_status;index" json:"delete_status"`
	Ket                     string     `gorm:"column:ket" json:"ket"`
}

func (WorkOrders) TableName() string {
	return "tb_work_orders"
}

type LabelBiru struct {
	Kode_produk string `gorm:"column:kode_produk" json:"kode_produk"`
	Batch_no    string `gorm:"column:batch_no" json:"batch_no"`
}

func (LabelBiru) TableName() string {
	return "tb_label_biru"
}
