import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Alert,
  Box,
  Card,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Slider,
  Stack,
  Typography,
  useTheme,
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
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
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
  const [hasPendingCut, setHasPendingCut] = useState(false);
  const [showCutWarning, setShowCutWarning] = useState(false);
  const [showCloseWarning, setShowCloseWarning] = useState(false);

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
      setHasPendingCut(false); // Cut wurde angewendet

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
    // Warnung anzeigen, wenn ein Schnitt vorbereitet aber nicht angewendet wurde
    if (hasPendingCut && !trimmedBlob) {
      setShowCutWarning(true);
      return;
    }
    
    if (trimmedBlob) {
      onSave(trimmedBlob, trimmedDuration);
    } else {
      fetch(videoBlobUrl!)
        .then(res => res.blob())
        .then(blob => onSave(blob, duration));
    }
  }, [trimmedBlob, trimmedDuration, videoBlobUrl, duration, onSave, hasPendingCut]);

  // Speichern ohne Schnitt bestätigen
  const handleSaveWithoutCut = useCallback(() => {
    setShowCutWarning(false);
    fetch(videoBlobUrl!)
      .then(res => res.blob())
      .then(blob => onSave(blob, duration));
  }, [videoBlobUrl, duration, onSave]);

  // Schließen mit Warnung wenn Schnitt angewendet aber nicht gespeichert
  const handleClose = useCallback(() => {
    if (trimmedBlob) {
      setShowCloseWarning(true);
    } else {
      onCancel();
    }
  }, [trimmedBlob, onCancel]);

  // Schließen ohne Speichern bestätigen
  const handleCloseWithoutSave = useCallback(() => {
    setShowCloseWarning(false);
    onCancel();
  }, [onCancel]);

  // Current position als Prozent
  const currentPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <Dialog open fullScreen onClose={handleClose}>
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        borderBottom: '1px solid',
        borderColor: 'divider',
        py: 1.5,
      }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <CutIcon color="primary" />
          <Typography variant="h6" fontWeight={600}>Video bearbeiten</Typography>
        </Stack>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        p: 0,
        bgcolor: isDark ? '#0a0a0a' : '#f5f5f5',
      }}>
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ m: 2 }}>
            {error}
          </Alert>
        )}

        {/* Video Player - Clean, ohne Overlays */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            minHeight: 300,
            cursor: 'pointer',
          }}
          onClick={togglePlay}
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

          {/* Zentraler Play-Button beim Pausieren */}
          {!isLoading && !isPlaying && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(0,0,0,0.3)',
                transition: 'opacity 0.2s',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.4)' },
              }}
            >
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  bgcolor: 'rgba(255,255,255,0.9)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                }}
              >
                <PlayIcon sx={{ fontSize: 40, color: '#0a0a0a', ml: 0.5 }} />
              </Box>
            </Box>
          )}
        </Box>

        {/* Kompakte Control-Leiste */}
        {!isLoading && (
          <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
            {/* Timeline / Trimmer */}
            <Box sx={{ px: 3, pt: 2, pb: 1 }}>
              <Box
                sx={{
                  position: 'relative',
                  height: 48,
                  borderRadius: 1.5,
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
              >
                {/* Ausgeschnittener Bereich (links) - mit Streifen-Muster */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${trimRange[0]}%`,
                    bgcolor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.3)',
                    backgroundImage: isDark 
                      ? 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.05) 4px, rgba(255,255,255,0.05) 8px)'
                      : 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.05) 4px, rgba(0,0,0,0.05) 8px)',
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
                    bgcolor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.3)',
                    backgroundImage: isDark 
                      ? 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.05) 4px, rgba(255,255,255,0.05) 8px)'
                      : 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.05) 4px, rgba(0,0,0,0.05) 8px)',
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
                    background: isDark 
                      ? 'linear-gradient(180deg, #4a4a4a 0%, #3a3a3a 100%)'
                      : 'linear-gradient(180deg, #f0f0f0 0%, #d8d8d8 100%)',
                    borderLeft: '3px solid',
                    borderRight: '3px solid',
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
                    width: 3,
                    bgcolor: isDark ? '#fff' : '#1976d2',
                    zIndex: 3,
                    pointerEvents: 'none',
                    boxShadow: isDark ? '0 0 8px rgba(255,255,255,0.5)' : '0 0 8px rgba(25,118,210,0.5)',
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      top: -6,
                      left: -4,
                      width: 11,
                      height: 11,
                      borderRadius: '50%',
                      bgcolor: isDark ? '#fff' : '#1976d2',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    },
                  }}
                />

                {/* Range Slider */}
                <Slider
                  value={trimRange}
                  onChange={(_, newValue) => {
                    const newRange = newValue as [number, number];
                    setTrimRange(newRange);
                    if (!trimmedBlob && (newRange[0] !== 0 || newRange[1] !== 100)) {
                      setHasPendingCut(true);
                    } else if (newRange[0] === 0 && newRange[1] === 100) {
                      setHasPendingCut(false);
                    }
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
                      width: 8,
                      height: '100%',
                      borderRadius: 1,
                      bgcolor: 'primary.main',
                      border: 'none',
                      '&:hover, &.Mui-focusVisible': {
                        boxShadow: '0 0 0 4px rgba(144, 202, 249, 0.3)',
                      },
                      '&::before': {
                        content: '"≡"',
                        color: 'white',
                        fontSize: 12,
                        fontWeight: 'bold',
                      },
                    },
                  }}
                />
              </Box>

              {/* Zeit-Info unter der Timeline */}
              <Stack 
                direction="row" 
                justifyContent="space-between" 
                alignItems="center"
                sx={{ mt: 1, px: 0.5 }}
              >
                <Typography variant="caption" sx={{ color: isDark ? 'grey.500' : 'grey.600', fontFamily: 'monospace' }}>
                  {formatTime(trimStartSeconds)}
                </Typography>
                <Typography variant="caption" sx={{ color: isDark ? 'grey.400' : 'grey.700', fontWeight: 500 }}>
                  {trimRange[0] === 0 && trimRange[1] === 100 
                    ? `${formatTime(currentTime)} / ${formatTime(duration)}`
                    : `Auswahl: ${formatTime(trimmedDuration)}`
                  }
                </Typography>
                <Typography variant="caption" sx={{ color: isDark ? 'grey.500' : 'grey.600', fontFamily: 'monospace' }}>
                  {formatTime(trimEndSeconds)}
                </Typography>
              </Stack>
            </Box>

            {/* Controls und Aktionen */}
            <Stack 
              direction="row" 
              alignItems="center" 
              justifyContent="space-between"
              sx={{ px: 3, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}
            >
              {/* Linke Controls: Playback */}
              <Stack direction="row" spacing={0.5} alignItems="center">
                <IconButton 
                  onClick={() => seekBy(-5)} 
                  size="small"
                  sx={{ color: isDark ? 'grey.400' : 'grey.700', '&:hover': { color: isDark ? 'white' : 'primary.main' } }}
                >
                  <Replay5Icon fontSize="small" />
                </IconButton>
                <IconButton 
                  onClick={togglePlay}
                  sx={{ 
                    color: 'white',
                    bgcolor: 'primary.main',
                    '&:hover': { bgcolor: 'primary.dark' },
                    mx: 0.5,
                  }}
                >
                  {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </IconButton>
                <IconButton 
                  onClick={() => seekBy(5)} 
                  size="small"
                  sx={{ color: isDark ? 'grey.400' : 'grey.700', '&:hover': { color: isDark ? 'white' : 'primary.main' } }}
                >
                  <Forward5Icon fontSize="small" />
                </IconButton>

                <IconButton 
                  onClick={toggleMute} 
                  size="small"
                  sx={{ color: isDark ? 'grey.400' : 'grey.700', '&:hover': { color: isDark ? 'white' : 'primary.main' }, ml: 1.5 }}
                >
                  {isMuted || volume === 0 ? <VolumeOffIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
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
                  sx={{ 
                    width: 80, 
                    color: isDark ? 'grey.400' : 'grey.600',
                    '& .MuiSlider-thumb': { width: 12, height: 12 },
                  }}
                />

                <Button 
                  variant="text" 
                  size="small" 
                  onClick={cyclePlaybackRate}
                  sx={{ 
                    color: isDark ? 'grey.400' : 'grey.700', 
                    minWidth: 40,
                    fontSize: '0.75rem',
                    '&:hover': { color: isDark ? 'white' : 'primary.main', bgcolor: 'transparent' },
                  }}
                >
                  {playbackRate}x
                </Button>
              </Stack>

              {/* Rechte Seite: Aktionen */}
              <Stack direction="row" spacing={1.5} alignItems="center">
                {isTrimming && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={16} sx={{ color: 'primary.main' }} />
                    <Typography variant="caption" sx={{ color: 'grey.400' }}>
                      {trimProgress}%
                    </Typography>
                  </Stack>
                )}

                <Button 
                  onClick={handleClose} 
                  disabled={isTrimming}
                  size="small"
                  sx={{ color: isDark ? 'grey.400' : 'grey.700' }}
                >
                  Abbrechen
                </Button>

                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<CutIcon />}
                  onClick={handleTrim}
                  disabled={isLoading || isTrimming || (trimRange[0] === 0 && trimRange[1] === 100)}
                  sx={{
                    borderColor: isDark ? 'grey.600' : 'grey.400',
                    color: isDark ? 'grey.300' : 'grey.800',
                    '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
                    '&.Mui-disabled': { borderColor: isDark ? 'grey.800' : 'grey.300', color: isDark ? 'grey.700' : 'grey.500' },
                  }}
                >
                  Schnitt anwenden
                </Button>

                <Button
                  variant="contained"
                  size="small"
                  startIcon={<SaveIcon />}
                  onClick={handleSave}
                  disabled={isLoading || isTrimming}
                >
                  {trimmedBlob ? 'Speichern' : 'Fertig'}
                </Button>
              </Stack>
            </Stack>
          </Box>
        )}
      </DialogContent>

      {/* Warnung: Nicht angewendeter Schnitt */}
      <Dialog open={showCutWarning} onClose={() => setShowCutWarning(false)}>
        <DialogTitle>Schnitt nicht angewendet</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Du hast einen Schnitt am Schieber vorbereitet, aber noch nicht auf "Schnitt anwenden" geklickt. 
            Der Schnitt wird nicht übernommen, wenn du jetzt speicherst.
          </DialogContentText>
          <DialogContentText sx={{ mt: 2, fontWeight: 'bold' }}>
            Möchtest du das Video ohne Schnitt speichern?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCutWarning(false)}>
            Zurück zum Editor
          </Button>
          <Button onClick={handleSaveWithoutCut} variant="contained" color="warning">
            Ohne Schnitt speichern
          </Button>
        </DialogActions>
      </Dialog>

      {/* Warnung: Schließen ohne Speichern */}
      <Dialog open={showCloseWarning} onClose={() => setShowCloseWarning(false)}>
        <DialogTitle>Änderungen nicht gespeichert</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Du hast einen Schnitt angewendet, aber noch nicht gespeichert. 
            Wenn du jetzt schließt, geht der bearbeitete Schnitt verloren.
          </DialogContentText>
          <DialogContentText sx={{ mt: 2, fontWeight: 'bold' }}>
            Möchtest du wirklich schließen, ohne zu speichern?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCloseWarning(false)} variant="contained">
            Zurück zum Editor
          </Button>
          <Button onClick={handleCloseWithoutSave} color="error">
            Schließen ohne Speichern
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
