package services

import (
	"context"
	"fmt"
	"lab-connect/backend-api/models"
	"regexp"
	"strconv"
	"strings"
	"time"

	"go.bug.st/serial"
)

type SerialReaderService struct{}

func (s *SerialReaderService) SendCommand(
	config *models.InstrumentConfig,
	command string,
) (string, error) {

	if config == nil {
		return "", fmt.Errorf("configuration is nil")
	}

	mode := &serial.Mode{
		BaudRate: config.BaudRate,
		DataBits: config.DataBits,
		StopBits: serial.StopBits(config.StopBits),
		Parity:   s.parseParity(config.Parity),
	}

	port, err := serial.Open(config.ComPort, mode)
	if err != nil {
		return "", fmt.Errorf("failed to open serial port: %v", err)
	}
	defer port.Close()

	// Pastikan command diakhiri newline
	if !strings.HasSuffix(command, "\r\n") {
		command += "\r\n"
	}

	// Kirim command
	_, err = port.Write([]byte(command))
	if err != nil {
		return "", fmt.Errorf("failed to send command: %v", err)
	}

	// Baca respon singkat (2–3 detik cukup)
	port.SetReadTimeout(3 * time.Second)
	buf := make([]byte, 512)
	n, err := port.Read(buf)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %v", err)
	}

	response := strings.TrimSpace(string(buf[:n]))
	return response, nil
}

func NewSerialReaderService() *SerialReaderService {
	return &SerialReaderService{}
}

// ReadData - Enhanced with 60 second timeout
func (s *SerialReaderService) ReadData(config *models.InstrumentConfig) (map[string]interface{}, error) {
	fmt.Println("========== SERIAL READ START ==========")
	fmt.Printf("[Serial Read] Port: %s, Baud: %d\n", config.ComPort, config.BaudRate)

	// Configure serial port
	mode := &serial.Mode{
		BaudRate: config.BaudRate,
		DataBits: config.DataBits,
		StopBits: serial.StopBits(config.StopBits),
		Parity:   s.parseParity(config.Parity),
	}

	// Open port
	port, err := serial.Open(config.ComPort, mode)
	if err != nil {
		return nil, fmt.Errorf("failed to open serial port: %v", err)
	}
	defer port.Close()
	fmt.Println("[Serial Read] ✅ Port opened")

	// Use 60 second timeout from config, default to 60s
	timeout := time.Duration(config.Timeout) * time.Second
	if timeout == 0 || timeout > 1800*time.Second {
		timeout = 1800 * time.Second
	}
	fmt.Printf("[Serial Read] Timeout: %s\n", timeout)

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	// Channel for result
	resultChan := make(chan map[string]interface{}, 1)
	errorChan := make(chan error, 1)

	// Goroutine to read data
	go func() {
		data, err := s.readFromPort(port, config.RegexPattern, timeout)
		if err != nil {
			errorChan <- err
			return
		}
		resultChan <- data
	}()

	// Wait for result or timeout
	select {
	case result := <-resultChan:
		fmt.Println("[Serial Read] ✅ Data received successfully")
		fmt.Println("========== SERIAL READ END ==========")
		return result, nil

	case err := <-errorChan:
		fmt.Printf("[Serial Read] ❌ Error: %v\n", err)
		fmt.Println("========== SERIAL READ END ==========")
		return nil, err

	case <-ctx.Done():
		fmt.Println("[Serial Read] ⏰ TIMEOUT after 1800 seconds")
		fmt.Println("========== SERIAL READ END ==========")
		return nil, fmt.Errorf("timeout: no data received after %s", timeout)
	}
}

