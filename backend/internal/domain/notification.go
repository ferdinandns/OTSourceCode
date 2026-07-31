package domain

import (
	"context"
	"time"
)

type Notification struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	UserID      uint      `gorm:"not null;index" json:"user_id"`
	Type        string    `gorm:"size:50;not null" json:"type"`
	Message     string    `gorm:"type:text;not null" json:"message"`
	IsRead      bool      `gorm:"default:false" json:"is_read"`
	ReferenceID *uint     `json:"reference_id,omitempty"`
	CreatedAt   time.Time `json:"created_at"`

	User User `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
}

// ApprovalResultNotif carries the data needed to notify a requester about an approval decision.
type ApprovalResultNotif struct {
	RequesterID   uint
	ApprovalID    uint
	Status        string
	Action        string
	EntityType    string
	Identifier    string
	ReviewerNotes string
	TotalItems    int
}

type NotificationRepository interface {
	Create(ctx context.Context, notif *Notification) error
	FindUserNotifications(ctx context.Context, userID uint) ([]Notification, error)
	MarkAsRead(ctx context.Context, id uint, userID uint) error
	MarkAllAsRead(ctx context.Context, userID uint) error
	Delete(ctx context.Context, id uint, userID uint) error
	DeleteAll(ctx context.Context, userID uint) error
}

type NotificationService interface {
	NotifyApprovers(ctx context.Context, requesterID uint, entityType, action, identifier, notes string, referenceID uint) error
	NotifyApproversForBulk(ctx context.Context, requesterID uint, itemCount int, notes string, referenceID uint) error
	NotifyRequesterApprovalResult(ctx context.Context, res ApprovalResultNotif) error
	NotifyNewInspection(ctx context.Context, scheduleID uint, sarprasCode, sarprasName string, deptID, typeID uint) error
	NotifyRepairPIC(ctx context.Context, repairID uint, sarprasCode, sarprasName string, picID uint, notes string) error
	NotifyReviewer(ctx context.Context, repairOrderID uint, sarprasCode, sarprasName, picName, notes string) error
	NotifyRefillEvidenceSubmitted(ctx context.Context, itemID uint, sarprasCode, sarprasName, uploaderName, newExpireDate, notes string) error
	NotifyRefillReviewResult(ctx context.Context, itemID uint, gaID uint, status string, rejectReason string, sarprasCode string) error
	NotifyPendingRefillVerification(ctx context.Context, itemID uint, sarprasCode string, daysPending int) error
	NotifyAparExpiryStatus(ctx context.Context, sarprasID uint, sarprasCode string, expiredDate time.Time, isExpired bool) error
	NotifyAPARMarksUsed(ctx context.Context, sarprasIDs []uint, markedBy uint, reason string) error
	SendRefillReminder(ctx context.Context, sarprasID uint, inspectionID uint, sarprasCode, sarprasName string) error
	NotifyRefillPODue(ctx context.Context, itemID uint, submittedBy uint, sarprasType, sarprasCode string, poNumber string, dueDate time.Time, daysDiff int, isOverdue bool) error
	SendInspectionReminder(ctx context.Context, userID uint, scheduleID uint, sarprasCode string, daysDiff int, isOverdue bool) error
	GetUserNotifications(ctx context.Context, userID uint) ([]Notification, error)
	MarkAsRead(ctx context.Context, id uint, userID uint) error
	DeleteNotification(ctx context.Context, id uint, userID uint) error
	DeleteAllNotifications(ctx context.Context, userID uint) error
	MarkAllAsRead(ctx context.Context, userID uint) error
}
