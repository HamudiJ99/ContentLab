import { Box, Stack, TextField, Typography } from '@mui/material';
import { toEmbedUrl, type ContentBlock } from '../../../types/lessonContent';

type Props = {
  block: ContentBlock;
  onChange: (patch: Partial<ContentBlock>) => void;
};

export default function EmbedBlockEditor({ block, onChange }: Props) {
  const embedSrc = toEmbedUrl(block.embedUrl);

  return (
    <Stack spacing={1.5}>
      <TextField
        label="Link (YouTube, Vimeo oder Website)"
        value={block.embedUrl}
        onChange={(e) => onChange({ embedUrl: e.target.value })}
        placeholder="https://www.youtube.com/watch?v=…"
        fullWidth
        size="small"
      />
      {embedSrc ? (
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            pt: '56.25%',
            borderRadius: 2,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <iframe
            src={embedSrc}
            title="Eingebetteter Inhalt"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
          />
        </Box>
      ) : (
        <Typography variant="caption" color="text.secondary">
          Füge einen Link ein, um eine Vorschau zu sehen.
        </Typography>
      )}
    </Stack>
  );
}
