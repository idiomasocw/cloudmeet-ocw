import React from 'react';
import { useRoomContext } from '@livekit/components-react';
import styles from '../styles/RecordingControls.module.css';

export function RecordingControls() {
  const room = useRoomContext();
  const [isRecording, setIsRecording] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const toggleRecording = async () => {
    if (isLoading) return; // Prevent multiple clicks

    setIsLoading(true);
    try {
      let baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
      if (!baseUrl && process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT) {
        try {
          // If conn details is a full URL, use its origin (e.g. https://backend.com)
          // If it's a relative path, this will throw/fail safely
          const urlObj = new URL(process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT);
          baseUrl = urlObj.origin;
        } catch (e) {
          // ignore invalid URL
          console.warn('Could not parse NEXT_PUBLIC_CONN_DETAILS_ENDPOINT as URL');
        }
      }
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
          // Update state on success
          setIsRecording(!isRecording);
          return;
        }

        throw new Error(
          `Failed to ${isRecording ? 'stop' : 'start'} recording: ${response.status} ${errorText}`,
        );
      }

      // Update state on success
      setIsRecording(!isRecording);
      console.log(`Recording ${isRecording ? 'stopped' : 'started'} successfully`);
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
        <span>{isRecording ? 'Recording in progress' : 'Meeting not recorded'}</span>
      </div>

      <button onClick={toggleRecording} disabled={isLoading} className={styles.recordingButton}>
        {isLoading ? 'Loading...' : isRecording ? 'Stop Recording' : 'Start Recording'}
      </button>
    </div>
  );
}
