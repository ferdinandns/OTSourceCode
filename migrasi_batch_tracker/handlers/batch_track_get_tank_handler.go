package handlers

import (
	"migrasi_batch_tracker/helpers"
	"migrasi_batch_tracker/services"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

func (h *BatchTrackStruct) ShowListMixingTank(c *gin.Context){
	data, err:= services.GetMixingTank(h.db)
	if err!= nil{
		response:= helpers.APIResponse("Gagal mengambil data Mixing Tank.", 500, "error", err.Error())
		c.JSON(500, response)
		return
	}
	response:= helpers.APIResponse("Data Mixing Tank berhasil dimuat.", 200, "success", data)
	c.JSON(http.StatusOK, response)
}

func (h *BatchTrackStruct) ShowListStorageTank(c *gin.Context){
	id:= c.Param("id") 
	workOrderId, _ := strconv.Atoi(id)

	if workOrderId == 0 {
		c.JSON(400, gin.H{"message": "ID tidak valid"})
		return
	}

	dataMesin, err := services.GetStorageTank(h.db, workOrderId)
	
	if err != nil {
		c.JSON(500, gin.H{"message": "Gagal mengambil daftar mesin"})
		return
	}

	c.JSON(200, gin.H{"message": "Sukses", "data": dataMesin})
}