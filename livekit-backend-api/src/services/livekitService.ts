import {
  AccessToken,
  EgressClient,
  EncodedFileOutput,
  S3Upload,
} from "livekit-server-sdk";

export interface LiveKitConfig {
  apiKey: string;
  apiSecret: string;
  wsUrl: string;
}

export interface TokenOptions {
  identity: string;
  name: string;
  metadata?: string;
  ttl?: string;
}

export class LiveKitService {
  constructor(private config: LiveKitConfig) {}

  async generateToken(
    roomName: string,
    options: TokenOptions,
  ): Promise<string> {
    if (!this.config.apiKey || !this.config.apiSecret) {
      throw new Error("LiveKit credentials not configured");
    }

    const at = new AccessToken(this.config.apiKey, this.config.apiSecret, {
      identity: options.identity,
      name: options.name,
      metadata: options.metadata,
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    });

    at.ttl = options.ttl || "60m";
    return await at.toJwt();
  }

  async startRecording(roomName: string, s3Bucket: string, awsRegion: string) {
    console.log("\n=== LIVEKIT SERVICE: START RECORDING ===");
    console.log("Room Name:", roomName);
    console.log("S3 Bucket:", s3Bucket);
    console.log("AWS Region:", awsRegion);

    const httpUrl = this.config.wsUrl
      .replace("wss://", "https://")
      .replace("ws://", "http://");
    console.log("EgressClient URL conversion:", {
      original: this.config.wsUrl,
      converted: httpUrl,
    });

    // Test network connectivity first
    try {
      const testUrl = new URL(httpUrl);
      console.log(
        "Testing connectivity to:",
        testUrl.hostname,
        "port:",
        testUrl.port || "443",
      );
      const response = await fetch(
        `${httpUrl}/twirp/livekit.Egress/ListEgress`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
          signal: AbortSignal.timeout(5000),
        },
      );
      console.log(
        "Connectivity test response:",
        response.status,
        response.statusText,
      );
    } catch (error) {
      console.error(
        "Connectivity test failed:",
        error instanceof Error ? error.message : String(error),
      );
    }

    console.log("Creating EgressClient...");
    const egressClient = new EgressClient(
      httpUrl,
      this.config.apiKey,
      this.config.apiSecret,
    );
    console.log("✅ EgressClient created");

    // Check if we should use local file output (for testing)
    const useLocalFiles = process.env.USE_LOCAL_RECORDINGS === "true";
    console.log("USE_LOCAL_RECORDINGS:", useLocalFiles);

    let fileOutput;
    if (useLocalFiles) {
      // Local file output for testing
      fileOutput = new EncodedFileOutput({
        filepath: `/recordings/${roomName}/${Date.now()}.mp4`,
        // No S3 output - files will be stored locally in the container
      });
      console.log("Using local file output for recording");
    } else {
      // S3 output - use credentials from environment
      const s3AccessKey = process.env.S3_ACCESS_KEY || "";
      const s3SecretKey = process.env.S3_SECRET_KEY || "";

      console.log("S3 Credentials Check:", {
        hasAccessKey: !!s3AccessKey,
        accessKeyLength: s3AccessKey.length,
        accessKeyPrefix: s3AccessKey.substring(0, 4),
        hasSecretKey: !!s3SecretKey,
        secretKeyLength: s3SecretKey.length,
      });

      fileOutput = new EncodedFileOutput({
        filepath: `recordings/${roomName}/${Date.now()}.mp4`,
        output: {
          case: "s3",
          value: new S3Upload({
            accessKey: s3AccessKey,
            secret: s3SecretKey,
            region: awsRegion,
            bucket: s3Bucket,
          }),
        },
      });
      console.log("Using S3 output for recording with credentials:", {
        bucket: s3Bucket,
        region: awsRegion,
        hasAccessKey: !!s3AccessKey,
        hasSecretKey: !!s3SecretKey,
      });
    }

    console.log("Calling egressClient.startRoomCompositeEgress...");
    try {
      const result = await egressClient.startRoomCompositeEgress(
        roomName,
        {
          file: fileOutput,
        },
        {
          layout: "grid",
        },
      );
      console.log("✅ startRoomCompositeEgress SUCCESS!");
      console.log("Result:", JSON.stringify(result, null, 2));
      console.log("=== END LIVEKIT SERVICE: START RECORDING ===\n");
      return result;
    } catch (error) {
      console.error("❌ startRoomCompositeEgress FAILED!");
      console.error(
        "Error type:",
        error instanceof Error ? error.constructor.name : typeof error,
      );
      console.error(
        "Error message:",
        error instanceof Error ? error.message : String(error),
      );
      console.error(
        "Error stack:",
        error instanceof Error ? error.stack : "No stack trace",
      );
      console.error(
        "Full error:",
        JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
      );
      console.log("=== END LIVEKIT SERVICE: START RECORDING (ERROR) ===\n");
      throw error;
    }
  }

  async stopRecording(egressId: string) {
    const httpUrl = this.config.wsUrl
      .replace("wss://", "https://")
      .replace("ws://", "http://");
    const egressClient = new EgressClient(
      httpUrl,
      this.config.apiKey,
      this.config.apiSecret,
    );
    return await egressClient.stopEgress(egressId);
  }
}