// readFromPort - Internal method to read data
func (s *SerialReaderService) readFromPort(port serial.Port, regexPattern string, maxDuration time.Duration) (map[string]interface{}, error) {
	buf := make([]byte, 4096)

	// STRATEGY 1: Try sending commands
	commands := []string{
		"PRINT\r\n", "P\r\n", "S\r\n", "SI\r\n",
		"\x05", // ENQ
	}

	fmt.Println("[Serial Read] STRATEGY 1: Trying commands...")
	for i, cmd := range commands {
		fmt.Printf("[Serial Read]   Command %d/%d: %q\n", i+1, len(commands), cmd)

		port.Write([]byte(cmd))
		port.SetReadTimeout(3 * time.Second)

		// Try to read response
		if data, err := s.tryReadWithTimeout(port, buf, 3*time.Second, regexPattern); err == nil {
			return data, nil
		}

		time.Sleep(100 * time.Millisecond)
	}

	// STRATEGY 2: Passive listening
	fmt.Println("[Serial Read] STRATEGY 2: Passive listening...")
	fmt.Printf("[Serial Read] ⚠️ Please trigger instrument now! (timeout: %s)\n", maxDuration)

	if data, err := s.tryReadWithTimeout(port, buf, maxDuration-10*time.Second, regexPattern); err == nil {
		return data, nil
	}

	return nil, fmt.Errorf("no data received after all strategies")
}

// tryReadWithTimeout - Try to read data within timeout
func (s *SerialReaderService) tryReadWithTimeout(port serial.Port, buf []byte, timeout time.Duration, regexPattern string) (map[string]interface{}, error) {
	deadline := time.Now().Add(timeout)
	var accumulated []byte
	lastDataTime := time.Now()
	dataTimeout := 1800 * time.Second

	for time.Now().Before(deadline) {
		port.SetReadTimeout(1800 * time.Millisecond)
		n, err := port.Read(buf)

		if err == nil && n > 0 {
			accumulated = append(accumulated, buf[:n]...)
			lastDataTime = time.Now()

			fmt.Printf("[Serial Read] 📦 Received %d bytes (total: %d)\n", n, len(accumulated))

			rawData := string(accumulated)

			// Check for terminator
			if strings.HasSuffix(rawData, "\r\n") ||
				strings.HasSuffix(rawData, "\n") {
				fmt.Println("[Serial Read] ✅ Complete data (terminator found)")
				return s.processData(rawData, regexPattern)
			}
			continue
		}

		// If we have data and no new data for 2 seconds, consider complete
		if len(accumulated) > 0 && time.Since(lastDataTime) > dataTimeout {
			fmt.Println("[Serial Read] ✅ Complete data (timeout)")
			return s.processData(string(accumulated), regexPattern)
		}
	}

	if len(accumulated) > 0 {
		fmt.Printf("[Serial Read] ⚠️ Returning partial data (%d bytes)\n", len(accumulated))
		return s.processData(string(accumulated), regexPattern)
	}

	return nil, fmt.Errorf("timeout: no data received")
}

// processData - Process raw data with regex
func (s *SerialReaderService) processData(rawData, regexPattern string) (map[string]interface{}, error) {
	cleanData := strings.TrimSpace(rawData)

	result := map[string]interface{}{
		"raw_data":   rawData,
		"clean_data": cleanData,
		"timestamp":  time.Now().Format("2006-01-02 15:04:05"),
		"parsed":     true,
	}

	// Apply regex if configured
	if regexPattern != "" {
		parsed, err := s.parseDataWithRegex(rawData, regexPattern)
		if err != nil {
			result["regex_error"] = err.Error()
			result["parsed"] = false
		} else {
			for k, v := range parsed {
				result[k] = v
			}
		}
	}

	return result, nil
}

// parseDataWithRegex - Parse data using regex
func (s *SerialReaderService) parseDataWithRegex(rawData, pattern string) (map[string]interface{}, error) {
	re, err := regexp.Compile(pattern)
	if err != nil {
		return nil, fmt.Errorf("invalid regex pattern: %v", err)
	}

	matches := re.FindStringSubmatch(rawData)
	if matches == nil {
		return map[string]interface{}{"parsed": false}, nil
	}

	result := map[string]interface{}{"parsed": true}
	for i, name := range re.SubexpNames() {
		if i > 0 && i < len(matches) && name != "" {
			result[name] = matches[i]
		}
	}

	return result, nil
}

// parseParity - Convert parity string to serial.Parity
func (s *SerialReaderService) parseParity(parity string) serial.Parity {
	switch parity {
	case "Odd":
		return serial.OddParity
	case "Even":
		return serial.EvenParity
	default:
		return serial.NoParity
	}
}

