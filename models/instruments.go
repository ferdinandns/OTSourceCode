package models

import (
	"time"

	"gorm.io/datatypes"
)

type Instrument struct {
	Id               uint   `json:"id" gorm:"primaryKey"`
	KodeInstrument   string `json:"instrument_code" gorm:"type:varchar(50);unique;not null"` // Nomor Kontrol (XXX-XXX-XXX)
	Nama             string `json:"name" gorm:"type:varchar(255);not null"`                  // Nama Instrument
	NomorSeri        string `json:"serial_number" gorm:"type:varchar(255)"`
	Merk             string `json:"brand" gorm:"type:varchar(255)"`
	Type             string `json:"type" gorm:"type:varchar(100);not null"`                // Jenis/Kategori
	LokasiInstrument string `json:"location_instrument" gorm:"type:varchar(255);not null"` // Ruangan
	LokasiSite       string `json:"location_site" gorm:"type:varchar(50);not null"`

	// PIC & Status
	PicUserID    uint   `json:"pic_user_id" gorm:"not null"`
	Status       string `json:"status" gorm:"type:varchar(50);not null;default:'Unconfigured'"` // Available, In Used, Unverified, dll
	SharedAccess bool   `json:"shared_access" gorm:"default:false"`

	// 🆕 Bridge Connection Fields
	BridgePCID     string    `json:"bridge_pc_id" gorm:"type:varchar(100);index"`                  // ID PC yang handle instrument ini
	BridgeStatus   string    `json:"bridge_status" gorm:"type:varchar(50);default:'disconnected'"` // connected, disconnected
	BridgePort     string    `json:"bridge_port" gorm:"type:varchar(20)"`                          // COM3, COM4, etc
	BridgeBaudrate int       `json:"bridge_baudrate"`                                              // 9600, 19200, etc
	LastBridgeSeen time.Time `json:"last_bridge_seen"`                                             // Last heartbeat from bridge

	// Kalibrasi
	TanggalKalibrasi time.Time `json:"calibration_date"`
	TenggatKalibrasi time.Time `json:"ed_kalibrasi" gorm:"column:tenggat_kalibrasi"`

	// Stock Opname
	TanggalStockOpname *time.Time `json:"stock_opname_date"`
	PicStockOpnameID   *uint      `json:"pic_stock_opname_id"`

	// Khusus Anak Timbang
	MassaANT *float64 `json:"massa_ant"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Relasi
	PICUser          User              `gorm:"foreignKey:PicUserID;constraint:OnDelete:SET NULL"`
	PICStockOpname   *User             `gorm:"foreignKey:PicStockOpnameID;constraint:OnDelete:SET NULL"`
	InstrumentConfig *InstrumentConfig `gorm:"foreignKey:InstrumentID;constraint:OnDelete:CASCADE"`
	UsageHistories   []InstrumentUsage `gorm:"foreignKey:InstrumentID"`
}

// 🆕 BridgePC Model - untuk track PC yang running bridge
type BridgePC struct {
	Id            uint       `json:"id" gorm:"primaryKey"`
	PCID          string     `json:"pc_id" gorm:"type:varchar(100);unique;not null;index"` // LAB-PC-001
	Hostname      string     `json:"hostname" gorm:"type:varchar(255)"`
	Location      string     `json:"location" gorm:"type:varchar(255)"` // Lab Kimia, Lab Fisika
	IPAddress     *string    `json:"ip_address" gorm:"type:varchar(50)"`
	Status        string     `json:"status" gorm:"type:varchar(50);default:'offline'"` // online, offline
	LastSeen      *time.Time `json:"last_seen"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
	BridgeRunning bool       `gorm:"default:false" json:"bridge_running"`
}

// 🆕 BridgeReading Model - untuk simpan data yang dikirim bridge
type BridgeReading struct {
	Id             uint           `json:"id" gorm:"primaryKey"`
	PCID           string         `json:"pc_id" gorm:"type:varchar(100);not null;index"`
	InstrumentID   uint           `json:"instrument_id" gorm:"not null;index"`
	Value          string         `json:"value" gorm:"type:text;not null"`
	Unit           *string        `json:"unit" gorm:"type:varchar(50)"`
	AdditionalData datatypes.JSON `gorm:"column:additional_data;type:jsonb"`
	ReadAt         time.Time      `json:"read_at" gorm:"not null;index"`
	CreatedAt      time.Time      `json:"created_at"`

	// Relasi
	Instrument Instrument `gorm:"foreignKey:InstrumentID;constraint:OnDelete:CASCADE"`
}
