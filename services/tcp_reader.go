package services

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"lab-connect/backend-api/models"
	"net"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type TCPReaderService struct{}

func NewTCPReaderService() *TCPReaderService {
	return &TCPReaderService{}
}

// ============================================
// IMPROVED: Multi-line Reading with Grouping
// ============================================

// ReadMultipleLinesGrouped - Read multiple lines and group them into logical items
// This version can group consecutive lines that belong to the same measurement
func (s *TCPReaderService) ReadMultipleLinesGrouped(config *models.InstrumentConfig, expectedItems int) ([]map[string]interface{}, error) {
	fmt.Println("========== TCP MULTI-LINE GROUPED READ START ==========")

	// Determine lines per item from config (default to 1 if not set)
	linesPerItem := config.LinesPerItem
	if linesPerItem <= 0 {
		linesPerItem = 1
	}

	expectedLines := expectedItems * linesPerItem
	fmt.Printf("[TCP Multi-Read] Expected items: %d, Lines per item: %d, Total lines: %d\n",
		expectedItems, linesPerItem, expectedLines)

	address := net.JoinHostPort(config.IPAddress, fmt.Sprintf("%d", config.TCPPort))
	fmt.Printf("[TCP Multi-Read] Connecting to %s\n", address)

	timeout := time.Duration(config.Timeout) * time.Second
	if timeout == 0 || timeout > 1800*time.Second {
		timeout = 1800 * time.Second
	}
	fmt.Printf("[TCP Multi-Read] Timeout: %v\n", timeout)
	fmt.Printf("[TCP Multi-Read] ⚠️ PASSIVE MODE: Please press PRINT button on instrument NOW!\n")

	// Connect
	conn, err := net.DialTimeout("tcp", address, 10*time.Second)
	if err != nil {
		fmt.Printf("[TCP Multi-Read] ❌ Connection failed: %v\n", err)
		return nil, fmt.Errorf("connection failed: %w", err)
	}
	defer conn.Close()

	fmt.Println("[TCP Multi-Read] ✅ Connected")
	fmt.Println("[TCP Multi-Read] 📡 Listening for data...")

	reader := bufio.NewReader(conn)
	allItems := make([]map[string]interface{}, 0, expectedItems)
	currentItemLines := make([]string, 0, linesPerItem)

	conn.SetReadDeadline(time.Now().Add(timeout))

	lineNumber := 0
	emptyLineCount := 0
	maxConsecutiveTimeouts := 2
	timeoutCount := 0
	lastDataTime := time.Now()
	noDataTimeout := 1800 * time.Second

	for {
		line, err := reader.ReadString('\n')

		// Handle timeout
		if err != nil {
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				timeSinceLastData := time.Since(lastDataTime)

				if timeSinceLastData > noDataTimeout {
					timeoutCount++
					fmt.Printf("[TCP Multi-Read] ✅ Instrument stopped sending (no data for %v)\n", timeSinceLastData)
					fmt.Printf("[TCP Multi-Read] ⏳ Timeout %d/%d, waiting for more data...\n", timeoutCount, maxConsecutiveTimeouts)

					if timeoutCount >= maxConsecutiveTimeouts {
						// Save any remaining lines as a partial item
						if len(currentItemLines) > 0 {
							item := s.groupLinesToItem(currentItemLines, config.RegexPattern, config.RegexFilterEnabled)
							if item != nil {
								allItems = append(allItems, item)
							}
							currentItemLines = []string{}
						}

						if len(allItems) >= expectedItems {
							fmt.Printf("[TCP Multi-Read] ✅ Received %d items (expected %d), stopping\n", len(allItems), expectedItems)
							break
						} else if len(allItems) > 0 {
							fmt.Printf("[TCP Multi-Read] ⚠️ Partial data: received %d/%d items\n", len(allItems), expectedItems)
							break
						} else {
							fmt.Println("[TCP Multi-Read] ❌ Error: timeout: no data received. Please press PRINT button")
							return nil, errors.New("timeout: no data received. Please press PRINT button")
						}
					}

					conn.SetReadDeadline(time.Now().Add(timeout))
					continue
				}

				conn.SetReadDeadline(time.Now().Add(timeout))
				continue
			}

			if err == io.EOF {
				fmt.Println("[TCP Multi-Read] 📡 Connection closed by instrument")
				break
			}

			if len(allItems) > 0 {
				fmt.Printf("[TCP Multi-Read] ⚠️ Read error but have %d items, stopping: %v\n", len(allItems), err)
				break
			}

			fmt.Printf("[TCP Multi-Read] ❌ Read error: %v\n", err)
			return nil, fmt.Errorf("read error: %w", err)
		}

		// Got data! Reset timeout counter
		timeoutCount = 0
		lastDataTime = time.Now()

		line = strings.TrimSpace(line)
		lineNumber++

		// Skip empty lines
		if line == "" {
			emptyLineCount++
			fmt.Printf("[TCP Multi-Read] ⚠️ Empty line at position %d, skipping\n", lineNumber)

			// Empty line might signal end of item group
			if len(currentItemLines) > 0 && emptyLineCount >= 1 {
				item := s.groupLinesToItem(currentItemLines, config.RegexPattern, config.RegexFilterEnabled)
				if item != nil {
					allItems = append(allItems, item)
					fmt.Printf("[TCP Multi-Read] ✅ Item %d completed (%d lines)\n", len(allItems), len(currentItemLines))
				}
				currentItemLines = []string{}
			}

			if emptyLineCount >= 3 && len(allItems) >= expectedItems {
				fmt.Printf("[TCP Multi-Read] ✅ Multiple empty lines after %d items, stopping\n", len(allItems))
				break
			}
			continue
		}

		emptyLineCount = 0
		fmt.Printf("[TCP Multi-Read] 📦 Line %d: %q\n", lineNumber, line)

		// Add line to current item
		currentItemLines = append(currentItemLines, line)

		// Check if we've collected enough lines for one item
		if len(currentItemLines) >= linesPerItem {
			item := s.groupLinesToItem(currentItemLines, config.RegexPattern, config.RegexFilterEnabled)
			if item != nil {
				allItems = append(allItems, item)
				fmt.Printf("[TCP Multi-Read] ✅ Item %d completed (%d lines)\n", len(allItems), len(currentItemLines))
			}
			currentItemLines = []string{}

			// Check if we have all expected items
			if len(allItems) >= expectedItems {
				fmt.Printf("[TCP Multi-Read] ✅ Reached expected count (%d items), checking for more...\n", expectedItems)
				conn.SetReadDeadline(time.Now().Add(2 * time.Second))

				testLine, testErr := reader.ReadString('\n')
				if testErr != nil || strings.TrimSpace(testLine) == "" {
					fmt.Println("[TCP Multi-Read] ✅ No additional data, stopping")
					break
				}
			}
		}

		conn.SetReadDeadline(time.Now().Add(timeout))
	}

	// Handle any remaining lines
	if len(currentItemLines) > 0 {
		item := s.groupLinesToItem(currentItemLines, config.RegexPattern, config.RegexFilterEnabled)
		if item != nil {
			allItems = append(allItems, item)
			fmt.Printf("[TCP Multi-Read] ✅ Final item completed (%d lines)\n", len(currentItemLines))
		}
	}

	fmt.Println("========== TCP MULTI-LINE GROUPED READ END ==========")

	if len(allItems) == 0 {
		fmt.Println("[TCP Multi-Read] ❌ No data received")
		return nil, errors.New("no data received from instrument")
	}

	if len(allItems) != expectedItems {
		fmt.Printf("[TCP Multi-Read] ⚠️ Expected %d items but received %d items\n", expectedItems, len(allItems))
	} else {
		fmt.Printf("[TCP Multi-Read] ✅ Successfully read all %d items as expected\n", len(allItems))
	}

	return allItems, nil
}

