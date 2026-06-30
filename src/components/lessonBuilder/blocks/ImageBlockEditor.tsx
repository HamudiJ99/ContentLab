import { useState, type ChangeEvent } from 'react';
import { Box, Button, Stack, Typography, CircularProgress, Alert, TextField, Slider } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../firebase/firebaseConfig';
import type { ContentBlock } from '../../../types/lessonContent';
import type { UploadContext } from '../LessonContentBuilder';

type Props = {
  block: ContentBlock;
  uploadContext: UploadContext;
  onChange: (patch: Partial<ContentBlock>) => void;
  onCommit: (patch: Partial<ContentBlock>) => void;
};

const MAX_MB = 15;

const extOf = (name: string) => {
  const parts = name.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'img';
};

export default function ImageBlockEditor({ block, uploadContext, onChange, onCommit }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Bitte nur Bilddateien hochladen.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Das Bild ist zu groß. Maximal ${MAX_MB} MB.`);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const path = `users/${uploadContext.userId}/courses/${uploadContext.courseId}/lessons/${uploadContext.lessonId}/blocks/${block.id}.${extOf(file.name)}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);
      onCommit({ imageUrl: url });
    } catch {
      setError('Bild konnte nicht hochgeladen werden.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    if (!window.confirm('Bild entfernen?')) return;
    onCommit({ imageUrl: '', caption: '' });
  };

  if (block.imageUrl) {
    const width = block.imageWidth || 100;
    return (
      <Stack spacing={1.5}>
        <Box sx={{ textAlign: 'center' }}>
          <Box
            component="img"
            src={block.imageUrl}
            alt={block.caption || 'Bild'}
            sx={{ width: `${width}%`, maxWidth: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
          />
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Bildgröße: {width}%
          </Typography>
          <Slider
            value={width}
            min={20}
            max={100}
            step={5}
            onChange={(_, val) => onChange({ imageWidth: Array.isArray(val) ? val[0] : val })}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${v}%`}
          />
        </Box>
        <TextField
          label="Bildunterschrift (optional)"
          value={block.caption}
          onChange={(e) => onChange({ caption: e.target.value })}
          size="small"
          fullWidth
        />
        <Box>
          <Button color="error" size="small" onClick={handleRemove}>
            Bild entfernen
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
        <ImageOutlinedIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Bild hochladen (max. {MAX_MB} MB)
        </Typography>
        <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} disabled={uploading}>
          {uploading ? 'Lädt hoch…' : 'Bild auswählen'}
          <input type="file" hidden accept="image/*" onChange={handleFile} />
        </Button>
        {uploading && <CircularProgress size={20} sx={{ display: 'block', mx: 'auto', mt: 2 }} />}
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}