// TestConnection - Test serial connection
func (s *SerialReaderService) TestConnection(config *models.InstrumentConfig, serialNumber string) (bool, string, string) {
	mode := &serial.Mode{
		BaudRate: config.BaudRate,
		DataBits: config.DataBits,
		StopBits: serial.StopBits(config.StopBits),
		Parity:   s.parseParity(config.Parity),
	}

	port, err := serial.Open(config.ComPort, mode)
	if err != nil {
		return false, fmt.Sprintf("Failed to open port: %v", err), ""
	}
	defer port.Close()

	// Send test command
	testCommand := "*IDN?\r\n"
	port.Write([]byte(testCommand))

	// Read response
	port.SetReadTimeout(2 * time.Second)
	buf := make([]byte, 256)
	n, err := port.Read(buf)
	if err != nil {
		return false, fmt.Sprintf("Failed to read response: %v", err), ""
	}

	response := string(buf[:n])
	return true, "Connection successful", response
}

// ReadValue - Read single numeric value from serial instrument (for verification)
func (s *SerialReaderService) ReadValue(config *models.InstrumentConfig) (float64, error) {
	if config == nil {
		return 0, fmt.Errorf("configuration is nil")
	}

	fmt.Println("[Serial ReadValue] Reading value for verification...")

	// Configure serial port
	mode := &serial.Mode{
		BaudRate: config.BaudRate,
		DataBits: config.DataBits,
		StopBits: serial.StopBits(config.StopBits),
		Parity:   s.parseParity(config.Parity),
	}

	// Open port
	port, err := serial.Open(config.ComPort, mode)
	if err != nil {
		return 0, fmt.Errorf("failed to open serial port: %v", err)
	}
	defer port.Close()

	// ✅ INCREASED TIMEOUT: Use config timeout or default to 60 seconds
	timeout := time.Duration(config.Timeout) * time.Second
	if timeout == 0 || timeout < 1800*time.Second {
		timeout = 1800 * time.Second
	}
	fmt.Printf("[Serial ReadValue] ⏱️ Timeout set to: %s\n", timeout)

	// Flush any old data
	port.ResetInputBuffer()
	port.ResetOutputBuffer()

	// STRATEGY 1: Try sending commands
	commands := []string{
		"PRINT\r\n",
		"P\r\n",
		"S\r\n",
		"SI\r\n",
		"\x05", // ENQ
	}

	fmt.Println("[Serial ReadValue] STRATEGY 1: Trying commands...")
	for i, cmd := range commands {
		fmt.Printf("[Serial ReadValue]   Command %d/%d: %q\n", i+1, len(commands), cmd)

		// Flush buffer before sending
		port.ResetInputBuffer()

		// Send command
		_, err := port.Write([]byte(cmd))
		if err != nil {
			fmt.Printf("[Serial ReadValue]   ⚠️ Failed to send: %v\n", err)
			continue
		}

		// Wait for response
		port.SetReadTimeout(5 * time.Second)
		buf := make([]byte, 256)
		var accumulated []byte

		deadline := time.Now().Add(5 * time.Second)
		for time.Now().Before(deadline) {
			n, err := port.Read(buf)
			if err == nil && n > 0 {
				accumulated = append(accumulated, buf[:n]...)

				// Check if we have terminator
				data := string(accumulated)
				if strings.HasSuffix(data, "\r\n") ||
					strings.HasSuffix(data, "\n") {
					value, err := s.extractNumericValue(data, config.RegexPattern)
					if err == nil {
						fmt.Printf("[Serial ReadValue] ✅ Value from command: %.4f\n", value)
						return value, nil
					}
				}
			}

			// If we have data, wait a bit more for complete packet
			if len(accumulated) > 0 {
				time.Sleep(500 * time.Millisecond)
				if len(accumulated) > 5 { // Arbitrary minimum
					data := string(accumulated)
					value, err := s.extractNumericValue(data, config.RegexPattern)
					if err == nil {
						fmt.Printf("[Serial ReadValue] ✅ Value: %.4f\n", value)
						return value, nil
					}
				}
			}
		}

		time.Sleep(200 * time.Millisecond)
	}

	// STRATEGY 2: Passive listening with longer timeout
	fmt.Println("[Serial ReadValue] STRATEGY 2: Passive listening...")
	fmt.Printf("[Serial ReadValue] ⚠️ Please trigger instrument now! (timeout: %s)\n", timeout)

	buf := make([]byte, 256)
	var accumulated []byte
	deadline := time.Now().Add(timeout)
	lastDataTime := time.Now()
	dataCompleteTimeout := 2 * time.Second

	retryCount := 0
	maxRetries := 3

	for time.Now().Before(deadline) {
		port.SetReadTimeout(1 * time.Second)
		n, err := port.Read(buf)

		if err == nil && n > 0 {
			accumulated = append(accumulated, buf[:n]...)
			lastDataTime = time.Now()

			fmt.Printf("[Serial ReadValue] 📦 Received %d bytes (total: %d)\n", n, len(accumulated))

			data := string(accumulated)

			// Check for terminator
			if strings.HasSuffix(data, "\r\n") ||
				strings.HasSuffix(data, "\n") ||
				strings.HasSuffix(data, "\r") {
				value, err := s.extractNumericValue(data, config.RegexPattern)
				if err == nil {
					fmt.Printf("[Serial ReadValue] ✅ Value: %.4f\n", value)
					return value, nil
				}
			}

			retryCount = 0 // Reset on successful read
		}

		// If we have data and no new data for 2 seconds, try to parse
		if len(accumulated) > 0 && time.Since(lastDataTime) > dataCompleteTimeout {
			data := string(accumulated)
			value, err := s.extractNumericValue(data, config.RegexPattern)
			if err == nil {
				fmt.Printf("[Serial ReadValue] ✅ Value: %.4f\n", value)
				return value, nil
			}

			// Retry mechanism
			if retryCount < maxRetries {
				retryCount++
				fmt.Printf("[Serial ReadValue] ⚠️ Parse failed, retry %d/%d...\n", retryCount, maxRetries)
				accumulated = []byte{}
				lastDataTime = time.Now()
				time.Sleep(1 * time.Second)
				continue
			}
		}

		// Show progress
		elapsed := time.Since(lastDataTime)
		if int(elapsed.Seconds())%10 == 0 && len(accumulated) == 0 {
			remaining := time.Until(deadline)
			fmt.Printf("[Serial ReadValue] ⏳ Waiting... (%.0fs remaining)\n", remaining.Seconds())
		}
	}

	// Timeout - try parsing partial data
	if len(accumulated) > 0 {
		data := string(accumulated)
		fmt.Printf("[Serial ReadValue] ⚠️ Timeout but attempting to parse: %q\n", data)
		value, err := s.extractNumericValue(data, config.RegexPattern)
		if err == nil {
			fmt.Printf("[Serial ReadValue] ⚠️ Value from partial data: %.4f\n", value)
			return value, nil
		}
		return 0, fmt.Errorf("timeout: received data but failed to parse: %v", err)
	}

	return 0, fmt.Errorf("timeout: no valid data received after %s. Please ensure: 1) Instrument is ON and connected, 2) COM port is correct, 3) Baud rate matches instrument", timeout)
}

