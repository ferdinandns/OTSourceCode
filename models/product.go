package models

import "time"

// Product - Model untuk Product, Sample, dan Material
type Product struct {
	Id             uint      `json:"id" gorm:"primaryKey"`
	ItemID         string    `json:"item_id" gorm:"type:varchar(50);unique;not null"`  // Auto-generated
	KategoriSampel string    `json:"kategori_sampel" gorm:"type:varchar(50);not null"` // RM, PM, Ruah, FG, Stabtes, Mikro, Proses
	ItemCode       string    `json:"item_code" gorm:"type:varchar(100);not null"`      // Kode dari Oracle
	ItemName       string    `json:"item_name" gorm:"type:varchar(255);not null"`      // Nama item
	Keterangan     string    `json:"keterangan" gorm:"type:text"`                      // Detail opsional
	LokasiSite     string    `json:"lokasi_site" gorm:"type:varchar(50);not null"`     // PLG/CKR
	CreatedBy      uint      `json:"created_by" gorm:"not null"`
	UpdatedBy      *uint     `json:"updated_by"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`

	// Relasi
	Creator User  `gorm:"foreignKey:CreatedBy;constraint:OnDelete:SET NULL"`
	Updater *User `gorm:"foreignKey:UpdatedBy;constraint:OnDelete:SET NULL"`
}

// TableName overrides the table name
func (Product) TableName() string {
	return "products"
}
