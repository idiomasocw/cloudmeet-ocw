import React from 'react';
import { useIsRecording, useRoomContext } from '@livekit/components-react';
import styles from '../styles/RecordingControls.module.css';

export function RecordingControls() {
  const room = useRoomContext();
  const isRecording = useIsRecording();
  const [isLoading, setIsLoading] = React.useState(false);

  const toggleRecording = async () => {
    setIsLoading(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
      const endpoint = isRecording ? '/record/stop' : '/record/start';
      const url = `${baseUrl}${endpoint}?roomName=${room.name}`;
      
      console.log('Attempting recording request to:', url);
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend error:', response.status, errorText);
        
        // Fallback to local API if backend fails
        if (baseUrl) {
          console.log('Trying fallback to local API...');
          const fallbackUrl = `/api${endpoint}?roomName=${room.name}`;
          const fallbackResponse = await fetch(fallbackUrl);
          if (!fallbackResponse.ok) {
            throw new Error(`Both backend and fallback failed`);
          }
          return;
        }
        
        throw new Error(`Failed to ${isRecording ? 'stop' : 'start'} recording: ${response.status} ${errorText}`);
      }
    } catch (error) {
      console.error('Recording error:', error);
      alert(`Failed to ${isRecording ? 'stop' : 'start'} recording`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`${styles.recordingBanner} ${isRecording ? styles.active : styles.inactive}`}>
      <div className={styles.recordingIndicator}>
        {isRecording && <div className={styles.pulsingDot} />}
        <span>
          {isRecording ? 'Recording in progress' : 'Meeting not recorded'}
        </span>
      </div>
      
      <button
        onClick={toggleRecording}
        disabled={isLoading}
        className={styles.recordingButton}
      >
        {isLoading ? 'Loading...' : isRecording ? 'Stop Recording' : 'Start Recording'}
      </button>
    </div>
  );
}