// ReadAllLines - Read all lines from the serial instrument in one burst.
// Used for multi-line instruments (e.g. pH Meter) that send all readings at once.
// Returns one float64 per non-empty line, in the order received.
func (s *SerialReaderService) ReadAllLines(config *models.InstrumentConfig) ([]string, error) {
	if config == nil {
		return nil, fmt.Errorf("configuration is nil")
	}

	fmt.Println("[Serial ReadAllLines] Reading all lines for batch verification...")

	mode := &serial.Mode{
		BaudRate: config.BaudRate,
		DataBits: config.DataBits,
		StopBits: serial.StopBits(config.StopBits),
		Parity:   s.parseParity(config.Parity),
	}

	port, err := serial.Open(config.ComPort, mode)
	if err != nil {
		return nil, fmt.Errorf("failed to open serial port: %v", err)
	}
	defer port.Close()

	port.ResetInputBuffer()
	port.ResetOutputBuffer()

	timeout := time.Duration(config.Timeout) * time.Second
	if timeout == 0 || timeout < 30*time.Second {
		timeout = 60 * time.Second
	}
	fmt.Printf("[Serial ReadAllLines] Timeout: %s\n", timeout)

	// Try commands first to trigger the instrument to send all readings
	commands := []string{"PRINT\r\n", "P\r\n", "S\r\n", "SI\r\n", "\x05"}
	for _, cmd := range commands {
		port.ResetInputBuffer()
		port.Write([]byte(cmd))
		port.SetReadTimeout(3 * time.Second)

		buf := make([]byte, 512)
		var acc []byte
		cmdDeadline := time.Now().Add(3 * time.Second)
		for time.Now().Before(cmdDeadline) {
			n, err := port.Read(buf)
			if err == nil && n > 0 {
				acc = append(acc, buf[:n]...)
			} else {
				break
			}
		}
		if len(acc) > 0 {
			fmt.Printf("[Serial ReadAllLines] Got initial data from command %q\n", cmd)
			// Collect remaining data until the port goes quiet
			lines := s.drainToLines(port, acc, timeout)
			if len(lines) > 0 {
				return lines, nil
			}
		}
	}

	// Passive: wait for instrument to send data
	fmt.Printf("[Serial ReadAllLines] ⚠️ Passive mode — please trigger instrument (timeout: %s)\n", timeout)
	lines := s.drainToLines(port, nil, timeout)
	if len(lines) == 0 {
		return nil, fmt.Errorf("timeout: no data received after %s", timeout)
	}
	return lines, nil
}

