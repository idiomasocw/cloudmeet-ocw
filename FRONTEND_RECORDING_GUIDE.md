# Frontend Recording Integration Guide

This guide shows how to add recording functionality to the existing `livekit-meet-frontend` React application.

## Step 1: Add Recording Hook

Create `lib/useRecording.ts`:

```typescript
import { useState, useCallback } from 'react';

interface RecordingState {
  isRecording: boolean;
  egressId: string | null;
  error: string | null;
}

export function useRecording(roomName: string) {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    egressId: null,
    error: null,
  });

  const startRecording = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/start-recording`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName }),
      });

      if (!response.ok) {
        throw new Error('Failed to start recording');
      }

      const data = await response.json();
      setState({
        isRecording: true,
        egressId: data.egressId,
        error: null,
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [roomName]);

  const stopRecording = useCallback(async () => {
    if (!state.egressId) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stop-recording`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ egressId: state.egressId }),
      });

      if (!response.ok) {
        throw new Error('Failed to stop recording');
      }

      setState({
        isRecording: false,
        egressId: null,
        error: null,
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [state.egressId]);

  return {
    ...state,
    startRecording,
    stopRecording,
  };
}
```

## Step 2: Create Recording Button Component

Create `lib/RecordingButton.tsx`:

```typescript
import { useRecording } from './useRecording';
import styles from '../styles/RecordingButton.module.css';

interface RecordingButtonProps {
  roomName: string;
}

export function RecordingButton({ roomName }: RecordingButtonProps) {
  const { isRecording, error, startRecording, stopRecording } = useRecording(roomName);

  return (
    <div className={styles.recordingContainer}>
      <button
        className={`${styles.recordingButton} ${isRecording ? styles.recording : ''}`}
        onClick={isRecording ? stopRecording : startRecording}
        disabled={!roomName}
      >
        <span className={styles.recordingIcon}>
          {isRecording ? '⏹️' : '🔴'}
        </span>
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </button>
      
      {error && (
        <div className={styles.error}>
          Error: {error}
        </div>
      )}
      
      {isRecording && (
        <div className={styles.recordingIndicator}>
          <span className={styles.pulse}></span>
          Recording in progress...
        </div>
      )}
    </div>
  );
}
```

## Step 3: Add Recording Button Styles

Create `styles/RecordingButton.module.css`:

```css
.recordingContainer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin: 16px 0;
}

.recordingButton {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.recordingButton:hover {
  background: #b91c1c;
  transform: translateY(-1px);
}

.recordingButton:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  transform: none;
}

.recordingButton.recording {
  background: #059669;
}

.recordingButton.recording:hover {
  background: #047857;
}

.recordingIcon {
  font-size: 16px;
}

.error {
  color: #dc2626;
  font-size: 12px;
  text-align: center;
  padding: 4px 8px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 4px;
}

.recordingIndicator {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #059669;
  font-size: 12px;
  font-weight: 500;
}

.pulse {
  width: 8px;
  height: 8px;
  background: #dc2626;
  border-radius: 50%;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
```

## Step 4: Integrate into Room Component

Update your main room component (likely in `app/rooms/[name]/page.tsx`):

```typescript
import { RecordingButton } from '../../../lib/RecordingButton';

// Inside your room component:
export default function RoomPage({ params }: { params: { name: string } }) {
  const roomName = params.name;

  return (
    <div className="room-container">
      {/* Your existing LiveKit components */}
      <LiveKitRoom
        video={true}
        audio={true}
        token={token}
        serverUrl={serverUrl}
        data-lk-theme="default"
        style={{ height: '100vh' }}
      >
        {/* Add recording button to your control bar */}
        <div className="controls-bar">
          <RecordingButton roomName={roomName} />
          {/* Your other controls */}
        </div>
        
        <RoomAudioRenderer />
        <VideoConference />
      </LiveKitRoom>
    </div>
  );
}
```

## Step 5: Add Environment Variables

Update your `.env.local` file:

```env
NEXT_PUBLIC_LIVEKIT_URL=wss://livekit.intellectif.com
NEXT_PUBLIC_API_URL=https://api.intellectif.com
```

## Step 6: Optional - Add Recording List Component

Create `lib/RecordingsList.tsx` to show past recordings:

```typescript
import { useState, useEffect } from 'react';

interface Recording {
  key: string;
  size: number;
  lastModified: string;
  url: string;
}

interface RecordingsListProps {
  roomName: string;
}

export function RecordingsList({ roomName }: RecordingsListProps) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRecordings = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/list-recordings?roomName=${roomName}`
        );
        const data = await response.json();
        setRecordings(data.recordings || []);
      } catch (error) {
        console.error('Failed to fetch recordings:', error);
      } finally {
        setLoading(false);
      }
    };

    if (roomName) {
      fetchRecordings();
    }
  }, [roomName]);

  if (loading) return <div>Loading recordings...</div>;
  if (recordings.length === 0) return <div>No recordings found</div>;

  return (
    <div className="recordings-list">
      <h3>Past Recordings</h3>
      {recordings.map((recording) => (
        <div key={recording.key} className="recording-item">
          <a href={recording.url} target="_blank" rel="noopener noreferrer">
            {recording.key.split('/').pop()}
          </a>
          <span>({Math.round(recording.size / 1024 / 1024)} MB)</span>
        </div>
      ))}
    </div>
  );
}
```

## Testing the Integration

1. **Deploy the infrastructure** using the CDK
2. **Build and push** the backend API to ECR
3. **Configure DNS** records for your domains
4. **Update the frontend** with the recording components
5. **Test recording** functionality in a live room

The recording button will appear in your room interface and allow users to start/stop recordings that are automatically saved to your S3 bucket.