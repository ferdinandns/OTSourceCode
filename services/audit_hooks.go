package services

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strings"

	"gorm.io/gorm"
)

// LogCreate logs an INSERT event
func (s *AuditService) LogCreate(userID *uint, username string, targetTable string, recordID string, newValues interface{}, endpoint string, ip string) {
	s.LogAsync(AuditEntry{
		UserID:      userID,
		Username:    username,
		Action:      "INSERT",
		TargetTable: targetTable,
		RecordID:    recordID,
		NewValues:   newValues,
		Endpoint:    endpoint,
		IPAddress:   ip,
	})
}

// LogUpdate logs an UPDATE event with old and new values
func (s *AuditService) LogUpdate(userID *uint, username string, targetTable string, recordID string, oldValues interface{}, newValues interface{}, endpoint string, ip string) {
	s.LogAsync(AuditEntry{
		UserID:      userID,
		Username:    username,
		Action:      "UPDATE",
		TargetTable: targetTable,
		RecordID:    recordID,
		OldValues:   oldValues,
		NewValues:   newValues,
		Endpoint:    endpoint,
		IPAddress:   ip,
	})
}

// LogDelete logs a DELETE event with the old values (snapshot before deletion)
func (s *AuditService) LogDelete(userID *uint, username string, targetTable string, recordID string, oldValues interface{}, endpoint string, ip string) {
	s.LogAsync(AuditEntry{
		UserID:      userID,
		Username:    username,
		Action:      "DELETE",
		TargetTable: targetTable,
		RecordID:    recordID,
		OldValues:   oldValues,
		Endpoint:    endpoint,
		IPAddress:   ip,
	})
}

// ============================================
// GORM PLUGIN — auto-hooks for all models
// ============================================
// Register this plugin once in main.go / database setup:
//   db.Use(services.NewAuditPlugin(auditService))
//
// This catches ALL INSERT/UPDATE/DELETE across every GORM model automatically.

type AuditPlugin struct {
	audit *AuditService
}

func NewAuditPlugin(audit *AuditService) *AuditPlugin {
	return &AuditPlugin{audit: audit}
}

func (ap *AuditPlugin) Name() string {
	return "AuditPlugin"
}

func (ap *AuditPlugin) Initialize(db *gorm.DB) error {
	// After create
	if err := db.Callback().Create().After("gorm:create").Register("audit:after_create", ap.afterCreate); err != nil {
		return err
	}
	// Before update (capture old values)
	if err := db.Callback().Update().Before("gorm:update").Register("audit:before_update", ap.beforeUpdate); err != nil {
		return err
	}
	// After update
	if err := db.Callback().Update().After("gorm:update").Register("audit:after_update", ap.afterUpdate); err != nil {
		return err
	}
	// Before delete (capture snapshot)
	if err := db.Callback().Delete().Before("gorm:delete").Register("audit:before_delete", ap.beforeDelete); err != nil {
		return err
	}

	return nil
}

func (ap *AuditPlugin) afterCreate(db *gorm.DB) {
	if db.Error != nil || db.Statement == nil {
		return
	}
	if shouldSkip(db.Statement.Table) {
		return
	}

	recordID := extractRecordID(db)
	newValues := structToMap(db.Statement.Model)

	ap.audit.LogAsync(AuditEntry{
		Action:      "INSERT",
		TargetTable: db.Statement.Table,
		RecordID:    recordID,
		NewValues:   newValues,
		// UserID/Username filled in by the service layer when context is available
	})
}

func (ap *AuditPlugin) beforeUpdate(db *gorm.DB) {
	if db.Statement == nil || shouldSkip(db.Statement.Table) {
		return
	}

	// Try to fetch old values before the update happens
	if db.Statement.Model != nil {
		recordID := extractRecordID(db)
		if recordID != "" {
			oldModel := reflect.New(reflect.TypeOf(db.Statement.Model).Elem()).Interface()
			if err := db.Session(&gorm.Session{NewDB: true}).Table(db.Statement.Table).Where("id = ?", recordID).First(oldModel).Error; err == nil {
				db.Statement.Set("audit:old_values", structToMap(oldModel))
			}
		}
	}
}

