package models

import "time"

type User struct {
	Id            uint      `json:"id" gorm:"primaryKey"`
	Name          string    `json:"name"`
	Username      string    `json:"username" gorm:"unique;not null"`
	Email         string    `json:"email" gorm:"unique;not null"`
	Password      string    `json:"password"`
	UserGroup     int       `json:"user_group" gorm:"type:int;default:5"`
	Role          string    `json:"role" gorm:"type:varchar(100);default:'user'"`
	LokasiUtamaId *uint     `json:"lokasi_utama_id" gorm:"column:lokasi_utama_id"`
	LokasiAktifId *uint     `json:"lokasi_aktif_id" gorm:"column:lokasi_aktif_id"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	Status        string    `json:"status" gorm:"type:varchar(20);default:'pending'"`

	// ── Req 2: password rotation ─────────────────────────────────────────
	PasswordChangedAt  *time.Time `json:"password_changed_at" gorm:"column:password_changed_at"`
	MustChangePassword bool       `json:"must_change_password" gorm:"default:false"`

	// ── Req 4: password reset token ──────────────────────────────────────
	PasswordResetToken       *string    `json:"-" gorm:"column:password_reset_token"`
	PasswordResetTokenExpiry *time.Time `json:"-" gorm:"column:password_reset_token_expiry"`

	// Associations
	LokasiUtama    *Lokasi      `gorm:"foreignKey:LokasiUtamaId;references:Id" json:"lokasi_utama,omitempty"`
	LokasiAktif    *Lokasi      `gorm:"foreignKey:LokasiAktifId;references:Id" json:"lokasi_aktif,omitempty"`
	LokasiTambahan []UserLokasi `gorm:"foreignKey:UserId" json:"lokasi_tambahan,omitempty"`
}