func (s *TCPReaderService) ReadNLines(config *models.InstrumentConfig, n int) (map[string]interface{}, error) {
	if n <= 0 {
		n = 1
	}

	address := net.JoinHostPort(config.IPAddress, fmt.Sprintf("%d", config.TCPPort))
	fmt.Printf("[TCP ReadNLines] Connecting to %s, expecting %d lines\n", address, n)

	conn, err := net.DialTimeout("tcp", address, 10*time.Second)
	if err != nil {
		return nil, fmt.Errorf("connection failed: %w", err)
	}
	defer conn.Close()

	itemTimeout := time.Duration(config.Timeout) * time.Second
	if itemTimeout < 30*time.Second {
		itemTimeout = 120 * time.Second
	}

	// Compile anchor regex jika ada
	var anchorRe *regexp.Regexp
	if config.BlockAnchor != "" {
		anchorRe, err = regexp.Compile(config.BlockAnchor)
		if err != nil {
			fmt.Printf("[TCP ReadNLines] ⚠️ Invalid block_anchor regex, ignoring: %v\n", err)
			anchorRe = nil
		} else {
			fmt.Printf("[TCP ReadNLines] ⚓ Anchor pattern: %s\n", config.BlockAnchor)
		}
	}

	reader := bufio.NewReader(conn)
	var collectedLines []string
	anchored := anchorRe == nil // Jika tidak ada anchor, langsung mulai kumpulkan

	conn.SetReadDeadline(time.Now().Add(itemTimeout))

	for len(collectedLines) < n {
		line, err := reader.ReadString('\n')

		if err != nil {
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				if len(collectedLines) > 0 {
					fmt.Printf("[TCP ReadNLines] ⚠️ Timeout setelah %d/%d baris\n", len(collectedLines), n)
					break
				}
				// Belum dapat data — reset dan tunggu operator PRINT
				conn.SetReadDeadline(time.Now().Add(itemTimeout))
				continue
			}
			if err == io.EOF {
				fmt.Println("[TCP ReadNLines] EOF — instrument closed connection")
				break
			}
			return nil, fmt.Errorf("read error: %w", err)
		}

		trimmed := strings.TrimSpace(line)
		conn.SetReadDeadline(time.Now().Add(itemTimeout))

		// Phase 1: Belum anchor — buang baris sampai anchor ditemukan
		if !anchored {
			if anchorRe.MatchString(trimmed) {
				fmt.Printf("[TCP ReadNLines] ⚓ Anchor found: %q — mulai kumpulkan\n", trimmed)
				anchored = true
				collectedLines = append(collectedLines, trimmed)
			} else {
				fmt.Printf("[TCP ReadNLines] ⏭️  Pre-anchor discard: %q\n", trimmed)
			}
			continue
		}

		// Phase 2: Sudah anchor — kumpulkan semua baris termasuk yang kosong
		if trimmed == "" {
			collectedLines = append(collectedLines, "")
			fmt.Printf("[TCP ReadNLines] Line %d/%d: (empty)\n", len(collectedLines), n)
		} else {
			collectedLines = append(collectedLines, trimmed)
			fmt.Printf("[TCP ReadNLines] Line %d/%d: %q\n", len(collectedLines), n, trimmed)
		}
	}

	if len(collectedLines) == 0 {
		return nil, fmt.Errorf("timeout: tidak ada data. Tekan tombol PRINT pada instrument")
	}

	combinedRaw := strings.Join(collectedLines, "\n")

	result := map[string]interface{}{
		"raw_data":   combinedRaw,
		"line_count": len(collectedLines),
		"timestamp":  time.Now().Format("2006-01-02 15:04:05"),
		"parsed":     false,
	}

	// Parse regex
	if config.RegexPattern != "" {
		re, err := regexp.Compile(config.RegexPattern)
		if err == nil {
			matches := re.FindAllStringSubmatch(combinedRaw, -1)
			subexpNames := re.SubexpNames()
			parsedData := make(map[string]interface{})
			for _, match := range matches {
				for i, name := range subexpNames {
					if i > 0 && name != "" && i < len(match) && match[i] != "" {
						parsedData[name] = strings.TrimSpace(match[i])
					}
				}
			}
			if len(parsedData) > 0 {
				result["parsed"] = true
				for k, v := range parsedData {
					result[k] = v
					fmt.Printf("[TCP ReadNLines] ✅ Parsed: %s = %v\n", k, v)
				}
			}
		}
	}

	fmt.Printf("[TCP ReadNLines] ✅ Block selesai: %d baris\n", len(collectedLines))
	return result, nil
}

