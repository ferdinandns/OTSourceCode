package handlers

import (
	"migrasi_batch_tracker/middleware"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// BatchTrackStruct menyimpan dependency database yang dipakai oleh seluruh handler workflow batch tracking.
type BatchTrackStruct struct {
	db           *gorm.DB
	dbWeightrack *gorm.DB
}

// NewBatchTrack membuat instance handler workflow dengan koneksi database aplikasi dan weightrack.
func NewBatchTrack(appDB, weightrackDB *gorm.DB) *BatchTrackStruct {
	return &BatchTrackStruct{
		db:           appDB,
		dbWeightrack: weightrackDB,
	}
}

// RegisterPublicRoutes mendaftarkan endpoint yang bisa diakses untuk melihat list tahap batch tanpa aksi mutasi.
func (h *BatchTrackStruct) RegisterPublicRoutes(rg *gin.RouterGroup) {
	rg.GET("/kirim-ppic", h.ShowListSheetPpic)

	rg.GET("/potong-stock", h.ShowListPotongStock)

	rg.GET("/wh-preparasi", h.ShowListWhPreparasi)

	rg.GET("/timbang", h.ShowListTimbang)

	rg.GET("/validasi-1", h.ShowListValidasi1)

	rg.GET("/validasi-2", h.ShowListValidasi2)

	rg.GET("/pr-compounding", h.ShowListMixingTankCompounding)

	rg.GET("/to-storage", h.ShowListTransferStorage)

	rg.GET("/qc-analisa", h.ShowListQcTerimaSample)

	rg.GET("/qc-release", h.ShowListQcAnalisaComplete)

	rg.GET("/kirim-ke-scan-barcode", h.ShowListQcRelease)

	rg.GET("/scan-storage", h.ShowListScanBarcodeStorage)

	rg.GET("/kirim-ke-sample-fg", h.ShowListProduksiFilling)

	rg.GET("/kirim-ke-end-packaging", h.ShowListSampleFG)

	rg.GET("/scan-end-packaging", h.ShowListEndPackaging)

	rg.GET("/scan-serah-terima-bpp", h.ShowListSerahTerimaBpp)

	rg.GET("/setor-br-complete", h.ShowListTerimaBR)

	rg.GET("/setor-rap-complete", h.ShowListTerimaRAP)

	rg.GET("/send-to-shipment", h.ShowListQaRilis)

	rg.GET("/receive-shipment", h.ShowListShipment)

}

// RegisterPrivateRoutes mendaftarkan endpoint aksi yang memerlukan autentikasi dan otorisasi user.
func (h *BatchTrackStruct) RegisterPrivateRoutes(rg *gin.RouterGroup) {
	rg.POST("/kirim-ppic", h.KirimPpicHandler)
	rg.DELETE("/kirim-ppic/:id", middleware.AccessArea("Administrator", "PPIC"), middleware.AccessLevel("administrator", "manager", "supervisor", "staff_ppic"), middleware.AccessDetailArea(h.db, "Administrator", "PPIC Site"), h.DeletePpicHandler)

	rg.POST("/potong-stock", h.PotongStockHandler)
	rg.DELETE("/potong-stock/:id", middleware.AccessArea("Administrator", "PPIC"), middleware.AccessLevel("administrator", "manager", "supervisor", "staff_ppic"), middleware.AccessDetailArea(h.db, "Administrator", "PPIC Site"), h.DeletePotongStockHandler)

	rg.DELETE("/wh-preparasi/:id", middleware.AccessArea("Administrator", "PPIC"), middleware.AccessLevel("administrator", "manager", "supervisor", "staff_ppic"), middleware.AccessDetailArea(h.db, "Administrator", "PPIC Site"), h.DeletePreparasiHandler)

	rg.POST("/timbang", h.TimbangHandler)
	rg.DELETE("/timbang/:id", middleware.AccessArea("Administrator", "PPIC"), middleware.AccessLevel("administrator", "manager", "supervisor", "staff_ppic"), middleware.AccessDetailArea(h.db, "Administrator", "PPIC Site"), h.DeleteWeighingHandler)

	rg.POST("/validasi-1", h.Validasi1WhHandler)

	rg.POST("/validasi-2", h.Validasi2PrHandler)

	rg.POST("/pr-compounding", h.PrCompoundingHandler)

	rg.POST("/to-storage", h.TftoStorageHandler)

	rg.POST("/qc-analisa", h.QcAnalisaHandler)

	rg.POST("/qc-release", h.QcReleaseKirimHandler)

	rg.POST("/kirim-ke-scan-barcode", h.KirimKeScanBarcodeHandler)

	rg.POST("/scan-storage", h.ScanStorageHandler)

	rg.POST("/kirim-ke-sample-fg", h.KirimKeSampleFGHandler)

	rg.POST("/kirim-ke-end-packaging", h.KirimKeEndPackagingHandler)

	rg.POST("/scan-end-packaging", h.ScanEndPackagingHandler)

	rg.POST("/scan-serah-terima-bpp", h.ScanSerahTerimaBppHandler)

	rg.POST("/setor-br-complete", h.SetorBrCompleteHandler)

	rg.POST("/setor-rap-complete", h.SetorRapCompleteHandler)

	rg.POST("/send-to-shipment", h.SendToShipmentHandler)

	rg.POST("/receive-shipment", h.ReceiveShipmentHandler)

	//route handler get tank
	rg.GET("/get-mixing-tank", h.ShowListMixingTank)
	rg.GET("/get-storage-tank/:id", h.ShowListStorageTank)
}
