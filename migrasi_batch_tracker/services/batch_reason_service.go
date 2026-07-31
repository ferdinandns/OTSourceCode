package services

import (
	"migrasi_batch_tracker/models"

	"gorm.io/gorm"
)

type BatchReasonService struct {
	db *gorm.DB
}

func NewBatchReasonService(db *gorm.DB) *BatchReasonService {
	return &BatchReasonService{db: db}
}

// CreateReason menyimpan alasan batch baru ke database.
func (s *BatchReasonService) CreateReason(reason *models.BatchReasons) error {
	return s.db.Create(reason).Error
}

func (s *BatchReasonService) UpdateReason(id int, updateData map[string]interface{}) (*models.BatchReasons, error) {
	var reason models.BatchReasons
	if err := s.db.First(&reason, id).Error; err != nil {
		return nil, err
	}

	if err := s.db.Model(&reason).Updates(updateData).Error; err != nil {
		return nil, err
	}
	return &reason, nil
}

func (s *BatchReasonService) DeleteReason(id int) error {
	return s.db.Delete(&models.BatchReasons{}, id).Error
}

// GetReasonsByBatchIDs mengambil semua reason yang terkait dengan beberapa batch sekaligus untuk efisiensi query.
func (s *BatchReasonService) GetReasonsByBatchIDs(batchIDs []int) (map[int][]models.BatchReasons, error) {
	var reasons []models.BatchReasons
	resultMap := make(map[int][]models.BatchReasons)

	if len(batchIDs) == 0 {
		return resultMap, nil
	}

	// Fetch semua reason dalam 1 query
	if err := s.db.Where("batch_id IN ?", batchIDs).Order("created_at asc").Find(&reasons).Error; err != nil {
		return nil, err
	}

	// Kelompokkan reason berdasarkan batch_id ke dalam map
	for _, r := range reasons {
		resultMap[r.BatchId] = append(resultMap[r.BatchId], r)
	}

	return resultMap, nil
}
