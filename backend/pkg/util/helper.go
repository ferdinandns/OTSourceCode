package util

import (
	"fmt"
	"strings"

	"emertrack/internal/domain"
	"gorm.io/gorm"
)

func BuildOrderClause(sortBy, sortOrder, defaultColumn, defaultOrder string, allowedColumns map[string]string) string {
	col, ok := allowedColumns[sortBy]
	if !ok {
		col = defaultColumn
	}

	dir := strings.ToUpper(defaultOrder)
	switch strings.ToUpper(sortOrder) {
	case "ASC":
		dir = "ASC"
	case "DESC":
		dir = "DESC"
	}

	return fmt.Sprintf("ORDER BY %s %s", col, dir)
}

func UpdateScheduleSnapshot(tx *gorm.DB, scheduleID *uint, status string) error {
	if scheduleID == nil {
		return nil
	}
	return tx.Model(&domain.InspectionSchedule{}).
		Where("id = ?", *scheduleID).
		Update("sarpras_status_snapshot", status).Error
}

// GetScheduleIDByRepairOrder trace scheduleID dari repair_order → inspection → schedule
func GetScheduleIDByRepairOrder(tx *gorm.DB, repairOrderID uint) *uint {
	var scheduleID *uint
	tx.Table("inspections i").
		Select("i.schedule_id").
		Joins("JOIN repair_orders ro ON ro.inspection_id = i.id").
		Where("ro.id = ?", repairOrderID).
		Scan(&scheduleID)
	return scheduleID
}

func FormatAction(action string) string {
	switch strings.ToLower(action) {
	case "create":
		return "Tambah"
	case "edit":
		return "Ubah"
	case "delete":
		return "Hapus"
	default:
		return action
	}
}

func FormatEntityType(entityType string) string {
	switch entityType {
	case "Sarpras":
		return "Sarpras"
	case "SarprasType":
		return "Jenis Sarpras"
	case "SarprasBulk":
		return "Import Sarpras"
	case "Site":
		return "Site"
	case "Department":
		return "Departemen"
	case "User":
		return "User"
	default:
		return entityType
	}
}