func (ap *AuditPlugin) afterUpdate(db *gorm.DB) {
	if db.Error != nil || db.Statement == nil || shouldSkip(db.Statement.Table) {
		return
	}

	recordID := extractRecordID(db)
	newValues := structToMap(db.Statement.Model)
	oldValues, _ := db.Statement.Get("audit:old_values")
	oldMap, hasOld := oldValues.(map[string]interface{})

	// Kalau old_values tidak berhasil di-capture, cek newValues saja
	// — kalau semua field yang berubah ada di skipOnlyColumns, skip
	if !hasOld {
		allSkipped := true
		for k := range newValues {
			if !skipOnlyColumns[k] {
				allSkipped = false
				break
			}
		}
		if allSkipped {
			return
		}
	} else if isOnlySkippedColumns(oldMap, newValues) {
		return
	}

	ap.audit.LogAsync(AuditEntry{
		Action:      "UPDATE",
		TargetTable: db.Statement.Table,
		RecordID:    recordID,
		OldValues:   oldValues,
		NewValues:   newValues,
	})
}

func (ap *AuditPlugin) beforeDelete(db *gorm.DB) {
	if db.Statement == nil || shouldSkip(db.Statement.Table) {
		return
	}

	recordID := extractRecordID(db)
	if recordID != "" {
		oldModel := reflect.New(reflect.TypeOf(db.Statement.Model).Elem()).Interface()
		if err := db.Session(&gorm.Session{NewDB: true}).Table(db.Statement.Table).Where("id = ?", recordID).First(oldModel).Error; err == nil {
			ap.audit.LogAsync(AuditEntry{
				Action:      "DELETE",
				TargetTable: db.Statement.Table,
				RecordID:    recordID,
				OldValues:   structToMap(oldModel),
			})
		}
	}
}

// ============================================
// HELPERS
// ============================================

func extractRecordID(db *gorm.DB) string {
	if db.Statement == nil {
		return ""
	}
	// Try to get ID from model
	if db.Statement.Model != nil {
		v := reflect.ValueOf(db.Statement.Model)
		if v.Kind() == reflect.Ptr {
			v = v.Elem()
		}
		if v.Kind() == reflect.Struct {
			// Try common ID field names
			for _, fieldName := range []string{"Id", "ID", "id"} {
				f := v.FieldByName(fieldName)
				if f.IsValid() && !f.IsZero() {
					return fmt.Sprintf("%v", f.Interface())
				}
			}
		}
	}
	return ""
}

func structToMap(v interface{}) map[string]interface{} {
	if v == nil {
		return nil
	}
	// Marshal to JSON then back to map — cleanest way to handle nested structs
	b, err := json.Marshal(v)
	if err != nil {
		return nil
	}
	var result map[string]interface{}
	if err := json.Unmarshal(b, &result); err != nil {
		return nil
	}
	// Remove password-like fields
	sensitiveKeys := []string{"password", "password_hash", "token", "secret"}
	for k := range result {
		for _, sensitive := range sensitiveKeys {
			if strings.Contains(strings.ToLower(k), sensitive) {
				delete(result, k)
			}
		}
	}
	return result
}

var skipTables = map[string]bool{
	"audit_logs":     true,
	"sessions":       true,
	"refresh_tokens": true,
	"api_keys":       true,
	"lokasis":        true,
}

var skipOnlyColumns = map[string]bool{
	"lokasi_aktif_id":      true,
	"must_change_password": true,
	"password_changed_at":  true,
}

func shouldSkip(table string) bool {
	return skipTables[table]
}

var ignoreInComparison = map[string]bool{
	"updated_at":      true,
	"lokasi_utama":    true,
	"lokasi_tambahan": true,
}

func isOnlySkippedColumns(oldVals, newVals map[string]interface{}) bool {
	if oldVals == nil {
		return false
	}
	for k, newVal := range newVals {
		// Field ini tidak ikut perbandingan sama sekali
		if ignoreInComparison[k] {
			continue
		}
		// Skip nested object/array (artefak Preload)
		switch newVal.(type) {
		case map[string]interface{}, []interface{}:
			continue
		}
		// Field ini memang boleh berubah tanpa trigger audit
		if skipOnlyColumns[k] {
			continue
		}
		// Ada field substantif yang berbeda → audit
		if fmt.Sprintf("%v", oldVals[k]) != fmt.Sprintf("%v", newVal) {
			return false
		}
	}
	return true
}
