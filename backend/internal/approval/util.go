package approval

import (
	"encoding/json"
	"fmt"

	"emertrack/internal/domain"
)

func MapToResponse(row *domain.ApprovalRequest) domain.ApprovalResponse {
	var reviewedAtStr string
	if row.ReviewedAt != nil {
		reviewedAtStr = row.ReviewedAt.Format("2006-01-02 15:04:05")
	}

	res := domain.ApprovalResponse{
		ID:          row.ID,
		EntityType:  row.EntityType,
		Action:      string(row.Action),
		Status:      row.Status,
		PayloadJSON: row.PayloadJSON,
		Notes:       row.Notes,
		CreatedAt:   row.CreatedAt.Format("2006-01-02 15:04:05"),
		ReviewedAt:  reviewedAtStr,
		Requester: domain.UserCompact{
			ID:             row.Requester.ID,
			Name:           row.Requester.Name,
			Email:          row.Requester.Email,
			DepartmentName: row.Requester.Department.Name,
		},
	}

	if row.ReviewedBy != nil && row.Reviewer.ID != 0 {
		res.Reviewer = &domain.UserCompact{
			ID:             row.Reviewer.ID,
			Name:           row.Reviewer.Name,
			Email:          row.Reviewer.Email,
			DepartmentName: row.Reviewer.Department.Name,
		}
	}
	return res
}

// GetMenuLabel returns the display label for a given entity type.
func GetMenuLabel(entityType string) string {
	switch entityType {
	case "SarprasType":
		return string(domain.MenuSarprasType)
	case "Sarpras", "SarprasBulk":
		return string(domain.MenuSarpras)
	case "Department":
		return string(domain.MenuDepartemen)
	default:
		return entityType
	}
}

// ExtractIdentifier extracts a human‑readable identifier from the approval payload.
func ExtractIdentifier(appr *domain.ApprovalRequest) string {
	var payload map[string]interface{}
	if err := json.Unmarshal([]byte(appr.PayloadJSON), &payload); err == nil {
		keys := []string{"code", "name", "title"}
		for _, key := range keys {
			if val, ok := payload[key].(string); ok && val != "" {
				return val
			}
		}
	}
	if appr.EntityID != nil {
		return fmt.Sprintf("ID:%v", *appr.EntityID)
	}
	return ""
}
