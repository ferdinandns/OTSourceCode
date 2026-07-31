package ws

import (
	"sync"

	"github.com/gorilla/websocket"
)

// Tambahkan struct Client untuk membungkus koneksi dengan Mutex-nya sendiri
type Client struct {
	Conn *websocket.Conn
	mu   sync.Mutex // Mutex ini khusus untuk menjaga satu koneksi ini
}

type Hub struct {
	clients map[uint][]*Client // Ubah dari *websocket.Conn ke *Client
	mu      sync.RWMutex       // Mutex ini tetap untuk menjaga map clients
}

var GlobalHub = &Hub{
	clients: make(map[uint][]*Client),
}

func (h *Hub) Register(userID uint, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	// Bungkus koneksi ke dalam struct Client
	h.clients[userID] = append(h.clients[userID], &Client{Conn: conn})
}

func (h *Hub) Unregister(userID uint, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	clients := h.clients[userID]
	for i, c := range clients {
		if c.Conn == conn {
			h.clients[userID] = append(clients[:i], clients[i+1:]...)
			break
		}
	}
}

func (h *Hub) SendToUser(userID uint, event string, data interface{}) {
	h.mu.RLock()
	clients, ok := h.clients[userID]
	h.mu.RUnlock()
	if !ok {
		return
	}

	msg := map[string]interface{}{"event": event, "data": data}

	var deadConns []*websocket.Conn
	for _, client := range clients {
		client.mu.Lock()
		err := client.Conn.WriteJSON(msg)
		client.mu.Unlock()
		if err != nil {
			deadConns = append(deadConns, client.Conn)
		}
	}
	for _, conn := range deadConns {
		h.Unregister(userID, conn)
	}
}

func (h *Hub) Broadcast(event string, data interface{}) {
	allClients := h.getAllClients()
	msg := map[string]interface{}{"event": event, "data": data}

	for _, client := range allClients {
		h.sendToClient(client, msg)
	}
}

// getAllClients returns a flat slice of all connected clients.
func (h *Hub) getAllClients() []*Client {
	h.mu.RLock()
	defer h.mu.RUnlock()
	var all []*Client
	for _, clients := range h.clients {
		all = append(all, clients...)
	}
	return all
}

// sendToClient attempts to write JSON to a client; if it fails, finds the user
// and unregisters the client.
func (h *Hub) sendToClient(client *Client, msg map[string]interface{}) {
	client.mu.Lock()
	err := client.Conn.WriteJSON(msg)
	client.mu.Unlock()
	if err == nil {
		return
	}
	userID := h.findUserIDByClient(client)
	if userID != 0 {
		h.Unregister(userID, client.Conn)
	}
}

// findUserIDByClient returns the userID associated with a client, or 0 if not found.
func (h *Hub) findUserIDByClient(target *Client) uint {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for userID, clients := range h.clients {
		for _, c := range clients {
			if c == target {
				return userID
			}
		}
	}
	return 0
}
