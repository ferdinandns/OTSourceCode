package domain

import (
	"context"
	"time"
)

// Enums

type InspectionResult string

const (
	ResultOK  InspectionResult = "OK"
	ResultNOK InspectionResult = "NOK"
)

type ScheduleStatus string

const (
	SchedulePending    ScheduleStatus = "pending"
	ScheduleInProgress ScheduleStatus = "in_progress"
	ScheduleOverdue    ScheduleStatus = "overdue"
	ScheduleDone       ScheduleStatus = "done"
)

// Entities

type InspectionSchedule struct {
	ID                    uint            `gorm:"primaryKey"`
	SarprasID             uint            `gorm:"not null;index"`
	CheckerID             *uint           `gorm:"default:null"`
	DueDate               time.Time       `gorm:"type:date;not null"`
	Status                ScheduleStatus  `gorm:"type:schedule_status_enum;default:pending"`
	PreviousStatus        *ScheduleStatus `gorm:"column:previous_status;type:schedule_status_enum;default:null"`
	SarprasStatusSnapshot *string         `gorm:"column:sarpras_status_snapshot;default:null"`
	CreatedAt             time.Time
	UpdatedAt             time.Time

	Sarpras Sarpras `gorm:"foreignKey:SarprasID;constraint:OnDelete:CASCADE"`
	Checker User    `gorm:"foreignKey:CheckerID;constraint:OnDelete:CASCADE"`
}

type Inspection struct {
	ID            uint  `gorm:"primaryKey"`
	ScheduleID    *uint `gorm:"index"`
	SarprasID     uint  `gorm:"not null;index"`
	CheckerID     uint  `gorm:"not null"`
	InspectedAt   time.Time
	OverallStatus InspectionResult `gorm:"type:inspection_result_enum;not null"`
	CreatedAt     time.Time

	Sarpras Sarpras          `gorm:"foreignKey:SarprasID;constraint:OnDelete:CASCADE"`
	Checker User             `gorm:"foreignKey:CheckerID;constraint:OnDelete:CASCADE"`
	Items   []InspectionItem `gorm:"foreignKey:InspectionID"`
}

type InspectionItem struct {
	ID           uint             `gorm:"primaryKey"`
	InspectionID uint             `gorm:"not null;index"`
	ParameterID  uint             `gorm:"not null"`
	Status       InspectionResult `gorm:"type:inspection_result_enum;not null"`
	Notes        string           `gorm:"type:text"`
	PhotoPath    string           `gorm:"type:text;not null"`
	CreatedAt    time.Time

	Parameter Parameter `gorm:"foreignKey:ParameterID;constraint:OnDelete:CASCADE"`
}

// Filters
type InspectionFilter struct {
	UserID    uint
	SarprasID *uint
	CheckerID *uint
	Status    *string
	Search    string
	Page      int
	PageSize  int
}

type InspectionHistoryFilter struct {
	SarprasID *uint
	CheckerID *uint
	Search    string
	Page      int
	PageSize  int
}

type InspectionMonitoringFilter struct {
	Status       *string
	SarprasType  *uint
	DepartmentID *uint
	Search       string
	Page         int
	PageSize     int
}

// Rows

type InspectionRow struct {
	ID             uint
	SarprasID      uint
	SarprasCode    string
	SarprasName    string
	DepartmentName string
	CheckerName    string
	CheckerID      uint
	InspectedAt    *time.Time
	OverallStatus  string
	ScheduleStatus ScheduleStatus
	SarprasStatus  SarprasStatus
	NextDueDate    *time.Time
}

type InspectionHistoryRow struct {
	InspectionID   uint             `json:"inspection_id"`
	SarprasID      uint             `json:"sarpras_id"`
	SarprasCode    string           `json:"sarpras_code"`
	SarprasName    string           `json:"sarpras_name"`
	DepartmentName string           `json:"department_name"`
	CheckerName    string           `json:"checker_name"`
	InspectedAt    time.Time        `json:"inspected_at"`
	OverallStatus  InspectionResult `json:"overall_status"`
	RepairOrderID  *uint            `json:"repair_order_id,omitempty"`
	RepairStatus   *RepairStatus    `json:"repair_status,omitempty"`
}

