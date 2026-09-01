package services

import (
	"errors"
	"fmt"
	"lab-connect/backend-api/models"
	"os"
	"time"
)

type TibboReaderService struct {
	tcpReader *TCPReaderService
}

func NewTibboReaderService(tcpReader *TCPReaderService) *TibboReaderService {
	return &TibboReaderService{
		tcpReader: tcpReader,
	}
}

// ReadData - Read data through Tibbo device
func (s *TibboReaderService) ReadData(config *models.InstrumentConfig) (map[string]interface{}, error) {
	// Tibbo uses TCP/IP protocol to communicate
	// So we can reuse TCPReaderService

	if config.IPAddress == "" || config.TCPPort == 0 {
		return nil, fmt.Errorf("tibbo configuration incomplete: IP address and TCP port required")
	}

	// Use TCP reader with Tibbo-specific handling
	return s.tcpReader.ReadData(config)
}

// TestConnection - Test Tibbo connection
func (s *TibboReaderService) TestConnection(config *models.InstrumentConfig, serialNumber string) (bool, string, string) {
	// Reuse TCP test connection
	return s.tcpReader.TestConnection(config, serialNumber)
}

// ReadValue - Read single numeric value through Tibbo (for verification)
func (s *TibboReaderService) ReadValue(config *models.InstrumentConfig) (float64, error) {
	if config == nil {
		return 0, fmt.Errorf("configuration is nil")
	}

	if config.IPAddress == "" || config.TCPPort == 0 {
		return 0, fmt.Errorf("tibbo configuration incomplete: IP address and TCP port required")
	}

	fmt.Println("[Tibbo ReadValue] Reading value through Tibbo device...")

	// Tibbo uses TCP/IP protocol, so reuse TCPReaderService
	value, err := s.tcpReader.ReadValue(config)
	if err != nil {
		return 0, fmt.Errorf("tibbo read failed: %v", err)
	}

	fmt.Printf("[Tibbo ReadValue] ✅ Value: %.4f\n", value)
	return value, nil
}

// ReadAllLines - Read all lines from the instrument through the Tibbo TCP bridge.
// Delegates to TCPReaderService since Tibbo uses TCP/IP for communication.
func (s *TibboReaderService) ReadAllLines(config *models.InstrumentConfig) ([]string, error) {
	if config == nil {
		return nil, fmt.Errorf("configuration is nil")
	}

	if config.IPAddress == "" || config.TCPPort == 0 {
		return nil, fmt.Errorf("tibbo configuration incomplete: IP address and TCP port required")
	}

	fmt.Println("[Tibbo ReadAllLines] Reading all lines through Tibbo device...")

	lines, err := s.tcpReader.ReadAllLines(config)
	if err != nil {
		return nil, fmt.Errorf("tibbo read all lines failed: %v", err)
	}

	fmt.Printf("[Tibbo ReadAllLines] ✅ %d lines received\n", len(lines))
	return lines, nil
}

func (s *TibboReaderService) SendCommand(config *models.InstrumentConfig, command string) (string, error) {
	if config.FilePath == "" {
		return "", errors.New("file path not configured")
	}

	// Write command to file
	commandFile := config.FilePath + ".cmd"
	if err := os.WriteFile(commandFile, []byte(command), 0644); err != nil {
		return "", fmt.Errorf("failed to write command: %w", err)
	}

	// Wait for response (with timeout)
	timeout := time.Duration(config.Timeout) * time.Millisecond
	if timeout == 0 {
		timeout = 5 * time.Second
	}

	startTime := time.Now()
	for {
		if time.Since(startTime) > timeout {
			return "", errors.New("timeout waiting for response")
		}

		// Read response from data file
		data, err := os.ReadFile(config.FilePath)
		if err != nil {
			time.Sleep(100 * time.Millisecond)
			continue
		}

		if len(data) > 0 {
			return string(data), nil
		}

		time.Sleep(100 * time.Millisecond)
	}
}
