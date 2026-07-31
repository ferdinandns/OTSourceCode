package domain

import (
	"context"
	"time"
)

type ReviewVerdict string

const (
	ReviewApprove ReviewVerdict = "approve"
	ReviewReject  ReviewVerdict = "reject"
)

type ReviewOrder struct {
	ID            uint           `gorm:"primaryKey"`
	RepairOrderID uint           `gorm:"not null;uniqueIndex:idx_review_orders_ro_sub"`
	SubmissionID  *uint          `gorm:"index;uniqueIndex:idx_review_orders_ro_sub"`
	ReviewerID    *uint          `gorm:"index"`
	Verdict       *ReviewVerdict `gorm:"type:text;check:review_orders_verdict_check,verdict IN ('approve','reject')"`
	Feedback      string         `gorm:"type:text"`
	ReviewedAt    *time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time

	RepairOrder RepairOrder        `gorm:"foreignKey:RepairOrderID;constraint:OnDelete:CASCADE"`
	Submission  RepairSubmission   `gorm:"foreignKey:SubmissionID"`
	Reviewer    *User              `gorm:"foreignKey:ReviewerID"`
	Attachments []ReviewAttachment `gorm:"foreignKey:ReviewOrderID"`
}

type ReviewAttachment struct {
	ID            uint   `gorm:"primaryKey"`
	ReviewOrderID uint   `gorm:"not null;index"`
	FilePath      string `gorm:"type:text;not null"`
	UploadedAt    time.Time
}

type ReviewRow struct {
	RepairOrderID uint
	SarprasID     uint
	SarprasCode   string
	SarprasName   string
	Site          string
	Department    string
	NOKParameters []string
	PICName       string
	SubmittedAt   *time.Time
	RepairStatus  RepairStatus
	SarprasStatus SarprasStatus
	ReviewerID    *int64
	IsMyReview    bool `json:"is_my_review"`
}

type ReviewDetailResponse struct {
	RepairOrderID  uint                 `json:"repair_order_id"`
	SarprasCode    string               `json:"sarpras_code"`
	SarprasName    string               `json:"sarpras_name"`
	SarprasTypeID  uint                 `json:"sarpras_type_id"`
	Category       string               `json:"category"`
	Site           string               `json:"site"`
	Department     string               `json:"department"`
	LocationDetail string               `json:"location_detail"`
	PICName        string               `json:"pic_name"`
	ActionPlan     string               `json:"action_plan"`
	RepairDueDate  *time.Time           `json:"repair_due_date"`
	ReportDate     *time.Time           `json:"report_date"`
	RepairDoneAt   *time.Time           `json:"repair_done_at"`
	Status         RepairStatus         `json:"status"`
	NOKDetails     []NOKParameterDetail `json:"nok_details"`
	RepairDesc     string               `json:"repair_desc"`
	Evidences      []string             `json:"evidences"`
}

type ReviewFilter struct {
	Search   string
	SiteID   *uint
	DeptID   *uint
	SortBy   string
	SortDir  string
	Page     int
	PageSize int
}

type ReviewResult struct {
	NewRepairStatus  RepairStatus
	NewSarprasStatus SarprasStatus
	AuditAction      string
	AuditMsg         string
}

type ReviewSummary struct {
	Approved      int64 `json:"approved"`
	Rejected      int64 `json:"rejected"`
	InReview      int64 `json:"in_review"`
	WaitingReview int64 `json:"waiting_review"`
}

type ReviewHistoryFilter struct {
	Page     int
	PageSize int
	Search   string
	Verdict  *ReviewVerdict
}

type ReviewHistoryRow struct {
	ReviewID       uint          `json:"review_id"`
	RepairOrderID  uint          `json:"repair_order_id"`
	SarprasCode    string        `json:"sarpras_code"`
	SarprasName    string        `json:"sarpras_name"`
	DepartmentName string        `json:"department_name"`
	Verdict        ReviewVerdict `json:"verdict"`
	Feedback       string        `json:"feedback"`
	ReviewedAt     time.Time     `json:"reviewed_at"`
	ReviewerName   string        `json:"reviewer_name"`
	RepairStatus   RepairStatus  `json:"repair_status"`
}

