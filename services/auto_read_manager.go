package services

import (
	"fmt"
	"sync"
	"time"
)

type autoReadState struct {
	cancelCh chan struct{}
	doneCh   chan struct{} // closed by the goroutine when it exits
}

type AutoReadManager struct {
	mu     sync.Mutex
	active map[uint]*autoReadState
}

var GlobalAutoReadManager = &AutoReadManager{
	active: make(map[uint]*autoReadState),
}

// Register creates a fresh cancel+done channel pair.
// The goroutine MUST call: defer close(doneCh)
func (m *AutoReadManager) Register(usageID uint) (cancelCh chan struct{}, doneCh chan struct{}) {
	m.mu.Lock()
	defer m.mu.Unlock()
	cancelCh = make(chan struct{})
	doneCh = make(chan struct{})
	m.active[usageID] = &autoReadState{cancelCh: cancelCh, doneCh: doneCh}
	fmt.Printf("[AutoReadMgr] Registered usage #%d\n", usageID)
	return cancelCh, doneCh
}

// Cancel closes the cancel channel. Safe to call multiple times.
func (m *AutoReadManager) Cancel(usageID uint) {
	m.mu.Lock()
	defer m.mu.Unlock()
	state, ok := m.active[usageID]
	if !ok {
		return
	}
	select {
	case <-state.cancelCh:
		// already closed
	default:
		close(state.cancelCh)
	}
	fmt.Printf("[AutoReadMgr] Cancelled usage #%d\n", usageID)
}

// CancelAndWait cancels the goroutine and blocks until doneCh is closed
// (goroutine exited) or timeout elapses. Returns true if clean exit.
func (m *AutoReadManager) CancelAndWait(usageID uint, timeout time.Duration) bool {
	m.mu.Lock()
	state, ok := m.active[usageID]
	if !ok {
		m.mu.Unlock()
		return true
	}
	doneCh := state.doneCh
	m.mu.Unlock()

	m.Cancel(usageID)

	select {
	case <-doneCh:
		fmt.Printf("[AutoReadMgr] usage #%d exited cleanly\n", usageID)
		return true
	case <-time.After(timeout):
		fmt.Printf("[AutoReadMgr] ⚠️ usage #%d still running after %v\n", usageID, timeout)
		return false
	}
}

// UnregisterIfMatch removes the entry only when cancelCh matches —
// prevents a newer goroutine's entry from being deleted by the deferred
// Unregister of an older goroutine.
func (m *AutoReadManager) UnregisterIfMatch(usageID uint, cancelCh chan struct{}) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if state, ok := m.active[usageID]; ok && state.cancelCh == cancelCh {
		delete(m.active, usageID)
		fmt.Printf("[AutoReadMgr] Unregistered usage #%d\n", usageID)
	}
}

// Unregister removes the entry unconditionally.
func (m *AutoReadManager) Unregister(usageID uint) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.active, usageID)
	fmt.Printf("[AutoReadMgr] Unregistered usage #%d\n", usageID)
}

// IsActive returns true if a goroutine is registered for usageID.
func (m *AutoReadManager) IsActive(usageID uint) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	_, ok := m.active[usageID]
	return ok
}
