package ws

func BroadcastRepairUpdated() {
	BroadcastDataUpdated(EntityRepair)
	BroadcastDataUpdated(EntityDashboard)
	BroadcastDataUpdated(EntitySarpras)
	BroadcastDataUpdated(EntityMyTask)
	BroadcastDataUpdated(EntityAudit)
}

func BroadcastInspectionUpdated() {
	BroadcastDataUpdated(EntityInspection)
	BroadcastDataUpdated(EntityDashboard)
	BroadcastDataUpdated(EntityMyTask)
	BroadcastDataUpdated(EntityAudit)
}

func BroadcastSarprasUpdated() {
	BroadcastDataUpdated(EntitySarpras)
	BroadcastDataUpdated(EntityDashboard)
	BroadcastDataUpdated(EntityAudit)
}

func BroadcastReviewUpdated() {
	BroadcastDataUpdated(EntityReview)
	BroadcastDataUpdated(EntityRepair)
	BroadcastDataUpdated(EntityDashboard)
	BroadcastDataUpdated(EntityMyTask)
	BroadcastDataUpdated(EntityAudit)
}

func BroadcastUserUpdated() {
	BroadcastDataUpdated(EntityUser)
	BroadcastDataUpdated(EntityDashboard)
	BroadcastDataUpdated(EntityAudit)
}

func BroadcastRefillUpdated() {
	BroadcastDataUpdated(EntityRefill)
	BroadcastDataUpdated(EntityDashboard)
	BroadcastDataUpdated(EntitySarpras)
	BroadcastDataUpdated(EntityMyTask)
	BroadcastDataUpdated(EntityAudit)
}

func BroadcastApprovalUpdated() {
	BroadcastDataUpdated(EntityApproval)
	BroadcastDataUpdated(EntityDashboard)
	BroadcastDataUpdated(EntityMyTask)
	BroadcastDataUpdated(EntityAudit)
}
