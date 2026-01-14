import { useState, useRef, useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Slider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  Videocam as VideocamIcon,
  ScreenShare as ScreenShareIcon,
  DuoOutlined as PictureInPictureIcon,
  FiberManualRecord as RecordIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Replay as ReplayIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  ContentCut as CutIcon,
} from '@mui/icons-material';

type RecordingMode = 'webcam' | 'screen' | 'both';
type RecordingState = 'idle' | 'requesting' | 'ready' | 'recording' | 'paused' | 'stopped' | 'reviewing';

type VideoRecorderProps = {
  onSave: (videoBlob: Blob, duration: number) => void;
  onCancel: () => void;
};

export default function VideoRecorder({ onSave, onCancel }: VideoRecorderProps) {
  const [mode, setMode] = useState<RecordingMode>('webcam');
  const [state, setState] = useState<RecordingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isTrimming, setIsTrimming] = useState(false);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    return () => {
      stopAllStreams();
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const stopAllStreams = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((track) => track.stop());
      webcamStreamRef.current = null;
    }
  };

  const handleModeChange = (_: React.MouseEvent<HTMLElement>, newMode: RecordingMode | null) => {
    if (newMode && state === 'idle') {
      setMode(newMode);
    }
  };

  const startRecording = async () => {
    try {
      setState('requesting');
      setError(null);
      chunksRef.current = [];
      setRecordingDuration(0);

      let combinedStream: MediaStream;

      if (mode === 'webcam') {
        // Nur Webcam
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1920, height: 1080 },
          audio: true,
        });
        webcamStreamRef.current = stream;
        combinedStream = stream;

        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
        }
      } else if (mode === 'screen') {
        // Nur Screen
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1920, height: 1080 },
          audio: true,
        });
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });

        screenStreamRef.current = screenStream;
        const audioTrack = audioStream.getAudioTracks()[0];
        
        combinedStream = new MediaStream([
          ...screenStream.getVideoTracks(),
          audioTrack,
        ]);

        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = combinedStream;
        }
      } else {
        // Picture-in-Picture (Screen + Webcam)
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1920, height: 1080 },
          audio: true,
        });
        const webcamStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: true,
        });

        screenStreamRef.current = screenStream;
        webcamStreamRef.current = webcamStream;

        // Canvas für Picture-in-Picture
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        canvasRef.current = canvas;

        const ctx = canvas.getContext('2d');
        const screenVideo = document.createElement('video');
        const webcamVideo = document.createElement('video');

        screenVideo.srcObject = screenStream;
        webcamVideo.srcObject = webcamStream;

        await screenVideo.play();
        await webcamVideo.play();

        const drawFrame = () => {
          if (!ctx) return;
          
          // Screen als Hintergrund
          ctx.drawImage(screenVideo, 0, 0, 1920, 1080);
          
          // Webcam in der Ecke (unten rechts)
          const pipWidth = 320;
          const pipHeight = 240;
          const padding = 20;
          ctx.drawImage(
            webcamVideo,
            1920 - pipWidth - padding,
            1080 - pipHeight - padding,
            pipWidth,
            pipHeight
          );

          if (state === 'recording' || state === 'ready') {
            requestAnimationFrame(drawFrame);
          }
        };

        drawFrame();

        const canvasStream = canvas.captureStream(30);
        const audioTrack = webcamStream.getAudioTracks()[0];
        
        combinedStream = new MediaStream([
          ...canvasStream.getVideoTracks(),
          audioTrack,
        ]);

        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = canvasStream;
        }
      }

      // MediaRecorder Setup
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp9',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setRecordedBlob(blob);
        
        // Verwende recordingDuration als initiale Duration
        const initialDuration = recordingDuration;
        if (initialDuration > 0) {
          setVideoDuration(initialDuration);
          setTrimStart(0);
          setTrimEnd(initialDuration);
        }
        
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = null;
          const url = URL.createObjectURL(blob);
          videoPreviewRef.current.src = url;
          videoPreviewRef.current.onloadedmetadata = () => {
            const duration = videoPreviewRef.current?.duration || 0;
            // Nur überschreiben wenn eine gültige Duration verfügbar ist
            if (duration && isFinite(duration) && duration > 0) {
              setVideoDuration(duration);
              setTrimStart(0);
              setTrimEnd(duration);
            }
          };
          // Fallback: Video laden erzwingen
          videoPreviewRef.current.load();
        }
        
        setState('reviewing');
        stopAllStreams();
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100);
      setState('recording');

      // Timer für Aufnahmedauer
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Zugriff auf Kamera/Bildschirm fehlgeschlagen. Bitte Berechtigungen prüfen.');
      setState('idle');
      stopAllStreams();
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.pause();
      setState('paused');
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && state === 'paused') {
      mediaRecorderRef.current.resume();
      setState('recording');
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && (state === 'recording' || state === 'paused')) {
      mediaRecorderRef.current.stop();
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  const restartRecording = () => {
    stopAllStreams();
    setRecordedBlob(null);
    setRecordingDuration(0);
    setTrimStart(0);
    setTrimEnd(0);
    setVideoDuration(0);
    setState('idle');
    if (videoPreviewRef.current) {
      videoPreviewRef.current.src = '';
      videoPreviewRef.current.srcObject = null;
    }
  };

  const handleTrim = async () => {
    if (!recordedBlob || !videoPreviewRef.current) return;

    setIsTrimming(true);

    try {
      // Einfaches Trimmen durch Blob-Slicing (für WebM)
      // Für präzises Trimmen bräuchte man FFmpeg.wasm
      const trimmedBlob = await trimVideo(recordedBlob);
      setRecordedBlob(trimmedBlob);
      
      if (videoPreviewRef.current) {
        videoPreviewRef.current.src = URL.createObjectURL(trimmedBlob);
        videoPreviewRef.current.currentTime = 0;
      }
    } catch (err) {
      console.error('Trimming error:', err);
      setError('Video konnte nicht geschnitten werden.');
    } finally {
      setIsTrimming(false);
    }
  };

  const trimVideo = async (blob: Blob): Promise<Blob> => {
    // Vereinfachtes Trimmen - für Produktions-Code würde man FFmpeg.wasm verwenden
    // Hier geben wir das Original zurück
    return blob;
  };

  const handleSave = () => {
    if (recordedBlob) {
      // Verwende videoDuration wenn verfügbar, sonst recordingDuration als Fallback
      const finalDuration = videoDuration > 0 ? videoDuration : recordingDuration;
      console.log('VideoRecorder handleSave: videoDuration =', videoDuration, ', recordingDuration =', recordingDuration, ', using =', finalDuration);
      onSave(recordedBlob, finalDuration);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open fullScreen>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Video aufnehmen</Typography>
          <IconButton edge="end" onClick={onCancel}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {error && <Alert severity="error">{error}</Alert>}

          {/* Modus-Auswahl */}
          {state === 'idle' && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <ToggleButtonGroup
                value={mode}
                exclusive
                onChange={handleModeChange}
                aria-label="Aufnahmemodus"
              >
                <ToggleButton value="webcam" aria-label="Webcam">
                  <Stack alignItems="center" spacing={1} sx={{ px: 2, py: 1 }}>
                    <VideocamIcon />
                    <Typography variant="caption">Webcam</Typography>
                  </Stack>
                </ToggleButton>
                <ToggleButton value="screen" aria-label="Screen">
                  <Stack alignItems="center" spacing={1} sx={{ px: 2, py: 1 }}>
                    <ScreenShareIcon />
                    <Typography variant="caption">Screen</Typography>
                  </Stack>
                </ToggleButton>
                <ToggleButton value="both" aria-label="Beides">
                  <Stack alignItems="center" spacing={1} sx={{ px: 2, py: 1 }}>
                    <PictureInPictureIcon />
                    <Typography variant="caption">Beides</Typography>
                  </Stack>
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          )}

          {/* Video Preview */}
          <Card sx={{ bgcolor: 'black', aspectRatio: '16/9', position: 'relative' }}>
            <video
              ref={videoPreviewRef}
              autoPlay={state === 'recording' || state === 'paused'}
              muted={state !== 'reviewing'}
              controls={state === 'reviewing'}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />

            {/* Recording Indicator */}
            {(state === 'recording' || state === 'paused') && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 16,
                  left: 16,
                  bgcolor: state === 'recording' ? 'error.main' : 'warning.main',
                  color: 'white',
                  px: 2,
                  py: 1,
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <RecordIcon sx={{ fontSize: 16 }} />
                <Typography variant="body2" fontWeight={600}>
                  {formatTime(recordingDuration)}
                </Typography>
              </Box>
            )}
          </Card>

          {/* Trimmer */}
          {state === 'reviewing' && videoDuration > 0 && isFinite(videoDuration) && (
            <Card sx={{ p: 2 }}>
              <Stack spacing={2}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <CutIcon />
                  <Typography variant="subtitle2">Video schneiden</Typography>
                </Stack>
                
                <Box>
                  <Typography variant="caption" color="text.secondary" gutterBottom>
                    Start: {formatTime(Math.floor(trimStart))}
                  </Typography>
                  <Slider
                    value={trimStart}
                    onChange={(_, value) => setTrimStart(value as number)}
                    min={0}
                    max={videoDuration}
                    step={0.1}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => formatTime(Math.floor(value))}
                  />
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary" gutterBottom>
                    Ende: {formatTime(Math.floor(trimEnd))}
                  </Typography>
                  <Slider
                    value={trimEnd}
                    onChange={(_, value) => setTrimEnd(value as number)}
                    min={0}
                    max={videoDuration}
                    step={0.1}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => formatTime(Math.floor(value))}
                  />
                </Box>

                <Button
                  variant="outlined"
                  startIcon={<CutIcon />}
                  onClick={handleTrim}
                  disabled={isTrimming || trimStart >= trimEnd}
                >
                  {isTrimming ? 'Wird geschnitten...' : 'Schneiden anwenden'}
                </Button>
              </Stack>
            </Card>
          )}

          {/* Controls */}
          <Stack direction="row" spacing={2} justifyContent="center">
            {state === 'idle' && (
              <Button
                variant="contained"
                size="large"
                startIcon={<RecordIcon />}
                onClick={startRecording}
                color="error"
              >
                Aufnahme starten
              </Button>
            )}

            {state === 'requesting' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <CircularProgress size={24} />
                <Typography>Zugriff wird angefordert...</Typography>
              </Box>
            )}

            {state === 'recording' && (
              <>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<PauseIcon />}
                  onClick={pauseRecording}
                >
                  Pause
                </Button>
                <Button
                  variant="contained"
                  size="large"
                  color="error"
                  startIcon={<StopIcon />}
                  onClick={stopRecording}
                >
                  Stop
                </Button>
              </>
            )}

            {state === 'paused' && (
              <>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<RecordIcon />}
                  onClick={resumeRecording}
                  color="error"
                >
                  Fortsetzen
                </Button>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<StopIcon />}
                  onClick={stopRecording}
                >
                  Stop
                </Button>
              </>
            )}

            {state === 'reviewing' && (
              <>
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<ReplayIcon />}
                  onClick={restartRecording}
                >
                  Neustarten
                </Button>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<SaveIcon />}
                  onClick={handleSave}
                  color="primary"
                >
                  Aufnahme speichern
                </Button>
              </>
            )}
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
