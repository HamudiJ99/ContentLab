import { useState, type ChangeEvent } from 'react';
import { Box, Button, Stack, Typography, CircularProgress, Alert } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../firebase/firebaseConfig';
import { formatFileSize, type ContentBlock } from '../../../types/lessonContent';
import type { UploadContext } from '../LessonContentBuilder';

type Props = {
  block: ContentBlock;
  uploadContext: UploadContext;
  onCommit: (patch: Partial<ContentBlock>) => void;
};

const MAX_MB = 200;

const extOf = (name: string) => {
  const parts = name.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'bin';
};

export default function FileBlockEditor({ block, uploadContext, onCommit }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Die Datei ist zu groß. Maximal ${MAX_MB} MB.`);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const path = `users/${uploadContext.userId}/courses/${uploadContext.courseId}/lessons/${uploadContext.lessonId}/blocks/${block.id}.${extOf(file.name)}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file, { contentType: file.type || 'application/octet-stream' });
      const url = await getDownloadURL(storageRef);
      onCommit({ fileUrl: url, fileName: file.name, fileSize: file.size });
    } catch {
      setError('Datei konnte nicht hochgeladen werden.');
    } finally {
      setUploading(false);
    }
  };

  if (block.fileUrl) {
    return (
      <Stack spacing={1.5}>
        <Box
          sx={{
            p: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <InsertDriveFileOutlinedIcon color="primary" />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={600} noWrap>
              {block.fileName || 'Datei'}
            </Typography>
            {block.fileSize > 0 && (
              <Typography variant="caption" color="text.secondary">
                {formatFileSize(block.fileSize)}
              </Typography>
            )}
          </Box>
        </Box>
        <Box>
          <Button
            color="error"
            size="small"
            onClick={() => window.confirm('Datei entfernen?') && onCommit({ fileUrl: '', fileName: '', fileSize: 0 })}
          >
            Datei entfernen
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
        <InsertDriveFileOutlinedIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Datei zum Download hochladen (max. {MAX_MB} MB)
        </Typography>
        <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} disabled={uploading}>
          {uploading ? 'Lädt hoch…' : 'Datei auswählen'}
          <input type="file" hidden onChange={handleFile} />
        </Button>
        {uploading && <CircularProgress size={20} sx={{ display: 'block', mx: 'auto', mt: 2 }} />}
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}