// groupLinesToItem - Combine multiple lines into one item with regex parsing
func (s *TCPReaderService) groupLinesToItem(lines []string, regexPattern string, filterEnabled bool) map[string]interface{} {
	if len(lines) == 0 {
		return nil
	}

	// Combine all lines into single raw data
	combinedRaw := strings.Join(lines, "\n")

	item := map[string]interface{}{
		"raw_data":   combinedRaw,
		"line_count": len(lines),
		"timestamp":  time.Now().Format("2006-01-02 15:04:05"),
		"parsed":     false,
	}

	// If regex pattern exists, try to parse each line
	if regexPattern != "" {
		parsedData := make(map[string]interface{})
		hasAnyMatch := false

		for i, line := range lines {
			lineData, err := s.parseLineWithRegex(line, regexPattern)
			if err != nil {
				fmt.Printf("[TCP Parse] ⚠️ Line %d parsing error: %v\n", i+1, err)
				continue
			}

			// NOTE: For multi-line items (e.g. pH meter), individual lines may not
			// match the regex on their own — only skip a line, never reject the whole
			// item here.  The whole-item filter is applied AFTER all lines are
			// processed, further below.
			if lineData == nil {
				fmt.Printf("[TCP Parse] ℹ️ Line %d doesn't match pattern, skipping line\n", i+1)
				continue
			}

			// Merge parsed data from this line
			hasAnyMatch = true
			for k, v := range lineData {
				// Prefix with line number if multiple lines have same field
				if _, exists := parsedData[k]; exists {
					parsedData[fmt.Sprintf("%s_line%d", k, i+1)] = v
				} else {
					parsedData[k] = v
				}
			}
		}

		// If filter enabled and NO line in this whole item matched, reject the item
		if filterEnabled && !hasAnyMatch {
			fmt.Println("[TCP Parse] ⚠️ No lines matched pattern (filtering enabled), item rejected")
			return nil
		}

		// Merge parsed data into item
		if hasAnyMatch {
			item["parsed"] = true
			for k, v := range parsedData {
				item[k] = v
			}
		}
	}

	return item
}

// parseLineWithRegex - Parse a single line with regex pattern
func (s *TCPReaderService) parseLineWithRegex(line, pattern string) (map[string]interface{}, error) {
	re, err := regexp.Compile(pattern)
	if err != nil {
		return nil, fmt.Errorf("invalid regex pattern: %v", err)
	}

	matches := re.FindStringSubmatch(line)
	if matches == nil {
		return nil, nil // No match, return nil (not an error)
	}

	result := make(map[string]interface{})
	for i, name := range re.SubexpNames() {
		if i > 0 && i < len(matches) && name != "" {
			result[name] = strings.TrimSpace(matches[i])
		}
	}

	return result, nil
}

