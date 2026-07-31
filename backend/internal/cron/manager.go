package cron

import (
	"context"
	"log"
	"time"

	"github.com/robfig/cron/v3"
)

type Job struct {
	Name     string
	Schedule string // cron expression
	Task     func(ctx context.Context) error
}

type Manager struct {
	cron   *cron.Cron
	ctx    context.Context
	cancel context.CancelFunc
	jobs   []Job
}

func NewManager() *Manager {
	ctx, cancel := context.WithCancel(context.Background())
	return &Manager{
		cron:   cron.New(cron.WithLocation(time.Local)),
		ctx:    ctx,
		cancel: cancel,
		jobs:   []Job{},
	}
}

func (m *Manager) RegisterJob(job Job) {
	m.jobs = append(m.jobs, job)
}

func (m *Manager) Start() {
	for _, job := range m.jobs {
		j := job // capture
		_, err := m.cron.AddFunc(j.Schedule, func() {
			log.Printf("[CRON] Starting job: %s", j.Name)
			if err := j.Task(m.ctx); err != nil {
				log.Printf("[CRON] Job %s error: %v", j.Name, err)
			} else {
				log.Printf("[CRON] Job %s completed", j.Name)
			}
		})
		if err != nil {
			log.Printf("[CRON] Failed to register job %s: %v", j.Name, err)
		}
	}
	m.cron.Start()
	log.Println("[CRON] Cron manager started with", len(m.jobs), "jobs")
}

func (m *Manager) Stop() {
	m.cancel()
	m.cron.Stop()
	log.Println("[CRON] Cron manager stopped")
}
