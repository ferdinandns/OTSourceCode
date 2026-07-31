package services

import (
	"errors"
	"time"

	"migrasi_batch_tracker/models"

	"gorm.io/gorm"
)

// GetAuditTrailService mengambil data audit trail beserta total jumlah datanya
func GetAuditTrailService(db *gorm.DB, startDateStr string, endDateStr string) ([]models.AuditTrail, int64, error) {
	var records []models.AuditTrail
	var total int64

	if startDateStr == "" && endDateStr == "" {
		today := time.Now().Format("2006-01-02")
		startDateStr = today
		endDateStr = today
	}

	if startDateStr != "" && endDateStr != "" {
		start, errStart := time.Parse("2006-01-02", startDateStr)
		end, errEnd := time.Parse("2006-01-02", endDateStr)

		if errStart != nil || errEnd != nil {
			return nil, 0, errors.New("format tanggal tidak valid, gunakan YYYY-MM-DD")
		}

		if end.Sub(start).Hours() > (30 * 24) {
			return nil, 0, errors.New("tanggal pencarian hanya boleh dalam rentang sebulan")
		}
	}

	query := db.Table("tb_admin_audit_trail")

	if startDateStr != "" {
		query = query.Where("tanggal >= ?", startDateStr)
	}

	if endDateStr != "" {
		query = query.Where("tanggal <= ?", endDateStr)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := query.Order("id DESC").Find(&records).Error; err != nil {
		return nil, 0, err
	}

	return records, total, nil
}