// ============================================
// IMPROVED: Single Line Reading with Filtering
// ============================================

// ReadData with improved regex filtering
func (s *TCPReaderService) ReadData(config *models.InstrumentConfig) (map[string]interface{}, error) {
	fmt.Println("========== TCP READ START ==========")

	address := net.JoinHostPort(config.IPAddress, fmt.Sprintf("%d", config.TCPPort))
	fmt.Printf("[TCP Read] Connecting to %s\n", address)
	fmt.Printf("[TCP Read] Regex filter enabled: %v\n", config.RegexFilterEnabled)

	conn, err := net.DialTimeout("tcp", address, 10*time.Second)
	if err != nil {
		return nil, fmt.Errorf("connection failed: %w", err)
	}
	defer conn.Close()

	timeout := time.Duration(config.Timeout) * time.Second
	if timeout == 0 || timeout > 1800*time.Second {
		timeout = 1800 * time.Second
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	resultChan := make(chan map[string]interface{}, 1)
	errorChan := make(chan error, 1)

	go func() {
		data, err := s.passiveReadOnly(conn, config.RegexPattern, config.RegexFilterEnabled, timeout)
		if err != nil {
			errorChan <- err
			return
		}
		resultChan <- data
	}()

	select {
	case result := <-resultChan:
		fmt.Println("[TCP Read] ✅ Data received successfully")
		fmt.Println("========== TCP READ END ==========")
		return result, nil

	case err := <-errorChan:
		fmt.Printf("[TCP Read] ❌ Error: %v\n", err)
		fmt.Println("========== TCP READ END ==========")
		return nil, err

	case <-ctx.Done():
		fmt.Println("[TCP Read] ⏰ TIMEOUT")
		fmt.Println("========== TCP READ END ==========")
		return nil, fmt.Errorf("timeout: no data received after %s", timeout)
	}
}

func (s *TCPReaderService) passiveReadOnly(conn net.Conn, regexPattern string, filterEnabled bool, maxDuration time.Duration) (map[string]interface{}, error) {
	deadline := time.Now().Add(maxDuration)
	lastDataTime := time.Now()
	quietTimeout := 3 * time.Second // baris header tiap ~800ms, jeda antar-batch

	fmt.Println("[TCP Read] 📡 Listening passively — skipping header lines until data match...")

	reader := bufio.NewReader(conn)
	var re *regexp.Regexp
	if regexPattern != "" {
		var err error
		re, err = regexp.Compile(regexPattern)
		if err != nil {
			fmt.Printf("[TCP Read] ⚠️ Invalid regex, falling back to raw: %v\n", err)
			re = nil
		}
	}

	for time.Now().Before(deadline) {
		conn.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
		line, err := reader.ReadString('\n')

		if err != nil {
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				// Kalau sudah dapat data tapi quiet, berarti header selesai dan
				// belum ada data berat — terus tunggu
				if time.Since(lastDataTime) > quietTimeout && time.Since(lastDataTime) < maxDuration {
					fmt.Println("[TCP Read] ⏳ Quiet after header burst — waiting for weight data...")
				}
				continue
			}
			if err == io.EOF {
				break
			}
			return nil, fmt.Errorf("read error: %w", err)
		}

		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}

		lastDataTime = time.Now()
		fmt.Printf("[TCP Read] 📦 Line received: %q\n", trimmed)

		// Kalau tidak ada regex, ambil baris pertama apapun
		if re == nil {
			return s.processDataWithFilter(trimmed, regexPattern, filterEnabled)
		}

		// Ada regex: skip kalau tidak match, ambil kalau match
		if re.MatchString(trimmed) {
			fmt.Printf("[TCP Read] ✅ Match found: %q\n", trimmed)
			return s.processDataWithFilter(trimmed, regexPattern, filterEnabled)
		}

		fmt.Printf("[TCP Read] ⏭️  Header/noise line skipped: %q\n", trimmed)
	}

	return nil, fmt.Errorf("timeout: no matching data received after %s", maxDuration)
}

func (s *TCPReaderService) processDataWithFilter(rawData, regexPattern string, filterEnabled bool) (map[string]interface{}, error) {
	cleanData := strings.TrimSpace(rawData)

	if cleanData == "" {
		return nil, fmt.Errorf("received empty data")
	}

	result := map[string]interface{}{
		"raw_data":   rawData,
		"clean_data": cleanData,
		"timestamp":  time.Now().Format("2006-01-02 15:04:05"),
		"parsed":     false,
	}

	// Parse with regex if pattern exists
	if regexPattern != "" {
		parsed, err := s.parseDataWithRegexFilter(rawData, regexPattern, filterEnabled)
		if err != nil {
			if filterEnabled {
				// If filter enabled and parsing failed, reject the data
				return nil, fmt.Errorf("data does not match required pattern: %v", err)
			}
			result["regex_error"] = err.Error()
			result["parsed"] = false
			return result, nil
		}

		if parsed == nil && filterEnabled {
			// If filter enabled and no match, reject the data
			return nil, fmt.Errorf("data does not match required pattern")
		}

		if parsed != nil {
			result["parsed"] = true
			for k, v := range parsed {
				result[k] = v
			}
		}
	}

	fmt.Printf("[TCP Read] 📊 Processed data: %q\n", cleanData)
	return result, nil
}

