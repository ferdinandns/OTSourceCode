package services

import (
	"encoding/json"
	"log"
	"time"

	"lab-connect/backend-api/database"
	"lab-connect/backend-api/models"
)

// StartSyncWatcher subscribes to DB health events and triggers a queue replay
// whenever the database comes back online.
// Call once from main.go, after InitDB().
func StartSyncWatcher() {
	ch := database.SubscribeDBHealth()
	go func() {
		for available := range ch {
			if available {
				log.Println("[Sync] 🔄 DB recovered — starting offline queue replay")
				if err := ReplayQueue(); err != nil {
					log.Printf("[Sync] ⚠️  Replay finished with errors: %v", err)
				}
			} else {
				log.Println("[Sync] ⚠️  DB went offline — new writes will be queued locally")
			}
		}
	}()
}

// ReplayQueue replays all pending entries in the offline queue in the order
// they were written. Safe to call manually (e.g. from an admin endpoint or
// at startup to recover entries from a previous crash).
func ReplayQueue() error {
	entries, err := PendingEntries()
	if err != nil {
		return err
	}

	if len(entries) == 0 {
		log.Println("[Sync] ✅ No pending entries to replay")
		return nil
	}

	log.Printf("[Sync] Replaying %d pending entries...", len(entries))

	var lastErr error
	for _, entry := range entries {
		if err := replayEntry(entry); err != nil {
			log.Printf("[Sync] ❌ Failed to replay %s (%s): %v", entry.ID, entry.EntityType, err)
			_ = MarkFailed(entry.ID, err.Error())
			lastErr = err
		} else {
			log.Printf("[Sync] ✅ Synced %s (%s)", entry.ID, entry.EntityType)
			_ = MarkSynced(entry.ID)
		}

		// Brief pause between inserts to avoid hammering the DB on recovery.
		time.Sleep(50 * time.Millisecond)
	}

	// Prune synced entries older than 7 days.
	_ = PruneQueue(7)

	if lastErr == nil {
		log.Println("[Sync] ✅ Replay complete — all entries synced")
	}
	return lastErr
}

// replayEntry deserialises the payload and INSERTs it into the correct table.
// We clear the primary key so GORM generates a new one, preventing duplicate-key
// conflicts if a partial sync already wrote this record.
func replayEntry(entry QueuedEntry) error {
	now := time.Now()

	switch entry.EntityType {

	case "instrument_usage":
		var record models.InstrumentUsage
		if err := json.Unmarshal(entry.Payload, &record); err != nil {
			return err
		}
		record.Id = 0 // let GORM generate a new PK
		record.SyncStatus = SyncSynced
		record.SyncedAt = &now
		return database.DB.Create(&record).Error

	case "instrument_verification":
		var record models.InstrumentVerification
		if err := json.Unmarshal(entry.Payload, &record); err != nil {
			return err
		}
		record.Id = 0
		record.SyncStatus = SyncSynced
		record.SyncedAt = &now
		return database.DB.Create(&record).Error

	default:
		return nil // unknown type — skip silently, do not fail the whole replay
	}
}
