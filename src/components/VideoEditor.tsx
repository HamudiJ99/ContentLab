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
  Menu,
  MenuItem,
  keyframes,
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
  Speed as SpeedIcon,
} from '@mui/icons-material';

import { FFmpeg } from '@ffmpeg/ffmpeg';
import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';

// Animations
const pulseAnimation = keyframes`
  0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.8; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
`;

const clickAnimation = keyframes`
  0% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -50%) scale(0.9); }
  100% { transform: translate(-50%, -50%) scale(1); }
`;

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

type DragType = 'start' | 'end' | 'move' | 'playhead' | 'trim-start' | 'trim-end' | null;

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
  
  // Trim State (for trimming video start/end)
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  
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
  const [isDragging, setIsDragging] = useState<DragType>(null);
  const [dragCutId, setDragCutId] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartCut, setDragStartCut] = useState<Cut | null>(null);
  const [playButtonAnimating, setPlayButtonAnimating] = useState(false);
  const [speedMenuAnchor, setSpeedMenuAnchor] = useState<null | HTMLElement>(null);

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

  // Calculate final duration (considering trim and cuts)
  const finalDuration = useMemo(() => {
    const trimmedDuration = trimEnd - trimStart;
    const totalCutTime = cuts.reduce((acc, cut) => {
      // Only count cuts that are within the trimmed range
      const cutStart = Math.max(cut.startTime, trimStart);
      const cutEnd = Math.min(cut.endTime, trimEnd);
      if (cutEnd > cutStart) {
        return acc + (cutEnd - cutStart);
      }
      return acc;
    }, 0);
    return Math.max(0, trimmedDuration - totalCutTime);
  }, [cuts, trimStart, trimEnd]);

  // Check if there are any edits
  const hasEdits = useMemo(() => {
    return cuts.length > 0 || trimStart > 0 || trimEnd < originalDuration;
  }, [cuts.length, trimStart, trimEnd, originalDuration]);

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
          setTrimEnd(video.duration); // Initialize trim end to video duration
        }
      }
      setIsLoading(false);
    };

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      video.currentTime = trimStart; // Go back to trim start
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
  }, [videoBlobUrl, originalDuration, trimStart]);

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

  // Playback controls with animation
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setPlayButtonAnimating(true);
    setTimeout(() => setPlayButtonAnimating(false), 300);
    video.paused ? video.play() : video.pause();
  }, []);

  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    // Constrain to trim bounds
    const constrainedTime = Math.max(trimStart, Math.min(time, trimEnd));
    video.currentTime = constrainedTime;
  }, [trimStart, trimEnd]);

  const seekBy = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    const newTime = Math.max(trimStart, Math.min(video.currentTime + delta, trimEnd));
    video.currentTime = newTime;
  }, [trimStart, trimEnd]);

  // Cut management
  const addCutAtPlayhead = useCallback(() => {
    const cutDuration = Math.min(2, originalDuration * 0.1);
    const startTime = Math.max(trimStart, currentTime - cutDuration / 2);
    const endTime = Math.min(trimEnd, startTime + cutDuration);
    
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
  }, [currentTime, cuts, trimStart, trimEnd, originalDuration]);

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
    setTrimStart(0);
    setTrimEnd(originalDuration);
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
    type: DragType,
    cutId?: string
  ) => {
    e.stopPropagation();
    setIsDragging(type);
    setDragStartX(e.clientX);
    if (cutId) {
      setDragCutId(cutId);
      const cut = cuts.find(c => c.id === cutId);
      if (cut) setDragStartCut({ ...cut });
    }
  }, [cuts]);

  const handleTimelineMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const time = (x / rect.width) * originalDuration;
    
    if (isDragging === 'playhead') {
      seekTo(time);
    } else if (isDragging === 'trim-start') {
      const newTrimStart = Math.max(0, Math.min(time, trimEnd - 0.5));
      setTrimStart(newTrimStart);
      // Remove cuts that are now outside trim range
      setCuts(prev => prev.filter(cut => cut.endTime > newTrimStart));
    } else if (isDragging === 'trim-end') {
      const newTrimEnd = Math.min(originalDuration, Math.max(time, trimStart + 0.5));
      setTrimEnd(newTrimEnd);
      // Remove cuts that are now outside trim range
      setCuts(prev => prev.filter(cut => cut.startTime < newTrimEnd));
    } else if (isDragging === 'move' && dragCutId && dragStartCut) {
      // Move the entire cut region
      const deltaX = e.clientX - dragStartX;
      const deltaTime = (deltaX / rect.width) * originalDuration;
      const cutDuration = dragStartCut.endTime - dragStartCut.startTime;
      let newStart = dragStartCut.startTime + deltaTime;
      let newEnd = dragStartCut.endTime + deltaTime;
      
      // Constrain to trim bounds
      if (newStart < trimStart) {
        newStart = trimStart;
        newEnd = trimStart + cutDuration;
      }
      if (newEnd > trimEnd) {
        newEnd = trimEnd;
        newStart = trimEnd - cutDuration;
      }
      
      // Check for overlaps with other cuts
      const otherCuts = cuts.filter(c => c.id !== dragCutId);
      const wouldOverlap = otherCuts.some(cut => 
        (newStart < cut.endTime && newEnd > cut.startTime)
      );
      
      if (!wouldOverlap) {
        updateCut(dragCutId, { startTime: newStart, endTime: newEnd });
      }
    } else if (dragCutId && (isDragging === 'start' || isDragging === 'end')) {
      updateCut(dragCutId, { [isDragging === 'start' ? 'startTime' : 'endTime']: time });
    }
  }, [isDragging, dragCutId, dragStartCut, dragStartX, originalDuration, trimStart, trimEnd, cuts, seekTo, updateCut]);

  const handleTimelineMouseUp = useCallback(() => {
    setIsDragging(null);
    setDragCutId(null);
    setDragStartCut(null);
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
    if (!originalBlobUrl) return;
    
    // Check if there's anything to process
    const hasTrim = trimStart > 0 || trimEnd < originalDuration;
    const hasCuts = cuts.length > 0;
    
    if (!hasTrim && !hasCuts) return;
    
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
      
      // Build segments considering both trim and cuts
      const sortedCuts = [...cuts]
        .filter(cut => cut.startTime < trimEnd && cut.endTime > trimStart)
        .sort((a, b) => a.startTime - b.startTime);
      
      const keepSegments: { start: number; end: number }[] = [];
      let currentStart = trimStart;
      
      for (const cut of sortedCuts) {
        const cutStart = Math.max(cut.startTime, trimStart);
        const cutEnd = Math.min(cut.endTime, trimEnd);
        if (cutStart > currentStart) {
          keepSegments.push({ start: currentStart, end: cutStart });
        }
        currentStart = cutEnd;
      }
      if (currentStart < trimEnd) {
        keepSegments.push({ start: currentStart, end: trimEnd });
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
        // Optimized FFmpeg parameters for faster processing
        await ffmpeg.exec([
          '-ss', String(segment.start),  // Seek before input for faster seeking
          '-i', 'input.webm',
          '-t', String(segment.end - segment.start),
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '23',  // Good quality with reasonable file size
          '-c:a', 'aac',
          '-b:a', '128k',
          '-movflags', '+faststart',
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
      setTrimStart(0);
      setTrimEnd(finalDuration);
      setOriginalDuration(finalDuration);
      setHasAppliedCuts(true);
      setProcessProgress(100);
    } catch (err) {
      console.error('Video processing failed:', err);
      setError('Video-Verarbeitung fehlgeschlagen. Bitte versuche es erneut.');
    } finally {
      setIsProcessing(false);
    }
  }, [originalBlobUrl, cuts, originalDuration, trimStart, trimEnd, finalDuration, loadFFmpeg]);

  // Save
  const handleSave = useCallback(async () => {
    if (hasEdits) {
      await processVideo();
    }
    if (videoBlobUrl) {
      const response = await fetch(videoBlobUrl);
      const blob = await response.blob();
      onSave(blob, hasEdits ? finalDuration : duration);
    }
  }, [hasEdits, videoBlobUrl, processVideo, finalDuration, duration, onSave]);

  // Close
  const handleClose = useCallback(() => {
    if (hasAppliedCuts || hasEdits) {
      setShowCloseWarning(true);
    } else {
      onCancel();
    }
  }, [hasAppliedCuts, hasEdits, onCancel]);

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
            bgcolor: isDark ? '#0f0f0f' : '#fafafa',
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
              <CircularProgress sx={{ color: isDark ? 'white' : 'primary.main' }} />
              <Typography color={isDark ? 'white' : 'text.primary'}>Video wird geladen...</Typography>
            </Stack>
          )}

          {/* Play/Pause Button with Animation */}
          {!isLoading && (
            <Box 
              sx={{ 
                position: 'absolute', 
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <Box 
                sx={{ 
                  width: 72, 
                  height: 72, 
                  borderRadius: '50%', 
                  bgcolor: isPlaying ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.95)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                  opacity: isPlaying ? 0 : 1,
                  transition: 'opacity 0.2s ease, transform 0.2s ease',
                  animation: playButtonAnimating 
                    ? `${clickAnimation} 0.3s ease`
                    : (!isPlaying ? `${pulseAnimation} 2s ease-in-out infinite` : 'none'),
                }}
              >
                {isPlaying ? (
                  <PauseIcon sx={{ fontSize: 40, color: 'white' }} />
                ) : (
                  <PlayIcon sx={{ fontSize: 40, color: '#111', ml: 0.5 }} />
                )}
              </Box>
            </Box>
          )}
        </Box>

        {/* Controls */}
        {!isLoading && (
          <Box sx={{ bgcolor: isDark ? '#1a1a1a' : '#fff', borderTop: '1px solid', borderColor: 'divider' }}>
            {/* Playback Controls - Simplified */}
            <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5} sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Tooltip title="5s zurück">
                <IconButton onClick={() => seekBy(-5)} size="small"><Replay5Icon fontSize="small" /></IconButton>
              </Tooltip>
              <IconButton 
                onClick={togglePlay} 
                sx={{ 
                  bgcolor: 'primary.main', 
                  color: 'white', 
                  '&:hover': { bgcolor: 'primary.dark' }, 
                  width: 40, 
                  height: 40,
                  mx: 0.5,
                }}
              >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </IconButton>
              <Tooltip title="5s vorwärts">
                <IconButton onClick={() => seekBy(5)} size="small"><Forward5Icon fontSize="small" /></IconButton>
              </Tooltip>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', minWidth: 160, textAlign: 'center', color: 'text.secondary', fontSize: '0.8rem' }}>
                {formatTime(currentTime, true)} / {formatTime(originalDuration, true)}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1, borderLeft: '1px solid', borderColor: 'divider', pl: 1 }}>
                <Tooltip title={isMuted ? 'Ton an' : 'Ton aus'}>
                  <IconButton onClick={() => setIsMuted(!isMuted)} size="small">
                    {isMuted ? <VolumeOffIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
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
                  sx={{ width: 60, '& .MuiSlider-thumb': { width: 10, height: 10 } }}
                />
              </Box>
              <Box sx={{ borderLeft: '1px solid', borderColor: 'divider', pl: 1, ml: 0.5 }}>
                <Tooltip title="Abspielgeschwindigkeit">
                  <Button 
                    size="small" 
                    onClick={(e) => setSpeedMenuAnchor(e.currentTarget)}
                    startIcon={<SpeedIcon fontSize="small" />}
                    sx={{ minWidth: 'auto', fontWeight: 600, fontSize: '0.8rem' }}
                  >
                    {playbackRate}x
                  </Button>
                </Tooltip>
                <Menu
                  anchorEl={speedMenuAnchor}
                  open={Boolean(speedMenuAnchor)}
                  onClose={() => setSpeedMenuAnchor(null)}
                  anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                  transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                  {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                    <MenuItem 
                      key={rate} 
                      onClick={() => { setPlaybackRate(rate); setSpeedMenuAnchor(null); }}
                      selected={playbackRate === rate}
                      sx={{ fontSize: '0.875rem', py: 0.5 }}
                    >
                      {rate}x {rate === 1 && '(Normal)'}
                    </MenuItem>
                  ))}
                </Menu>
              </Box>
            </Stack>

            {/* Timeline */}
            <Box sx={{ px: 2, py: 1.5 }}>
              {/* Simplified toolbar - icon buttons only */}
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Tooltip title="Schnitt hinzufügen (C)">
                    <IconButton 
                      onClick={addCutAtPlayhead} 
                      disabled={isProcessing}
                      sx={{ 
                        bgcolor: '#f97316', 
                        color: 'white',
                        '&:hover': { bgcolor: '#ea580c' },
                        '&.Mui-disabled': { bgcolor: 'action.disabledBackground' }
                      }}
                      size="small"
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {selectedCutId && (
                    <Tooltip title="Schnitt löschen (Entf)">
                      <IconButton 
                        onClick={deleteSelectedCut} 
                        disabled={isProcessing} 
                        color="error"
                        size="small"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {hasEdits && (
                    <Tooltip title="Alles zurücksetzen">
                      <IconButton 
                        onClick={resetAllCuts} 
                        disabled={isProcessing}
                        size="small"
                      >
                        <ResetIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                    {hasEdits 
                      ? `Finale Länge: ${formatTime(finalDuration)}` 
                      : ''}
                  </Typography>
                  <Tooltip title="Verkleinern">
                    <IconButton size="small" onClick={() => setTimelineZoom(z => Math.max(0.5, z - 0.25))} disabled={timelineZoom <= 0.5}>
                      <ZoomOutIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Vergrößern">
                    <IconButton size="small" onClick={() => setTimelineZoom(z => Math.min(3, z + 0.25))} disabled={timelineZoom >= 3}>
                      <ZoomInIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
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

                  {/* Trimmed-out regions (areas outside trim range) */}
                  {trimStart > 0 && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: 0,
                        width: `${(trimStart / originalDuration) * 100}%`,
                        top: 0,
                        bottom: 0,
                        bgcolor: isDark ? 'rgba(26, 26, 26, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                        zIndex: 3,
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                  {trimEnd < originalDuration && (
                    <Box
                      sx={{
                        position: 'absolute',
                        right: 0,
                        width: `${((originalDuration - trimEnd) / originalDuration) * 100}%`,
                        top: 0,
                        bottom: 0,
                        bgcolor: isDark ? 'rgba(26, 26, 26, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                        zIndex: 3,
                        pointerEvents: 'none',
                      }}
                    />
                  )}

                  {/* Trim Start Handle */}
                  <Box
                    onMouseDown={(e) => handleTimelineMouseDown(e, 'trim-start')}
                    sx={{
                      position: 'absolute',
                      left: `${(trimStart / originalDuration) * 100}%`,
                      top: 0,
                      bottom: 0,
                      width: 16,
                      transform: 'translateX(-50%)',
                      cursor: 'ew-resize',
                      zIndex: 5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      '&:hover > div': { bgcolor: '#ea580c' },
                    }}
                  >
                    <Box sx={{ 
                      width: 6, 
                      height: '100%', 
                      bgcolor: '#f97316', 
                      borderRadius: '4px 0 0 4px',
                      boxShadow: '-2px 0 4px rgba(0,0,0,0.3)',
                      transition: 'background-color 0.15s',
                    }} />
                  </Box>

                  {/* Trim End Handle */}
                  <Box
                    onMouseDown={(e) => handleTimelineMouseDown(e, 'trim-end')}
                    sx={{
                      position: 'absolute',
                      left: `${(trimEnd / originalDuration) * 100}%`,
                      top: 0,
                      bottom: 0,
                      width: 16,
                      transform: 'translateX(-50%)',
                      cursor: 'ew-resize',
                      zIndex: 5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      '&:hover > div': { bgcolor: '#ea580c' },
                    }}
                  >
                    <Box sx={{ 
                      width: 6, 
                      height: '100%', 
                      bgcolor: '#f97316', 
                      borderRadius: '0 4px 4px 0',
                      boxShadow: '2px 0 4px rgba(0,0,0,0.3)',
                      transition: 'background-color 0.15s',
                    }} />
                  </Box>

                  {/* Cut regions */}
                  {cuts.map((cut) => {
                    const leftPercent = (cut.startTime / originalDuration) * 100;
                    const widthPercent = ((cut.endTime - cut.startTime) / originalDuration) * 100;
                    const isSelected = cut.id === selectedCutId;
                    return (
                      <Box
                        key={cut.id}
                        onClick={(e) => { e.stopPropagation(); setSelectedCutId(cut.id); }}
                        onMouseDown={(e) => { 
                          // If clicking on center (not handles), start move drag
                          const rect = e.currentTarget.getBoundingClientRect();
                          const relX = e.clientX - rect.left;
                          const handleZone = 16;
                          if (relX > handleZone && relX < rect.width - handleZone) {
                            handleTimelineMouseDown(e, 'move', cut.id);
                          }
                        }}
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
                          cursor: 'grab',
                          '&:active': { cursor: 'grabbing' },
                        }}
                      >
                        {/* Start resize handle */}
                        <Box onMouseDown={(e) => handleTimelineMouseDown(e, 'start', cut.id)}
                          sx={{ position: 'absolute', left: -4, top: 0, bottom: 0, width: 12, cursor: 'ew-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                          <Box sx={{ width: 4, height: '60%', bgcolor: 'rgba(255,255,255,0.9)', borderRadius: 1 }} />
                        </Box>
                        {/* End resize handle */}
                        <Box onMouseDown={(e) => handleTimelineMouseDown(e, 'end', cut.id)}
                          sx={{ position: 'absolute', right: -4, top: 0, bottom: 0, width: 12, cursor: 'ew-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                          <Box sx={{ width: 4, height: '60%', bgcolor: 'rgba(255,255,255,0.9)', borderRadius: 1 }} />
                        </Box>
                        {/* Duration label */}
                        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', bgcolor: 'rgba(0,0,0,0.8)', color: 'white', px: 1, py: 0.5, borderRadius: 1, fontSize: '0.65rem', fontWeight: 600, whiteSpace: 'nowrap', pointerEvents: 'none', opacity: isSelected || widthPercent > 5 ? 1 : 0 }}>
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
                <Typography variant="caption" color="text.secondary" fontFamily="monospace" fontSize="0.65rem">0:00</Typography>
                <Typography variant="caption" color="text.secondary" fontFamily="monospace" fontSize="0.65rem">{formatTime(originalDuration / 4)}</Typography>
                <Typography variant="caption" color="text.secondary" fontFamily="monospace" fontSize="0.65rem">{formatTime(originalDuration / 2)}</Typography>
                <Typography variant="caption" color="text.secondary" fontFamily="monospace" fontSize="0.65rem">{formatTime((originalDuration / 4) * 3)}</Typography>
                <Typography variant="caption" color="text.secondary" fontFamily="monospace" fontSize="0.65rem">{formatTime(originalDuration)}</Typography>
              </Stack>
            </Box>

            {/* Actions - Simplified */}
            <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={1} sx={{ px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              {isProcessing && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mr: 'auto' }}>
                  <CircularProgress size={18} sx={{ color: 'primary.main' }} />
                  <Typography variant="caption" color="text.secondary">Verarbeite... {processProgress}%</Typography>
                </Stack>
              )}
              <Button size="small" onClick={handleClose} disabled={isProcessing}>
                Abbrechen
              </Button>
              {hasEdits && (
                <Tooltip title="Schnitte anwenden ohne zu speichern">
                  <Button 
                    variant="outlined" 
                    size="small"
                    onClick={processVideo} 
                    disabled={isProcessing}
                    startIcon={<CutIcon fontSize="small" />}
                  >
                    Anwenden
                  </Button>
                </Tooltip>
              )}
              <Button 
                variant="contained" 
                size="small"
                startIcon={<SaveIcon fontSize="small" />} 
                onClick={handleSave} 
                disabled={isLoading || isProcessing}
              >
                Speichern
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
            {hasEdits
              ? 'Du hast ungespeicherte Änderungen (Trim/Schnitte). Wenn du jetzt schließt, gehen diese verloren.'
              : 'Möchtest du den Editor wirklich schließen?'
            }
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCloseWarning(false)}>Zurück</Button>
          <Button onClick={onCancel} color="error">Schließen</Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
