require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const authRoutes = require("./routes/auth");
const { getTransporter } = require("./utils/mailer");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// Request logging in development
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use("/api/auth", authRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "CiNE Authentication & Watchlist Backend",
    db: mongoose.connection.readyState === 1 ? "connected" : "connecting",
    timestamp: new Date().toISOString()
  });
});

// Root welcome
app.get("/", (req, res) => {
  res.send(`
    <div style="font-family:sans-serif;background:#080909;color:#fff;padding:40px;min-height:100vh">
      <h1 style="color:#E5242A">CiNE.. Backend API</h1>
      <p>Authentication and Database service powered by <strong>MongoDB</strong> & <strong>Nodemailer</strong>.</p>
      <ul>
        <li>Status: <strong>Online</strong></li>
        <li>Database: <strong>${mongoose.connection.readyState === 1 ? "Connected" : "Initializing..."}</strong></li>
        <li>Health check: <a style="color:#E5242A" href="/api/health">/api/health</a></li>
      </ul>
    </div>
  `);
});

// Connect to MongoDB
async function initDatabase() {
  const path = require("path");
  const fs = require("fs");

  const mongoDataDir = path.join(__dirname, ".mongodb-data");
  const mongoBinDir = path.join(__dirname, ".mongodb-bin");
  if (!fs.existsSync(mongoDataDir)) fs.mkdirSync(mongoDataDir, { recursive: true });
  if (!fs.existsSync(mongoBinDir)) fs.mkdirSync(mongoBinDir, { recursive: true });

  process.env.MONGOMS_DOWNLOAD_DIR = mongoBinDir;

  const customUri = process.env.MONGODB_URI;

  if (customUri && !customUri.includes("127.0.0.1") && !customUri.includes("localhost")) {
    try {
      console.log(`[DB] Attempting connection to custom MONGODB_URI...`);
      await mongoose.connect(customUri, { serverSelectionTimeoutMS: 5000 });
      console.log(`[DB] Connected successfully to remote MongoDB Atlas`);
      return;
    } catch (err) {
      console.warn(`[DB] Could not connect to custom MONGODB_URI: ${err.message}`);
    }
  }

  // Attempt local MongoDB on 27017 if already running
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/cine", { serverSelectionTimeoutMS: 1500 });
    console.log(`[DB] Connected successfully to local MongoDB at 127.0.0.1:27017/cine`);
    return;
  } catch (localErr) {
    console.log(`[DB] No external mongod detected on port 27017. Starting persistent embedded MongoDB on D: drive...`);
  }

  // Persistent MongoDB server using D:\CiNE\server\.mongodb-data bound to port 27017
  try {
    const { MongoMemoryServer } = require("mongodb-memory-server");
    const mongod = await MongoMemoryServer.create({
      instance: {
        port: 27017,
        dbName: "cine",
        dbPath: mongoDataDir
      },
      binary: {
        downloadDir: mongoBinDir
      }
    });
    const memoryUri = mongod.getUri();
    await mongoose.connect(`${memoryUri}cine`);
    console.log(`[DB] MongoDB server is ACTIVE on port 27017!`);
    console.log(`[DB] Compass Connection URI: mongodb://localhost:27017`);
    console.log(`[DB] Database: cine | Data folder: ${mongoDataDir}`);

    process.on("SIGINT", async () => {
      await mongoose.disconnect();
      await mongod.stop();
      process.exit(0);
    });
  } catch (embedErr) {
    console.warn(`[DB] Could not bind to port 27017 (${embedErr.message}), falling back to auto-port...`);
    try {
      const { MongoMemoryServer } = require("mongodb-memory-server");
      const fallbackMongod = await MongoMemoryServer.create({
        instance: {
          dbName: "cine",
          dbPath: mongoDataDir
        },
        binary: {
          downloadDir: mongoBinDir
        }
      });
      const fallbackUri = fallbackMongod.getUri();
      await mongoose.connect(`${fallbackUri}cine`);
      console.log(`[DB] MongoDB server active on fallback port: ${fallbackUri}`);
      console.log(`[DB] Compass Connection URI: ${fallbackUri}`);
    } catch (fbErr) {
      console.error(`[DB] Critical: Failed to start embedded MongoDB:`, fbErr.message);
    }
  }
}

// Start server
async function startServer() {
  await initDatabase();
  await getTransporter(); // Initialize Nodemailer

  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(` CiNE Backend Server running on http://localhost:${PORT}`);
    console.log(` Real Authentication: MongoDB + Nodemailer Active`);
    console.log(` Health check: http://localhost:${PORT}/api/health`);
    console.log(`======================================================\n`);
  });
}

startServer().catch(err => {
  console.error("Fatal startup error:", err);
});
