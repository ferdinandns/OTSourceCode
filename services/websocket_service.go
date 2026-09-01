package services

import (
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins (sesuaikan untuk production)
	},
}

type WebSocketService struct {
	clients   map[*websocket.Conn]bool
	broadcast chan interface{}
	mutex     sync.Mutex
}

var wsService *WebSocketService

func InitWebSocketService() *WebSocketService {
	if wsService == nil {
		wsService = &WebSocketService{
			clients:   make(map[*websocket.Conn]bool),
			broadcast: make(chan interface{}),
		}
		go wsService.handleBroadcast()
	}
	return wsService
}

func (ws *WebSocketService) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("WebSocket upgrade error:", err)
		return
	}
	defer conn.Close()

	ws.mutex.Lock()
	ws.clients[conn] = true
	ws.mutex.Unlock()

	log.Println("✅ Client connected to WebSocket")

	// Keep connection alive
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			ws.mutex.Lock()
			delete(ws.clients, conn)
			ws.mutex.Unlock()
			log.Println("❌ Client disconnected")
			break
		}
	}
}

func (ws *WebSocketService) handleBroadcast() {
	for {
		message := <-ws.broadcast
		ws.mutex.Lock()
		for client := range ws.clients {
			err := client.WriteJSON(message)
			if err != nil {
				log.Println("WebSocket write error:", err)
				client.Close()
				delete(ws.clients, client)
			}
		}
		ws.mutex.Unlock()
	}
}

func (ws *WebSocketService) BroadcastData(data interface{}) {
	ws.broadcast <- data
}

func GetWebSocketService() *WebSocketService {
	return wsService
}
