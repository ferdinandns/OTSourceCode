// models/verification_read_request.go
package models

import "time"

type VerificationReadRequest struct {
	Id             uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	VerificationID uint       `json:"verification_id"`
	StepNumber     int        `json:"step_number"`
	InstrumentID   uint       `json:"instrument_id"`
	Status         string     `json:"status"` // pending, fulfilled, timeout
	StepType       string     `json:"step_type"`
	RequestedAt    time.Time  `json:"requested_at"`
	FulfilledAt    *time.Time `json:"fulfilled_at"`
	ReferenceID    *uint      `json:"reference_id" gorm:"column:reference_id"`
}
