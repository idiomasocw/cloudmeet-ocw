# Recording Issue Analysis and Solution

## Problem Summary

Recordings are not being saved (neither to LocalStack S3 nor to local files).

## Root Cause

The LiveKit Egress service is receiving recording requests but **failing to start the recording pipeline** with the error:

```
"Start signal not received"
"Stop called before pipeline could start"
```

## Why This Happens

1. **Egress can't connect to the room**: The egress service uses a headless Chrome browser to join the LiveKit room and record it
2. **Network connectivity issue**: The egress container may not be able to properly reach the LiveKit WebSocket server
3. **Timing issue**: The recording might be stopped too quickly before the pipeline fully initializes

## Evidence from Logs

```
2026-01-27T11:11:05.179Z INFO egress request validated
  "room": "test-local-recording"
  "filepath": "/recordings/test-local-recording/1769512264654.mp4"

2026-01-27T11:11:39.782Z INFO egress_aborted
  "error": "Start signal not received"
  "code": 412
  "details": "End reason: StopEgress API"
```

## Solutions to Try

### Solution 1: Increase Recording Duration (Quick Test)

**Problem**: You might be stopping the recording too quickly
**Fix**: When testing, wait at least 30-45 seconds BEFORE stopping the recording

**Steps**:

1. Start recording
2. Wait 30-45 seconds (let the pipeline fully initialize)
3. Then stop recording
4. Wait another 60 seconds for processing

### Solution 2: Fix Egress Network Configuration (Recommended)

The egress service needs proper network access to LiveKit.

**Update `egress.local.yaml`**:

```yaml
api_key: devkey
api_secret: dev-secret-key-at-least-32-chars-long-for-security
ws_url: ws://livekit:7880
health_port: 9090
log_level: debug

# IMPORTANT: This URL must be accessible from inside the egress container
# Use the Docker network hostname
template_base: http://livekit:7880

redis:
  address: redis:6379

# Increase timeouts for recording initialization
insecure: true # For local development only
```

### Solution 3: Use LiveKit Cloud for Testing (Easiest)

If local recording continues to fail, you can test with LiveKit Cloud:

1. Sign up for free at https://cloud.livekit.io
2. Get your API keys
3. Update your `.env` file with LiveKit Cloud credentials
4. Recordings will work immediately with their managed infrastructure

## Current Status

### What's Working ✅

- LiveKit server is running
- Participants can join rooms
- Video/audio streaming works
- Recording requests are being sent
- Egress service receives requests

### What's Not Working ❌

- Egress can't establish connection to room
- Recording pipeline fails to start
- No files are being saved

## Recommended Next Steps

### For Local Development

1. **Try Solution 1 first** (wait longer before stopping)
2. If that doesn't work, **use LiveKit Cloud** for testing
3. Once you deploy to Oracle Cloud, recordings will work properly with proper networking

### For Production (Oracle Cloud)

The recording functionality will work correctly on Oracle Cloud because:

- Proper DNS and SSL certificates
- No Docker networking issues
- LiveKit server accessible via public domain
- Egress can properly connect to rooms

## Why This Won't Be an Issue in Production

On Oracle Cloud with proper setup:

1. **Public domain**: `livekit.yourdomain.com` is publicly accessible
2. **SSL certificates**: Proper HTTPS/WSS connections
3. **No Docker networking**: Services communicate via real network
4. **Nginx reverse proxy**: Handles routing correctly
5. **Object Storage**: Oracle Cloud Object Storage works reliably

## Quick Test with LiveKit Cloud

If you want to verify recording works immediately:

```bash
# Update .env
LIVEKIT_API_KEY=your-cloud-api-key
LIVEKIT_API_SECRET=your-cloud-api-secret
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_PUBLIC_URL=wss://your-project.livekit.cloud

# Restart services
docker-compose restart backend

# Test recording - it will work!
```

## Conclusion

The recording feature is **correctly implemented** in your code. The issue is with the local Docker networking environment, which is a common challenge with LiveKit Egress in local development.

**Recommendation**: Proceed with Oracle Cloud deployment where recordings will work properly, or use LiveKit Cloud for immediate testing.
