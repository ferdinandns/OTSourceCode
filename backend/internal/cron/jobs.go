package cron

import (
	"context"
	"emertrack/internal/domain"
	"log"
)

type Jobs struct {
	sarprasService      domain.SarprasService
	inspectionService   domain.InspectionService
	notificationService domain.NotificationService
	repairService       domain.RepairService
	refillService	  	domain.RefillService
}

func NewJobs(
	ss domain.SarprasService,
	is domain.InspectionService,
	ns domain.NotificationService,
	rs domain.RepairService,
	rfs domain.RefillService,
) *Jobs {
	return &Jobs{
		sarprasService:      ss,
		inspectionService:   is,
		notificationService: ns,
		repairService:       rs,
		refillService:       rfs,
	}
}

func (j *Jobs) RunDailyTasks(ctx context.Context) error {
	log.Printf("[CRON] Running Daily Tasks")

	if err := j.sarprasService.UpdateStatusExpiry(ctx); err != nil {
		log.Printf("[CRON] Error UpdateStatusExpiry: %v", err)
	}

	if err := j.inspectionService.GenerateSchedulesDueSoon(ctx); err != nil {
		log.Printf("[CRON] Error GenerateSchedulesDueSoon: %v", err)
	}

	if err := j.inspectionService.UpdateOverdueAndNotReady(ctx); err != nil {
		log.Printf("[CRON] Error UpdateOverdueAndNotReady: %v", err)
	}

	if err := j.inspectionService.SendInspectionReminders(ctx); err != nil {
		log.Printf("[CRON] Error SendInspectionReminders: %v", err)
	}

	if err := j.repairService.SendRepairReminders(ctx); err != nil {
		log.Printf("[CRON] Error SendRepairReminders: %v", err)
	}

	if err := j.refillService.SendExpiryReminders(); err != nil {
		log.Printf("[CRON] Error SendExpiryReminder: %v", err)
	}

	if err := j.refillService.SendPOReminders(); err != nil {
		log.Printf("[CRON] Error SendPOReminders: %v", err)
	}

	if err := j.refillService.SendVerificationReminders(); err != nil {
		log.Printf("[CRON] Error SendVerivicationReminders: %v", err)
	}

	return nil
}
