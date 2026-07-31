package models

import "time"

type EditThresholdsRequest struct {
	BatasTreshold    string  `json:"batas_treshold" binding:"required"`
	LimitBawahPharma float64 `json:"limit_bawah_pharma" binding:"gte=0"`
	LimitAtasPharma  float64 `json:"limit_atas_pharma" binding:"gte=0"`
	LimitBawahHerbal float64 `json:"limit_bawah_herbal" binding:"gte=0"`
	LimitAtasHerbal  float64 `json:"limit_atas_herbal" binding:"gte=0"`
	Username         string  `json:"username" binding:"required"`
	Password         string  `json:"password" binding:"required"`
}

type GetProductAlert struct {
	ID                                       uint       `json:"id"`
	KodeProduk                               string     `json:"kode_produk"`
	NamaProduk                               string     `json:"nama_produk"`
	UpdatedBy                                *string    `json:"updated_by"`
	UpdateTime                               *time.Time `json:"update_time"`
	Kategori                                 string     `json:"kategori"`
	Sediaan                                  string     `json:"sediaan"`
	ThresholdCwoPotongStock                  *float64   `gorm:"column:threshold_cwo_potong_stock" json:"threshold_cwo_potong_stock"`
	ThresholdPotongStockValidasi1            *float64   `gorm:"column:threshold_potong_stock_validasi_1" json:"threshold_potong_stock_validasi_1"`
	ThresholdValidasi1Validasi2              *float64   `gorm:"column:threshold_validasi_1_validasi_2" json:"threshold_validasi_1_validasi_2"`
	ThresholdValidasi2StartCompounding       *float64   `gorm:"column:threshold_validasi_2_start_compounding" json:"threshold_validasi_2_start_compounding"`
	ThresholdStartCompoundingEndCompounding  *float64   `gorm:"column:threshold_start_compounding_end_compounding" json:"threshold_start_compounding_end_compounding"`
	ThresholdEndCompoundingSamplingRuah      *float64   `gorm:"column:threshold_end_compounding_sampling_ruah" json:"threshold_end_compounding_sampling_ruah"`
	ThresholdSamplingRuahRuahDatang          *float64   `gorm:"column:threshold_sampling_ruah_ruah_datang" json:"threshold_sampling_ruah_ruah_datang"`
	ThresholdRuahDatangDisposisiRuah         *float64   `gorm:"column:threshold_ruah_datang_disposisi_ruah" json:"threshold_ruah_datang_disposisi_ruah"`
	ThresholdDisposisiRuahLabelingRuah       *float64   `gorm:"column:threshold_disposisi_ruah_labeling_ruah" json:"threshold_disposisi_ruah_labeling_ruah"`
	ThresholdLabelingRuahStartFilling        *float64   `gorm:"column:threshold_labeling_ruah_start_filling" json:"threshold_labeling_ruah_start_filling"`
	ThresholdStartFillingEndPackaging        *float64   `gorm:"column:threshold_start_filling_end_packaging" json:"threshold_start_filling_end_packaging"`
	ThresholdEndPackagingQaRilis             *float64   `gorm:"column:threshold_end_packaging_qa_rilis" json:"threshold_end_packaging_qa_rilis"`
	ThresholdEndPackagingSetorBr             *float64   `gorm:"column:threshold_end_packaging_setor_br" json:"threshold_end_packaging_setor_br"`
	ThresholdSetorBrQaRilis                  *float64   `gorm:"column:threshold_setor_br_qa_rilis" json:"threshold_setor_br_qa_rilis"`
	ThresholdEndPackagingSetorRap            *float64   `gorm:"column:threshold_end_packaging_setor_rap" json:"threshold_end_packaging_setor_rap"`
	ThresholdSetorRapQaRilis                 *float64   `gorm:"column:threshold_setor_rap_qa_rilis" json:"threshold_setor_rap_qa_rilis"`
	ThresholdEndFillingQaRilis               *float64   `gorm:"column:threshold_end_filling_qa_rilis" json:"threshold_end_filling_qa_rilis"`
	ThresholdEndFillingSetorBr               *float64   `gorm:"column:threshold_end_filling_setor_br" json:"threshold_end_filling_setor_br"`
	ThresholdEndFillingSetorRap              *float64   `gorm:"column:threshold_end_filling_setor_rap" json:"threshold_end_filling_setor_rap"`
	ThresholdQaRilisShipment                 *float64   `gorm:"column:threshold_qa_rilis_shipment" json:"threshold_qa_rilis_shipment"`
}

type EditAlertRequest struct {
	Field           string   `json:"field" binding:"required"`
	ConfirmUsername string   `json:"confirm_username" binding:"required"`
	ConfirmPassword string   `json:"confirm_password" binding:"required"`
	PharmaPowder    *float64 `json:"pharma_powder"` 
	HerbalLiquid    *float64 `json:"herbal_liquid"`
	PharmaLiquid    *float64 `json:"pharma_liquid"`
}