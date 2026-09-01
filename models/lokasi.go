package models

import "time"

type Lokasi struct {
	Id        uint      `json:"id" gorm:"primaryKey;column:id"`
	Nama      string    `json:"nama" gorm:"type:varchar(255);not null;column:nama"`
	Kode      string    `json:"kode" gorm:"type:varchar(50);unique;not null;column:kode"`
	CreatedAt time.Time `json:"created_at" gorm:"column:created_at"`
	UpdatedAt time.Time `json:"updated_at" gorm:"column:updated_at"`
}
