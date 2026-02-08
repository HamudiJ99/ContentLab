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
} from '@mui/icons-material';

type RecordingMode = 'webcam' | 'screen' | 'both';
type RecordingState =
  | 'idle'
  | 'requesting'
  | 'ready'
  | 'recording'
  | 'paused'
  | 'stopped'
  | 'reviewing';

type VideoRecorderProps = {
  onSave: (videoBlob: Blob, duration: number) => void;
  onCancel: () => void;
};

export default function VideoRecorder({ onSave, onCancel }: VideoRecorderProps) {
  const [mode, setMode] = useState<RecordingMode>('webcam');
  const [state, setState] = useState<RecordingState>('idle');
  const [error, setError] = useState<string | null>(null);

  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);

  const [recordingDuration, setRecordingDuration] = useState(0);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Fix für “stale state” in requestAnimationFrame-Schleifen
  const stateRef = useRef<RecordingState>('idle');
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    return () => {
      stopAllStreams();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopAllStreams = () => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    webcamStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    webcamStreamRef.current = null;
  };

  const handleModeChange = (_: React.MouseEvent<HTMLElement>, newMode: RecordingMode | null) => {
    if (newMode && state === 'idle') setMode(newMode);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getModeLabel = (m: RecordingMode) => {
    if (m === 'webcam') return 'Webcam-Aufnahme';
    if (m === 'screen') return 'Bildschirmaufnahme';
    return 'Screen + Webcam';
  };


  /* ===================== RECORDING LOGIK ===================== */

  const startRecording = async () => {
    try {
      setState('requesting');
      setError(null);
      chunksRef.current = [];
      setRecordingDuration(0);

      let combinedStream: MediaStream;

      if (mode === 'webcam') {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1920, height: 1080 },
          audio: true,
        });
        webcamStreamRef.current = stream;
        combinedStream = stream;
        if (videoPreviewRef.current) videoPreviewRef.current.srcObject = stream;
      } else if (mode === 'screen') {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1920, height: 1080 },
          audio: true,
        });
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        screenStreamRef.current = screenStream;

        combinedStream = new MediaStream([
          ...screenStream.getVideoTracks(),
          audioStream.getAudioTracks()[0],
        ]);

        if (videoPreviewRef.current) videoPreviewRef.current.srcObject = combinedStream;
      } else {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        screenStreamRef.current = screenStream;
        webcamStreamRef.current = webcamStream;

        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        canvasRef.current = canvas;
        const ctx = canvas.getContext('2d')!;

        const screenVideo = document.createElement('video');
        const webcamVideo = document.createElement('video');
        screenVideo.srcObject = screenStream;
        webcamVideo.srcObject = webcamStream;

        await screenVideo.play();
        await webcamVideo.play();

        const draw = () => {
          if (!ctx) return;

          ctx.drawImage(screenVideo, 0, 0, 1920, 1080);
          // PiP unten rechts
          const pipW = 320;
          const pipH = 240;
          const pad = 20;
          ctx.drawImage(webcamVideo, 1920 - pipW - pad, 1080 - pipH - pad, pipW, pipH);

          // weiter zeichnen, solange recording/paused
          if (stateRef.current === 'recording' || stateRef.current === 'paused') {
            requestAnimationFrame(draw);
          }
        };

        const canvasStream = canvas.captureStream(30);
        combinedStream = new MediaStream([
          ...canvasStream.getVideoTracks(),
          webcamStream.getAudioTracks()[0],
        ]);

        if (videoPreviewRef.current) videoPreviewRef.current.srcObject = canvasStream;

        // Sobald wir auf recording wechseln, startet die Schleife sauber
        // (stateRef wird durch useEffect aktualisiert)
        requestAnimationFrame(draw);
      }

      const recorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp9',
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });

        setRecordedBlob(blob);
        
        // Erstelle Video-Element zum Auslesen der echten Dauer
        const tempVideo = document.createElement('video');
        tempVideo.preload = 'metadata';
        tempVideo.src = URL.createObjectURL(blob);
        
        tempVideo.onloadedmetadata = () => {
          let duration = tempVideo.duration;
          
          // Verhindere Infinity oder NaN
          if (!isFinite(duration) || duration <= 0) {
            console.warn('Invalid video duration:', duration, '- using recording time');
            duration = recordingDuration > 0 ? recordingDuration : 60;
          }
          
          console.log('VideoRecorder: Final duration:', duration);
          setVideoDuration(duration);
          
          if (videoPreviewRef.current) {
            videoPreviewRef.current.srcObject = null;
            videoPreviewRef.current.src = tempVideo.src;
            videoPreviewRef.current.load();
          }
          
          // Cleanup
          URL.revokeObjectURL(tempVideo.src);
        };

        setState('reviewing');
        stopAllStreams();
      };

      mediaRecorderRef.current = recorder;

      recorder.start(100);
      setState('recording');

      // Timer
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (e) {
      console.error(e);
      setError('Zugriff auf Kamera/Bildschirm fehlgeschlagen.');
      setState('idle');
      stopAllStreams();
    }
  };

  const pauseRecording = () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.pause();
    setState('paused');
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  };

  const resumeRecording = () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.resume();
    setState('recording');

    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = window.setInterval(() => {
      setRecordingDuration((d) => d + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    mediaRecorderRef.current.stop();
  };

  const restartRecording = () => {
    stopAllStreams();
    setRecordedBlob(null);
    setRecordingDuration(0);
    setVideoDuration(0);
    setError(null);
    setState('idle');

    if (videoPreviewRef.current) {
      videoPreviewRef.current.src = '';
      videoPreviewRef.current.srcObject = null;
    }
  };


  const handleSave = () => {
    if (!recordedBlob) return;
    // videoDuration ist nach Trim die “neue” Dauer
    onSave(recordedBlob, videoDuration);
  };

  /* ===================== UI ===================== */

  return (
    <Dialog open maxWidth="md" fullWidth onClose={onCancel}>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Video aufnehmen</Typography>
          <IconButton onClick={onCancel}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 4 }}>
        <Stack spacing={4}>
          {error && <Alert severity="error">{error}</Alert>}

          {state === 'requesting' && (
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="center">
              <CircularProgress size={28} />
              <Typography>Zugriff wird angefordert…</Typography>
            </Stack>
          )}

          {state === 'idle' && (
            <Stack alignItems="center" spacing={1.5}>
              <Typography fontWeight={600}>Aufnahmemodus wählen</Typography>

              <ToggleButtonGroup value={mode} exclusive onChange={handleModeChange} size="small">
                <ToggleButton value="webcam" aria-label="Webcam">
                  <Stack alignItems="center" spacing={0.5} sx={{ px: 1.5, py: 0.5 }}>
                    <VideocamIcon fontSize="small" />
                    <Typography variant="caption">Webcam</Typography>
                  </Stack>
                </ToggleButton>

                <ToggleButton value="screen" aria-label="Bildschirm">
                  <Stack alignItems="center" spacing={0.5} sx={{ px: 1.5, py: 0.5 }}>
                    <ScreenShareIcon fontSize="small" />
                    <Typography variant="caption">Screen</Typography>
                  </Stack>
                </ToggleButton>

                <ToggleButton value="both" aria-label="Beides">
                  <Stack alignItems="center" spacing={0.5} sx={{ px: 1.5, py: 0.5 }}>
                    <PictureInPictureIcon fontSize="small" />
                    <Typography variant="caption">Beides</Typography>
                  </Stack>
                </ToggleButton>
              </ToggleButtonGroup>


            </Stack>
          )}

          {/* Preview */}
          <Card
            sx={{
              height: 480,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'black',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Mode badge (immer sichtbar) */}
            <Box
              sx={{
                position: 'absolute',
                top: 12,
                right: 12,
                bgcolor: 'rgba(0,0,0,0.65)',
                color: 'white',
                px: 1.5,
                py: 0.75,
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                zIndex: 2,
              }}
            >
              {mode === 'webcam' && <VideocamIcon sx={{ fontSize: 16 }} />}
              {mode === 'screen' && <ScreenShareIcon sx={{ fontSize: 16 }} />}
              {mode === 'both' && <PictureInPictureIcon sx={{ fontSize: 16 }} />}
              <Typography variant="caption" sx={{ color: 'white' }}>
                {getModeLabel(mode)}
              </Typography>
            </Box>

            {/* Recording timer (während Aufnahme sichtbar) */}
            {(state === 'recording' || state === 'paused') && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  bgcolor: state === 'recording' ? 'error.main' : 'warning.main',
                  color: 'white',
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  zIndex: 2,
                }}
              >
                <RecordIcon sx={{ fontSize: 16 }} />
                <Typography variant="caption" fontWeight={700} sx={{ color: 'white' }}>
                  {formatTime(recordingDuration)}
                </Typography>
              </Box>
            )}

            {/* Video-Preview während Aufnahme/Anfrage */}
            {(state === 'recording' || state === 'paused' || state === 'requesting' || state === 'idle') && (
              <video
                ref={videoPreviewRef}
                autoPlay={state === 'recording' || state === 'paused'}
                muted
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            )}
            {/* Review-Video mit Controls und src (Download, Zeit etc.) */}
            {state === 'reviewing' && recordedBlob && (
              <video
                src={URL.createObjectURL(recordedBlob)}
                controls
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            )}
          </Card>

        </Stack>
      </DialogContent>

      {/* Controls immer unten */}
      <Box sx={{ p: 3, borderTop: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={2} justifyContent="center">
          {state === 'idle' && (
            <Button
              color="error"
              variant="contained"
              onClick={startRecording}
              startIcon={<RecordIcon />}
            >
              Aufnahme starten
            </Button>
          )}

          {state === 'recording' && (
            <>
              <Button onClick={pauseRecording} startIcon={<PauseIcon />}>
                Pause
              </Button>
              <Button color="error" onClick={stopRecording} startIcon={<StopIcon />}>
                Stop
              </Button>
            </>
          )}

          {state === 'paused' && (
            <>
              <Button color="error" onClick={resumeRecording} startIcon={<RecordIcon />}>
                Fortsetzen
              </Button>
              <Button onClick={stopRecording} startIcon={<StopIcon />}>
                Stop
              </Button>
            </>
          )}

          {state === 'reviewing' && (
            <>
              <Button onClick={restartRecording} startIcon={<ReplayIcon />}>
                Neu
              </Button>
              <Button variant="contained" onClick={handleSave} startIcon={<SaveIcon />}>
                Speichern
              </Button>
            </>
          )}
        </Stack>
      </Box>
    </Dialog>
  );
}
