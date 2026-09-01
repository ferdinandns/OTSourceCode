package main

import (
	"fmt"
	"lab-connect/backend-api/controllers"
	"lab-connect/backend-api/database"
	"lab-connect/backend-api/routes"
	"lab-connect/backend-api/services"
	"log"
	"os"

	"github.com/joho/godotenv"
)

func main() {
	// Load .env
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	// Initialize database
	database.InitDB()
	database.SeedMettlerToledoCommands()
	services.InitWebSocketService()
	services.StartSyncWatcher()
	// On startup, if DB is available, replay any pending offline entries
	if database.IsDBAvailable() {
		go func() {
			if err := services.ReplayQueue(); err != nil {
				log.Printf("[Startup] Offline queue replay error: %v", err)
			}
		}()
	}

	auditService := services.NewAuditService(database.DB)
	database.DB.Use(services.NewAuditPlugin(auditService))

	// Initialize services
	serialReader := services.NewSerialReaderService()
	tcpReader := services.NewTCPReaderService()
	tibboReader := services.NewTibboReaderService(tcpReader)
	pdfGenerator := services.NewPDFGeneratorService(database.DB)

	instrumentReader := services.NewInstrumentReaderService(
		serialReader,
		tcpReader,
		tibboReader,
		pdfGenerator,
	)

	instrumentService := services.NewInstrumentService()

	auditController := controllers.NewAuditController(auditService)

	// Initialize controllers
	instrumentController := controllers.NewInstrumentController(
		instrumentService,
		instrumentReader,
	)

	log.Println("✅ WebSocket Service initialized")

	// Setup router
	router := routes.SetupRouter(instrumentController, auditController, auditService)

	controllers.StartWebSocketBroadcast()

	// ✅ DEBUG: Print all registered routes
	fmt.Println("\n========================================")
	fmt.Println(" REGISTERED ROUTES:")
	fmt.Println("========================================")
	for _, route := range router.Routes() {
		fmt.Printf("%-6s %s\n", route.Method, route.Path)
	}
	fmt.Println("========================================")

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	log.Printf("API Base URL: http://localhost:%s/api", port)
	log.Printf("Health Check: http://localhost:%s/health", port)

	if err := router.Run("0.0.0.0:" + port); err != nil {
		log.Fatal("Failed to start server:", err)
	}

}