func (s *TCPReaderService) parseDataWithRegexFilter(rawData, pattern string, filterEnabled bool) (map[string]interface{}, error) {
	re, err := regexp.Compile(pattern)
	if err != nil {
		return nil, fmt.Errorf("invalid regex pattern: %v", err)
	}

	matches := re.FindStringSubmatch(rawData)
	if matches == nil {
		if filterEnabled {
			return nil, nil // Signal that data should be filtered out
		}
		return map[string]interface{}{"parsed": false}, nil
	}

	result := make(map[string]interface{})
	result["parsed"] = true

	for i, name := range re.SubexpNames() {
		if i > 0 && i < len(matches) && name != "" {
			result[name] = strings.TrimSpace(matches[i])
		}
	}

	return result, nil
}

// ============================================
// Keep existing methods for compatibility
// ============================================

// ReadMultipleLines - Original method, kept for backward compatibility
func (s *TCPReaderService) ReadMultipleLines(config *models.InstrumentConfig, expectedLines int) ([]map[string]interface{}, error) {
	// Redirect to grouped version with linesPerItem = 1
	return s.ReadMultipleLinesGrouped(config, expectedLines)
}

// SendCommand sends a command to the instrument
func (s *TCPReaderService) SendCommand(config *models.InstrumentConfig, command string) (string, error) {
	address := net.JoinHostPort(config.IPAddress, strconv.Itoa(config.TCPPort))

	fmt.Println("========== TCP COMMAND ==========")
	fmt.Printf("[TCP Command] Connecting to %s\n", address)
	fmt.Printf("[TCP Command] Command: %q\n", command)

	conn, err := net.DialTimeout("tcp", address, 10*time.Second)
	if err != nil {
		return "", fmt.Errorf("connection failed: %v", err)
	}
	defer conn.Close()

	cmd := strings.TrimSpace(command) + "\r\n"
	if _, err := conn.Write([]byte(cmd)); err != nil {
		return "", fmt.Errorf("failed to send command: %v", err)
	}
	fmt.Println("[TCP Command] ✅ Command sent")

	timeout := time.Duration(config.Timeout) * time.Second
	if timeout == 0 {
		timeout = 3 * time.Second
	}

	deadline := time.Now().Add(timeout)
	var response []byte
	buf := make([]byte, 1024)

	for time.Now().Before(deadline) {
		conn.SetReadDeadline(time.Now().Add(500 * time.Millisecond))

		n, err := conn.Read(buf)
		if err != nil {
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				if len(response) > 0 {
					break
				}
				continue
			}
			if err == io.EOF {
				break
			}
			return "", fmt.Errorf("read error: %v", err)
		}

		response = append(response, buf[:n]...)

		if strings.Contains(string(response), "\r\n") {
			break
		}
	}

	if len(response) == 0 {
		return "", errors.New("no response from instrument")
	}

	result := strings.TrimSpace(string(response))
	fmt.Printf("[TCP Command] ✅ Response: %q\n", result)
	fmt.Println("========== TCP COMMAND END ==========")

	return result, nil
}

func (s *TCPReaderService) TestConnection(config *models.InstrumentConfig, serialNumber string) (bool, string, string) {
	address := net.JoinHostPort(config.IPAddress, strconv.Itoa(config.TCPPort))

	fmt.Printf("[TCP Test] Testing connection to %s\n", address)

	conn, err := net.DialTimeout("tcp", address, 5*time.Second)
	if err != nil {
		return false, fmt.Sprintf("Connection failed: %v", err), ""
	}
	defer conn.Close()

	fmt.Println("[TCP Test] ✅ Connection successful")
	return true,
		"TCP connection successful. Instrument is reachable. Ready for passive data acquisition.",
		fmt.Sprintf("Connected to %s:%d", config.IPAddress, config.TCPPort)
}

func (s *TCPReaderService) ReadValue(config *models.InstrumentConfig) (float64, error) {
	if config == nil {
		return 0, fmt.Errorf("configuration is nil")
	}

	maxRetries := 3
	for attempt := 1; attempt <= maxRetries; attempt++ {
		value, err := s.tryReadValue(config)
		if err == nil {
			return value, nil
		}

		isConnReset := strings.Contains(err.Error(), "forcibly closed") ||
			strings.Contains(err.Error(), "connection reset") ||
			strings.Contains(err.Error(), "wsarecv") ||
			strings.Contains(err.Error(), "EOF")

		if isConnReset && attempt < maxRetries {
			fmt.Printf("[TCP ReadValue] ⚠️ Connection dropped, reconnecting (attempt %d/%d)...\n",
				attempt, maxRetries)
			time.Sleep(1 * time.Second)
			continue
		}

		return 0, err
	}

	return 0, fmt.Errorf("failed after %d attempts", maxRetries)
}

