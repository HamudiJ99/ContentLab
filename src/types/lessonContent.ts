import { v4 as uuidv4 } from 'uuid';

// Block-basiertes Lektions-Modell (Baukasten). Eine Lektion besteht aus einer
// geordneten Liste von Inhaltsblöcken. Gespeichert als Feld `blocks` am Lektions-Dokument.
// Firestore akzeptiert kein `undefined` – daher leere Strings / 0 als Defaults.

export type ContentBlockType =
  | 'text'
  | 'image'
  | 'video'
  | 'pdf'
  | 'audio'
  | 'file'
  | 'embed'
  | 'divider';

export interface ContentBlock {
  id: string;
  type: ContentBlockType;
  html: string; // text
  imageUrl: string; // image
  caption: string; // image (Bildunterschrift)
  imageWidth: number; // image (Breite in Prozent, 20–100)
  videoUrl: string; // video
  videoDuration: number; // video (Sekunden)
  pdfUrl: string; // pdf
  audioUrl: string; // audio
  fileUrl: string; // file (Download)
  fileName: string; // file
  fileSize: number; // file (Bytes)
  embedUrl: string; // embed (iframe-URL)
}

export const contentBlockMeta: Record<ContentBlockType, { label: string; description: string }> = {
  text: { label: 'Text', description: 'Formatierter Text, Überschriften, Listen' },
  image: { label: 'Bild', description: 'Bild hochladen mit optionaler Bildunterschrift' },
  video: { label: 'Video', description: 'Video hochladen oder aufnehmen' },
  pdf: { label: 'PDF', description: 'PDF-Dokument einbetten' },
  audio: { label: 'Audio', description: 'Audiodatei hochladen' },
  file: { label: 'Datei / Download', description: 'Beliebige Datei zum Herunterladen' },
  embed: { label: 'Einbetten', description: 'YouTube, Vimeo oder Website per Link' },
  divider: { label: 'Trenner', description: 'Optische Trennlinie zwischen Inhalten' },
};

// Reihenfolge im "Inhalt hinzufügen"-Bereich.
export const contentBlockOrder: ContentBlockType[] = [
  'text',
  'image',
  'video',
  'pdf',
  'audio',
  'file',
  'embed',
  'divider',
];

export const createBlock = (type: ContentBlockType, init: Partial<ContentBlock> = {}): ContentBlock => ({
  id: init.id ?? uuidv4(),
  type,
  html: init.html ?? '',
  imageUrl: init.imageUrl ?? '',
  caption: init.caption ?? '',
  imageWidth: init.imageWidth ?? 100,
  videoUrl: init.videoUrl ?? '',
  videoDuration: init.videoDuration ?? 0,
  pdfUrl: init.pdfUrl ?? '',
  audioUrl: init.audioUrl ?? '',
  fileUrl: init.fileUrl ?? '',
  fileName: init.fileName ?? '',
  fileSize: init.fileSize ?? 0,
  embedUrl: init.embedUrl ?? '',
});

const ALL_TYPES: ContentBlockType[] = contentBlockOrder;

const normalizeBlock = (raw: unknown): ContentBlock => {
  const b = (raw ?? {}) as Partial<ContentBlock>;
  const type: ContentBlockType = ALL_TYPES.includes(b.type as ContentBlockType)
    ? (b.type as ContentBlockType)
    : 'text';
  return createBlock(type, {
    id: typeof b.id === 'string' ? b.id : undefined,
    html: typeof b.html === 'string' ? b.html : '',
    imageUrl: typeof b.imageUrl === 'string' ? b.imageUrl : '',
    caption: typeof b.caption === 'string' ? b.caption : '',
    imageWidth: typeof b.imageWidth === 'number' ? b.imageWidth : 100,
    videoUrl: typeof b.videoUrl === 'string' ? b.videoUrl : '',
    videoDuration: typeof b.videoDuration === 'number' ? b.videoDuration : 0,
    pdfUrl: typeof b.pdfUrl === 'string' ? b.pdfUrl : '',
    audioUrl: typeof b.audioUrl === 'string' ? b.audioUrl : '',
    fileUrl: typeof b.fileUrl === 'string' ? b.fileUrl : '',
    fileName: typeof b.fileName === 'string' ? b.fileName : '',
    fileSize: typeof b.fileSize === 'number' ? b.fileSize : 0,
    embedUrl: typeof b.embedUrl === 'string' ? b.embedUrl : '',
  });
};

