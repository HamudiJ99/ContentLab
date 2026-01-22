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

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

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
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  const [recordingDuration, setRecordingDuration] = useState(0);

  const [isTrimming, setIsTrimming] = useState(false);
  const [trimProgress, setTrimProgress] = useState<number>(0);

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

  // FFmpeg
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const ffmpegReadyRef = useRef(false);

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

  const ensureFFmpeg = async () => {
    if (ffmpegReadyRef.current && ffmpegRef.current) return ffmpegRef.current;

    const ffmpeg = new FFmpeg();
    ffmpeg.on('progress', ({ progress }) => {
      // progress 0..1
      setTrimProgress(Math.round((progress || 0) * 100));
    });

    // Lädt Core/Worker/WASM aus dem Package-Bundle (keine URLs nötig)
    await ffmpeg.load();

    ffmpegRef.current = ffmpeg;
    ffmpegReadyRef.current = true;
    return ffmpeg;
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
        setVideoDuration(recordingDuration);
        setTrimStart(0);
        setTrimEnd(recordingDuration);

        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = null;
          videoPreviewRef.current.src = URL.createObjectURL(blob);
          videoPreviewRef.current.load();
        }

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
    setTrimStart(0);
    setTrimEnd(0);
    setVideoDuration(0);
    setError(null);
    setState('idle');

    if (videoPreviewRef.current) {
      videoPreviewRef.current.src = '';
      videoPreviewRef.current.srcObject = null;
    }
  };

  const handleTrim = async () => {
    if (!recordedBlob) return;

    // Validierung
    const start = Math.max(0, trimStart);
    const end = Math.min(videoDuration || 0, trimEnd);

    if (!isFinite(start) || !isFinite(end) || end <= start) {
      setError('Ungültiger Schnittbereich. Bitte Start < Ende wählen.');
      return;
    }

    setError(null);
    setIsTrimming(true);
    setTrimProgress(0);

    try {
      const ffmpeg = await ensureFFmpeg();

      // Clean alte Dateien (best effort)
      try {
        await ffmpeg.deleteFile('input.webm');
        await ffmpeg.deleteFile('output.webm');
      } catch {
        // ignore
      }

      await ffmpeg.writeFile('input.webm', await fetchFile(recordedBlob));

      // Re-Encode (robust & “echtes Schneiden”)
      // -ss/-to vor -i ist schneller, kann aber ungenauer sein.
      // Für Genauigkeit: -ss/-to nach -i. Wir nutzen Genauigkeit.
      await ffmpeg.exec([
        '-i',
        'input.webm',
        '-ss',
        String(start),
        '-to',
        String(end),
        '-c:v',
        'libvpx-vp9',
        '-crf',
        '32',
        '-b:v',
        '0',
        '-c:a',
        'libopus',
        'output.webm',
      ]);

      const out = await ffmpeg.readFile('output.webm');

      const data = out as Uint8Array;

      // 🔥 ERZWINGT echten ArrayBuffer (kein SharedArrayBuffer)
      const copiedBuffer = Uint8Array.from(data).buffer;

      const trimmed = new Blob([copiedBuffer], { type: 'video/webm' });


      setRecordedBlob(trimmed);

      const newDuration = Math.max(0, end - start);
      setVideoDuration(newDuration);
      setTrimStart(0);
      setTrimEnd(newDuration);

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = null;
        videoPreviewRef.current.src = URL.createObjectURL(trimmed);
        videoPreviewRef.current.currentTime = 0;
        videoPreviewRef.current.load();
      }
    } catch (e) {
      console.error(e);
      setError('Schneiden fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setIsTrimming(false);
      setTrimProgress(0);
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

            <video
              ref={videoPreviewRef}
              autoPlay={state === 'recording' || state === 'paused'}
              muted={state !== 'reviewing'}
              controls={state === 'reviewing'}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </Card>

          {/* Trimming */}
          {state === 'reviewing' && recordedBlob && videoDuration > 0 && isFinite(videoDuration) && (
            <Card sx={{ p: 3 }}>
              <Stack spacing={3}>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CutIcon fontSize="small" />
                    <Typography fontWeight={600}>Video schneiden</Typography>
                  </Stack>

                  {isTrimming && (
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <CircularProgress size={18} />
                      <Typography variant="caption" color="text.secondary">
                        {trimProgress > 0 ? `${trimProgress}%` : 'Lädt…'}
                      </Typography>
                    </Stack>
                  )}
                </Stack>

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Start: {formatTime(trimStart)}
                  </Typography>
                  <Slider
                    value={trimStart}
                    onChange={(_, v) => {
                      const next = Number(v);
                      // Start darf nicht >= Ende sein
                      const safe = Math.min(next, Math.max(0, trimEnd - 0.1));
                      setTrimStart(safe);
                    }}
                    min={0}
                    max={videoDuration}
                    step={0.1}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(v) => formatTime(Number(v))}
                    disabled={isTrimming}
                  />
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Ende: {formatTime(trimEnd)}
                  </Typography>
                  <Slider
                    value={trimEnd}
                    onChange={(_, v) => {
                      const next = Number(v);
                      // Ende darf nicht <= Start sein
                      const safe = Math.max(next, trimStart + 0.1);
                      setTrimEnd(safe);
                    }}
                    min={0}
                    max={videoDuration}
                    step={0.1}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(v) => formatTime(Number(v))}
                    disabled={isTrimming}
                  />
                </Box>

                <Button
                  variant="outlined"
                  startIcon={<CutIcon />}
                  onClick={handleTrim}
                  disabled={isTrimming || trimStart >= trimEnd}
                >
                  {isTrimming ? 'Schneide…' : 'Schnitt anwenden'}
                </Button>

                <Typography variant="caption" color="text.secondary">
                  Hinweis: Das Schneiden kann beim ersten Mal länger dauern, da FFmpeg geladen wird.
                </Typography>
              </Stack>
            </Card>
          )}
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