func (s *TCPReaderService) tryReadValue(config *models.InstrumentConfig) (float64, error) {
	address := net.JoinHostPort(config.IPAddress, strconv.Itoa(config.TCPPort))
	fmt.Printf("[TCP ReadValue] Connecting to %s for verification...\n", address)

	conn, err := net.DialTimeout("tcp", address, 10*time.Second)
	if err != nil {
		return 0, fmt.Errorf("connection failed: %v", err)
	}
	defer conn.Close()

	fmt.Println("[TCP ReadValue] ⏳ Please press PRINT button on instrument NOW!")

	timeout := time.Duration(config.Timeout) * time.Second
	if timeout == 0 || timeout < 30*time.Second {
		timeout = 60 * time.Second
	}
	fmt.Printf("[TCP ReadValue] ⏱️ Timeout set to: %s\n", timeout)

	buf := make([]byte, 1024)
	var accumulated []byte
	deadline := time.Now().Add(timeout)
	lastDataTime := time.Now()
	dataCompleteTimeout := 3 * time.Second

	for time.Now().Before(deadline) {
		conn.SetReadDeadline(time.Now().Add(1 * time.Second))
		n, err := conn.Read(buf)

		if err != nil {
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				if len(accumulated) > 0 && time.Since(lastDataTime) > dataCompleteTimeout {
					data := string(accumulated)
					value, parseErr := s.extractNumericValue(data, config.RegexPattern)
					if parseErr == nil {
						fmt.Printf("[TCP ReadValue] ✅ Value: %.4f\n", value)
						return value, nil
					}
					// Data ada tapi tidak bisa di-parse → clear dan tunggu lagi
					fmt.Printf("[TCP ReadValue] ⏭️ Non-numeric accumulated data, clearing: %q\n", strings.TrimSpace(data))
					accumulated = nil
				}
				continue
			}
			// EOF atau connection reset → return error supaya caller retry
			return 0, fmt.Errorf("read error: %v", err)
		}

		if n > 0 {
			accumulated = append(accumulated, buf[:n]...)
			lastDataTime = time.Now()
			fmt.Printf("[TCP ReadValue] 📦 Received %d bytes (total: %d)\n", n, len(accumulated))

			data := string(accumulated)
			if strings.HasSuffix(data, "\r\n") ||
				strings.HasSuffix(data, "\n") ||
				strings.HasSuffix(data, "\r") {
				value, err := s.extractNumericValue(data, config.RegexPattern)
				if err == nil {
					fmt.Printf("[TCP ReadValue] ✅ Value: %.4f\n", value)
					return value, nil
				}
				// Dapat newline tapi bukan angka valid → clear dan tunggu baris berikutnya
				fmt.Printf("[TCP ReadValue] ⏭️ Non-numeric line, waiting for next: %q\n", strings.TrimSpace(data))
				accumulated = nil
			}
		}
	}

	if len(accumulated) > 0 {
		value, err := s.extractNumericValue(string(accumulated), config.RegexPattern)
		if err == nil {
			return value, nil
		}
		return 0, fmt.Errorf("timeout: received data but failed to parse: %v", err)
	}

	return 0, fmt.Errorf("timeout: no valid data received after %s", timeout)
}

// ============================================

func (s *TCPReaderService) ReadValueWithCommand(config *models.InstrumentConfig, command string) (float64, error) {
	if config == nil {
		return 0, fmt.Errorf("configuration is nil")
	}

	maxRetries := 3
	for attempt := 1; attempt <= maxRetries; attempt++ {
		value, err := s.tryReadValueWithCommand(config, command)
		if err == nil {
			return value, nil
		}

		isConnReset := strings.Contains(err.Error(), "forcibly closed") ||
			strings.Contains(err.Error(), "connection reset") ||
			strings.Contains(err.Error(), "wsarecv") ||
			strings.Contains(err.Error(), "EOF")

		if isConnReset && attempt < maxRetries {
			fmt.Printf("[TCP ReadValue] ⚠️ Connection dropped, reconnecting (attempt %d/%d)...\n",
				attempt, maxRetries)
			time.Sleep(1 * time.Second)
			continue
		}

		return 0, err
	}

	return 0, fmt.Errorf("failed after %d attempts", maxRetries)
}

