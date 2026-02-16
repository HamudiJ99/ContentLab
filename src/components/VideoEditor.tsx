import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Alert,
  Box,
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
  Tooltip,
  Typography,
  useTheme,
  alpha,
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
  RestartAlt as ResetIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
} from '@mui/icons-material';

import { FFmpeg } from '@ffmpeg/ffmpeg';
import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';

// Types
type Cut = {
  id: string;
  startTime: number;
  endTime: number;
};

type Thumbnail = {
  time: number;
  dataUrl: string;
};

type VideoEditorProps = {
  videoUrl: string;
  onSave: (videoBlob: Blob, duration: number) => void;
  onCancel: () => void;
};

const generateId = () => Math.random().toString(36).substring(2, 9);

export default function VideoEditor({ videoUrl, onSave, onCancel }: VideoEditorProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  // Core State
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [originalBlobUrl, setOriginalBlobUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [originalDuration, setOriginalDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Cut State
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [selectedCutId, setSelectedCutId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [hasAppliedCuts, setHasAppliedCuts] = useState(false);
  
  // Thumbnails
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [thumbnailsLoading, setThumbnailsLoading] = useState(false);
  
  // Audio
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.9);
  const [playbackRate, setPlaybackRate] = useState(1);
  
  // UI State
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'playhead' | null>(null);
  const [dragCutId, setDragCutId] = useState<string | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const ffmpegLoadedRef = useRef(false);
  const loadIdRef = useRef(0);

  // Format time
  const formatTime = useCallback((seconds: number, showMs = false): string => {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    
    if (hrs > 0) {
      return showMs 
        ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
        : `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return showMs 
      ? `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
      : `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Calculate final duration
  const finalDuration = useMemo(() => {
    const totalCutTime = cuts.reduce((acc, cut) => acc + (cut.endTime - cut.startTime), 0);
    return Math.max(0, originalDuration - totalCutTime);
  }, [cuts, originalDuration]);

  // Load video
  useEffect(() => {
    let objectUrl: string | null = null;
    const controller = new AbortController();
    const loadId = ++loadIdRef.current;

    const loadVideo = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(videoUrl, { signal: controller.signal });
        if (!response.ok) throw new Error(`Video konnte nicht geladen werden (Status: ${response.status})`);

        const blob = await response.blob();
        if (blob.size === 0) throw new Error('Video ist leer');

        objectUrl = URL.createObjectURL(blob);
        if (loadId === loadIdRef.current) {
          setVideoBlobUrl(objectUrl);
          setOriginalBlobUrl(objectUrl);
        } else if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Video konnte nicht geladen werden.');
        setIsLoading(false);
      }
    };

    if (videoUrl) {
      loadVideo();
    } else {
      setError('Keine Video-URL vorhanden');
      setIsLoading(false);
    }

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [videoUrl]);

  // Video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoBlobUrl) return;

    const onLoadedMetadata = () => {
      if (video.duration > 0 && isFinite(video.duration)) {
        setDuration(video.duration);
        if (originalDuration === 0) {
          setOriginalDuration(video.duration);
        }
      }
      setIsLoading(false);
    };

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      video.currentTime = 0;
    };
    const onError = () => {
      setError('Video konnte nicht abgespielt werden');
      setIsLoading(false);
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);
    video.load();

    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
    };
  }, [videoBlobUrl, originalDuration]);

  // Generate thumbnails
  useEffect(() => {
    if (!originalBlobUrl || originalDuration === 0) return;

    const generateThumbnails = async () => {
      setThumbnailsLoading(true);
      const video = document.createElement('video');
      video.src = originalBlobUrl;
      video.crossOrigin = 'anonymous';
      video.muted = true;
      
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve();
        video.load();
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const thumbnailCount = Math.max(20, Math.ceil(originalDuration / 2));
      const interval = originalDuration / thumbnailCount;
      
      canvas.width = 160;
      canvas.height = 90;

      const newThumbnails: Thumbnail[] = [];
      
      for (let i = 0; i < thumbnailCount; i++) {
        const time = i * interval;
        video.currentTime = time;
        
        await new Promise<void>((resolve) => {
          video.onseeked = () => {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            newThumbnails.push({
              time,
              dataUrl: canvas.toDataURL('image/jpeg', 0.6),
            });
            resolve();
          };
        });
      }

      setThumbnails(newThumbnails);
      setThumbnailsLoading(false);
      video.remove();
    };

    generateThumbnails();
  }, [originalBlobUrl, originalDuration]);

  // Audio settings
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = isMuted;
    video.volume = Math.max(0, Math.min(1, volume));
    video.playbackRate = playbackRate;
  }, [isMuted, volume, playbackRate, videoBlobUrl]);

  // Playback controls
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.paused ? video.play() : video.pause();
  }, []);

  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(time, duration));
  }, [duration]);

  const seekBy = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.currentTime + delta, duration));
  }, [duration]);

  // Cut management
  const addCutAtPlayhead = useCallback(() => {
    const cutDuration = Math.min(2, originalDuration * 0.1);
    const startTime = Math.max(0, currentTime - cutDuration / 2);
    const endTime = Math.min(originalDuration, startTime + cutDuration);
    
    const overlaps = cuts.some(cut => 
      (startTime >= cut.startTime && startTime < cut.endTime) ||
      (endTime > cut.startTime && endTime <= cut.endTime) ||
      (startTime <= cut.startTime && endTime >= cut.endTime)
    );
    
    if (overlaps) {
      setError('Schnitt überschneidet sich mit einem existierenden Schnitt');
      return;
    }
    
    const newCut: Cut = { id: generateId(), startTime, endTime };
    setCuts(prev => [...prev, newCut]);
    setSelectedCutId(newCut.id);
  }, [currentTime, cuts, originalDuration]);

  const updateCut = useCallback((cutId: string, updates: Partial<Cut>) => {
    setCuts(prev => prev.map(cut => {
      if (cut.id !== cutId) return cut;
      const updated = { ...cut, ...updates };
      if (updated.endTime <= updated.startTime) {
        updated.endTime = updated.startTime + 0.1;
      }
      updated.startTime = Math.max(0, updated.startTime);
      updated.endTime = Math.min(originalDuration, updated.endTime);
      return updated;
    }));
  }, [originalDuration]);

  const deleteCut = useCallback((cutId: string) => {
    setCuts(prev => prev.filter(cut => cut.id !== cutId));
    if (selectedCutId === cutId) setSelectedCutId(null);
  }, [selectedCutId]);

  const deleteSelectedCut = useCallback(() => {
    if (selectedCutId) deleteCut(selectedCutId);
  }, [selectedCutId, deleteCut]);

  const resetAllCuts = useCallback(() => {
    setCuts([]);
    setSelectedCutId(null);
    if (originalBlobUrl && videoBlobUrl !== originalBlobUrl) {
      setVideoBlobUrl(originalBlobUrl);
      setDuration(originalDuration);
    }
    setHasAppliedCuts(false);
  }, [originalBlobUrl, videoBlobUrl, originalDuration]);

  // Timeline interaction
  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || isDragging) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    seekTo(percent * originalDuration);
  }, [originalDuration, seekTo, isDragging]);

  const handleTimelineMouseDown = useCallback((
    e: React.MouseEvent,
    type: 'start' | 'end' | 'playhead',
    cutId?: string
  ) => {
    e.stopPropagation();
    setIsDragging(type);
    if (cutId) setDragCutId(cutId);
  }, []);

  const handleTimelineMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const time = (x / rect.width) * originalDuration;
    
    if (isDragging === 'playhead') {
      seekTo(time);
    } else if (dragCutId) {
      updateCut(dragCutId, { [isDragging === 'start' ? 'startTime' : 'endTime']: time });
    }
  }, [isDragging, dragCutId, originalDuration, seekTo, updateCut]);

  const handleTimelineMouseUp = useCallback(() => {
    setIsDragging(null);
    setDragCutId(null);
  }, []);

  // FFmpeg
  const loadFFmpeg = useCallback(async () => {
    if (ffmpegLoadedRef.current && ffmpegRef.current) return ffmpegRef.current;
    const ffmpeg = new FFmpeg();
    ffmpeg.on('progress', ({ progress }) => setProcessProgress(Math.round((progress || 0) * 100)));
    await ffmpeg.load({ coreURL, wasmURL });
    ffmpegRef.current = ffmpeg;
    ffmpegLoadedRef.current = true;
    return ffmpeg;
  }, []);

  const processVideo = useCallback(async () => {
    if (!originalBlobUrl || cuts.length === 0) return;
    
    setIsProcessing(true);
    setProcessProgress(0);
    setError(null);
    
    try {
      const ffmpeg = await loadFFmpeg();
      const response = await fetch(originalBlobUrl);
      const videoBlob = await response.blob();
      const videoData = new Uint8Array(await videoBlob.arrayBuffer());
      
      try {
        await ffmpeg.deleteFile('input.webm');
        await ffmpeg.deleteFile('output.mp4');
        await ffmpeg.deleteFile('concat.txt');
        for (let i = 0; i < 20; i++) await ffmpeg.deleteFile(`segment${i}.mp4`);
      } catch { /* ignore */ }
      
      await ffmpeg.writeFile('input.webm', videoData);
      
      const sortedCuts = [...cuts].sort((a, b) => a.startTime - b.startTime);
      const keepSegments: { start: number; end: number }[] = [];
      let currentStart = 0;
      
      for (const cut of sortedCuts) {
        if (cut.startTime > currentStart) {
          keepSegments.push({ start: currentStart, end: cut.startTime });
        }
        currentStart = cut.endTime;
      }
      if (currentStart < originalDuration) {
        keepSegments.push({ start: currentStart, end: originalDuration });
      }
      
      if (keepSegments.length === 0) {
        setError('Keine Videosegmente übrig nach den Schnitten');
        setIsProcessing(false);
        return;
      }
      
      const segmentFiles: string[] = [];
      for (let i = 0; i < keepSegments.length; i++) {
        const segment = keepSegments[i];
        const segmentFile = `segment${i}.mp4`;
        await ffmpeg.exec([
          '-i', 'input.webm',
          '-ss', String(segment.start),
          '-to', String(segment.end),
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-c:a', 'aac',
          '-y',
          segmentFile
        ]);
        segmentFiles.push(segmentFile);
      }
      
      let finalFile = segmentFiles[0];
      if (segmentFiles.length > 1) {
        const concatContent = segmentFiles.map(f => `file '${f}'`).join('\n');
        await ffmpeg.writeFile('concat.txt', concatContent);
        await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', '-y', 'output.mp4']);
        finalFile = 'output.mp4';
      }
      
      const outputData = await ffmpeg.readFile(finalFile);
      let arrayBuffer: ArrayBuffer;
      if (typeof outputData === 'string') {
        arrayBuffer = new TextEncoder().encode(outputData).buffer as ArrayBuffer;
      } else {
        arrayBuffer = new ArrayBuffer(outputData.length);
        new Uint8Array(arrayBuffer).set(outputData as Uint8Array);
      }
      
      const processedBlob = new Blob([arrayBuffer], { type: 'video/mp4' });
      const processedUrl = URL.createObjectURL(processedBlob);
      setVideoBlobUrl(processedUrl);
      setDuration(finalDuration);
      setCuts([]);
      setSelectedCutId(null);
      setHasAppliedCuts(true);
      setProcessProgress(100);
    } catch (err) {
      console.error('Video processing failed:', err);
      setError('Video-Verarbeitung fehlgeschlagen. Bitte versuche es erneut.');
    } finally {
      setIsProcessing(false);
    }
  }, [originalBlobUrl, cuts, originalDuration, finalDuration, loadFFmpeg]);

  // Save
  const handleSave = useCallback(async () => {
    if (cuts.length > 0) {
      await processVideo();
    }
    if (videoBlobUrl) {
      const response = await fetch(videoBlobUrl);
      const blob = await response.blob();
      onSave(blob, cuts.length > 0 ? finalDuration : duration);
    }
  }, [cuts, videoBlobUrl, processVideo, finalDuration, duration, onSave]);

  // Close
  const handleClose = useCallback(() => {
    if (hasAppliedCuts || cuts.length > 0) {
      setShowCloseWarning(true);
    } else {
      onCancel();
    }
  }, [hasAppliedCuts, cuts.length, onCancel]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekBy(e.shiftKey ? -1 : -5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekBy(e.shiftKey ? 1 : 5);
          break;
        case 'Delete':
        case 'Backspace':
          if (selectedCutId) {
            e.preventDefault();
            deleteSelectedCut();
          }
          break;
        case 'c':
        case 'C':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            addCutAtPlayhead();
          }
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, seekBy, selectedCutId, deleteSelectedCut, addCutAtPlayhead]);

  const currentPercent = originalDuration > 0 ? (currentTime / originalDuration) * 100 : 0;

  return (
    <Dialog 
      open 
      fullScreen 
      onClose={handleClose}
      PaperProps={{ sx: { bgcolor: isDark ? '#0f0f0f' : '#fafafa' } }}
    >
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        px: 3,
        py: 1.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: isDark ? '#1a1a1a' : '#fff',
      }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <CutIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h6" fontWeight={600}>Video bearbeiten</Typography>
        </Stack>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ m: 2 }}>
            {error}
          </Alert>
        )}

        {/* Video Player */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            minHeight: 300,
            bgcolor: '#000',
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
            <Stack spacing={2} alignItems="center" sx={{ position: 'absolute', inset: 0, justifyContent: 'center' }}>
              <CircularProgress sx={{ color: 'white' }} />
              <Typography color="white">Video wird geladen...</Typography>
            </Stack>
          )}

          {!isLoading && !isPlaying && (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.3)' }}>
              <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
                <PlayIcon sx={{ fontSize: 40, color: '#111', ml: 0.5 }} />
              </Box>
            </Box>
          )}
        </Box>

        {/* Controls */}
        {!isLoading && (
          <Box sx={{ bgcolor: isDark ? '#1a1a1a' : '#fff', borderTop: '1px solid', borderColor: 'divider' }}>
            {/* Playback Controls */}
            <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <IconButton onClick={() => seekBy(-5)} size="small"><Replay5Icon /></IconButton>
              <IconButton onClick={togglePlay} sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' }, width: 44, height: 44 }}>
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </IconButton>
              <IconButton onClick={() => seekBy(5)} size="small"><Forward5Icon /></IconButton>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', minWidth: 180, textAlign: 'center', color: 'text.secondary' }}>
                {formatTime(currentTime, true)} / {formatTime(originalDuration, true)}
              </Typography>
              <IconButton onClick={() => setIsMuted(!isMuted)} size="small" sx={{ ml: 2 }}>
                {isMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
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
                sx={{ width: 80, '& .MuiSlider-thumb': { width: 12, height: 12 } }}
              />
              <Button size="small" onClick={() => {
                const rates = [0.5, 1, 1.25, 1.5, 2];
                const idx = rates.indexOf(playbackRate);
                setPlaybackRate(rates[(idx + 1) % rates.length]);
              }} sx={{ minWidth: 50, fontWeight: 600 }}>
                {playbackRate}x
              </Button>
            </Stack>

            {/* Timeline */}
            <Box sx={{ px: 2, py: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Tooltip title="Schnitt an Playhead hinzufügen (C)">
                    <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={addCutAtPlayhead} disabled={isProcessing}
                      sx={{ bgcolor: '#f97316', '&:hover': { bgcolor: '#ea580c' } }}>
                      Schnitt hinzufügen
                    </Button>
                  </Tooltip>
                  {selectedCutId && (
                    <Tooltip title="Ausgewählten Schnitt löschen (Entf)">
                      <Button variant="outlined" size="small" startIcon={<DeleteIcon />} onClick={deleteSelectedCut} disabled={isProcessing} color="error">
                        Schnitt löschen
                      </Button>
                    </Tooltip>
                  )}
                  {cuts.length > 0 && (
                    <Tooltip title="Alle Schnitte zurücksetzen">
                      <Button variant="outlined" size="small" startIcon={<ResetIcon />} onClick={resetAllCuts} disabled={isProcessing}>
                        Zurücksetzen
                      </Button>
                    </Tooltip>
                  )}
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                    {cuts.length > 0 ? `${cuts.length} Schnitt${cuts.length > 1 ? 'e' : ''} • Finale Länge: ${formatTime(finalDuration)}` : 'Klicke auf "Schnitt hinzufügen" um Bereiche zu entfernen'}
                  </Typography>
                  <IconButton size="small" onClick={() => setTimelineZoom(z => Math.max(0.5, z - 0.25))} disabled={timelineZoom <= 0.5}>
                    <ZoomOutIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => setTimelineZoom(z => Math.min(3, z + 0.25))} disabled={timelineZoom >= 3}>
                    <ZoomInIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>

              <Box sx={{ overflowX: 'auto', overflowY: 'hidden', pb: 1 }}>
                <Box
                  ref={timelineRef}
                  onClick={handleTimelineClick}
                  onMouseMove={handleTimelineMouseMove}
                  onMouseUp={handleTimelineMouseUp}
                  onMouseLeave={handleTimelineMouseUp}
                  sx={{
                    position: 'relative',
                    height: 80,
                    minWidth: `${100 * timelineZoom}%`,
                    borderRadius: 2,
                    overflow: 'hidden',
                    cursor: isDragging ? 'grabbing' : 'pointer',
                    bgcolor: isDark ? '#2a2a2a' : '#e5e5e5',
                    userSelect: 'none',
                  }}
                >
                  {/* Thumbnails */}
                  {thumbnails.length > 0 && (
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', opacity: thumbnailsLoading ? 0.5 : 1 }}>
                      {thumbnails.map((thumb, i) => (
                        <Box key={i} sx={{ flex: 1, height: '100%', backgroundImage: `url(${thumb.dataUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                      ))}
                    </Box>
                  )}

                  {/* Cut regions */}
                  {cuts.map((cut) => {
                    const leftPercent = (cut.startTime / originalDuration) * 100;
                    const widthPercent = ((cut.endTime - cut.startTime) / originalDuration) * 100;
                    const isSelected = cut.id === selectedCutId;
                    return (
                      <Box
                        key={cut.id}
                        onClick={(e) => { e.stopPropagation(); setSelectedCutId(cut.id); }}
                        sx={{
                          position: 'absolute',
                          left: `${leftPercent}%`,
                          width: `${widthPercent}%`,
                          top: 0,
                          bottom: 0,
                          bgcolor: alpha('#ef4444', 0.6),
                          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.1) 4px, rgba(0,0,0,0.1) 8px)',
                          border: isSelected ? '2px solid #ef4444' : 'none',
                          boxShadow: isSelected ? '0 0 0 2px rgba(239,68,68,0.3)' : 'none',
                          zIndex: 2,
                          cursor: 'pointer',
                        }}
                      >
                        <Box onMouseDown={(e) => handleTimelineMouseDown(e, 'start', cut.id)}
                          sx={{ position: 'absolute', left: -4, top: 0, bottom: 0, width: 12, cursor: 'ew-resize', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Box sx={{ width: 4, height: '60%', bgcolor: 'rgba(255,255,255,0.8)', borderRadius: 1 }} />
                        </Box>
                        <Box onMouseDown={(e) => handleTimelineMouseDown(e, 'end', cut.id)}
                          sx={{ position: 'absolute', right: -4, top: 0, bottom: 0, width: 12, cursor: 'ew-resize', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Box sx={{ width: 4, height: '60%', bgcolor: 'rgba(255,255,255,0.8)', borderRadius: 1 }} />
                        </Box>
                        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', bgcolor: 'rgba(0,0,0,0.8)', color: 'white', px: 1, py: 0.5, borderRadius: 1, fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap', pointerEvents: 'none', opacity: isSelected || widthPercent > 5 ? 1 : 0 }}>
                          {formatTime(cut.endTime - cut.startTime)}
                        </Box>
                      </Box>
                    );
                  })}

                  {/* Playhead */}
                  <Box
                    onMouseDown={(e) => handleTimelineMouseDown(e, 'playhead')}
                    sx={{
                      position: 'absolute',
                      left: `${currentPercent}%`,
                      top: 0,
                      bottom: 0,
                      width: 3,
                      bgcolor: '#f97316',
                      zIndex: 10,
                      cursor: 'ew-resize',
                      transform: 'translateX(-50%)',
                      boxShadow: '0 0 8px rgba(249,115,22,0.6)',
                      '&::before': { content: '""', position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '8px solid #f97316' },
                    }}
                  />
                  <Box sx={{ position: 'absolute', left: `${currentPercent}%`, top: -26, transform: 'translateX(-50%)', bgcolor: '#f97316', color: 'white', px: 1, py: 0.25, borderRadius: 1, fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap', zIndex: 11 }}>
                    {formatTime(currentTime, true)}
                  </Box>
                </Box>
              </Box>

              <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5, px: 0.5 }}>
                <Typography variant="caption" color="text.secondary" fontFamily="monospace">0:00</Typography>
                <Typography variant="caption" color="text.secondary" fontFamily="monospace">{formatTime(originalDuration / 4)}</Typography>
                <Typography variant="caption" color="text.secondary" fontFamily="monospace">{formatTime(originalDuration / 2)}</Typography>
                <Typography variant="caption" color="text.secondary" fontFamily="monospace">{formatTime((originalDuration / 4) * 3)}</Typography>
                <Typography variant="caption" color="text.secondary" fontFamily="monospace">{formatTime(originalDuration)}</Typography>
              </Stack>
            </Box>

            {/* Actions */}
            <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={1.5} sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
              {isProcessing && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mr: 'auto' }}>
                  <CircularProgress size={20} sx={{ color: 'primary.main' }} />
                  <Typography variant="body2" color="text.secondary">Verarbeite Video... {processProgress}%</Typography>
                </Stack>
              )}
              <Button onClick={handleClose} disabled={isProcessing}>Abbrechen</Button>
              {cuts.length > 0 && (
                <Button variant="outlined" startIcon={<CutIcon />} onClick={processVideo} disabled={isProcessing}>
                  Schnitte anwenden
                </Button>
              )}
              <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={isLoading || isProcessing}>
                {cuts.length > 0 ? 'Schneiden & Speichern' : 'Speichern'}
              </Button>
            </Stack>
          </Box>
        )}
      </Box>

      {/* Close Warning */}
      <Dialog open={showCloseWarning} onClose={() => setShowCloseWarning(false)}>
        <DialogTitle>Änderungen verwerfen?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Du hast {cuts.length > 0 ? `${cuts.length} Schnitt${cuts.length > 1 ? 'e' : ''} vorbereitet` : 'ungespeicherte Änderungen'}.
            Wenn du jetzt schließt, gehen diese verloren.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCloseWarning(false)}>Zurück zum Editor</Button>
          <Button onClick={onCancel} color="error">Schließen ohne Speichern</Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
