package notification

import (
	"context"
	"emertrack/internal/domain"

	"gorm.io/gorm"
)

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) domain.NotificationRepository {
	return &repository{db: db}
}

func (r *repository) Create(ctx context.Context, notif *domain.Notification) error {
	return r.db.WithContext(ctx).Create(notif).Error
}

func (r *repository) FindUserNotifications(ctx context.Context, userID uint) ([]domain.Notification, error) {
	var notifs []domain.Notification
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at desc").
		Limit(50).
		Find(&notifs).Error
	return notifs, err
}

func (r *repository) MarkAsRead(ctx context.Context, id uint, userID uint) error {
	return r.db.WithContext(ctx).
		Model(&domain.Notification{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("is_read", true).Error
}

func (r *repository) MarkAllAsRead(ctx context.Context, userID uint) error {
	return r.db.WithContext(ctx).
		Model(&domain.Notification{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Update("is_read", true).Error
}

func (r *repository) Delete(ctx context.Context, id uint, userID uint) error {
	return r.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", id, userID).
		Delete(&domain.Notification{}).Error
}

func (r *repository) DeleteAll(ctx context.Context, userID uint) error {
	return r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Delete(&domain.Notification{}).Error
}