func (s *TCPReaderService) tryReadValueWithCommand(config *models.InstrumentConfig, command string) (float64, error) {
	address := net.JoinHostPort(config.IPAddress, strconv.Itoa(config.TCPPort))
	fmt.Printf("[TCP ReadValue] Connecting to %s...\n", address)

	conn, err := net.DialTimeout("tcp", address, 10*time.Second)
	if err != nil {
		return 0, fmt.Errorf("connection failed: %v", err)
	}
	defer conn.Close()
	fmt.Println("[TCP ReadValue] ✅ Connected")

	if command == "" {
		command = "S"
	}
	cmd := command + "\r\n"
	fmt.Printf("[TCP ReadValue] 📤 Sending command: %q\n", command)
	if _, err := conn.Write([]byte(cmd)); err != nil {
		return 0, fmt.Errorf("failed to send command: %v", err)
	}

	timeout := time.Duration(config.Timeout) * time.Second
	if timeout == 0 || timeout < 5*time.Second {
		timeout = 30 * time.Second
	}

	reader := bufio.NewReader(conn)
	deadline := time.Now().Add(timeout)

	for time.Now().Before(deadline) {
		conn.SetReadDeadline(time.Now().Add(2 * time.Second))
		line, err := reader.ReadString('\n')

		if err != nil {
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				// Tidak ada data — kirim ulang command dan tunggu
				fmt.Println("[TCP ReadValue] ⏳ No data, re-sending command...")
				conn.Write([]byte(cmd))
				continue
			}
			// EOF atau connection reset → return error supaya caller retry
			return 0, fmt.Errorf("read error: %v", err)
		}

		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}

		fmt.Printf("[TCP ReadValue] 📦 Line received: %q\n", trimmed)

		value, err := s.parseMTSICSResponse(trimmed, config.RegexPattern)
		if err == nil {
			fmt.Printf("[TCP ReadValue] ✅ Valid weight parsed: %.4f\n", value)
			return value, nil
		}

		// Bukan berat (header, status line, dll) — skip dan tunggu baris berikutnya
		fmt.Printf("[TCP ReadValue] ⏭️  Non-weight line skipped: %q\n", trimmed)
	}

	return 0, fmt.Errorf("timeout: no valid weight data received after %s", timeout)
}

// parseMTSICSResponse - Parse MT-SICS protocol responses
// Common formats:
//
//	S S      123.4567 g    (Stable weight)
//	S D      123.4567 g    (Dynamic weight)
//	S I    +0123.4567 g    (Immediate weight)
func (s *TCPReaderService) parseMTSICSResponse(data, regexPattern string) (float64, error) {
	data = strings.TrimSpace(data)

	// Check for MT-SICS error responses
	if strings.HasPrefix(data, "ES") || strings.HasPrefix(data, "ET") {
		return 0, fmt.Errorf("balance error: %s", data)
	}

	// If custom regex provided, use it first
	if regexPattern != "" {
		re, err := regexp.Compile(regexPattern)
		if err == nil {
			matches := re.FindStringSubmatch(data)
			if len(matches) > 1 {
				valueStr := strings.TrimSpace(matches[1])
				if value, err := strconv.ParseFloat(valueStr, 64); err == nil {
					return value, nil
				}
			}
		}
	}

	// MT-SICS response format: "S S      123.4567 g"
	// Split by whitespace and look for numeric value
	parts := strings.Fields(data)
	for _, part := range parts {
		// Try to parse each part as a number
		cleaned := strings.TrimSpace(part)
		cleaned = strings.TrimPrefix(cleaned, "+")

		if value, err := strconv.ParseFloat(cleaned, 64); err == nil {
			// Found a valid number
			return value, nil
		}
	}

	return 0, fmt.Errorf("no numeric value found in MT-SICS response: %q", data)
}

// ReadMultipleLinesGroupedWithCommand - Read multiple measurements by sending commands
func (s *TCPReaderService) ReadMultipleLinesGroupedWithCommand(config *models.InstrumentConfig, expectedItems int, command string) ([]map[string]interface{}, error) {
	fmt.Println("========== TCP MULTI-READ WITH COMMANDS START ==========")

	if command == "" {
		command = "SI" // Send immediate value (don't wait for stability)
	}

	address := net.JoinHostPort(config.IPAddress, fmt.Sprintf("%d", config.TCPPort))
	fmt.Printf("[TCP Multi-Read] Connecting to %s\n", address)

	conn, err := net.DialTimeout("tcp", address, 10*time.Second)
	if err != nil {
		fmt.Printf("[TCP Multi-Read] ❌ Connection failed: %v\n", err)
		return nil, fmt.Errorf("connection failed: %w", err)
	}
	defer conn.Close()

	fmt.Println("[TCP Multi-Read] ✅ Connected")

	allItems := make([]map[string]interface{}, 0, expectedItems)
	reader := bufio.NewReader(conn)

	timeout := time.Duration(config.Timeout) * time.Second
	if timeout == 0 || timeout > 60*time.Second {
		timeout = 1800 * time.Second
	}

	for i := 0; i < expectedItems; i++ {
		// Send command for each measurement
		cmd := command + "\r\n"
		fmt.Printf("[TCP Multi-Read] 📤 Sending command %d/%d: %q\n", i+1, expectedItems, command)

		if _, err := conn.Write([]byte(cmd)); err != nil {
			return allItems, fmt.Errorf("failed to send command %d: %v", i+1, err)
		}

		// Read response
		conn.SetReadDeadline(time.Now().Add(timeout))
		line, err := reader.ReadString('\n')

		if err != nil {
			if err == io.EOF {
				fmt.Println("[TCP Multi-Read] 📡 Connection closed by instrument")
				break
			}
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				fmt.Printf("[TCP Multi-Read] ⏱️ Timeout on item %d/%d\n", i+1, expectedItems)
				break
			}
			fmt.Printf("[TCP Multi-Read] ❌ Read error on item %d: %v\n", i+1, err)
			break
		}

		line = strings.TrimSpace(line)
		fmt.Printf("[TCP Multi-Read] 📦 Item %d response: %q\n", i+1, line)

		if line == "" {
			fmt.Printf("[TCP Multi-Read] ⚠️ Empty response for item %d\n", i+1)
			continue
		}

		// Parse the response
		item := map[string]interface{}{
			"raw_data":  line,
			"timestamp": time.Now().Format("2006-01-02 15:04:05"),
			"parsed":    false,
		}

		// Try to extract numeric value
		value, err := s.parseMTSICSResponse(line, config.RegexPattern)
		if err == nil {
			item["value"] = value
			item["parsed"] = true
		} else {
			// Fallback extraction
			value, err = s.extractNumericValue(line, config.RegexPattern)
			if err == nil {
				item["value"] = value
				item["parsed"] = true
			} else {
				item["parse_error"] = err.Error()
			}
		}

		allItems = append(allItems, item)

		// Small delay between commands to avoid overwhelming the balance
		if i < expectedItems-1 {
			time.Sleep(100 * time.Millisecond)
		}
	}

	fmt.Println("========== TCP MULTI-READ WITH COMMANDS END ==========")

	if len(allItems) == 0 {
		return nil, errors.New("no data received from instrument")
	}

	fmt.Printf("[TCP Multi-Read] ✅ Successfully read %d/%d items\n", len(allItems), expectedItems)
	return allItems, nil
}