type InspectionMonitoringRow struct {
	InspectionID   uint       `json:"inspection_id"`
	SarprasID      uint       `json:"sarpras_id"`
	SarprasCode    string     `json:"sarpras_code"`
	SarprasName    string     `json:"sarpras_name"`
	DepartmentName string     `json:"department_name"`
	CheckerName    string     `json:"checker_name"`
	CheckerID      uint       `json:"checker_id"`
	CreatedAt      time.Time  `json:"created_at"`
	ScheduleStatus string     `json:"schedule_status"`
	SarprasStatus  string     `json:"sarpras_status"`
	NextDueDate    *time.Time `json:"next_due_date"`
}

// For scheduler generate due
type SarprasSchedulingData struct {
	ID                 uint
	DueDate            *time.Time
	InspIntervalMonths int
}

// DTOs

type InspectionFormResponse struct {
	SarprasID   uint                          `json:"sarpras_id"`
	SarprasCode string                        `json:"sarpras_code"`
	SarprasName string                        `json:"sarpras_name"`
	DueDate     *time.Time                    `json:"due_date"`
	CanInspect  bool                          `json:"can_inspect"`
	Parameters  []InspectionParameterResponse `json:"parameters"`
}

type InspectionParameterResponse struct {
	ID         uint   `json:"id"`
	Name       string `json:"name"`
	Desc       string `json:"desc"`
	OrderNo    int    `json:"order_no"`
	Editable   bool   `json:"editable"`
	RefillInfo string `json:"refill_info,omitempty"`
}

type SubmitInspectionRequest struct {
	SarprasID uint                `json:"sarpras_id" binding:"required"`
	Items     []SubmitItemRequest `json:"items"      binding:"required,dive"`
}

type SubmitItemRequest struct {
	ParameterID uint             `json:"parameter_id" binding:"required"`
	Status      InspectionResult `json:"status"       binding:"required"`
	Notes       string           `json:"notes"`
	PhotoPath   string           `json:"photo_path"`
}

type InspectionSubmitResult struct {
	InspectionID  uint             `json:"inspection_id"`
	OverallStatus InspectionResult `json:"overall_status"`
	SarprasStatus SarprasStatus    `json:"sarpras_status"`
	NextDueDate   *time.Time       `json:"next_due_date,omitempty"`
	RepairOrderID *uint            `json:"repair_order_id,omitempty"`
}

type InspectionDetailResponse struct {
	ID            uint                     `json:"id"`
	ScheduleID    *uint                    `json:"schedule_id,omitempty"`
	InspectedAt   time.Time                `json:"inspected_at"`
	OverallStatus InspectionResult         `json:"overall_status"`
	CreatedAt     time.Time                `json:"created_at"`
	Sarpras       SarprasSimple            `json:"sarpras"`
	Checker       CheckerSimple            `json:"checker"`
	Items         []InspectionItemResponse `json:"items"`
	Repair        *RepairInfo              `json:"repair,omitempty"`
}

type SarprasSimple struct {
	ID               uint       `json:"id"`
	Code             string     `json:"code"`
	SarprasTypeName  string     `json:"sarpras_type_name"`
	LocationDeptName string     `json:"location_dept_name"`
	LocationDetail   string     `json:"location_detail"`
	Status           string     `json:"status"`
	RiskLevel        string     `json:"risk_level"`
	LastInspected    *time.Time `json:"last_inspected"`
	DueDate          *time.Time `json:"due_date"`
}

type CheckerSimple struct {
	ID             uint   `json:"id"`
	Name           string `json:"name"`
	DepartmentName string `json:"department_name"`
}

type InspectionItemResponse struct {
	ID            uint   `json:"id"`
	ParameterName string `json:"parameter_name"`
	Status        string `json:"status"`
	Notes         string `json:"notes"`
	PhotoPath     string `json:"photo_path"`
}

type RepairInfo struct {
	RepairOrderID uint             `json:"repair_order_id"`
	Status        RepairStatus     `json:"status"`
	Submissions   []SubmissionInfo `json:"submissions,omitempty"`
}

