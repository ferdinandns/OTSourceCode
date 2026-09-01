package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"lab-connect/backend-api/models"
	"lab-connect/backend-api/structs"
	"time"
)

// readForItem performs a single item read using the correct strategy
// (single-line vs multi-line) based on config.LinesPerItem.
// Extracted as a helper so both RetryItem and resumeAutoReadFromItem
// use the exact same read path.
func (s *InstrumentReaderService) readForItem(config *models.InstrumentConfig, mtsicsCommand string) (map[string]interface{}, error) {
	if config.LinesPerItem > 1 {
		// Multi-line mode
		if config.IPAddress != "" {
			return s.tcpReader.ReadNLines(config, config.LinesPerItem)
		} else if config.ComPort != "" {
			return s.serialReader.ReadData(config)
		}
		return nil, fmt.Errorf("no valid connection configured for multi-line read")
	}
	// Single-line mode
	return s.readFromInstrument(config, mtsicsCommand)
}

// ──────────────────────────────────────────────────────────────
// RetryItem — called by the controller when the user clicks
// "Ulang" on a live result row.
//
// Flow:
//  1. Validate usage is active (Read Process / Paused).
//  2. Get instrument config.
//  3. Cancel the running goroutine and wait for it to exit (doneCh).
//  4. Delete the old UsageResult for targetItemNumber.
//  5. Re-read the instrument (using correct single/multi-line path).
//  6. Save the new result (IsReread inherited from usage.ParentUsageID).
//  7. Resume goroutine from (targetItem + 1), or mark Done if last item.
//
// ──────────────────────────────────────────────────────────────
func (s *InstrumentReaderService) RetryItem(usageID uint, targetItemNumber int) (*structs.RetryItemResponse, error) {
	// ── 1. Load usage ────────────────────────────────────────
	usage, err := s.instrumentSvc.GetUsageByID(usageID)
	if err != nil {
		return nil, fmt.Errorf("usage not found: %w", err)
	}

	allowedStatuses := map[string]bool{
		"Read Process": true,
		"Paused":       true,
	}
	if !allowedStatuses[usage.StatusPenggunaan] {
		return nil, fmt.Errorf("cannot retry: usage status is '%s' (expected Read Process or Paused)", usage.StatusPenggunaan)
	}

	// ── 2. Get instrument config ──────────────────────────────
	config, err := s.instrumentSvc.GetInstrumentConfiguration(usage.InstrumentID)
	if err != nil {
		return nil, errors.New("instrument configuration not found")
	}

	// ── FIX 2: Inherit IsReread from usage session ────────────
	// If this usage is a Re-read session (has ParentUsageID), every result
	// written — including retried ones — must have IsReread = true.
	isReread := usage.ParentUsageID != nil

	// ── 3. Cancel running goroutine and wait for clean exit ───
	// FIX 3: Use CancelAndWait with a generous timeout instead of a
	// fixed 300ms sleep.  For instruments that are blocking on a serial/TCP
	// read this can take a few seconds; 15s covers even slow hardware.
	if GlobalAutoReadManager.IsActive(usageID) {
		exited := GlobalAutoReadManager.CancelAndWait(usageID, 15*time.Second)
		if !exited {
			fmt.Printf("[RetryItem] ⚠️ Goroutine usage #%d did not exit within 15s; continuing with risk of overlap\n", usageID)
		}
	}

	// ── 4. Mark usage as Paused ──────────────────────────────
	s.db.Model(&models.InstrumentUsage{}).
		Where("id = ?", usageID).
		Updates(map[string]interface{}{
			"status_penggunaan": "Paused",
			"updated_at":        time.Now(),
		})

	// ── 5. Delete the old result for this item ────────────────
	if err := s.db.
		Where("instrument_usage_id = ? AND item_number = ?", usageID, targetItemNumber).
		Delete(&models.UsageResult{}).Error; err != nil {
		return nil, fmt.Errorf("failed to delete old result: %w", err)
	}
	fmt.Printf("[RetryItem] Deleted old result for usage #%d item #%d\n", usageID, targetItemNumber)

	// ── 6. Resolve MT-SICS command ────────────────────────────
	mtsicsCommand := "SI"
	if usage.AdditionalData != "" {
		var ad map[string]interface{}
		if json.Unmarshal([]byte(usage.AdditionalData), &ad) == nil {
			if cmd, ok := ad["mtsics_command"].(string); ok && cmd != "" {
				mtsicsCommand = cmd
			}
		}
	}

	// ── 7. Re-read the instrument (correct single/multi-line) ─
	// FIX 4 (RetryItem side): use readForItem instead of readFromInstrument
	// so multi-line instruments are handled correctly.
	resultData, readErr := s.readForItem(config, mtsicsCommand)
	if readErr != nil {
		// Restore to Read Process so the user can try again.
		s.db.Model(&models.InstrumentUsage{}).
			Where("id = ?", usageID).
			Update("status_penggunaan", "Read Process")
		return nil, fmt.Errorf("instrument read failed: %w", readErr)
	}

	// ── 8. Determine batch for this item ──────────────────────
	var batches []structs.BatchData
	json.Unmarshal([]byte(usage.NoQCBatch), &batches)

	batchNo := ""
	counter := 0
	for _, b := range batches {
		for i := 0; i < b.JumlahItem; i++ {
			counter++
			if counter == targetItemNumber {
				batchNo = b.NoQCBatch
				break
			}
		}
		if batchNo != "" {
			break
		}
	}

	// ── 9. Save new result ────────────────────────────────────
	resultJSON, _ := json.Marshal(resultData)
	newResult := models.UsageResult{
		InstrumentUsageID: usageID,
		NoQCBatch:         batchNo,
		ItemNumber:        targetItemNumber,
		ResultData:        string(resultJSON),
		IsReread:          isReread, // FIX 2: was hardcoded false
		CreatedAt:         time.Now(),
	}
	if err := s.db.Create(&newResult).Error; err != nil {
		return nil, fmt.Errorf("failed to save retried result: %w", err)
	}
	fmt.Printf("[RetryItem] Saved new result (ID: %d) for item #%d\n", newResult.Id, targetItemNumber)

	// ── 10. Resume goroutine from next item ───────────────────
	totalItems := 0
	for _, b := range batches {
		totalItems += b.JumlahItem
	}

	nextItem := targetItemNumber + 1
	if nextItem > totalItems {
		// Retried the last item — mark done.
		s.updateUsageStatus(usageID, "Done Read", "All items completed after retry")
		GlobalAutoReadManager.Unregister(usageID)
	} else {
		s.db.Model(&models.InstrumentUsage{}).
			Where("id = ?", usageID).
			Update("status_penggunaan", "Read Process")

		go s.resumeAutoReadFromItem(usageID, usage.InstrumentID, nextItem, totalItems)
	}

	return &structs.RetryItemResponse{
		Success:         true,
		RetriedItem:     targetItemNumber,
		NewResultID:     newResult.Id,
		ResumedFromItem: nextItem,
		ResultData:      resultData,
		Message:         fmt.Sprintf("Item #%d re-read successfully. Resuming from item #%d.", targetItemNumber, nextItem),
	}, nil
}