// ReadAllLines - Read all lines sent by the TCP instrument in one burst.
// Used for multi-line instruments (e.g. pH Meter via TCP-serial bridge) that
// transmit all readings at once. Returns one string per non-empty line.
func (s *TCPReaderService) ReadAllLines(config *models.InstrumentConfig) ([]string, error) {
	if config == nil {
		return nil, fmt.Errorf("configuration is nil")
	}

	fmt.Println("[TCP ReadAllLines] Reading all lines for batch verification...")

	address := net.JoinHostPort(config.IPAddress, fmt.Sprintf("%d", config.TCPPort))

	timeout := time.Duration(config.Timeout) * time.Second
	if timeout == 0 || timeout < 30*time.Second {
		timeout = 60 * time.Second
	}
	fmt.Printf("[TCP ReadAllLines] Connecting to %s (timeout %s)\n", address, timeout)

	conn, err := net.DialTimeout("tcp", address, 10*time.Second)
	if err != nil {
		return nil, fmt.Errorf("connection failed: %w", err)
	}
	defer conn.Close()
	fmt.Println("[TCP ReadAllLines] ✅ Connected")

	// Optionally trigger the instrument
	triggerCmds := []string{"PRINT\r\n", "P\r\n"}
	for _, cmd := range triggerCmds {
		conn.SetWriteDeadline(time.Now().Add(2 * time.Second))
		conn.Write([]byte(cmd))
	}

	reader := bufio.NewReader(conn)
	var lines []string
	lastDataTime := time.Now()
	quietTimeout := 2 * time.Second

	conn.SetReadDeadline(time.Now().Add(timeout))

	for {
		conn.SetReadDeadline(time.Now().Add(quietTimeout))
		line, err := reader.ReadString('\n')

		if line != "" {
			trimmed := strings.TrimSpace(line)
			if trimmed != "" {
				lines = append(lines, trimmed)
				fmt.Printf("[TCP ReadAllLines] 📦 Line %d: %q\n", len(lines), trimmed)
			}
			lastDataTime = time.Now()
		}

		if err != nil {
			if err == io.EOF {
				fmt.Println("[TCP ReadAllLines] ✅ EOF — instrument closed connection")
				break
			}
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				if len(lines) > 0 && time.Since(lastDataTime) >= quietTimeout {
					fmt.Printf("[TCP ReadAllLines] ✅ Quiet for %s, done\n", quietTimeout)
					break
				}
				if time.Since(lastDataTime) > timeout {
					break
				}
				continue
			}
			fmt.Printf("[TCP ReadAllLines] ⚠️ Read error: %v\n", err)
			break
		}
	}

	if len(lines) == 0 {
		return nil, fmt.Errorf("timeout: no data received after %s", timeout)
	}

	fmt.Printf("[TCP ReadAllLines] ✅ %d non-empty lines received\n", len(lines))
	return lines, nil
}

// extractNumericValue - Extract numeric value from data, optionally using regex pattern
func (s *TCPReaderService) extractNumericValue(data, regexPattern string) (float64, error) {
	if regexPattern != "" {
		re, err := regexp.Compile(regexPattern)
		if err == nil {
			matches := re.FindStringSubmatch(data)
			if len(matches) > 1 {
				valueStr := strings.TrimSpace(matches[1])
				if value, err := strconv.ParseFloat(valueStr, 64); err == nil {
					return value, nil
				}
			}
		}
	}

	re := regexp.MustCompile(`[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?`)
	match := re.FindString(data)
	if match == "" {
		return 0, fmt.Errorf("no numeric value found in data: %q", data)
	}

	value, err := strconv.ParseFloat(match, 64)
	if err != nil {
		return 0, fmt.Errorf("failed to parse numeric value: %v", err)
	}

	return value, nil
}
