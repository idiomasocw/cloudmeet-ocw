import { Request, Response } from "express";
import { LiveKitService } from "../services/livekitService.js";
import { getLiveKitURL } from "../utils/getLiveKitURL.js";
import { randomString } from "../utils/randomString.js";

const COOKIE_KEY = "random-participant-postfix";

export function createConnectionDetailsHandler(livekitService: LiveKitService) {
  return async (req: Request, res: Response) => {
    const { roomName, participantName, metadata, region } = req.query;

    if (!roomName || !participantName) {
      return res.status(400).json({
        error: 'Missing "roomName" or "participantName" query parameters',
      });
    }

    try {
      // Use public URL for browser clients, fallback to internal URL
      const publicUrl =
        process.env.LIVEKIT_PUBLIC_URL || process.env.LIVEKIT_URL || "";
      const livekitServerUrl = (
        region ? getLiveKitURL(publicUrl, region as string) : publicUrl
      ).replace("https://", "wss://");

      // Handle participant postfix from cookies
      let randomParticipantPostfix = req.cookies?.[COOKIE_KEY];
      if (!randomParticipantPostfix) {
        randomParticipantPostfix = randomString(4);
      }

      const token = await livekitService.generateToken(roomName as string, {
        identity: `${participantName}__${randomParticipantPostfix}`,
        name: participantName as string,
        metadata: (metadata as string) || "",
        ttl: "5m", // Shorter TTL like frontend
      });

      const connectionDetails = {
        serverUrl: livekitServerUrl,
        roomName: roomName,
        participantToken: token,
        participantName: participantName,
      };

      // Set cookie with dynamic security based on environment
      const cookieExpiration = new Date(
        Date.now() + 60 * 120 * 1000,
      ).toUTCString();
      res.cookie(COOKIE_KEY, randomParticipantPostfix, {
        path: "/",
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production", // Only secure in production
        expires: new Date(cookieExpiration),
      });

      res.json(connectionDetails);
    } catch (error) {
      console.error("Error generating connection details:", error);
      res.status(500).json({ error: "Failed to generate connection details" });
    }
  };
}
