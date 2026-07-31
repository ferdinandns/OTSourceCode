package mytask

import (
	"context"
	"database/sql"
	"emertrack/internal/domain"
)

type myTaskRepository struct {
	rawDB *sql.DB
}

func NewRepository(rawDB *sql.DB) domain.MyTaskRepository {
	return &myTaskRepository{rawDB: rawDB}
}

func (r *myTaskRepository) GetMyTasks(ctx context.Context, userID uint, roles []string, isSupervisor bool, isGA bool) (*domain.MyTasksResponse, error) {
	resp := &domain.MyTasksResponse{}

	isQS := false
	for _, role := range roles {
		switch role {
		case "checker":
			tasks, err := r.getCheckerTasks(ctx, userID, isSupervisor)
			if err != nil {
				return nil, err
			}
			resp.Inspections = append(resp.Inspections, tasks...)

		case "qs":
			isQS = true
			verifications, approvals, err := r.getQSTasks(ctx, userID, isSupervisor)
			if err != nil {
				return nil, err
			}
			resp.Verifications = append(resp.Verifications, verifications...)
			resp.Approvals = append(resp.Approvals, approvals...)

		case "pic_responsibility":
			repairs, err := r.getPICTasks(ctx, userID)
			if err != nil {
				return nil, err
			}
			resp.Repairs = append(resp.Repairs, repairs...)
		}
	}

	// Called once, outside the loop.
	refillTasks, err := r.getRefillTasks(ctx, isGA, isQS)
	if err != nil {
		return nil, err
	}
	resp.Refills = refillTasks

	return resp, nil
}

// --- Extracted helper methods ---

func (r *myTaskRepository) getCheckerTasks(ctx context.Context, userID uint, isSupervisor bool) ([]domain.TaskItem, error) {
	query := GET_CHECKER_TASK

	if !isSupervisor {
		query += IS_SUPERVISOR
	}

	query += INSPECTION_ORDER_BY

	rows, err := r.rawDB.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []domain.TaskItem
	for rows.Next() {
		var t domain.TaskItem
		var sarprasType string
		if err := rows.Scan(&t.ID, &t.Title, &t.Subtitle, &sarprasType, &t.Priority); err != nil {
			return nil, err
		}
		t.Meta = map[string]interface{}{
			"sarpras_type": sarprasType,
		}
		tasks = append(tasks, t)
	}

	return tasks, rows.Err()
}

func (r *myTaskRepository) getQSTasks(ctx context.Context, userID uint, isSupervisor bool) ([]domain.TaskItem, []domain.TaskItem, error) {
	verifQuery := GET_QS_TASKS
	verifications, err := r.fetchStandardTasks(ctx, verifQuery, userID)
	if err != nil {
		return nil, nil, err
	}

	var approvals []domain.TaskItem
	if isSupervisor {
		// Approval query does not require arguments.
		approvals, err = r.fetchStandardTasks(ctx, GET_APPROVALS)
		if err != nil {
			return nil, nil, err
		}
	}
	return verifications, approvals, nil
}

func (r *myTaskRepository) getPICTasks(ctx context.Context, userID uint) ([]domain.TaskItem, error) {
	return r.fetchStandardTasks(ctx, GET_PIC_RESP_TASKS, userID)
}

func (r *myTaskRepository) fetchStandardTasks(ctx context.Context, query string, args ...interface{}) ([]domain.TaskItem, error) {
	rows, err := r.rawDB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []domain.TaskItem
	for rows.Next() {
		var t domain.TaskItem
		if err := rows.Scan(&t.ID, &t.Title, &t.Subtitle, &t.Priority); err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}

	return tasks, rows.Err()
}

func (r *myTaskRepository) getRefillTasks(ctx context.Context, isGA bool, isQS bool) ([]domain.TaskItem, error) {
	if !isGA && !isQS {
		return nil, nil
	}

	var tasks []domain.TaskItem
	var err error

	if isGA {
		tasks, err = r.fetchStandardTasks(ctx, GET_REFILL_TASKS_GA)
		if err != nil {
			return nil, err
		}
	}

	if isQS {
		qsTasks, err := r.fetchStandardTasks(ctx, GET_REFILL_TASKS_QS)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, qsTasks...)
	}

	// Remove duplicates when user has both GA and QS roles.
	seen := make(map[uint]bool)
	unique := []domain.TaskItem{}
	for _, t := range tasks {
		if !seen[t.ID] {
			seen[t.ID] = true
			unique = append(unique, t)
		}
	}
	return unique, nil
}
