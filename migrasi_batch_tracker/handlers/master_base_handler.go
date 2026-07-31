package handlers

import (
	"net/http"

	"migrasi_batch_tracker/helpers"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type BaseHandler[T any] struct {
	db *gorm.DB
}

func NewBaseHandler[T any](db *gorm.DB) *BaseHandler[T] {
	return &BaseHandler[T]{db: db}
}

func (h *BaseHandler[T]) Index(c *gin.Context){
	var records []T
	if err:= h.db.Find(&records).Error; err != nil {
		response:= helpers.APIResponse("gagal mengambil data", http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}
	response:= helpers.APIResponse("berhasil mengambil data", http.StatusOK, "success", records)
	c.JSON(http.StatusOK, response)
}

func (h *BaseHandler[T]) Create(c *gin.Context) {
	var record T 
	if err:= c.ShouldBindJSON(&record); err!= nil {
		response:= helpers.APIResponse("data tidak valid", http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	if err:= h.db.Create(&record).Error; err!= nil {
		response:= helpers.APIResponse("gagal menambahkan data", http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return	
	}
	c.JSON(http.StatusCreated, record)
}

func (h* BaseHandler[T]) Update(c* gin.Context){
	id:= c.Param("id")
	var record T 

	if err:= h.db.First(&record, id).Error; err!= nil {
		response:= helpers.APIResponse("data tidak ditemukan", http.StatusNotFound, "error", nil)
		c.JSON(http.StatusNotFound, response)
		return
	}

	var updateData map[string]interface{}
	if err:= c.ShouldBindJSON(&updateData); err!= nil {
		response:= helpers.APIResponse("data tidak valid", http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	if err:= h.db.Model(&record).Updates(updateData).Error; err!= nil {
		response:= helpers.APIResponse("gagal memperbarui data", http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	h.db.First(&record, id)
	response:= helpers.APIResponse("berhasil memperbarui data", http.StatusOK, "success", record)
	c.JSON(http.StatusOK, response)
}

func (h* BaseHandler[T]) Delete(c* gin.Context) {
	id:= c.Param("id")
	var record T
	if err:= h.db.Delete(&record, id).Error; err!= nil {
		response:= helpers.APIResponse("gagal menghapus data", http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response:= helpers.APIResponse("berhasil menghapus data", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}