import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { S3Client } from "@aws-sdk/client-s3";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { createClient } from "redis";
import { LiveKitService, LiveKitConfig } from "./services/livekitService.js";
import { createConnectionDetailsHandler } from "./routes/connectionDetails.js";
import { createRecordingHandlers } from "./routes/recording.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: [
      "https://cloumeet.intellectif.com",
      "https://main.d7su4zfgbh6z8.amplifyapp.com",
      "http://localhost:3000",
      "http://localhost:3001",
    ],
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

// AWS clients
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
});
const secretsClient = new SecretsManagerClient({
  region: process.env.AWS_REGION || "us-east-1",
});

// Redis client
let redisClient: any = null;
let livekitService: LiveKitService;

// Log environment variables on startup
function logEnvironmentVariables() {
  console.log("\n=== ENVIRONMENT VARIABLES ===");
  const envVars = [
    "PORT",
    "AWS_REGION",
    "REDIS_URL",
    "S3_BUCKET",
    "LIVEKIT_API_KEY",
    "LIVEKIT_API_SECRET",
    "LIVEKIT_URL",
  ];

  envVars.forEach((varName) => {
    const value = process.env[varName];
    if (value) {
      // Mask sensitive values
      const maskedValue = ["LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"].includes(
        varName,
      )
        ? `${value.substring(0, 4)}***${value.substring(value.length - 4)}`
        : value;
      console.log(`✅ ${varName}: ${maskedValue}`);
    } else {
      console.log(`❌ ${varName}: NOT SET`);
    }
  });
  console.log("==============================\n");
}

// Initialize services
async function initializeServices() {
  logEnvironmentVariables();

  try {
    // Use environment variables (injected by CDK from Secrets Manager)
    const livekitConfig: LiveKitConfig = {
      apiKey: process.env.LIVEKIT_API_KEY || "",
      apiSecret: process.env.LIVEKIT_API_SECRET || "",
      wsUrl: process.env.LIVEKIT_URL || "",
    };

    // Initialize LiveKit service
    livekitService = new LiveKitService(livekitConfig);

    // Initialize Redis client
    if (process.env.REDIS_URL) {
      redisClient = createClient({ url: process.env.REDIS_URL });
      await redisClient.connect();
      console.log("Connected to Redis");
    }

    console.log("Services initialized successfully");
  } catch (error) {
    console.error("Failed to initialize services:", error);
  }
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Setup routes after services are initialized
async function setupRoutes() {
  // Connection details route (backward compatibility)
  app.get(
    "/connection-details",
    createConnectionDetailsHandler(livekitService),
  );

  // New get-token endpoint
  app.post("/get-token", async (req, res) => {
    const { roomName, identity } = req.body;

    if (!roomName || !identity) {
      return res.status(400).json({ error: "Missing roomName or identity" });
    }

    try {
      const token = await livekitService.generateToken(roomName, {
        identity,
        name: identity,
      });
      const publicUrl =
        process.env.LIVEKIT_PUBLIC_URL || process.env.LIVEKIT_URL;
      res.json({ token, serverUrl: publicUrl });
    } catch (error) {
      console.error("Error generating token:", error);
      res.status(500).json({ error: "Failed to generate token" });
    }
  });

  // Recording routes
  const recordingHandlers = createRecordingHandlers(
    livekitService,
    s3Client,
    redisClient,
  );

  // Support both GET (frontend style) and POST (new style) for recordings
  app.get("/record/start", recordingHandlers.startRecording);
  app.post("/start-recording", recordingHandlers.startRecording);

  app.get("/record/stop", recordingHandlers.stopRecording);
  app.post("/stop-recording", recordingHandlers.stopRecording);

  app.get("/list-recordings", recordingHandlers.listRecordings);
}

// Initialize and start server
async function startServer() {
  await initializeServices();
  await setupRoutes();

  app.listen(PORT, () => {
    console.log(`LiveKit Token Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });
}

startServer().catch(console.error);
