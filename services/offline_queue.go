package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"sync"
	"time"
)

// QueuedEntry is one offline record waiting to be replayed to the DB.
type QueuedEntry struct {
	ID         string          `json:"id"`
	EntityType string          `json:"entity_type"` // "instrument_usage" | "instrument_verification"
	Payload    json.RawMessage `json:"payload"`
	QueuedAt   time.Time       `json:"queued_at"`
	SyncStatus string          `json:"sync_status"` // "pending" | "synced" | "failed"
	SyncedAt   *time.Time      `json:"synced_at,omitempty"`
	Error      string          `json:"error,omitempty"`
}

const (
	offlineQueueDir  = "/var/data/lab-connect"
	offlineQueueFile = "/var/data/lab-connect/offline_queue.json"

	SyncPending = "pending"
	SyncSynced  = "synced"
	SyncFailed  = "failed"
)

var queueMu sync.Mutex

// EnqueueUsage serialises an InstrumentUsage and appends it to the offline queue.
// Called by instrument_service.go when IsDBAvailable() == false.
func EnqueueUsage(payload interface{}) error {
	return enqueue("instrument_usage", payload)
}

// EnqueueVerification serialises an InstrumentVerification and appends it to the queue.
// Called by verification_service.go when IsDBAvailable() == false.
func EnqueueVerification(payload interface{}) error {
	return enqueue("instrument_verification", payload)
}

func enqueue(entityType string, payload interface{}) error {
	raw, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("offline queue marshal error: %w", err)
	}

	entry := QueuedEntry{
		ID:         newQueueID(),
		EntityType: entityType,
		Payload:    raw,
		QueuedAt:   time.Now(),
		SyncStatus: SyncPending,
	}

	queueMu.Lock()
	defer queueMu.Unlock()

	entries, err := readQueue()
	if err != nil {
		return err
	}
	entries = append(entries, entry)
	if err := writeQueue(entries); err != nil {
		return err
	}

	log.Printf("[OfflineQueue] ✅ Queued %s (id: %s)", entityType, entry.ID)
	return nil
}

// PendingEntries returns all entries with sync_status = "pending".
func PendingEntries() ([]QueuedEntry, error) {
	queueMu.Lock()
	defer queueMu.Unlock()

	all, err := readQueue()
	if err != nil {
		return nil, err
	}

	var pending []QueuedEntry
	for _, e := range all {
		if e.SyncStatus == SyncPending {
			pending = append(pending, e)
		}
	}
	return pending, nil
}

// MarkSynced sets sync_status = "synced" for the given entry ID.
func MarkSynced(id string) error {
	return updateEntry(id, func(e *QueuedEntry) {
		now := time.Now()
		e.SyncStatus = SyncSynced
		e.SyncedAt = &now
	})
}

// MarkFailed sets sync_status = "failed" with a reason.
func MarkFailed(id, reason string) error {
	return updateEntry(id, func(e *QueuedEntry) {
		e.SyncStatus = SyncFailed
		e.Error = reason
	})
}

// PruneQueue removes synced entries older than retentionDays.
func PruneQueue(retentionDays int) error {
	queueMu.Lock()
	defer queueMu.Unlock()

	entries, err := readQueue()
	if err != nil {
		return err
	}

	cutoff := time.Now().AddDate(0, 0, -retentionDays)
	var kept []QueuedEntry
	pruned := 0
	for _, e := range entries {
		if e.SyncStatus == SyncSynced && e.SyncedAt != nil && e.SyncedAt.Before(cutoff) {
			pruned++
			continue
		}
		kept = append(kept, e)
	}
	if pruned > 0 {
		log.Printf("[OfflineQueue] Pruned %d synced entries older than %d days", pruned, retentionDays)
	}
	return writeQueue(kept)
}

// QueueStats returns a summary for admin/health endpoints.
func QueueStats() (pending, synced, failed int, err error) {
	queueMu.Lock()
	defer queueMu.Unlock()

	entries, err := readQueue()
	if err != nil {
		return
	}
	for _, e := range entries {
		switch e.SyncStatus {
		case SyncPending:
			pending++
		case SyncSynced:
			synced++
		case SyncFailed:
			failed++
		}
	}
	return
}

// ── internal helpers ──────────────────────────────────────────────────────────

func readQueue() ([]QueuedEntry, error) {
	if err := os.MkdirAll(offlineQueueDir, 0755); err != nil {
		return nil, err
	}
	data, err := os.ReadFile(offlineQueueFile)
	if errors.Is(err, os.ErrNotExist) {
		return []QueuedEntry{}, nil
	}
	if err != nil {
		return nil, err
	}
	if len(data) == 0 {
		return []QueuedEntry{}, nil
	}
	var entries []QueuedEntry
	if err := json.Unmarshal(data, &entries); err != nil {
		return nil, err
	}
	return entries, nil
}

func writeQueue(entries []QueuedEntry) error {
	data, err := json.MarshalIndent(entries, "", "  ")
	if err != nil {
		return err
	}
	// Atomic write: write to .tmp then rename so the file is never corrupted mid-write.
	tmp := offlineQueueFile + ".tmp"
	if err := os.WriteFile(tmp, data, 0644); err != nil {
		return err
	}
	return os.Rename(tmp, offlineQueueFile)
}

func updateEntry(id string, mutate func(*QueuedEntry)) error {
	queueMu.Lock()
	defer queueMu.Unlock()

	entries, err := readQueue()
	if err != nil {
		return err
	}
	found := false
	for i := range entries {
		if entries[i].ID == id {
			mutate(&entries[i])
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("offline queue: entry not found: %s", id)
	}
	return writeQueue(entries)
}

func newQueueID() string {
	// Uses google/uuid which is already in go.mod as an indirect dependency.
	// If you prefer not to import it, the timestamp string below is also unique
	// enough for a single-machine queue.
	return fmt.Sprintf("%d", time.Now().UnixNano())
}
