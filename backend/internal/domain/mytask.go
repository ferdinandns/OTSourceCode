package domain

import (
	"context"
)

type TaskItem struct {
	ID       uint                   `json:"id"`
	Title    string                 `json:"title"`
	Subtitle string                 `json:"subtitle,omitempty"`
	Priority string                 `json:"priority,omitempty"`
	Meta     map[string]interface{} `json:"meta,omitempty"`
}

type MyTasksResponse struct {
	Inspections   []TaskItem `json:"inspections"`
	Verifications []TaskItem `json:"verifications"`
	Approvals     []TaskItem `json:"approvals"`
	Repairs       []TaskItem `json:"repairs"`
	Refills       []TaskItem `json:"refills"`
}

type MyTaskRepository interface {
	GetMyTasks(ctx context.Context, userID uint, roles []string, isSupervisor bool, isGA bool) (*MyTasksResponse, error)
}

type MyTaskService interface {
	GetMyTasks(ctx context.Context, userID uint, roles []string, isSupervisor bool, isGA bool) (*MyTasksResponse, error)
}
