import { Request, Response } from 'express';
import { LiveKitService } from '../services/livekitService.js';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

export function createRecordingHandlers(livekitService: LiveKitService, s3Client: S3Client, redisClient: any) {
  
  // Start recording - supports both GET (frontend style) and POST (new style)
  const startRecording = async (req: Request, res: Response) => {
    const roomName = req.method === 'GET' ? req.query.roomName : req.body.roomName;

    if (!roomName) {
      return res.status(400).json({ error: 'Missing roomName parameter' });
    }

    try {
      const s3Bucket = process.env.S3_BUCKET || 'cloumeet-recordings';
      const awsRegion = process.env.AWS_REGION || 'us-east-1';
      
      const egressInfo = await livekitService.startRecording(
        roomName as string, 
        s3Bucket, 
        awsRegion
      );
      
      // Store egress info in Redis for tracking
      if (redisClient) {
        const recordingData = {
          roomName,
          egressId: egressInfo.egressId,
          startedAt: new Date().toISOString(),
          status: 'active'
        };
        
        // Store both ways for efficient lookup
        await redisClient.setEx(`recording:${egressInfo.egressId}`, 3600, JSON.stringify(recordingData));
        await redisClient.setEx(`room:${roomName}:active_recording`, 3600, egressInfo.egressId);
      }

      // Return format compatible with both frontend and new API
      if (req.method === 'GET') {
        // Frontend expects null response with 200 status
        res.status(200).send(null);
      } else {
        // New API returns detailed info
        res.json({ 
          egressId: egressInfo.egressId, 
          status: 'started',
          roomName 
        });
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      res.status(500).json({ error: 'Failed to start recording' });
    }
  };

  // Stop recording - supports both GET (frontend style) and POST (new style)
  const stopRecording = async (req: Request, res: Response) => {
    const roomName = req.method === 'GET' ? req.query.roomName : req.body.roomName;
    const egressId = req.method === 'GET' ? req.query.egressId : req.body.egressId;

    if (!roomName && !egressId) {
      return res.status(400).json({ error: 'Missing roomName or egressId parameter' });
    }

    try {
      let targetEgressId = egressId;
      
      // If no egressId provided, find active recording by roomName (frontend style)
      if (!targetEgressId && redisClient) {
        // Use room-specific key pattern for efficiency
        const roomRecordingKey = `room:${roomName}:active_recording`;
        const activeRecordingId = await redisClient.get(roomRecordingKey);
        if (activeRecordingId) {
          targetEgressId = activeRecordingId;
        }
      }

      if (!targetEgressId) {
        return res.status(404).json({ error: 'No active recording found' });
      }

      const egressInfo = await livekitService.stopRecording(targetEgressId as string);

      // Update Redis record and clean up room key
      if (redisClient) {
        const recordingData = await redisClient.get(`recording:${targetEgressId}`);
        if (recordingData) {
          const data = JSON.parse(recordingData);
          data.status = 'stopped';
          data.stoppedAt = new Date().toISOString();
          await redisClient.setEx(`recording:${targetEgressId}`, 3600, JSON.stringify(data));
          
          // Remove active recording key for the room
          await redisClient.del(`room:${data.roomName}:active_recording`);
        }
      }

      // Return format compatible with both frontend and new API
      if (req.method === 'GET') {
        res.status(200).send(null);
      } else {
        res.json({ 
          egressId: egressInfo.egressId, 
          status: 'stopped' 
        });
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      res.status(500).json({ error: 'Failed to stop recording' });
    }
  };

  // List recordings
  const listRecordings = async (req: Request, res: Response) => {
    const { roomName } = req.query;

    if (!roomName) {
      return res.status(400).json({ error: 'Missing roomName query parameter' });
    }

    try {
      const s3Bucket = process.env.S3_BUCKET || 'cloumeet-recordings';
      const awsRegion = process.env.AWS_REGION || 'us-east-1';
      
      const command = new ListObjectsV2Command({
        Bucket: s3Bucket,
        Prefix: `recordings/${roomName}/`,
      });

      const response = await s3Client.send(command);
      const recordings = response.Contents?.map(obj => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
        url: `https://${s3Bucket}.s3.${awsRegion}.amazonaws.com/${obj.Key}`
      })) || [];

      res.json({ recordings, roomName });
    } catch (error) {
      console.error('Error listing recordings:', error);
      res.status(500).json({ error: 'Failed to list recordings' });
    }
  };

  return { startRecording, stopRecording, listRecordings };
}