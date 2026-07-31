package handlers

import (
	"migrasi_batch_tracker/helpers"
	"migrasi_batch_tracker/models"
	"migrasi_batch_tracker/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

// KirimPpicHandler adalah HTTP handler untuk endpoint pengiriman data PPIC ke Produksi.
// Arsitektur:
// - Parsing payload JSON ke struct `models.Request`.
// - Ekstraksi context pengguna (User ID, Nama, Area) dari JWT middleware yang diset di `c.Get`.
// - Mendelegasikan logika bisnis utama ke `services.KirimPpicService`.
func (h *BatchTrackStruct) KirimPpicHandler(c *gin.Context) {
	var req models.Request

	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("Tidak ada WO yang dipilih.", http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	userIDany, _ := c.Get("user_id")
	userID := uint(userIDany.(float64))

	userNamaAny, _ := c.Get("nama")
	userNama := userNamaAny.(string)

	userAreaAny, _ := c.Get("area")
	userArea := userAreaAny.(string)

	userIP := c.ClientIP()

	err := services.KirimPpicService(h.db, req, userID, userNama, userArea, userIP)
	if err != nil {
		response := helpers.APIResponse("Gagal proses: "+err.Error(), http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponse("Batch WO berhasil dikirim.", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}

// PotongStockHandler menangani request HTTP untuk memproses potong stok bahan baku.
// Endpoint ini memastikan payload terikat dengan benar dan meneruskan konteks keamanan ke service layer.
func (h *BatchTrackStruct) PotongStockHandler(c *gin.Context) {
	var req models.NextRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("Tidak ada WO yang dipilih. "+err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	userIDFloat, _ := c.Get("user_id")
	userID := uint(userIDFloat.(float64))

	userNamaAny, _ := c.Get("nama")
	userNama := userNamaAny.(string)

	userAreaAny, _ := c.Get("area")
	userArea := userAreaAny.(string)

	userIP := c.ClientIP()

	err := services.PotongStockService(h.db, req, userID, userNama, userArea, userIP)

	if err != nil {
		response := helpers.APIResponse("Gagal proses: "+err.Error(), http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponse("Batch potong stock berhasil diproses.", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}

// TimbangHandler menangani sinkronisasi data timbangan secara manual (bukan lewat cron job).
// Arsitektur: Berbeda dengan handler lain, endpoint ini tidak menerima payload spesifik melainkan 
// memicu operasi sinkronisasi penuh di `services.TimbangService`.
func (h *BatchTrackStruct) TimbangHandler(c *gin.Context) {
	res, err := services.TimbangService(h.dbWeightrack, h.db)
	if err != nil {
		response := helpers.APIResponse("Gagal proses timbang: "+err.Error(), http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponse("Berhasil memuat data timbang", http.StatusOK, "success", res)
	c.JSON(http.StatusOK, response)
}

// Validasi1WhHandler melayani HTTP request dari tim Warehouse untuk validasi tahap 1.
func (h *BatchTrackStruct) Validasi1WhHandler(c *gin.Context) {
	var req models.NextRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("Tidak ada WO yang dipilih. "+err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	userIDFloat, _ := c.Get("user_id")
	userID := uint(userIDFloat.(float64))

	userNamaAny, _ := c.Get("nama")
	userNama := userNamaAny.(string)

	userAreaAny, _ := c.Get("area")
	userArea := userAreaAny.(string)

	userIP := c.ClientIP()

	err := services.WhValidasi1Service(h.db, req.Id, userID, userNama, userArea, userIP)

	if err != nil {
		response := helpers.APIResponse("Gagal proses: "+err.Error(), http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponse("Batch validasi 1 berhasil diproses.", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) Validasi2PrHandler(c *gin.Context) {
	var req models.NextRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("Tidak ada WO yang dipilih. "+err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	err := services.PrValidasi2Service(h.db, req)

	if err != nil {
		response := helpers.APIResponse("Gagal proses: "+err.Error(), http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponse("Batch validasi 2 berhasil diproses.", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}

// PrCompoundingHandler memproses request alokasi mixing tank (Payload `models.TankRequest`) 
// dan dimulainya proses compounding oleh Produksi.
func (h *BatchTrackStruct) PrCompoundingHandler(c *gin.Context) {
	var req models.TankRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse(err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	userIDFloat, _ := c.Get("user_id")
	userID := uint(userIDFloat.(float64))

	userNamaAny, _ := c.Get("nama")
	userNama := userNamaAny.(string)

	userAreaAny, _ := c.Get("area")
	userArea := userAreaAny.(string)

	userIP := c.ClientIP()

	err := services.PrCompoundingService(h.db, req, userID, userNama, userArea, userIP)

	if err != nil {
		response := helpers.APIResponse("Gagal proses: "+err.Error(), http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponse("Batch compounding berhasil diproses.", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) TftoStorageHandler(c *gin.Context) {
	var req models.TankRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse(err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	userIDFloat, _ := c.Get("user_id")
	userID := uint(userIDFloat.(float64))

	userNamaAny, _ := c.Get("nama")
	userNama := userNamaAny.(string)

	userAreaAny, _ := c.Get("area")
	userArea := userAreaAny.(string)

	userIP := c.ClientIP()

	err := services.TftoStorageService(h.db, req, userID, userNama, userArea, userIP)

	if err != nil {
		response := helpers.APIResponse("Gagal proses: "+err.Error(), http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponse("Batch compounding berhasil diproses.", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) QcAnalisaHandler(c *gin.Context) {
	var req models.TextInputRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("ID tidak ditemukan. "+err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	userIDFloat, _ := c.Get("user_id")
	userID := uint(userIDFloat.(float64))

	userNamaAny, _ := c.Get("nama")
	userNama := userNamaAny.(string)

	userAreaAny, _ := c.Get("area")
	userArea := userAreaAny.(string)

	userIP := c.ClientIP()

	err := services.QcAnalisaService(h.db, req, userID, userNama, userArea, userIP)

	if err != nil {
		response := helpers.APIResponse("Gagal proses: "+err.Error(), http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponse("Tanggal QC Analisa berhasil diperbarui.", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) QcReleaseKirimHandler(c *gin.Context) {
	var req models.NextRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("ID tidak ditemukan. "+err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	userIDFloat, _ := c.Get("user_id")
	userID := uint(userIDFloat.(float64))

	userNamaAny, _ := c.Get("nama")
	userNama := userNamaAny.(string)

	userAreaAny, _ := c.Get("area")
	userArea := userAreaAny.(string)

	userIP := c.ClientIP()

	err := services.QcReleaseKirimService(h.db, req, userID, userNama, userArea, userIP)

	if err != nil {
		response := helpers.APIResponse("Gagal proses: "+err.Error(), http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponse("Batch berhasil direlease ke QC Release.", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) KirimKeScanBarcodeHandler(c *gin.Context) {
	var req models.NextRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("Tidak ada batch yang dipilih. "+err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	userIDFloat, _ := c.Get("user_id")
	userID := uint(userIDFloat.(float64))

	userNamaAny, _ := c.Get("nama")
	userNama := userNamaAny.(string)

	userAreaAny, _ := c.Get("area")
	userArea := userAreaAny.(string)

	userIP := c.ClientIP()

	err := services.KirimKeScanBarcodeService(h.db, req, userID, userNama, userArea, userIP)

	if err != nil {
		response := helpers.APIResponse("Gagal proses: "+err.Error(), http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponse("Batch berhasil masuk ke Storage.", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) ScanStorageHandler(c *gin.Context) {
	var req models.TextInputRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("Tidak ada batch yang dipilih. "+err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	userIDFloat, _ := c.Get("user_id")
	userID := uint(userIDFloat.(float64))

	userNamaAny, _ := c.Get("nama")
	userNama := userNamaAny.(string)

	userAreaAny, _ := c.Get("area")
	userArea := userAreaAny.(string)

	userIP := c.ClientIP()

	err := services.ScanStorageService(h.db, req, userID, userNama, userArea, userIP)

	if err != nil {
		response := helpers.APIResponse("Gagal proses: "+err.Error(), http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponse("Scan cocok. Batch siap untuk Filling.", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) KirimKeSampleFGHandler(c *gin.Context) {
	var req models.TextInputRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("Tidak ada batch yang dipilih. "+err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	err := services.KirimKeSampleFGService(h.db, req)

	if err != nil {
		response := helpers.APIResponse("Gagal proses: "+err.Error(), http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponse("Batch berhasil dikirim ke Sample FG.", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) KirimKeEndPackagingHandler(c *gin.Context) {
	var req models.NextRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("Tidak ada batch yang dipilih. "+err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	userIDFloat, _ := c.Get("user_id")
	userID := uint(userIDFloat.(float64))

	userNamaAny, _ := c.Get("nama")
	userNama := userNamaAny.(string)

	userAreaAny, _ := c.Get("area")
	userArea := userAreaAny.(string)

	userIP := c.ClientIP()

	err := services.KirimKeEndPackagingDariSampleFGService(h.db, req, userID, userNama, userArea, userIP)

	if err != nil {
		response := helpers.APIResponse("Gagal proses: "+err.Error(), http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponse("Batch berhasil dikirim ke End Packaging.", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) ScanEndPackagingHandler(c *gin.Context) {
	var req models.TextInputRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("Tidak ada batch yang dipilih. "+err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	userIDFloat, _ := c.Get("user_id")
	userID := uint(userIDFloat.(float64))

	userNamaAny, _ := c.Get("nama")
	userNama := userNamaAny.(string)

	userAreaAny, _ := c.Get("area")
	userArea := userAreaAny.(string)

	userIP := c.ClientIP()

	err := services.ScanEndPackagingService(h.db, req, userID, userNama, userArea, userIP)

	if err != nil {
		response := helpers.APIResponse("Gagal proses: "+err.Error(), http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponse("Batch dikirim ke Serah Terima BPP.", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) ScanSerahTerimaBppHandler(c *gin.Context) {
	var req models.NextRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("Tidak ada batch yang dipilih. "+err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	userIDFloat, _ := c.Get("user_id")
	userID := uint(userIDFloat.(float64))

	userNamaAny, _ := c.Get("nama")
	userNama := userNamaAny.(string)

	userAreaAny, _ := c.Get("area")
	userArea := userAreaAny.(string)

	userIP := c.ClientIP()

	err := services.ScanSerahTerimaBppService(h.db, req, userID, userNama, userArea, userIP)

	if err != nil {
		response := helpers.APIResponse("Gagal proses: "+err.Error(), http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponse("Batch berhasil di-scan dan dikirim ke Setor BR.", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) SetorBrCompleteHandler(c *gin.Context) {
	var req models.NextRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("Tidak ada batch yang dipilih. "+err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	userIDFloat, _ := c.Get("user_id")
	userID := uint(userIDFloat.(float64))

	userNamaAny, _ := c.Get("nama")
	userNama := userNamaAny.(string)

	userAreaAny, _ := c.Get("area")
	userArea := userAreaAny.(string)

	userIP := c.ClientIP()

	err := services.SetorBrCompleteService(h.db, req, userID, userNama, userArea, userIP)

	if err != nil {
		response := helpers.APIResponse("Gagal proses: "+err.Error(), http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponse("Batch berhasil disetor BR.", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) SetorRapCompleteHandler(c *gin.Context) {
	var req models.NextRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("Tidak ada batch yang dipilih. "+err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	userIDFloat, _ := c.Get("user_id")
	userID := uint(userIDFloat.(float64))

	userNamaAny, _ := c.Get("nama")
	userNama := userNamaAny.(string)

	userAreaAny, _ := c.Get("area")
	userArea := userAreaAny.(string)

	userIP := c.ClientIP()

	err := services.SetorRapCompleteService(h.db, req, userID, userNama, userArea, userIP)

	if err != nil {
		response := helpers.APIResponse("Gagal proses: "+err.Error(), http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponse("Setor RAP berhasil diselesaikan.", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) SendToShipmentHandler(c *gin.Context) {
	var req models.NextRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("Tidak ada batch yang dipilih. "+err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	userIDFloat, _ := c.Get("user_id")
	userID := uint(userIDFloat.(float64))

	userNamaAny, _ := c.Get("nama")
	userNama := userNamaAny.(string)

	userAreaAny, _ := c.Get("area")
	userArea := userAreaAny.(string)

	userIP := c.ClientIP()

	err := services.SendToShipmentService(h.db, req, userID, userNama, userArea, userIP)

	if err != nil {
		response := helpers.APIResponse("Gagal proses: "+err.Error(), http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponse("Batch berhasil dikirim ke Shipment.", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) ReceiveShipmentHandler(c *gin.Context) {
	var req models.NextRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("Tidak ada batch yang dipilih. "+err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	userIDFloat, _ := c.Get("user_id")
	userID := uint(userIDFloat.(float64))

	userNamaAny, _ := c.Get("nama")
	userNama := userNamaAny.(string)

	userAreaAny, _ := c.Get("area")
	userArea := userAreaAny.(string)

	userIP := c.ClientIP()

	err := services.ReceiveShipmentService(h.db, req, userID, userNama, userArea, userIP)

	if err != nil {
		response := helpers.APIResponse("Gagal proses: "+err.Error(), http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponse("Batch berhasil diterima di Shipment.", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}

// DeletePpicHandler adalah representasi endpoint HTTP untuk operasi pembatalan (Soft Delete).
// Arsitektur:
// - Mengekstrak payload konfirmasi password.
// - Mengambil metadata level akses pengguna dari konteks JWT untuk keperluan otorisasi di service layer.
func (h *BatchTrackStruct) DeletePpicHandler(c *gin.Context) {
	var req models.DeleteRequestPpic

	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("Tidak ada batch yang dipilih. "+err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	userUsername := c.GetString("username")
	if userUsername == "" {
		response := helpers.APIResponse("Username tidak valid atau kosong", http.StatusUnauthorized, "error", nil)
		c.JSON(http.StatusUnauthorized, response)
		return
	}

	userNama := c.GetString("nama")
	userArea := c.GetString("area")
	userLevel := c.GetString("level")
	userIP := c.ClientIP()

	err := services.DeletePpicService(h.db, req, userNama, userUsername, userArea, userLevel, userIP)

	if err != nil {
		response := helpers.APIResponse("Gagal proses: "+err.Error(), http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponse("Wo berhasil dihapus.", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) DeletePotongStockHandler(c *gin.Context) {
	var req models.DeleteRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("Tidak ada batch yang dipilih. "+err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	userUsername := c.GetString("username")
	if userUsername == "" {
		response := helpers.APIResponse("Username tidak valid atau kosong", http.StatusUnauthorized, "error", nil)
		c.JSON(http.StatusUnauthorized, response)
		return
	}

	userNama := c.GetString("nama")
	userArea := c.GetString("area")
	userLevel := c.GetString("level")
	userIP := c.ClientIP()

	err := services.DeletePotongStockService(h.db, req, userNama, userUsername, userArea, userLevel, userIP)

	if err != nil {
		response := helpers.APIResponse("Gagal proses: "+err.Error(), http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponse("Wo berhasil dihapus.", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) DeletePreparasiHandler(c *gin.Context) {
	var req models.DeleteRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("Tidak ada batch yang dipilih. "+err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	userUsername := c.GetString("username")
	if userUsername == "" {
		response := helpers.APIResponse("Username tidak valid atau kosong", http.StatusUnauthorized, "error", nil)
		c.JSON(http.StatusUnauthorized, response)
		return
	}

	userNama := c.GetString("nama")
	userArea := c.GetString("area")
	userLevel := c.GetString("level")
	userIP := c.ClientIP()

	err := services.DeletePreparasiService(h.db, req, userNama, userUsername, userArea, userLevel, userIP)

	if err != nil {
		response := helpers.APIResponse("Gagal proses: "+err.Error(), http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponse("Wo berhasil dihapus.", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) DeleteWeighingHandler(c *gin.Context) {
	var req models.DeleteRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("Tidak ada batch yang dipilih. "+err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	userUsername := c.GetString("username")
	if userUsername == "" {
		response := helpers.APIResponse("Username tidak valid atau kosong", http.StatusUnauthorized, "error", nil)
		c.JSON(http.StatusUnauthorized, response)
		return
	}

	userNama := c.GetString("nama")
	userArea := c.GetString("area")
	userLevel := c.GetString("level")
	userIP := c.ClientIP()

	err := services.DeleteWeighingService(h.db, req, userNama, userUsername, userArea, userLevel, userIP)

	if err != nil {
		response := helpers.APIResponse("Gagal proses: "+err.Error(), http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponse("Wo berhasil dihapus.", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}
