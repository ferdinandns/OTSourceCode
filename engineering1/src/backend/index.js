const fetch = require("isomorphic-fetch");
const express = require("express");
const cors = require("cors");
const { body, validationResult } = require("express-validator");
const upload = require("./middleware/multer");
const { db, db2, db3, db4, post } = require("./database");
const { databaseRouter } = require("./routers");
const { exec } = require("child_process");
const fs = require("fs");
const axios = require("axios");
const http = require("http");
const WebSocket = require("ws");
const cron = require("node-cron");
const fileUpload = require('express-fileupload'); // 1. Import it 


// Add this line with your other imports
const databaseControllers = require("./controllers/databaseControllers.js");

const port = 8002;
const app = express();
app.use(fileUpload()); 

app.use(cors());
// Enhance JSON parsing to capture raw body for debugging and increase size limit
app.use(
  express.json({
    limit: '2mb',
    verify: (req, res, buf) => {
      try {
        req.rawBody = buf.toString();
      } catch (e) {
        req.rawBody = undefined;
      }
    },
  })
);

// Debug middleware: log payload reaching the route
app.use((req, res, next) => {
  if (req.method === 'POST' && req.path === '/part/bulk-import-pending') {
    console.log('🛰️ Incoming POST /part/bulk-import-pending');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Raw body length:', req.rawBody ? req.rawBody.length : 0);
    if (req.rawBody) {
      try {
        const parsedRaw = JSON.parse(req.rawBody);
        console.log('Raw body JSON keys:', Object.keys(parsedRaw));
      } catch (e) {
        console.log('Raw body not JSON, first 200 chars:', req.rawBody.slice(0, 200));
      }
    }
    console.log('Parsed body type:', typeof req.body, 'keys:', req.body && Object.keys(req.body));
  }
  next();
});

app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static("public"));

const OLLAMA_URL = "http://10.126.15.141:11434/api/generate";

// Antrian untuk permintaan
let requestQueue = [];
let isProcessing = false;

// Fungsi untuk memproses antrian
const processQueue = async () => {
  if (isProcessing || requestQueue.length === 0) return;

  isProcessing = true;
  const { req, res } = requestQueue.shift();

  try {
    const response = await axios.post(OLLAMA_URL, {
      model: req.body.machine,
      prompt: req.body.prompt,
    });

    res.json(response.data);
    console.log(response.data);
  } catch (error) {
    console.error("Error fetching Ollama:", error.message);
    res.status(500).json({ error: "Failed to get response from Ollama" });
  } finally {
    isProcessing = false;
    processQueue(); // Proses permintaan berikutnya dalam antrian
  }
};

app.post("/ask-ollama", (req, res) => {
  requestQueue.push({ req, res });
  processQueue();
});

// Logging middleware to log request body
app.use((req, res, next) => {
  console.log(`Request Body: ${JSON.stringify(req.body)}`);
  next();
});

// Error handling middleware for JSON parsing errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    console.error("Bad JSON:", err.message);
    return res.status(400).send({ error: "Invalid JSON payload" });
  }
  next();
});

app.post(
  "/validation",
  body("email").isEmail(),
  body("password").isLength({ min: 5 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array() });
    }
    return res.status(200).send(req.body);
  }
);

app.get("/plc", async (req, res) => {
  try {
    const response = await fetch("http://10.126.15.134/awp/data/data.js");
    const data = await response.text();
    res.send(data);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/upload", upload.single("file"), async (req, res) => {
  const { file } = req;
  const filepath = file ? "/" + file.filename : null;
  let data;
  try {
    data = JSON.parse(req.body.data);
  } catch (err) {
    console.error(err);
    return res.status(400).send({ error: "Invalid JSON payload" });
  }

  res.status(200).send({ filepath });

  let fetchQuery = `UPDATE parammachine_saka.users SET imagePath = ${db.escape(
    filepath
  )} WHERE id_users = ${db.escape(data.id)}`;

  db.query(fetchQuery, (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send({
        isSuccess: false,
        message: "Error updating database",
      });
    } else {
      res.status(200).send({ isSuccess: true, message: "Success update data" });
    }
  });
});