// resumeAutoReadFromItem starts a new goroutine that continues reading from
// startItem (1-indexed) until totalItems.
//
// FIX 4: Branches on config.LinesPerItem to handle both single-line and
// multi-line instruments — previously only single-line was used.
func (s *InstrumentReaderService) resumeAutoReadFromItem(usageID, instrumentID uint, startItem, totalItems int) {
	fmt.Printf("[RetryResume] Resuming usage #%d from item #%d (total: %d)\n", usageID, startItem, totalItems)

	// Register fresh cancel + done channels for this goroutine
	cancelCh, doneCh := GlobalAutoReadManager.Register(usageID)
	defer close(doneCh)
	defer GlobalAutoReadManager.UnregisterIfMatch(usageID, cancelCh)

	usage, err := s.instrumentSvc.GetUsageByID(usageID)
	if err != nil {
		fmt.Printf("[RetryResume] ❌ Cannot load usage: %v\n", err)
		return
	}

	config, err := s.instrumentSvc.GetInstrumentConfiguration(instrumentID)
	if err != nil {
		fmt.Printf("[RetryResume] ❌ Cannot load config: %v\n", err)
		return
	}

	// Inherit isReread from usage session
	isReread := usage.ParentUsageID != nil

	var batches []structs.BatchData
	json.Unmarshal([]byte(usage.NoQCBatch), &batches)

	mtsicsCommand := "SI"
	if usage.AdditionalData != "" {
		var ad map[string]interface{}
		if json.Unmarshal([]byte(usage.AdditionalData), &ad) == nil {
			if cmd, ok := ad["mtsics_command"].(string); ok && cmd != "" {
				mtsicsCommand = cmd
			}
		}
	}

	// Build a flat item→batch list starting from startItem.
	type itemBatch struct {
		itemNumber int
		batchNo    string
	}
	var itemList []itemBatch
	counter := 0
	for _, b := range batches {
		for i := 0; i < b.JumlahItem; i++ {
			counter++
			if counter >= startItem {
				itemList = append(itemList, itemBatch{counter, b.NoQCBatch})
			}
		}
	}

	successCount := 0
	for _, item := range itemList {
		// Cancel check BEFORE blocking read
		select {
		case <-cancelCh:
			fmt.Printf("[RetryResume] ⛔ Cancelled at item #%d\n", item.itemNumber)
			return
		default:
		}

		fmt.Printf("[RetryResume] Reading item #%d / %d (batch: %s)\n",
			item.itemNumber, totalItems, item.batchNo)

		s.updateProgress(usageID, item.itemNumber-1, totalItems, "reading")

		// FIX 4: use readForItem — handles both single and multi-line modes
		resultData, readErr := s.readForItem(config, mtsicsCommand)
		if readErr != nil {
			fmt.Printf("[RetryResume] ❌ Error on item #%d: %v\n", item.itemNumber, readErr)
			s.updateUsageStatus(usageID, "Failed",
				fmt.Sprintf("Failed at item %d: %v (completed: %d/%d)", item.itemNumber, readErr, successCount, totalItems))
			s.instrumentSvc.UpdateInstrumentStatus(instrumentID, "Available")
			return
		}

		// Post-read cancel check (catches cancels that arrived mid-read)
		select {
		case <-cancelCh:
			fmt.Printf("[RetryResume] ⛔ Cancelled after read, item #%d (result discarded)\n", item.itemNumber)
			return
		default:
		}

		resultJSON, _ := json.Marshal(resultData)
		result := models.UsageResult{
			InstrumentUsageID: usageID,
			NoQCBatch:         item.batchNo,
			ItemNumber:        item.itemNumber,
			ResultData:        string(resultJSON),
			IsReread:          isReread, // FIX 2: inherited from session
			CreatedAt:         time.Now(),
		}
		if err := s.db.Create(&result).Error; err != nil {
			fmt.Printf("[RetryResume] ❌ DB error on item #%d: %v\n", item.itemNumber, err)
			s.updateUsageStatus(usageID, "Failed", fmt.Sprintf("Database error at item %d", item.itemNumber))
			s.instrumentSvc.UpdateInstrumentStatus(instrumentID, "Available")
			return
		}

		fmt.Printf("[RetryResume] ✅ Item #%d saved (Result ID: %d)\n", item.itemNumber, result.Id)
		successCount++
		s.updateProgress(usageID, item.itemNumber, totalItems, fmt.Sprintf("item_%d_done", item.itemNumber))

		time.Sleep(1 * time.Second)
	}

	fmt.Printf("[RetryResume] 🎉 Resumed loop finished. %d items saved.\n", successCount)

	if isReread {
		now := time.Now()
		s.db.Model(&models.InstrumentUsage{}).
			Where("id = ?", usageID).
			Updates(map[string]interface{}{
				"status_penggunaan": "Re-read",
				"result_status":     "awaiting_approval",
				"end_time":          &now,
				"updated_at":        time.Now(),
			})
	} else {
		s.updateUsageStatus(usageID, "Done Read", fmt.Sprintf("All %d items completed", totalItems))
	}

	s.instrumentSvc.UpdateInstrumentStatus(instrumentID, "Available")
}
