package services

import (
	"errors"
	"lab-connect/backend-api/models"
	"lab-connect/backend-api/structs"
	"time"
)

// ApproveVerification - Supervisor approves or rejects a completed verification.
// Only verifications with status Complies / Not Complies (i.e. finished) can be approved.
func (s *VerificationService) ApproveVerification(
	verificationID uint,
	supervisorID uint,
	req structs.ApproveVerificationRequest,
) (*structs.ApproveVerificationResponse, error) {

	// 1. Load the verification record
	var verification models.InstrumentVerification
	if err := s.db.Preload("Instrument").Preload("User").First(&verification, verificationID).Error; err != nil {
		return nil, errors.New("verification not found")
	}

	// 2. Guard: only completed verifications can be approved
	if verification.Status != "Complies" && verification.Status != "Not Complies" && verification.Status != "Completed" {
		return nil, errors.New("only completed verifications can be approved or rejected")
	}

	// 3. Apply approval
	now := time.Now()
	approvalStatus := "approved"
	if !req.Approved {
		approvalStatus = "rejected"
	}

	if err := s.db.Model(&verification).Updates(map[string]interface{}{
		"approval_status": approvalStatus,
		"approved_by":     supervisorID,
		"approved_at":     now,
		"approval_notes":  req.Notes,
	}).Error; err != nil {
		return nil, err
	}

	return &structs.ApproveVerificationResponse{
		VerificationID: verificationID,
		ApprovalStatus: approvalStatus,
		ApprovedBy:     supervisorID,
		ApprovedAt:     now,
		Message:        "Approval processed successfully",
	}, nil
}
