package handlers

import (
	"migrasi_batch_tracker/helpers"
	"migrasi_batch_tracker/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ShowListSheetPpic mengambil data list awal untuk tahap PPIC.
// Arsitektur View Handler:
// - Tidak mem-parsing payload JSON karena ini murni operasi GET/Read.
// - Memanggil fungsi pada service layer yang mereturn array struct, jumlah data, dan (opsional) metrik lain.
// - Membungkus hasil ke dalam standar format response API (menggunakan `helpers.APIResponseList` atau `gin.H`).
func (h *BatchTrackStruct) ShowListSheetPpic(c *gin.Context) {
	data, count, err := services.GetSheetPpic(h.db)

	if err != nil {
		response := helpers.APIResponseList("Gagal mengambil data PPIC.", http.StatusInternalServerError, "error", count, err.Error())
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponseList("Data PPIC dimuat.", http.StatusOK, "success", count, data)
	c.JSON(http.StatusOK, response)
}

// ShowListPotongStock mengambil data yang sedang berada di tahap potong stock.
func (h *BatchTrackStruct) ShowListPotongStock(c *gin.Context) {
	data, count, countOver, err := services.GetPotongStock(h.db)

	if err != nil {
		response := helpers.APIResponseList("Gagal mengambil data potong stock.", http.StatusInternalServerError, "error", count, err.Error())
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	// response:= helpers.APIResponseList("Data potong stock berhasil dimuat.", http.StatusOK, "success", count, data)
	meta := gin.H{
		"message":    "Data potong stock berhasil dimuat.",
		"code":       http.StatusOK,
		"status":     "success",
		"count":      count,
		"count_over": countOver,
	}

	response := gin.H{
		"meta": meta,
		"data": data}
	c.JSON(http.StatusOK, response)
}

// ShowListWhPreparasi menampilkan batch yang sedang menunggu proses preparasi sebelum timbang.
func (h *BatchTrackStruct) ShowListWhPreparasi(c *gin.Context) {
	data, count, err := services.GetPreparasi(h.db)

	if err != nil {
		response := helpers.APIResponseList("Gagal mengambil data wh preparasi.", http.StatusInternalServerError, "error", count, err.Error())
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponseList("Data wh preparasi berhasil dimuat.", http.StatusOK, "success", count, data)
	c.JSON(http.StatusOK, response)
}

// ShowListTimbang mengambil data tahap timbang dari database aplikasi dan weightrack.
func (h *BatchTrackStruct) ShowListTimbang(c *gin.Context) {
	data, count, err := services.GetTimbang(h.db, h.dbWeightrack)

	if err != nil {
		response := helpers.APIResponseList("Gagal mengambil data timbang.", http.StatusInternalServerError, "error", count, err.Error())
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponseList("Data timbang berhasil dimuat.", http.StatusOK, "success", count, data)
	c.JSON(http.StatusOK, response)
}

// ShowListValidasi1 menampilkan batch yang sudah lewat tahap timbang dan menunggu validasi 1.
func (h *BatchTrackStruct) ShowListValidasi1(c *gin.Context) {
	data, count, err := services.GetValidasi1(h.db)

	if err != nil {
		response := helpers.APIResponseList("Gagal mengambil data validasi 1.", http.StatusInternalServerError, "error", count, err.Error())
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponseList("Data validasi 1 berhasil dimuat.", http.StatusOK, "success", count, data)
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) ShowListValidasi2(c *gin.Context) {
	data, count, countOver, err := services.GetValidasi2(h.db)

	if err != nil {
		response := helpers.APIResponseList("Gagal mengambil data validasi 2.", http.StatusInternalServerError, "error", count, err.Error())
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	// response:= helpers.APIResponseList("Data validasi 2 berhasil dimuat.", http.StatusOK, "success", count, data)
	meta := gin.H{
		"message":    "Data validasi 2 berhasil dimuat.",
		"code":       http.StatusOK,
		"status":     "success",
		"count":      count,
		"count_over": countOver,
	}

	response := gin.H{
		"meta": meta,
		"data": data}
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) ShowListMixingTankCompounding(c *gin.Context) {
	data, count, err := services.GetMixingTankCompounding(h.db)

	if err != nil {
		response := helpers.APIResponseList("Gagal mengambil data compounding.", http.StatusInternalServerError, "error", count, err.Error())
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponseList("Data compounding berhasil dimuat.", http.StatusOK, "success", count, data)
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) ShowListTransferStorage(c *gin.Context) {
	data, count, countOver, err := services.GetTransferStorage(h.db)

	if err != nil {
		response := helpers.APIResponseList("Gagal mengambil data transfer storage.", http.StatusInternalServerError, "error", count, err.Error())
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	// response:= helpers.APIResponseList("Data transfer storage berhasil dimuat.", http.StatusOK, "success", count, data)
	meta := gin.H{
		"message":    "Data transfer storage berhasil dimuat.",
		"code":       http.StatusOK,
		"status":     "success",
		"count":      count,
		"count_over": countOver,
	}

	response := gin.H{
		"meta": meta,
		"data": data}
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) ShowListQcTerimaSample(c *gin.Context) {
	data, count, countOver, err := services.GetQcTerimaSample(h.db)

	if err != nil {
		response := helpers.APIResponseList("Gagal mengambil data QC Terima Sample.", http.StatusInternalServerError, "error", count, err.Error())
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	// response:= helpers.APIResponseList("Data QC Terima Sample berhasil dimuat.", http.StatusOK, "success", count, data)
	meta := gin.H{
		"message":    "Data QC Terima Sample berhasil dimuat.",
		"code":       http.StatusOK,
		"status":     "success",
		"count":      count,
		"count_over": countOver,
	}
	response := gin.H{
		"meta": meta,
		"data": data}
	c.JSON(http.StatusOK, response)
}

// ShowListQcAnalisaComplete menampilkan batch yang sudah selesai analisa QC dan menunggu release.
func (h *BatchTrackStruct) ShowListQcAnalisaComplete(c *gin.Context) {
	data, count, err := services.GetQcAnalisaComplete(h.db)

	if err != nil {
		response := helpers.APIResponseList("Gagal mengambil data QC analisa complete.", http.StatusInternalServerError, "error", count, err.Error())
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponseList("Data QC analisa complete berhasil dimuat.", http.StatusOK, "success", count, data)
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) ShowListQcRelease(c *gin.Context) {
	data, count, err := services.GetQcRelease(h.db)

	if err != nil {
		response := helpers.APIResponseList("Gagal mengambil data QC Release.", http.StatusInternalServerError, "error", count, err.Error())
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponseList("Data QC Release berhasil dimuat.", http.StatusOK, "success", count, data)
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) ShowListScanBarcodeStorage(c *gin.Context) {
	data, count, err := services.GetScanBarcodeStorage(h.db)

	if err != nil {
		response := helpers.APIResponseList("Gagal mengambil data Scan Barcode Storage.", http.StatusInternalServerError, "error", count, err.Error())
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponseList("Data Scan Barcode Storage berhasil dimuat.", http.StatusOK, "success", count, data)
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) ShowListProduksiFilling(c *gin.Context) {
	data, count, err := services.GetProduksiFilling(h.db)

	if err != nil {
		response := gin.H{
			"code":    http.StatusInternalServerError,
			"message": "Gagal mengambil data Produksi Filling.",
			"status":  "error",
			"count":   count,
			"data":    err.Error(),
		}
		c.JSON(http.StatusInternalServerError, response)
		return
	}
	response := gin.H{
		"code":    http.StatusOK,
		"message": "Data Produksi Filling berhasil dimuat.",
		"status":  "success",
		"count":   count,
		"data":    data,
	}
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) ShowListSampleFG(c *gin.Context) {
	data, count, err := services.GetSampleFG(h.db)

	if err != nil {
		response := helpers.APIResponseList("Gagal mengambil data Sample FG.", http.StatusInternalServerError, "error", count, err.Error())
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponseList("Data Sample FG berhasil dimuat.", http.StatusOK, "success", count, data)
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) ShowListEndPackaging(c *gin.Context) {
	data, count, err := services.GetEndPackaging(h.db)

	if err != nil {
		response := helpers.APIResponseList("Gagal mengambil data End Packaging.", http.StatusInternalServerError, "error", count, err.Error())
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponseList("Data End Packaging berhasil dimuat.", http.StatusOK, "success", count, data)
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) ShowListSerahTerimaBpp(c *gin.Context) {
	data, count, err := services.GetSerahTerimaBpp(h.db)

	if err != nil {
		response := helpers.APIResponseList("Gagal mengambil data Serah Terima BPP.", http.StatusInternalServerError, "error", count, err.Error())
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponseList("Data Serah Terima BPP berhasil dimuat.", http.StatusOK, "success", count, data)
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) ShowListTerimaBR(c *gin.Context) {
	data, count, err := services.GetTerimaBR(h.db)

	if err != nil {
		response := helpers.APIResponseList("Gagal mengambil data Terima BR.", http.StatusInternalServerError, "error", count, err.Error())
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponseList("Data Terima BR berhasil dimuat.", http.StatusOK, "success", count, data)
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) ShowListTerimaRAP(c *gin.Context) {
	data, count, err := services.GetTerimaRAP(h.db)

	if err != nil {
		response := helpers.APIResponseList("Gagal mengambil data Terima RAP.", http.StatusInternalServerError, "error", count, err.Error())
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponseList("Data Terima RAP berhasil dimuat.", http.StatusOK, "success", count, data)
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) ShowListQaRilis(c *gin.Context) {
	data, count, err := services.GetQaRilis(h.db)

	if err != nil {
		response := helpers.APIResponseList("Gagal mengambil data QA Rilis.", http.StatusInternalServerError, "error", count, err.Error())
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponseList("Data QA Rilis berhasil dimuat.", http.StatusOK, "success", count, data)
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) ShowListShipment(c *gin.Context) {
	data, count, err := services.GetShipment(h.db)

	if err != nil {
		response := helpers.APIResponseList("Gagal mengambil data Shipment.", http.StatusInternalServerError, "error", count, err.Error())
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponseList("Data Shipment berhasil dimuat.", http.StatusOK, "success", count, data)
	c.JSON(http.StatusOK, response)
}
