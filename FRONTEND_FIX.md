# Frontend Connection Fix

## Problem

The frontend was trying to connect to `https://api.intellectif.com` (production) instead of `http://localhost:3001` (local).

## Solution

Updated `livekit-meet-frontend/.env.local` with local development URLs.

## What to Do Now

### 1. Stop the Frontend

Press `Ctrl+C` in the terminal where `pnpm dev` is running.

### 2. Restart the Frontend

```bash
cd livekit-meet-frontend
pnpm dev
```

### 3. Refresh Your Browser

Go to http://localhost:3000 and refresh the page.

## Updated Configuration

The `.env.local` file now has:

```bash
LIVEKIT_URL=ws://localhost:7880
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_CONN_DETAILS_ENDPOINT=http://localhost:3001/connection-details
```

## Verify Backend is Running

Before testing, make sure the backend is accessible:

```bash
curl http://localhost:3001/health
```

You should see a JSON response with service status.

## Test the Connection

1. Go to http://localhost:3000
2. Enter a room name (e.g., "test-room")
3. Enter your name (e.g., "test-user")
4. Click "Join"

The frontend should now connect to your local backend! 🎉

## If It Still Doesn't Work

Check the browser console for errors and the backend logs:

```bash
docker-compose logs -f backend
```