export const normalizeBlocks = (raw: unknown): ContentBlock[] =>
  Array.isArray(raw) ? raw.map(normalizeBlock) : [];

// Rohdaten eines Lektions-Dokuments.
type LessonLike = {
  blocks?: unknown;
  type?: string;
  content?: string;
  videoUrl?: string;
  videoDuration?: number;
  pdfUrl?: string;
};

// Liefert die Blockliste – aus `blocks` oder (für Alt-Lektionen ohne `blocks`)
// rekonstruiert aus den früheren Einzelfeldern (type/content/videoUrl/pdfUrl).
export const resolveBlocks = (data: LessonLike): ContentBlock[] => {
  if (Array.isArray(data.blocks)) {
    return normalizeBlocks(data.blocks);
  }
  const blocks: ContentBlock[] = [];
  if (data.type === 'video' && data.videoUrl) {
    blocks.push(createBlock('video', { videoUrl: data.videoUrl, videoDuration: data.videoDuration ?? 0 }));
  }
  if (data.type === 'pdf' && data.pdfUrl) {
    blocks.push(createBlock('pdf', { pdfUrl: data.pdfUrl }));
  }
  if (typeof data.content === 'string' && data.content.trim()) {
    blocks.push(createBlock('text', { html: data.content }));
  }
  return blocks;
};

export const blocksTotalDuration = (blocks: ContentBlock[]): number =>
  blocks.reduce((sum, b) => sum + (b.type === 'video' ? b.videoDuration : 0), 0);

export const blockHasContent = (b: ContentBlock): boolean => {
  switch (b.type) {
    case 'text':
      return b.html.trim().length > 0;
    case 'image':
      return b.imageUrl.length > 0;
    case 'video':
      return b.videoUrl.length > 0;
    case 'pdf':
      return b.pdfUrl.length > 0;
    case 'audio':
      return b.audioUrl.length > 0;
    case 'file':
      return b.fileUrl.length > 0;
    case 'embed':
      return b.embedUrl.length > 0;
    case 'divider':
      return true;
    default:
      return false;
  }
};

// Kurzbeschreibung für den eingeklappten Block-Header.
export const blockSummary = (b: ContentBlock): string => {
  switch (b.type) {
    case 'text': {
      const text = b.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      return text ? (text.length > 80 ? `${text.slice(0, 80)}…` : text) : 'Leerer Text';
    }
    case 'image':
      return b.caption || (b.imageUrl ? 'Bild hochgeladen' : 'Kein Bild');
    case 'video':
      return b.videoUrl ? 'Video vorhanden' : 'Kein Video';
    case 'pdf':
      return b.pdfUrl ? 'PDF vorhanden' : 'Kein PDF';
    case 'audio':
      return b.audioUrl ? 'Audio vorhanden' : 'Kein Audio';
    case 'file':
      return b.fileName || (b.fileUrl ? 'Datei vorhanden' : 'Keine Datei');
    case 'embed':
      return b.embedUrl || 'Kein Link';
    case 'divider':
      return 'Trennlinie';
    default:
      return '';
  }
};

export const formatFileSize = (bytes: number): string => {
  if (bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

// Wandelt gängige Video-/Seiten-Links in eine einbettbare iframe-URL um.
export const toEmbedUrl = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed) return '';
  // YouTube
  const yt = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  // Vimeo
  const vimeo = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  // sonst Original-URL (z. B. bereits Embed-Link oder andere Seite)
  return trimmed;
};
