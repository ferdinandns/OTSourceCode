package controllers

import (
	"lab-connect/backend-api/database"
	"lab-connect/backend-api/helpers"
	"lab-connect/backend-api/models"
	"lab-connect/backend-api/structs"
	"net/http"

	"github.com/gin-gonic/gin"
)

// GetAllLokasi - Untuk dropdown di form register
func GetAllLokasi(c *gin.Context) {
	var lokasi []models.Lokasi

	if err := database.DB.Find(&lokasi).Error; err != nil {
		c.JSON(http.StatusInternalServerError, structs.ErrorResponse{
			Success: false,
			Message: "Failed to fetch lokasi",
			Errors:  helpers.TranslateErrorMessage(err),
		})
		return
	}

	// Build response
	lokasiRes := []structs.LokasiResponse{}
	for _, l := range lokasi {
		lokasiRes = append(lokasiRes, structs.LokasiResponse{
			Id:   l.Id,
			Nama: l.Nama,
			Kode: l.Kode,
		})
	}

	c.JSON(http.StatusOK, structs.SuccessResponse{
		Success: true,
		Message: "Lokasi fetched successfully",
		Data:    lokasiRes,
	})
}

// CreateLokasi - Untuk admin menambah lokasi baru
func CreateLokasi(c *gin.Context) {
	var req = structs.LokasiCreateRequest{}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusUnprocessableEntity, structs.ErrorResponse{
			Success: false,
			Message: "Validation Errors",
			Errors:  helpers.TranslateErrorMessage(err),
		})
		return
	}

	lokasi := models.Lokasi{
		Nama: req.Nama,
		Kode: req.Kode,
	}

	if err := database.DB.Create(&lokasi).Error; err != nil {
		c.JSON(http.StatusInternalServerError, structs.ErrorResponse{
			Success: false,
			Message: "Failed to create lokasi",
			Errors:  helpers.TranslateErrorMessage(err),
		})
		return
	}

	c.JSON(http.StatusCreated, structs.SuccessResponse{
		Success: true,
		Message: "Lokasi created successfully",
		Data: structs.LokasiResponse{
			Id:   lokasi.Id,
			Nama: lokasi.Nama,
			Kode: lokasi.Kode,
		},
	})
}
