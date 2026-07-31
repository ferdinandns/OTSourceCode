package domain

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"
)

// --- ENTITIES ---

type Site struct {
	ID        uint   `gorm:"primaryKey"`
	Code      string `gorm:"uniqueIndex;not null;size:20"`
	Name      string `gorm:"not null;size:100"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

type Department struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Code      string         `gorm:"uniqueIndex;not null;size:20" json:"code"`
	Name      string         `gorm:"not null;size:100" json:"name"`
	IsQs      bool           `gorm:"default:false" json:"is_qs"`
	SiteID    uint           `gorm:"not null;index" json:"site_id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
	Site      Site           `gorm:"foreignKey:SiteID;constraint:OnDelete:RESTRICT" json:"site"`
}

type DepartmentRow struct {
	ID        uint
	Code      string `gorm:"column:department_code"`
	Name      string `gorm:"column:department_name"`
	IsQs      bool
	SiteCode  string `gorm:"column:site_code"`
	SiteName  string `gorm:"column:site_name"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

// DepartmentReferences holds counts of records referencing a department.
type DepartmentReferences struct {
	Users        int64 `json:"users"`
	SarprasTypes int64 `json:"sarpras_types"`
	Sarpras      int64 `json:"sarpras"`
}

// HasReferences returns true if any referencing records exist.
func (r *DepartmentReferences) HasReferences() bool {
	return r.Users > 0 || r.SarprasTypes > 0 || r.Sarpras > 0
}

// Describe returns a human-readable message describing the references.
func (r *DepartmentReferences) Describe(entityLabel string) string {
	var parts []string
	if r.Users > 0 {
		parts = append(parts, fmt.Sprintf("%d users", r.Users))
	}
	if r.SarprasTypes > 0 {
		parts = append(parts, fmt.Sprintf("%d sarpras types", r.SarprasTypes))
	}
	if r.Sarpras > 0 {
		parts = append(parts, fmt.Sprintf("%d sarpras records", r.Sarpras))
	}
	if len(parts) == 0 {
		return ""
	}
	return fmt.Sprintf("Cannot delete %s: still referenced by %s. Please reassign or remove those records first.",
		entityLabel, fmt.Sprintf("%s", joinParts(parts)))
}

// SiteReferences holds counts of records referencing a site.
type SiteReferences struct {
	Users       int64 `json:"users"`
	Departments int64 `json:"departments"`
	Sarpras     int64 `json:"sarpras"`
}

// HasReferences returns true if any referencing records exist.
func (r *SiteReferences) HasReferences() bool {
	return r.Users > 0 || r.Departments > 0 || r.Sarpras > 0
}

// Describe returns a human-readable message describing the references.
func (r *SiteReferences) Describe(entityLabel string) string {
	var parts []string
	if r.Users > 0 {
		parts = append(parts, fmt.Sprintf("%d users", r.Users))
	}
	if r.Departments > 0 {
		parts = append(parts, fmt.Sprintf("%d departments", r.Departments))
	}
	if r.Sarpras > 0 {
		parts = append(parts, fmt.Sprintf("%d sarpras records", r.Sarpras))
	}
	if len(parts) == 0 {
		return ""
	}
	return fmt.Sprintf("Cannot delete %s: still referenced by %s. Please reassign or remove those records first.",
		entityLabel, joinParts(parts))
}

// joinParts joins parts with commas and "and" for the last element.
func joinParts(parts []string) string {
	if len(parts) == 0 {
		return ""
	}
	if len(parts) == 1 {
		return parts[0]
	}
	result := parts[0]
	for i := 1; i < len(parts)-1; i++ {
		result += ", " + parts[i]
	}
	result += " and " + parts[len(parts)-1]
	return result
}

// --- INTERFACES ---

type MasterRepository interface {
	// Departments
	CreateDepartment(ctx context.Context, d *Department) error
	UpdateDepartment(ctx context.Context, d *Department) error
	DeleteDepartment(ctx context.Context, id uint) error
	FindByIdDepartment(ctx context.Context, id uint) (*Department, error)
	FindByCodeDepartment(ctx context.Context, code string) (*Department, error)
	ListDepartment(ctx context.Context, filter map[string]interface{}) ([]DepartmentRow, error)

	CreateSite(ctx context.Context, s *Site) error
	UpdateSite(ctx context.Context, s *Site) error
	DeleteSite(ctx context.Context, id uint) error
	FindByIdSite(ctx context.Context, id uint) (*Site, error)
	ListSite(ctx context.Context, filter map[string]interface{}) ([]Site, error)
	FindByCodeSite(ctx context.Context, code string) (*Site, error)

	CheckDepartmentReferences(ctx context.Context, id uint) (*DepartmentReferences, error)
	CheckSiteReferences(ctx context.Context, id uint) (*SiteReferences, error)

	CreateGenericTx(tx *gorm.DB, entity interface{}) error
	UpdateGenericTx(tx *gorm.DB, id uint, entity interface{}) error
	DeleteGenericTx(tx *gorm.DB, entity interface{}, id uint) error
}

type MasterService interface {
	RequestCreateDepartment(ctx context.Context, userID uint, req *Department, notes string) (*ApprovalRequest, error)
	RequestEditDepartment(ctx context.Context, userID, id uint, req *Department, notes string) (*ApprovalRequest, error)
	RequestDeleteDepartment(ctx context.Context, userID, id uint) (*ApprovalRequest, error)
	ListDepartments(ctx context.Context, filter map[string]interface{}) ([]DepartmentRow, error)

	RequestCreateSite(ctx context.Context, userID uint, req *Site) (*ApprovalRequest, error)
	RequestEditSite(ctx context.Context, userID, id uint, req *Site) (*ApprovalRequest, error)
	RequestDeleteSite(ctx context.Context, userID, id uint) (*ApprovalRequest, error)
	ListSites(ctx context.Context, filter map[string]interface{}) ([]Site, error)
}
