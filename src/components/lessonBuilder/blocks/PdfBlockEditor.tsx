import { useState, type ChangeEvent } from 'react';
import { Box, Button, Stack, Typography, CircularProgress, Alert } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../../../firebase/firebaseConfig';
import type { ContentBlock } from '../../../types/lessonContent';
import type { UploadContext } from '../LessonContentBuilder';

type Props = {
  block: ContentBlock;
  uploadContext: UploadContext;
  onCommit: (patch: Partial<ContentBlock>) => void;
};

const MAX_MB = 50;

export default function PdfBlockEditor({ block, uploadContext, onCommit }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storagePath = `users/${uploadContext.userId}/courses/${uploadContext.courseId}/lessons/${uploadContext.lessonId}/blocks/${block.id}.pdf`;

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Bitte nur PDF-Dateien hochladen.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Die PDF-Datei ist zu groß. Maximal ${MAX_MB} MB.`);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file, { contentType: 'application/pdf' });
      const url = await getDownloadURL(storageRef);
      onCommit({ pdfUrl: url });
    } catch {
      setError('PDF konnte nicht hochgeladen werden.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('PDF entfernen?')) return;
    try {
      await deleteObject(ref(storage, storagePath)).catch(() => {});
    } finally {
      onCommit({ pdfUrl: '' });
    }
  };

  if (block.pdfUrl) {
    return (
      <Stack spacing={1.5}>
        <Box
          sx={{
            width: '100%',
            height: 480,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <iframe src={block.pdfUrl} title="PDF" style={{ width: '100%', height: '100%', border: 'none' }} />
        </Box>
        <Box>
          <Button color="error" size="small" onClick={handleRemove}>
            PDF entfernen
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
        <PictureAsPdfIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          PDF hochladen (max. {MAX_MB} MB)
        </Typography>
        <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} disabled={uploading}>
          {uploading ? 'Lädt hoch…' : 'PDF auswählen'}
          <input type="file" hidden accept="application/pdf" onChange={handleFile} />
        </Button>
        {uploading && <CircularProgress size={20} sx={{ display: 'block', mx: 'auto', mt: 2 }} />}
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}
