import { useState, type ChangeEvent } from 'react';
import { Box, Button, Stack, Typography, CircularProgress, Alert } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../firebase/firebaseConfig';
import type { ContentBlock } from '../../../types/lessonContent';
import type { UploadContext } from '../LessonContentBuilder';

type Props = {
  block: ContentBlock;
  uploadContext: UploadContext;
  onCommit: (patch: Partial<ContentBlock>) => void;
};

const MAX_MB = 100;

const extOf = (name: string) => {
  const parts = name.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'mp3';
};

export default function AudioBlockEditor({ block, uploadContext, onCommit }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      setError('Bitte nur Audiodateien hochladen.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Die Audiodatei ist zu groß. Maximal ${MAX_MB} MB.`);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const path = `users/${uploadContext.userId}/courses/${uploadContext.courseId}/lessons/${uploadContext.lessonId}/blocks/${block.id}.${extOf(file.name)}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);
      onCommit({ audioUrl: url });
    } catch {
      setError('Audiodatei konnte nicht hochgeladen werden.');
    } finally {
      setUploading(false);
    }
  };

  if (block.audioUrl) {
    return (
      <Stack spacing={1.5}>
        <audio src={block.audioUrl} controls style={{ width: '100%' }} />
        <Box>
          <Button color="error" size="small" onClick={() => window.confirm('Audio entfernen?') && onCommit({ audioUrl: '' })}>
            Audio entfernen
          </Button>
        </Box>
      </Stack>
    );
  }

  return (
    <Stack spacing={1.5}>
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
        <AudiotrackIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Audiodatei hochladen (max. {MAX_MB} MB)
        </Typography>
        <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} disabled={uploading}>
          {uploading ? 'Lädt hoch…' : 'Audio auswählen'}
          <input type="file" hidden accept="audio/*" onChange={handleFile} />
        </Button>
        {uploading && <CircularProgress size={20} sx={{ display: 'block', mx: 'auto', mt: 2 }} />}
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}
