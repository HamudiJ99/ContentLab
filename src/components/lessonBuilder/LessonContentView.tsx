import { Box, Card, CardContent, Stack, Alert, Typography, Divider, Button } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { toEmbedUrl, formatFileSize, type ContentBlock } from '../../types/lessonContent';

type Props = {
  blocks: ContentBlock[];
};

const richTextSx = {
  '& p': { margin: '0.5em 0' },
  '& h1': { fontSize: '2em', fontWeight: 700, margin: '0.67em 0' },
  '& h2': { fontSize: '1.5em', fontWeight: 700, margin: '0.75em 0' },
  '& h3': { fontSize: '1.17em', fontWeight: 700, margin: '0.83em 0' },
  '& ul, & ol': { paddingLeft: '1.5em', margin: '0.5em 0' },
  '& img': { maxWidth: '100%', height: 'auto', borderRadius: 1 },
  '& a': { color: 'primary.main' },
  '& blockquote': {
    borderLeft: '3px solid',
    borderColor: 'divider',
    paddingLeft: '1em',
    marginLeft: 0,
    fontStyle: 'italic',
    color: 'text.secondary',
  },
  '& code': { bgcolor: 'action.hover', padding: '0.2em 0.4em', borderRadius: '3px', fontFamily: 'monospace' },
  '& pre': {
    bgcolor: 'action.hover',
    padding: '1em',
    borderRadius: '4px',
    overflow: 'auto',
    '& code': { bgcolor: 'transparent', padding: 0 },
  },
} as const;

export default function LessonContentView({ blocks }: Props) {
  if (blocks.length === 0) {
    return <Alert severity="info">Diese Lektion enthält noch keinen Inhalt.</Alert>;
  }

  return (
    <Stack spacing={3}>
      {blocks.map((block) => {
        switch (block.type) {
          case 'text':
            if (!block.html.trim()) return null;
            return (
              <Card key={block.id}>
                <CardContent sx={{ p: { xs: 2, md: 4 } }}>
                  <Box sx={richTextSx} dangerouslySetInnerHTML={{ __html: block.html }} />
                </CardContent>
              </Card>
            );

          case 'image':
            if (!block.imageUrl) return null;
            return (
              <Box key={block.id}>
                <Box
                  component="img"
                  src={block.imageUrl}
                  alt={block.caption || 'Bild'}
                  sx={{ width: `${block.imageWidth || 100}%`, maxWidth: '100%', borderRadius: 2, display: 'block', mx: 'auto' }}
                />
                {block.caption && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                    {block.caption}
                  </Typography>
                )}
              </Box>
            );

          case 'video':
            if (!block.videoUrl) return null;
            return (
              <Card key={block.id}>
                <Box sx={{ width: '100%', bgcolor: 'background.default' }}>
                  <video
                    src={block.videoUrl}
                    controls
                    preload="metadata"
                    style={{ width: '100%', display: 'block', maxHeight: 640 }}
                  />
                </Box>
              </Card>
            );

          case 'pdf':
            if (!block.pdfUrl) return null;
            return (
              <Card key={block.id}>
                <Box sx={{ width: '100%', height: { xs: 480, md: 640 } }}>
                  <iframe src={block.pdfUrl} title="PDF" style={{ width: '100%', height: '100%', border: 'none' }} />
                </Box>
              </Card>
            );

          case 'audio':
            if (!block.audioUrl) return null;
            return (
              <Card key={block.id}>
                <CardContent>
                  <audio src={block.audioUrl} controls style={{ width: '100%' }} />
                </CardContent>
              </Card>
            );

          case 'file':
            if (!block.fileUrl) return null;
            return (
              <Card key={block.id}>
                <CardContent>
                  <Stack direction="row" spacing={2} alignItems="center">
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
                    <Button
                      variant="outlined"
                      startIcon={<DownloadIcon />}
                      component="a"
                      href={block.fileUrl}
                      target="_blank"
                      rel="noopener"
                    >
                      Download
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            );

          case 'embed': {
            const src = toEmbedUrl(block.embedUrl);
            if (!src) return null;
            return (
              <Card key={block.id}>
                <Box sx={{ position: 'relative', width: '100%', pt: '56.25%' }}>
                  <iframe
                    src={src}
                    title="Eingebetteter Inhalt"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                  />
                </Box>
              </Card>
            );
          }

          case 'divider':
            return <Divider key={block.id} />;

          default:
            return null;
        }
      })}
    </Stack>
  );
}
