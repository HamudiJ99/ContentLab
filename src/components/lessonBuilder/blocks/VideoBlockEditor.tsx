import { useState, type ChangeEvent } from 'react';
import {
  Box,
  Button,
  Stack,
  Typography,
  CircularProgress,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import VideocamIcon from '@mui/icons-material/Videocam';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../../../firebase/firebaseConfig';
import { processVideoForStreaming } from '../../../utils/videoProcessing';
import VideoRecorder from '../../VideoRecorder';
import VideoEditor from '../../VideoEditor';
import type { ContentBlock } from '../../../types/lessonContent';
import type { UploadContext } from '../LessonContentBuilder';

type Props = {
  block: ContentBlock;
  uploadContext: UploadContext;
  onCommit: (patch: Partial<ContentBlock>) => void;
};

const MAX_MB = 1000;

const readDuration = (file: Blob): Promise<number> =>
  new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const d = video.duration;
      URL.revokeObjectURL(video.src);
      resolve(Number.isFinite(d) && d > 0 ? Math.round(d) : 0);
    };
    video.onerror = () => resolve(0);
    video.src = URL.createObjectURL(file);
  });

export default function VideoBlockEditor({ block, uploadContext, onCommit }: Props) {
  const [mode, setMode] = useState<'upload' | 'record'>('upload');
  const [showRecorder, setShowRecorder] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const storagePath = `users/${uploadContext.userId}/courses/${uploadContext.courseId}/lessons/${uploadContext.lessonId}/blocks/${block.id}.mp4`;

  // alreadyProcessed=true: Blob ist bereits ein streamfähiges MP4 (z. B. aus dem VideoEditor)
  // und muss nicht erneut transkodiert werden.
  const uploadBlob = async (source: Blob, knownDuration?: number, alreadyProcessed = false) => {
    setError(null);
    setBusy(true);
    try {
      const duration = knownDuration ?? (await readDuration(source));
      let toUpload = source;
      if (!alreadyProcessed) {
        setProcessing(true);
        setProgress(0);
        toUpload = await processVideoForStreaming(source, setProgress);
        setProcessing(false);
      }
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, toUpload, {
        contentType: 'video/mp4',
        cacheControl: 'public, max-age=31536000',
      });
      const url = await getDownloadURL(storageRef);
      onCommit({ videoUrl: url, videoDuration: duration });
    } catch {
      setError('Video konnte nicht verarbeitet werden.');
    } finally {
      setBusy(false);
      setProcessing(false);
    }
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setError('Bitte nur Video-Dateien hochladen.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Die Video-Datei ist zu groß. Maximal ${MAX_MB} MB.`);
      return;
    }
    await uploadBlob(file);
  };

  const handleRemove = async () => {
    if (!window.confirm('Video entfernen?')) return;
    try {
      await deleteObject(ref(storage, storagePath)).catch(() => {});
    } finally {
      onCommit({ videoUrl: '', videoDuration: 0 });
    }
  };

  if (block.videoUrl) {
    return (
      <Stack spacing={1.5}>
        <Box
          sx={{
            width: '100%',
            maxHeight: 460,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            overflow: 'hidden',
            bgcolor: 'background.default',
          }}
        >
          <video src={block.videoUrl} controls preload="metadata" style={{ width: '100%', display: 'block' }} />
        </Box>
        {busy && (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              {processing ? `Wird optimiert… ${progress}%` : 'Wird gespeichert…'}
            </Typography>
          </Stack>
        )}
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ContentCutIcon />}
            onClick={() => setShowEditor(true)}
            disabled={busy}
          >
            Schneiden
          </Button>
          <Button color="error" size="small" onClick={handleRemove} disabled={busy}>
            Video entfernen
          </Button>
        </Stack>
        {showEditor && (
          <VideoEditor
            videoUrl={block.videoUrl}
            onSave={(blob, duration) => {
              setShowEditor(false);
              void uploadBlob(blob, Math.round(duration), true);
            }}
            onCancel={() => setShowEditor(false)}
          />
        )}
      </Stack>
    );
  }

  if (busy) {
    return (
      <Stack alignItems="center" spacing={1} sx={{ py: 3 }}>
        <CircularProgress size={28} />
        <Typography variant="body2" color="text.secondary">
          {processing ? `Wird optimiert… ${progress}%` : 'Wird hochgeladen…'}
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={1.5}>
      <ToggleButtonGroup
        value={mode}
        exclusive
        size="small"
        onChange={(_, val) => val && setMode(val)}
        fullWidth
      >
        <ToggleButton value="upload">
          <UploadFileIcon fontSize="small" sx={{ mr: 1 }} /> Hochladen
        </ToggleButton>
        <ToggleButton value="record">
          <VideocamIcon fontSize="small" sx={{ mr: 1 }} /> Aufnehmen
        </ToggleButton>
      </ToggleButtonGroup>

      {mode === 'upload' ? (
        <Box
          sx={{
            p: 3,
            border: '2px dashed',
            borderColor: 'divider',
            borderRadius: 2,
            textAlign: 'center',
            bgcolor: 'background.default',
          }}
        >
          <PlayCircleOutlineIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Video hochladen (max. {MAX_MB} MB)
          </Typography>
          <Button variant="outlined" component="label" startIcon={<UploadFileIcon />}>
            Video auswählen
            <input type="file" hidden accept="video/*" onChange={handleFile} />
          </Button>
        </Box>
      ) : (
        <Box
          sx={{
            p: 3,
            border: '2px dashed',
            borderColor: 'divider',
            borderRadius: 2,
            textAlign: 'center',
            bgcolor: 'background.default',
          }}
        >
          <VideocamIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Mit Webcam oder Bildschirm aufnehmen.
          </Typography>
          <Button variant="contained" startIcon={<VideocamIcon />} onClick={() => setShowRecorder(true)}>
            Aufnahme starten
          </Button>
        </Box>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {showRecorder && (
        <VideoRecorder
          onSave={(blob, duration) => {
            setShowRecorder(false);
            void uploadBlob(blob, Math.round(duration));
          }}
          onCancel={() => setShowRecorder(false)}
        />
      )}
    </Stack>
  );
}