// drainToLines reads from an already-opened port until it goes quiet, then returns all
// non-empty trimmed lines. initialData may carry bytes already read before this call.
func (s *SerialReaderService) drainToLines(port serial.Port, initialData []byte, maxWait time.Duration) []string {
	var accumulated []byte
	accumulated = append(accumulated, initialData...)

	buf := make([]byte, 512)
	deadline := time.Now().Add(maxWait)
	lastDataTime := time.Now()
	quietTimeout := 2 * time.Second // declare done after 2 s of silence

	for time.Now().Before(deadline) {
		port.SetReadTimeout(500 * time.Millisecond)
		n, err := port.Read(buf)
		if err == nil && n > 0 {
			accumulated = append(accumulated, buf[:n]...)
			lastDataTime = time.Now()
			fmt.Printf("[Serial ReadAllLines] 📦 %d bytes (total %d)\n", n, len(accumulated))
			continue
		}
		// No new bytes — check quiet timeout
		if len(accumulated) > 0 && time.Since(lastDataTime) > quietTimeout {
			fmt.Printf("[Serial ReadAllLines] ✅ Quiet for %s, treating as complete\n", quietTimeout)
			break
		}
	}

	if len(accumulated) == 0 {
		return nil
	}

	raw := strings.TrimSpace(string(accumulated))
	rawLines := strings.Split(raw, "\n")
	out := make([]string, 0, len(rawLines))
	for _, l := range rawLines {
		l = strings.TrimSpace(strings.TrimRight(l, "\r"))
		if l != "" {
			out = append(out, l)
		}
	}
	fmt.Printf("[Serial ReadAllLines] ✅ %d non-empty lines\n", len(out))
	return out
}

// extractNumericValue - Extract numeric value from data string using regex pattern if available
func (s *SerialReaderService) extractNumericValue(data, regexPattern string) (float64, error) {
	// If regex pattern is provided, use it
	if regexPattern != "" {
		re, err := regexp.Compile(regexPattern)
		if err == nil {
			matches := re.FindStringSubmatch(data)
			if len(matches) > 1 {
				// Try to parse first captured group
				valueStr := strings.TrimSpace(matches[1])
				if value, err := strconv.ParseFloat(valueStr, 64); err == nil {
					return value, nil
				}
			}
		}
	}

	// Default: extract first numeric value
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
