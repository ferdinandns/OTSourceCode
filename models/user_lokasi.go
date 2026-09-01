package models

import "time"

// UserLokasi adalah pivot table untuk relasi many-to-many
type UserLokasi struct {
	Id        uint      `json:"id" gorm:"primaryKey;column:id"`
	UserId    uint      `json:"user_id" gorm:"not null;column:user_id"`
	LokasiId  uint      `json:"lokasi_id" gorm:"not null;column:lokasi_id"`
	CreatedAt time.Time `json:"created_at" gorm:"column:created_at"`

	// Relasi
	User   User   `gorm:"foreignKey:UserId;references:Id;constraint:OnDelete:CASCADE"`
	Lokasi Lokasi `gorm:"foreignKey:LokasiId;references:Id;constraint:OnDelete:CASCADE"`
}