type ReviewHistoryDetail struct {
	ReviewID       uint        `json:"review_id"`
	RepairOrderID  uint        `json:"repair_order_id"`
	SarprasCode    string      `json:"sarpras_code"`
	SarprasName    string      `json:"sarpras_name"`
	DepartmentName string      `json:"department_name"`
	Verdict        string      `json:"verdict"`
	Feedback       string      `json:"feedback"`
	ReviewedAt     time.Time   `json:"reviewed_at"`
	ReviewerName   string      `json:"reviewer_name"`
	RepairStatus   string      `json:"repair_status"`
	ActionPlan     string      `json:"action_plan"`
	EvidencePaths  []string    `json:"evidence_paths"`
	NOKDetails     []NOKDetail `json:"nok_details"`
}

type NOKDetail struct {
	ParameterName string `json:"parameter_name"`
	Notes         string `json:"notes"`
	PhotoURL      string `json:"photo_url"`
}

// ReviewSubmitRequest is the body for POST /reviews/:id/submit
type ReviewSubmitRequest struct {
	Verdict     ReviewVerdict `json:"verdict"`
	Feedback    string        `json:"feedback"`
	Attachments []string      `json:"attachments,omitempty"`
}

type ReviewRepository interface {
	ListPendingReviews(ctx context.Context, filter ReviewFilter) ([]ReviewRow, int64, error)
	GetReviewDetail(ctx context.Context, repairOrderID uint) (*ReviewDetailResponse, error)
	SubmitReview(ctx context.Context, repairOrderID uint, reviewerID uint, verdict ReviewVerdict, feedback string) error
	GetReviewSummary(ctx context.Context) (*ReviewSummary, error)
	ListReviewsByRepairOrderID(ctx context.Context, repairOrderID uint, limit, offset int) ([]ReviewOrder, int64, error)
	ListQSHistory(ctx context.Context, reviewerID uint, filter ReviewHistoryFilter) ([]ReviewHistoryRow, int64, error)
	GetReviewHistoryDetail(ctx context.Context, reviewID uint) (*ReviewHistoryDetail, error)
	GetAllHistoryForExport(ctx context.Context, reviewerID uint, filter ReviewHistoryFilter) ([]ReviewHistoryDetail, error)

	ClaimReview(ctx context.Context, repairOrderID uint, reviewerID uint) error
	CancelClaimReview(ctx context.Context, repairOrderID uint, reviewerID uint) error
	GetRepairOrderForReview(ctx context.Context, repairOrderID uint) (*RepairOrder, error)
	SubmitCompleteReview(ctx context.Context, repairOrderID uint, reviewerID uint, req ReviewSubmitRequest) error
}

type ReviewService interface {
	ListPendingReviews(ctx context.Context, filter ReviewFilter) ([]ReviewRow, int64, error)
	GetReviewDetail(ctx context.Context, repairOrderID uint) (*ReviewDetailResponse, error)
	SubmitReview(ctx context.Context, repairOrderID uint, reviewerID uint, req ReviewSubmitRequest) error
	GetReviewSummary(ctx context.Context) (*ReviewSummary, error)
	ClaimReview(ctx context.Context, repairOrderID uint, reviewerID uint) error
	CancelClaimReview(ctx context.Context, repairOrderID uint, reviewerID uint) error
	GetReviewHistory(ctx context.Context, repairOrderID uint) ([]ReviewOrder, error)
	ListQSHistory(ctx context.Context, reviewerID uint, filter ReviewHistoryFilter) ([]ReviewHistoryRow, int64, error)
	ListReviewsByRepairOrderID(ctx context.Context, repairOrderID uint, limit, offset int) ([]ReviewOrder, int64, error)
	GetHistoryDetail(ctx context.Context, reviewID uint) (*ReviewHistoryDetail, error)
	ExportHistory(ctx context.Context, reviewerID uint, filter ReviewHistoryFilter) ([]byte, string, error)
}
