package inspection

import (
	"emertrack/internal/domain"
)

func MapInspectionToResponse(insp *domain.Inspection) *domain.InspectionDetailResponse {
	resp := &domain.InspectionDetailResponse{
		ID:            insp.ID,
		ScheduleID:    insp.ScheduleID,
		InspectedAt:   insp.InspectedAt,
		OverallStatus: insp.OverallStatus,
		CreatedAt:     insp.CreatedAt,
		Sarpras: domain.SarprasSimple{
			ID:               insp.Sarpras.ID,
			Code:             insp.Sarpras.Code,
			SarprasTypeName:  insp.Sarpras.SarprasType.Name,
			LocationDeptName: insp.Sarpras.LocationDept.Name,
			LocationDetail:   insp.Sarpras.LocationDetail,
			Status:           string(insp.Sarpras.Status),
			RiskLevel:        string(insp.Sarpras.RiskLevel),
			LastInspected:    insp.Sarpras.LastInspected,
			DueDate:          insp.Sarpras.DueDate,
		},
		Checker: domain.CheckerSimple{
			ID:             insp.Checker.ID,
			Name:           insp.Checker.Name,
			DepartmentName: insp.Checker.Department.Name,
		},
	}

	for _, item := range insp.Items {
		resp.Items = append(resp.Items, domain.InspectionItemResponse{
			ID:            item.ID,
			ParameterName: item.Parameter.Name,
			Status:        string(item.Status),
			Notes:         item.Notes,
			PhotoPath:     item.PhotoPath,
		})
	}

	return resp
}
