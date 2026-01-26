import { AccessToken, EgressClient, EncodedFileOutput, S3Upload } from 'livekit-server-sdk';

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

  async generateToken(roomName: string, options: TokenOptions): Promise<string> {
    if (!this.config.apiKey || !this.config.apiSecret) {
      throw new Error('LiveKit credentials not configured');
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

    at.ttl = options.ttl || '60m';
    return await at.toJwt();
  }

  async startRecording(roomName: string, s3Bucket: string, awsRegion: string) {
    const httpUrl = this.config.wsUrl.replace('wss://', 'https://').replace('ws://', 'http://');
    console.log('EgressClient URL conversion:', { original: this.config.wsUrl, converted: httpUrl });
    
    // Test network connectivity first
    try {
      const testUrl = new URL(httpUrl);
      console.log('Testing connectivity to:', testUrl.hostname, 'port:', testUrl.port || '443');
      const response = await fetch(`${httpUrl}/twirp/livekit.Egress/ListEgress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(5000)
      });
      console.log('Connectivity test response:', response.status, response.statusText);
    } catch (error) {
      console.error('Connectivity test failed:', error instanceof Error ? error.message : String(error));
    }
    
    const egressClient = new EgressClient(httpUrl, this.config.apiKey, this.config.apiSecret);
    
    const fileOutput = new EncodedFileOutput({
      filepath: `recordings/${roomName}/${Date.now()}.mp4`,
      output: {
        case: 's3',
        value: new S3Upload({
          accessKey: '', // Using IAM role
          secret: '',
          region: awsRegion,
          bucket: s3Bucket,
        }),
      },
    });

    return await egressClient.startRoomCompositeEgress(roomName, {
      file: fileOutput,
    }, {
      layout: 'grid',
    });
  }

  async stopRecording(egressId: string) {
    const httpUrl = this.config.wsUrl.replace('wss://', 'https://').replace('ws://', 'http://');
    const egressClient = new EgressClient(httpUrl, this.config.apiKey, this.config.apiSecret);
    return await egressClient.stopEgress(egressId);
  }
}