package domain

import (
	"context"
	"database/sql"
	"time"
)

type RepairStatus string

const (
	RepairAssigned            RepairStatus = "assigned"
	RepairInProgress          RepairStatus = "in_progress"
	RepairSubmitted           RepairStatus = "submitted"
	RepairInReview            RepairStatus = "in_review"
	RepairWaitingVerification RepairStatus = "waiting_verification"
	RepairApproved            RepairStatus = "approved"
	RepairRejected            RepairStatus = "rejected"
)

type RepairOrder struct {
	ID                 uint         `gorm:"primaryKey"`
	InspectionID       uint         `gorm:"not null;index"`
	SarprasID          uint         `gorm:"not null;index"`
	PICID              uint         `gorm:"not null"`
	Status             RepairStatus `gorm:"type:repair_status_enum;default:'assigned'"`
	ReviewerID         *uint
	ActiveSubmissionID *uint `gorm:"index"`
	CreatedAt          time.Time
	UpdatedAt          time.Time

	Sarpras     Sarpras            `gorm:"foreignKey:SarprasID;constraint:OnDelete:CASCADE"`
	PIC         User               `gorm:"foreignKey:PICID;constraint:OnDelete:CASCADE"`
	Reviewer    *User              `gorm:"foreignKey:ReviewerID"`
	Submissions []RepairSubmission `gorm:"foreignKey:RepairOrderID"`

	// ActiveSubmissionID FK: no action (referensi ke repair_submissions)
	// InspectionID FK: no action (referensi ke inspections)
}

type RepairSubmission struct {
	ID            uint       `gorm:"primaryKey"`
	RepairOrderID uint       `gorm:"not null;index"`
	Attempt       int        `gorm:"not null"`
	ActionPlan    string     `gorm:"type:text"`
	DueDate       *time.Time `gorm:"type:date"`
	Status        string     `gorm:"type:varchar(50);default:'draft'"`
	CreatedAt     time.Time
	UpdatedAt     time.Time

	RepairOrder *RepairOrder     `gorm:"foreignKey:RepairOrderID;constraint:OnDelete:CASCADE"`
	Evidences   []RepairEvidence `gorm:"foreignKey:SubmissionID"`
}

type RepairEvidence struct {
	ID           uint   `gorm:"primaryKey"`
	SubmissionID uint   `gorm:"not null;index"`
	FilePath     string `gorm:"type:text;not null"`
	UploadedBy   *uint
	UploadedAt   time.Time

	Submission *RepairSubmission `gorm:"foreignKey:SubmissionID"`
	Uploader   *User             `gorm:"foreignKey:UploadedBy;constraint:OnDelete:SET NULL"`
}

// DTO untuk response detail repair dengan riwayat submission
type RepairDetailResponse struct {
	RepairOrderID    uint                 `json:"repair_order_id"`
	PICName          string               `json:"pic_name"`
	SarprasCode      string               `json:"sarpras_code"`
	SarprasName      string               `json:"sarpras_name"`
	Department       string               `json:"department"`
	InspectedAt      *time.Time           `json:"inspected_at"`
	Status           RepairStatus         `json:"status"`
	ReviewerFeedback string               `json:"reviewer_feedback"`
	ReviewerName     string               `json:"reviewer_name"`
	Submissions      []SubmissionDetail   `json:"submissions"`
	NOKDetails       []NOKParameterDetail `json:"nok_details"`
}

type SubmissionDetail struct {
	ID                uint       `json:"id"`
	Attempt           int        `json:"attempt"`
	ActionPlan        string     `json:"action_plan"`
	DueDate           *time.Time `json:"due_date"`
	Status            string     `json:"status"` // draft, submitted, reviewed
	CreatedAt         time.Time  `json:"created_at"`
	Evidences         []string   `json:"evidences"`
	ReviewedAt        *time.Time `json:"reviewed_at,omitempty"`
	Verdict           string     `json:"verdict,omitempty"`
	Feedback          string     `json:"feedback,omitempty"`
	ReviewerName      string     `json:"reviewer_name,omitempty"`
	ReviewAttachments []string   `json:"review_attachments,omitempty"`
}

// RepairMonitoringRow untuk response monitoring repair (QS)
type RepairMonitoringRow struct {
	RepairOrderID uint         `json:"repair_order_id"`
	SarprasID     uint         `json:"sarpras_id"`
	SarprasCode   string       `json:"sarpras_code"`
	SarprasName   string       `json:"sarpras_name"`
	PICDepartment string       `json:"pic_department"`
	DepartmentID  uint         `json:"department_id"`
	PICName       string       `json:"pic_name"`
	CheckerName   string       `json:"checker_name"`
	ActionPlan    string       `json:"action_plan"`
	RepairStatus  RepairStatus `json:"repair_status"`
	CreatedAt     time.Time    `json:"created_at"`
	DueDate       *time.Time   `json:"due_date"`
	ReviewerID    *uint        `json:"reviewer_id"`
	ReviewerName  string       `json:"reviewer_name"`
}

