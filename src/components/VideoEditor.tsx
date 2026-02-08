import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Alert,
  Box,
  Card,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  ContentCut as CutIcon,
  Save as SaveIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Replay5 as Replay5Icon,
  Forward5 as Forward5Icon,
  VolumeOff as VolumeOffIcon,
  VolumeUp as VolumeUpIcon,
} from '@mui/icons-material';

import { FFmpeg } from '@ffmpeg/ffmpeg';
import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';

type VideoEditorProps = {
  videoUrl: string;
  onSave: (videoBlob: Blob, duration: number) => void;
  onCancel: () => void;
};

export default function VideoEditor({ videoUrl, onSave, onCancel }: VideoEditorProps) {
  // State
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trimRange, setTrimRange] = useState<[number, number]>([0, 100]);
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimProgress, setTrimProgress] = useState(0);
  const [trimmedBlob, setTrimmedBlob] = useState<Blob | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.9);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const ffmpegLoadedRef = useRef(false);
  const loadIdRef = useRef(0);
  const trimStartRef = useRef(0);

  // Formatierung
  const formatTime = useCallback((seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Trim-Werte in Sekunden
  const trimStartSeconds = (trimRange[0] / 100) * duration;
  const trimEndSeconds = (trimRange[1] / 100) * duration;
  const trimmedDuration = trimEndSeconds - trimStartSeconds;

  useEffect(() => {
    trimStartRef.current = trimStartSeconds;
  }, [trimStartSeconds]);

  // Video als Blob laden (CORS umgehen)
  useEffect(() => {
    let objectUrl: string | null = null;
    const controller = new AbortController();
    const loadId = ++loadIdRef.current;

    const loadVideo = async () => {
      try {
        console.log('VideoEditor: Loading video from URL:', videoUrl);
        setIsLoading(true);
        setError(null);

        const response = await fetch(videoUrl, { signal: controller.signal });
        console.log('VideoEditor: Fetch response status:', response.status);
        if (!response.ok) throw new Error(`Video konnte nicht geladen werden (Status: ${response.status})`);

        const blob = await response.blob();
        console.log('VideoEditor: Blob loaded, size:', blob.size, 'type:', blob.type);

        if (blob.size === 0) {
          throw new Error('Video ist leer');
        }

        objectUrl = URL.createObjectURL(blob);
        console.log('VideoEditor: Object URL created:', objectUrl);
        if (loadId === loadIdRef.current) {
          setVideoBlobUrl(objectUrl);
        } else if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        console.error('VideoEditor: Video laden fehlgeschlagen:', err);
        setError(err instanceof Error ? err.message : 'Video konnte nicht geladen werden.');
        setIsLoading(false);
      }
    };

    if (videoUrl) {
      loadVideo();
    } else {
      console.error('VideoEditor: No videoUrl provided');
      setError('Keine Video-URL vorhanden');
      setIsLoading(false);
    }

    return () => {
      controller.abort();
      if (objectUrl) {
        console.log('VideoEditor: Cleaning up object URL');
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [videoUrl]);

  // Video Events
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoBlobUrl) return;

    console.log('VideoEditor: Setting up video element with src:', videoBlobUrl);

    const onLoadedMetadata = () => {
      console.log('VideoEditor: loadedmetadata event, duration:', video.duration);
      if (video.duration > 0 && isFinite(video.duration)) {
        setDuration(video.duration);
        setTrimRange((prev) => (prev[0] === 0 && prev[1] === 100 ? [0, 100] : prev));
      }
      setIsLoading(false);
    };

    const onLoadedData = () => {
      console.log('VideoEditor: loadeddata event');
      setIsLoading(false);
    };

    const onCanPlay = () => {
      console.log('VideoEditor: canplay event');
      setIsLoading(false);
    };

    const onError = () => {
      console.error('VideoEditor: Video error:', video.error);
      setError('Video konnte nicht abgespielt werden');
      setIsLoading(false);
    };

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      video.currentTime = trimStartRef.current;
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);

    // Force load
    video.load();

    const timeoutId = window.setTimeout(() => {
      if (video.readyState >= 1) {
        console.log('VideoEditor: metadata timeout, continue rendering');
        setIsLoading(false);
      }
    }, 3000);

    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      window.clearTimeout(timeoutId);
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
    };
  }, [videoBlobUrl]);

  // Play/Pause
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      if (video.currentTime < trimStartSeconds) {
        video.currentTime = trimStartSeconds;
      }
      video.play();
    } else {
      video.pause();
    }
  }, [trimStartSeconds]);

  const seekBy = useCallback((deltaSeconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const max = isFinite(duration) && duration > 0 ? duration : video.duration || 0;
    const next = Math.min(Math.max(video.currentTime + deltaSeconds, 0), max);
    video.currentTime = next;
  }, [duration]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const cyclePlaybackRate = useCallback(() => {
    const rates = [0.5, 1, 1.25, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    setPlaybackRate(nextRate);
  }, [playbackRate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = isMuted;
    video.volume = Math.max(0, Math.min(1, volume));
    video.playbackRate = playbackRate;
  }, [isMuted, volume, playbackRate, videoBlobUrl]);

  // Seek to position
  const seekTo = useCallback((percent: number) => {
    const video = videoRef.current;
    if (!video || duration === 0) return;
    video.currentTime = (percent / 100) * duration;
  }, [duration]);

  // FFmpeg laden
  const loadFFmpeg = useCallback(async () => {
    if (ffmpegLoadedRef.current && ffmpegRef.current) {
      return ffmpegRef.current;
    }

    const ffmpeg = new FFmpeg();
    ffmpeg.on('progress', ({ progress }) => {
      setTrimProgress(Math.round((progress || 0) * 100));
    });

    await ffmpeg.load({ coreURL, wasmURL });
    ffmpegRef.current = ffmpeg;
    ffmpegLoadedRef.current = true;
    return ffmpeg;
  }, []);

  // Video schneiden
  const handleTrim = useCallback(async () => {
    if (!videoBlobUrl || duration === 0) return;

    const start = trimStartSeconds;
    const end = trimEndSeconds;

    if (end <= start) {
      setError('Ende muss nach dem Start liegen');
      return;
    }

    setError(null);
    setIsTrimming(true);
    setTrimProgress(0);

    try {
      const ffmpeg = await loadFFmpeg();

      // Video-Daten holen
      const response = await fetch(videoBlobUrl);
      const videoBlob = await response.blob();
      const videoData = new Uint8Array(await videoBlob.arrayBuffer());

      // Alte Dateien löschen
      try {
        await ffmpeg.deleteFile('input.webm');
        await ffmpeg.deleteFile('output.mp4');
      } catch {
        // Ignorieren
      }

      // Video schreiben und schneiden
      await ffmpeg.writeFile('input.webm', videoData);

      const execPromise = ffmpeg.exec([
        '-i', 'input.webm',
        '-ss', String(start),
        '-to', String(end),
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-c:a', 'aac',
        '-y',
        'output.mp4'
      ]);

      const timeoutPromise = new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error('FFmpeg timeout')), 120000);
      });

      await Promise.race([execPromise, timeoutPromise]);

      // Ergebnis lesen
      const outputData = await ffmpeg.readFile('output.mp4');
      // Handle FileData type properly - copy to a plain ArrayBuffer
      let arrayBuffer: ArrayBuffer;
      if (typeof outputData === 'string') {
        const encoder = new TextEncoder();
        arrayBuffer = encoder.encode(outputData).buffer as ArrayBuffer;
      } else {
        // Copy to new ArrayBuffer to avoid SharedArrayBuffer issues
        arrayBuffer = new ArrayBuffer(outputData.length);
        new Uint8Array(arrayBuffer).set(outputData as Uint8Array);
      }
      const trimmedVideoBlob = new Blob([arrayBuffer], { type: 'video/mp4' });

      setTrimmedBlob(trimmedVideoBlob);
      setTrimProgress(100);

      // Vorschau aktualisieren
      const trimmedUrl = URL.createObjectURL(trimmedVideoBlob);
      setVideoBlobUrl(trimmedUrl);
      setDuration(end - start);
      setTrimRange([0, 100]);

    } catch (err) {
      console.error('Schneiden fehlgeschlagen:', err);
      setError('Video schneiden fehlgeschlagen. Bitte versuche es erneut.');
    } finally {
      setIsTrimming(false);
    }
  }, [videoBlobUrl, duration, trimStartSeconds, trimEndSeconds, loadFFmpeg]);

  // Speichern
  const handleSave = useCallback(() => {
    if (trimmedBlob) {
      onSave(trimmedBlob, trimmedDuration);
    } else {
      fetch(videoBlobUrl!)
        .then(res => res.blob())
        .then(blob => onSave(blob, duration));
    }
  }, [trimmedBlob, trimmedDuration, videoBlobUrl, duration, onSave]);

  // Current position als Prozent
  const currentPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <Dialog open fullScreen onClose={onCancel}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <CutIcon />
          <Typography variant="h6">Video bearbeiten</Typography>
        </Stack>
        <IconButton onClick={onCancel}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, p: 3 }}>
        {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

        {/* Video Player */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'black',
            borderRadius: 2,
            overflow: 'hidden',
            position: 'relative',
            minHeight: 400,
          }}
        >
          <video
            ref={videoRef}
            src={videoBlobUrl || undefined}
            preload="metadata"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              opacity: isLoading ? 0 : 1,
            }}
            onClick={togglePlay}
          />

          {isLoading && (
            <Stack
              spacing={2}
              alignItems="center"
              sx={{ position: 'absolute', inset: 0, justifyContent: 'center' }}
            >
              <CircularProgress sx={{ color: 'white' }} />
              <Typography color="white">Video wird geladen...</Typography>
            </Stack>
          )}

          {/* Play/Pause Overlay */}
          {!isLoading && (
            <IconButton
              onClick={togglePlay}
              sx={{
                position: 'absolute',
                bottom: 16,
                left: 16,
                bgcolor: 'rgba(0,0,0,0.6)',
                color: 'white',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
              }}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </IconButton>
          )}

          {/* Zeit-Anzeige */}
          {!isLoading && (
            <Typography
              sx={{
                position: 'absolute',
                bottom: 16,
                right: 16,
                bgcolor: 'rgba(0,0,0,0.6)',
                color: 'white',
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
                fontSize: '0.875rem',
              }}
            >
              {formatTime(currentTime)} / {formatTime(duration)}
            </Typography>
          )}
        </Box>

        {/* Controls Bar */}
        {!isLoading && (
          <Card
            sx={{
              p: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              flexWrap: 'wrap',
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton onClick={() => seekBy(-5)}>
                <Replay5Icon />
              </IconButton>
              <IconButton onClick={togglePlay}>
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </IconButton>
              <IconButton onClick={() => seekBy(5)}>
                <Forward5Icon />
              </IconButton>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 200 }}>
              <IconButton onClick={toggleMute}>
                {isMuted || volume === 0 ? <VolumeOffIcon /> : <VolumeUpIcon />}
              </IconButton>
              <Slider
                size="small"
                value={Math.round(volume * 100)}
                onChange={(_, v) => {
                  const next = Math.max(0, Math.min(100, Number(v)));
                  setVolume(next / 100);
                  if (next > 0) setIsMuted(false);
                }}
                min={0}
                max={100}
                sx={{ width: 140 }}
              />
            </Stack>

            <Button variant="outlined" size="small" onClick={cyclePlaybackRate}>
              {playbackRate}x
            </Button>

            <Box sx={{ flexGrow: 1 }} />

            <Typography variant="body2" color="text.secondary">
              {formatTime(currentTime)} / {formatTime(duration)}
            </Typography>
          </Card>
        )}

        {/* Timeline / Trimmer - Loom Style */}
        {!isLoading && (
          <Box sx={{ px: 2 }}>
            {/* Trim Info */}
            <Stack direction="row" justifyContent="space-between" mb={1}>
              <Typography variant="body2" color="text.secondary">
                Schnitt: {formatTime(trimStartSeconds)} - {formatTime(trimEndSeconds)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Dauer: {formatTime(trimmedDuration)}
              </Typography>
            </Stack>

            {/* Timeline Container */}
            <Box
              sx={{
                position: 'relative',
                height: 60,
                bgcolor: 'grey.200',
                borderRadius: 1,
                overflow: 'hidden',
              }}
            >
              {/* Ausgeschnittener Bereich (links) */}
              <Box
                sx={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${trimRange[0]}%`,
                  bgcolor: 'rgba(0,0,0,0.4)',
                  zIndex: 1,
                }}
              />

              {/* Ausgeschnittener Bereich (rechts) */}
              <Box
                sx={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: `${100 - trimRange[1]}%`,
                  bgcolor: 'rgba(0,0,0,0.4)',
                  zIndex: 1,
                }}
              />

              {/* Aktiver Bereich */}
              <Box
                sx={{
                  position: 'absolute',
                  left: `${trimRange[0]}%`,
                  right: `${100 - trimRange[1]}%`,
                  top: 0,
                  bottom: 0,
                  bgcolor: 'primary.light',
                  border: '2px solid',
                  borderColor: 'primary.main',
                  boxSizing: 'border-box',
                }}
              />

              {/* Playhead */}
              <Box
                sx={{
                  position: 'absolute',
                  left: `${currentPercent}%`,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  bgcolor: 'error.main',
                  zIndex: 3,
                  pointerEvents: 'none',
                }}
              />

              {/* Range Slider */}
              <Slider
                value={trimRange}
                onChange={(_, newValue) => {
                  setTrimRange(newValue as [number, number]);
                }}
                onChangeCommitted={(_, newValue) => {
                  const value = newValue as [number, number];
                  seekTo(value[0]);
                }}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => formatTime((v / 100) * duration)}
                min={0}
                max={100}
                step={0.1}
                disableSwap
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: '100%',
                  '& .MuiSlider-rail': { display: 'none' },
                  '& .MuiSlider-track': { display: 'none' },
                  '& .MuiSlider-thumb': {
                    width: 12,
                    height: '100%',
                    borderRadius: 0,
                    bgcolor: 'primary.dark',
                    border: 'none',
                    '&:hover, &.Mui-focusVisible': {
                      boxShadow: 'none',
                      bgcolor: 'primary.main',
                    },
                  },
                }}
              />
            </Box>

            {/* Trimming Progress */}
            {isTrimming && (
              <Stack direction="row" spacing={2} alignItems="center" mt={2}>
                <CircularProgress size={20} />
                <Typography variant="body2">
                  Schneide Video... {trimProgress}%
                </Typography>
              </Stack>
            )}
          </Box>
        )}

        {/* Aktionen */}
        <Stack direction="row" spacing={2} justifyContent="center">
          <Button onClick={onCancel} disabled={isTrimming}>
            Abbrechen
          </Button>

          <Button
            variant="outlined"
            startIcon={<CutIcon />}
            onClick={handleTrim}
            disabled={isLoading || isTrimming || (trimRange[0] === 0 && trimRange[1] === 100)}
          >
            Schnitt anwenden
          </Button>

          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={isLoading || isTrimming}
          >
            {trimmedBlob ? 'Speichern' : 'Fertig'}
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