app.post("/generate", (req, res) => {
  const { model, prompt } = req.body;
  const command = `curl.exe -X POST http://10.126.15.141:11434/api/generate -H "Content-Type: application/json" -d "{\\"model\\":\\"${model}\\", \\"prompt\\":\\"${prompt}\\"}"`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(error);
      res.status(500).send(`Error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(stderr);
      res.status(500).send(`Stderr: ${stderr}`);
      return;
    }
    try {
      const jsonResponse = JSON.parse(stdout);
      res.status(200).json(jsonResponse);
    } catch (parseError) {
      console.error(parseError);
      res.status(500).send(`Failed to parse response: ${parseError.message}`);
    }
  });
});

let connectionStatus = {
  db1: "Unknown",
  db2: "Unknown",
  db3: "Unknown",
  db4: "Unknown",
  postgresql: "Unknown",
};

// Function to ping connections every 5 seconds
function pingConnections() {
  setInterval(() => {
    // Iterate through all mysql connections (Pools AND Single)
    [db, db2, db3, db4].forEach((conn, index) => {
      
      // CHANGED: Use .query('SELECT 1') instead of .ping()
      // This works universally for both your Pools and Single connections.
      conn.query('SELECT 1', (err) => {
        const status = err ? `Error : ${err.message}` : "YOMAN";
        connectionStatus[`db${index + 1}`] = status;
      });
      
    });
    // Your PostgreSQL logic stays exactly the same
    post.query("SELECT 1", (err) => {
      const status = err ? `Error: ${err.message}` : "YOMAN";
      connectionStatus.postgresql = status;
    });
  }, 5000);
}

// Start pinging connections
pingConnections();

// API endpoint to get connection status
app.use("/api/connection", (req, res) => {
  res.json(connectionStatus);
});

app.use("/part", databaseRouter);

// WebSocket implementation
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.post("/ask", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify({ message: "WebSocket connection established" }));

  const ws = new WebSocket(`ws://localhost:${port}`);

  ws.on("open", () => {
    ws.send(JSON.stringify(req.body));
  });

  ws.on("message", (data) => {
    console.log("Received:", data);
  });
});

wss.on("connection", (ws) => {
  ws.on("message", async (message) => {
    const { machine, prompt } = JSON.parse(message);

    try {
      const response = await axios.post(
        OLLAMA_URL,
        {
          model: machine,
          prompt: prompt,
          stream: true,
        },
        { responseType: "stream" }
      );

      response.data.on("data", (chunk) => {
        try {
          const jsonChunks = chunk.toString().trim().split("\n");
          jsonChunks.forEach((jsonChunk) => {
            const parsed = JSON.parse(jsonChunk);
            if (parsed.response) {
              console.log(parsed.response); // Log hasil ke console
              ws.send(parsed.response);
            }
          });
        } catch (err) {
          console.error("Error parsing stream chunk:", err);
          ws.send(JSON.stringify({ error: "Error parsing stream chunk" }));
        }
      });

      response.data.on("end", () => {
        ws.close();
      });
    } catch (error) {
      console.error("Error fetching Ollama:", error.message);
      ws.send(JSON.stringify({ error: "Failed to get response from Ollama" }));
      ws.close();
    }
  });
});

app.post(
  "/api/import-pmp-data",
  upload.single("pmpfile"), // We use your existing 'upload' middleware
  databaseControllers.bulkImportPMPData
);

app.post(
  '/api/bulk-import-pending',databaseControllers.bulkImportPendingJobs // <-- Now it handles JSON
);

server.listen(port, () => {
  console.log("SERVER RUNNING IN PORT " + port);
});


// Only run on Instance 0 to prevent duplicate inserts
// =============================================================
// ⚡ AUTOMATIC CRON JOB (Safe for PM2 Cluster Mode)
// =============================================================

// =============================================================
// 🧪 TEST MODE: AUTOMATIC CRON JOB
// =============================================================

// =============================================================
// ⚡ AUTOMATIC CRON JOB (Safe for PM2 Cluster Mode)
// =============================================================

if (process.env.NODE_APP_INSTANCE === '0' || typeof process.env.NODE_APP_INSTANCE === 'undefined') {
    
    console.log("✅ Cron Jobs initialized on Instance 0 (OEE + Downtime ETL)");

    // --- HELPER 1: OEE ARCHIVING ---
    const triggerArchive = async (dateStr, shiftLabel, shiftId) => {
        try {
            console.log(`⏰ [OEE] Archiving ${shiftLabel} for Date: ${dateStr}`);
            await axios.get('http://10.126.15.197:8002/part/getUnifiedOEE', {
                params: { date: dateStr, archive: 'true', target_shift: shiftId },
            });
            console.log(`✅ OEE Archive Success for ${shiftLabel}`);
        } catch (error) {
            console.error(`❌ OEE Archive Failed (${shiftLabel}):`, error.message);
        }
    };

    // --- HELPER 2: DOWNTIME ETL (Processes pd_desc and ud_desc) ---
    const triggerDowntimeETL = async (shiftLabel) => {
        try {
            console.log(`🚀 [ETL] Running Downtime Stats Sync for: ${shiftLabel}`);
            // This triggers the same logic as your manual "Execute ETL" button
            await axios.post('http://10.126.15.197:8002/part/runEtlProcess');
            console.log(`✅ Downtime ETL Success for ${shiftLabel}`);
        } catch (error) {
            console.error(`❌ Downtime ETL Failed (${shiftLabel}):`, error.message);
        }
    };

    // --- SCHEDULED JOBS (Asia/Jakarta Timezone) ---
    
    // 1. Shift 1 End (15:00:05)
    cron.schedule('0 15 * * *', () => { 
        setTimeout(() => {
            const today = new Date().toISOString().split('T')[0];
            triggerArchive(today, "Shift 1", 1); 
            triggerDowntimeETL("Shift 1"); // Added integrated call
        }, 5000);
    }, { timezone: "Asia/Jakarta" });

    // 2. Shift 2 End (22:45:05)
    cron.schedule('45 22 * * *', () => { 
        setTimeout(() => {
            const today = new Date().toISOString().split('T')[0];
            triggerArchive(today, "Shift 2", 2);
            triggerDowntimeETL("Shift 2"); // Added integrated call
        }, 5000);
    }, { timezone: "Asia/Jakarta" });

    // 3. Shift 3 End (06:30:05)
    cron.schedule('30 6 * * *', () => { 
        setTimeout(() => {
            const d = new Date();
            d.setHours(d.getHours() - 12); // Logic to capture previous production date
            const dateStr = d.toISOString().split('T')[0];
            triggerArchive(dateStr, "Shift 3", 3);
            triggerDowntimeETL("Shift 3"); // Added integrated call
        }, 5000);
    }, { timezone: "Asia/Jakarta" });

} else {
    console.log(`Instance ${process.env.NODE_APP_INSTANCE}: Standing by.`);
}


if (process.env.NODE_APP_INSTANCE === '0' || typeof process.env.NODE_APP_INSTANCE === 'undefined') {
    
    console.log("🧪 Fette ETL TEST Cron Initialized (Syncing to fette_shift_logs)");

    // --- FETTE ETL HELPER ---
    const triggerFetteETL = async (dateStr, shiftLabel) => {
        try {
            console.log(`📡 [TEST-SYNC] Requesting ETL for ${shiftLabel} on ${dateStr}...`);
            
            // Calling your new sync controller
            const response = await axios.get('http://10.126.15.197:8002/part/syncFetteETL', {
                params: { date: dateStr }
            });
            
            console.log(`✅ [TEST-SUCCESS] ${shiftLabel} synced:`, response.data.message);
        } catch (error) {
            console.error(`❌ [TEST-FAILED] ${shiftLabel}:`, error.response?.data || error.message);
        }
    };

    // --- SCHEDULED TEST JOBS (Asia/Jakarta) ---

    // 1. Shift 1 Sync (Starts 5 seconds after 15:00)
    cron.schedule('0 15 * * *', () => { 
        const today = new Date().toISOString().split('T')[0];
        setTimeout(() => triggerFetteETL(today, "Shift 1"), 5000);
    }, { timezone: "Asia/Jakarta" });

    // 2. Shift 2 Sync (Starts 5 seconds after 22:45)
    cron.schedule('45 22 * * *', () => { 
        const today = new Date().toISOString().split('T')[0];
        setTimeout(() => triggerFetteETL(today, "Shift 2"), 5000);
    }, { timezone: "Asia/Jakarta" });

    // 3. Shift 3 Sync (Starts 5 seconds after 06:30)
    cron.schedule('30 6 * * *', () => { 
        // Logic to shift back 12 hours so 6:30 AM data belongs to the previous date
        const d = new Date();
        d.setHours(d.getHours() - 12); 
        const dateStr = d.toISOString().split('T')[0];
        
        setTimeout(() => triggerFetteETL(dateStr, "Shift 3"), 5000);
    }, { timezone: "Asia/Jakarta" });

}

/*

// --- SCHEDULED JOBS (Asia/Jakarta Timezone) ---

// --- SHIFT 1 END ---
// Immediate Sync (15:00:05)
cron.schedule('0 15 * * *', () => { 
    setTimeout(() => {
        const today = new Date().toISOString().split('T')[0];
        triggerFetteETL(today, "Shift 1 (Immediate)");
    }, 5000);
}, { timezone: "Asia/Jakarta" });

// Finalizer Sync (15:05:00)
cron.schedule('5 15 * * *', () => { 
    const today = new Date().toISOString().split('T')[0];
    triggerFetteETL(today, "Shift 1 (Finalizer)");
}, { timezone: "Asia/Jakarta" });


// --- SHIFT 2 END ---
// Immediate Sync (22:45:05)
cron.schedule('45 22 * * *', () => { 
    setTimeout(() => {
        const today = new Date().toISOString().split('T')[0];
        triggerFetteETL(today, "Shift 2 (Immediate)");
    }, 5000);
}, { timezone: "Asia/Jakarta" });

// Finalizer Sync (22:50:00)
cron.schedule('50 22 * * *', () => { 
    const today = new Date().toISOString().split('T')[0];
    triggerFetteETL(today, "Shift 2 (Finalizer)");
}, { timezone: "Asia/Jakarta" });


// --- SHIFT 3 END --- (Using -12h logic)
// Immediate Sync (06:30:05)
cron.schedule('30 6 * * *', () => { 
    setTimeout(() => {
        const d = new Date(); d.setHours(d.getHours() - 12);
        const dateStr = d.toISOString().split('T')[0];
        triggerFetteETL(dateStr, "Shift 3 (Immediate)");
    }, 5000);
}, { timezone: "Asia/Jakarta" });

// Finalizer Sync (06:35:00)
cron.schedule('35 6 * * *', () => { 
    const d = new Date(); d.setHours(d.getHours() - 12);
    const dateStr = d.toISOString().split('T')[0];
    triggerFetteETL(dateStr, "Shift 3 (Finalizer)");
}, { timezone: "Asia/Jakarta" });

*/