type RepairMonitoringFilter struct {
	DepartmentID *uint  `json:"department_id"`
	Search       string `json:"search"`
	Page         int    `json:"page"`
	PageSize     int    `json:"page_size"`
}

type RepairRow struct {
	ID               uint
	SarprasID        uint
	SarprasCode      string
	SarprasName      string
	DepartmentName   string
	CheckerName      string
	InspectedAt      *time.Time
	NOKParameters    []string
	ActionPlan       string
	RepairDueDate    *time.Time
	PICName          string
	SarprasStatus    SarprasStatus
	RepairStatus     RepairStatus
	RepairStatusDate *time.Time
}

type RepairFilter struct {
	SarprasID *uint
	PICID     *uint
	Status    *RepairStatus
	Search    string
	Page      int
	PageSize  int
}

type RepairHistoryFilter struct {
	Page     int
	PageSize int
	Search   string
	Status   *RepairStatus
}

type RepairAllHistoryFilter struct {
	DepartmentID *uint  `json:"department_id"`
	Search       string `json:"search"`
	Page         int    `json:"page"`
	PageSize     int    `json:"page_size"`
}

type NOKParameterDetail struct {
	ParameterName string `json:"parameter_name"`
	Notes         string `json:"notes"`
	PhotoURL      string `json:"photo_url"`
}

type RepairReminderRow struct {
	RepairID      uint
	PicID         uint
	SarprasCode   string
	SarprasName   string
	SubmissionID  sql.NullInt64
	ActionPlan    sql.NullString
	DueDate       sql.NullTime
	EvidenceCount int
}

// Repository Interface
type RepairRepository interface {
	Create(ctx context.Context, order *RepairOrder) error
	FindByID(ctx context.Context, id uint) (*RepairOrder, error)
	UpdateStatus(ctx context.Context, id uint, status RepairStatus) error
	UpdateActiveSubmission(ctx context.Context, repairOrderID uint, submissionID uint) error

	CreateSubmission(ctx context.Context, submission *RepairSubmission) error
	GetActiveSubmission(ctx context.Context, repairOrderID uint) (*RepairSubmission, error)
	GetSubmissionsByRepairOrder(ctx context.Context, repairOrderID uint) ([]RepairSubmission, error)
	GetSubmissionWithEvidences(ctx context.Context, submissionID uint) (*RepairSubmission, error)
	UpdateSubmissionStatus(ctx context.Context, submissionID uint, status string) error

	AddEvidenceToSubmission(ctx context.Context, evidence *RepairEvidence) error
	DeleteEvidencesBySubmission(ctx context.Context, submissionID uint) error

	ListAll(ctx context.Context, filter RepairFilter) ([]RepairRow, int64, error)
	GetDetail(ctx context.Context, repairOrderID uint) (*RepairDetailResponse, error)
	GetNOKItems(ctx context.Context, inspectionID uint) ([]NOKParameterDetail, error)
	ListPICHistory(ctx context.Context, picID uint, filter RepairHistoryFilter) ([]RepairRow, int64, error)
	ListMonitoring(ctx context.Context, filter RepairMonitoringFilter) ([]RepairMonitoringRow, int64, error)
	ListAllHistory(ctx context.Context, filter RepairAllHistoryFilter) ([]RepairMonitoringRow, int64, error)
	GetRepairReminders(ctx context.Context) ([]RepairReminderRow, error)
}

// Service Interface
type RepairService interface {
	ListRepairs(ctx context.Context, filter RepairFilter) ([]RepairRow, int64, error)
	GetRepairDetail(ctx context.Context, repairOrderID uint) (*RepairDetailResponse, error)
	FillActionPlan(ctx context.Context, repairOrderID uint, picID uint, actionPlan string, dueDate time.Time) error
	SubmitEvidence(ctx context.Context, repairOrderID uint, picID uint, filePaths []string, notes string) error
	NotifyPICAboutReviewResult(ctx context.Context, repairOrderID uint, picID uint, status RepairStatus, reviewerFeedback string) error
	ListPICHistory(ctx context.Context, picID uint, filter RepairHistoryFilter) ([]RepairRow, int64, error)
	ListMonitoring(ctx context.Context, filter RepairMonitoringFilter) ([]RepairMonitoringRow, int64, error)
	ListAllHistory(ctx context.Context, filter RepairAllHistoryFilter) ([]RepairMonitoringRow, int64, error)
	SendRepairReminders(ctx context.Context) error
}