type SubmissionInfo struct {
	ID                uint       `json:"id"`
	Attempt           int        `json:"attempt"`
	ActionPlan        string     `json:"action_plan"`
	DueDate           *time.Time `json:"due_date"`
	Status            string     `json:"status"`
	CreatedAt         time.Time  `json:"created_at"`
	Evidences         []string   `json:"evidences,omitempty"`
	ReviewedAt        *time.Time `json:"reviewed_at,omitempty"`
	Verdict           string     `json:"verdict,omitempty"`
	Feedback          string     `json:"feedback,omitempty"`
	Reviewer          string     `json:"reviewer,omitempty"`
	ReviewAttachments []string   `json:"review_attachments,omitempty"`
}

// Domain Helpers

// CanInspect returns true if today is within the H-10 window before due date.
func CanInspect(dueDate *time.Time) bool {
	if dueDate == nil {
		return false
	}
	return !time.Now().Before(dueDate.AddDate(0, 0, -10))
}

// IsOverdue returns true if dueDate has passed.
func IsOverdue(dueDate *time.Time) bool {
	if dueDate == nil {
		return false
	}
	return time.Now().After(*dueDate)
}

// Repository & Service interface

type InspectionRepository interface {
	// Core
	Create(ctx context.Context, insp *Inspection) error
	CreateItem(ctx context.Context, item *InspectionItem) error
	FindByID(ctx context.Context, id uint) (*Inspection, error)
	GetLatestBySarpras(ctx context.Context, sarprasID uint) (*Inspection, error)

	// List & monitoring
	ListActiveTasks(ctx context.Context, filter InspectionFilter) ([]InspectionRow, int64, error)
	ListHistory(ctx context.Context, filter InspectionHistoryFilter) ([]InspectionHistoryRow, int64, error)
	ListMonitoring(ctx context.Context, filter InspectionMonitoringFilter) ([]InspectionMonitoringRow, int64, error)

	// Detail — repair & review (used by GetInspectionDetail)
	GetRepairOrderByInspection(ctx context.Context, inspectionID uint) (*RepairOrder, error)
	GetSubmissionsByRepairOrder(ctx context.Context, repairOrderID uint) ([]RepairSubmission, error)
	GetReviewBySubmission(ctx context.Context, submissionID uint) (*ReviewOrder, error)
	GetReviewerByID(ctx context.Context, reviewerID uint) (*User, error)

	// Scheduler
	GetSarprasForScheduling(ctx context.Context) ([]SarprasSchedulingData, error)
	HasActiveSchedule(ctx context.Context, sarprasID uint) (bool, error)
	HasScheduleForDueDate(ctx context.Context, sarprasID uint, dueDate time.Time) (bool, error)
	CreateSchedule(ctx context.Context, schedule *InspectionSchedule) error
	UpdateOverdueSchedules(ctx context.Context) error
	UpdateMarkAsNotReady(ctx context.Context) error

	// Reminder
	GetSchedulesForReminder(ctx context.Context) ([]InspectionSchedule, error)
}

type InspectionService interface {
	// Form & submit
	GetInspectionForm(ctx context.Context, sarprasID uint) (*InspectionFormResponse, error)
	SubmitInspection(ctx context.Context, req *SubmitInspectionRequest, checkerID uint) (*InspectionSubmitResult, error)

	// Claim
	ClaimInspection(ctx context.Context, scheduleID uint, userID uint) error
	CancelClaim(ctx context.Context, scheduleID uint, userID uint) error

	// List & detail
	ListActiveTasks(ctx context.Context, filter InspectionFilter) ([]InspectionRow, int64, error)
	ListHistory(ctx context.Context, filter InspectionHistoryFilter) ([]InspectionHistoryRow, int64, error)
	ListMonitoring(ctx context.Context, filter InspectionMonitoringFilter) ([]InspectionMonitoringRow, int64, error)
	GetInspectionDetail(ctx context.Context, id uint) (*InspectionDetailResponse, error)

	// Scheduler
	GenerateSchedulesDueSoon(ctx context.Context) error
	UpdateOverdueAndNotReady(ctx context.Context) error

	// Reminder
	SendInspectionReminders(ctx context.Context) error
}