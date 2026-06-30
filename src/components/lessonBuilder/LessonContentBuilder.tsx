import { useState } from 'react';
import {
  Box,
  Stack,
  Card,
  CardContent,
  Typography,
  IconButton,
  Tooltip,
  Divider,
  Collapse,
  Paper,
  ButtonBase,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import LinkIcon from '@mui/icons-material/Link';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  createBlock,
  contentBlockMeta,
  contentBlockOrder,
  blockSummary,
  type ContentBlock,
  type ContentBlockType,
} from '../../types/lessonContent';
import { isConfirmDeleteEnabled } from '../../utils/preferences';
import TextBlockEditor from './blocks/TextBlockEditor';
import ImageBlockEditor from './blocks/ImageBlockEditor';
import PdfBlockEditor from './blocks/PdfBlockEditor';
import VideoBlockEditor from './blocks/VideoBlockEditor';
import AudioBlockEditor from './blocks/AudioBlockEditor';
import FileBlockEditor from './blocks/FileBlockEditor';
import EmbedBlockEditor from './blocks/EmbedBlockEditor';

export type UploadContext = { userId: string; courseId: string; lessonId: string };

type Props = {
  blocks: ContentBlock[];
  uploadContext: UploadContext;
  onChange: (blocks: ContentBlock[]) => void; // wird beim "Speichern" persistiert
  onPersist: (blocks: ContentBlock[]) => void; // sofort speichern (nach Medien-Upload)
};

const blockIcon: Record<ContentBlockType, React.ReactNode> = {
  text: <ArticleOutlinedIcon fontSize="small" />,
  image: <ImageOutlinedIcon fontSize="small" />,
  video: <PlayCircleOutlineIcon fontSize="small" />,
  pdf: <PictureAsPdfOutlinedIcon fontSize="small" />,
  audio: <AudiotrackIcon fontSize="small" />,
  file: <InsertDriveFileOutlinedIcon fontSize="small" />,
  embed: <LinkIcon fontSize="small" />,
  divider: <HorizontalRuleIcon fontSize="small" />,
};

const PALETTE_PREFIX = 'new:';
const DROP_END = 'list-end';

export default function LessonContentBuilder({ blocks, uploadContext, onChange, onPersist }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [activeDrag, setActiveDrag] = useState<{ label: string; icon: React.ReactNode } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const patchBlock = (id: string, patch: Partial<ContentBlock>) =>
    blocks.map((b) => (b.id === id ? { ...b, ...patch } : b));

  const handleChange = (id: string, patch: Partial<ContentBlock>) => onChange(patchBlock(id, patch));
  const handleCommit = (id: string, patch: Partial<ContentBlock>) => onPersist(patchBlock(id, patch));
  const handleDelete = (id: string) => onChange(blocks.filter((b) => b.id !== id));

  const requestDelete = (id: string) => {
    if (isConfirmDeleteEnabled()) {
      setPendingDelete(id);
    } else {
      handleDelete(id);
    }
  };

  const confirmDelete = () => {
    if (pendingDelete) handleDelete(pendingDelete);
    setPendingDelete(null);
  };

  const expand = (id: string) =>
    setCollapsed((prev) => {
      const s = new Set(prev);
      s.delete(id);
      return s;
    });

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  const addBlock = (type: ContentBlockType, index?: number) => {
    const nb = createBlock(type);
    const at = index === undefined ? blocks.length : Math.max(0, Math.min(index, blocks.length));
    onChange([...blocks.slice(0, at), nb, ...blocks.slice(at)]);
    expand(nb.id);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    if (id.startsWith(PALETTE_PREFIX)) {
      const type = id.slice(PALETTE_PREFIX.length) as ContentBlockType;
      setActiveDrag({ label: contentBlockMeta[type].label, icon: blockIcon[type] });
    } else {
      const b = blocks.find((x) => x.id === id);
      if (b) setActiveDrag({ label: contentBlockMeta[b.type].label, icon: blockIcon[b.type] });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    const activeId = String(active.id);
    const overId = over ? String(over.id) : null;

    // Neuer Block aus der Palette
    if (activeId.startsWith(PALETTE_PREFIX)) {
      const type = activeId.slice(PALETTE_PREFIX.length) as ContentBlockType;
      const index =
        overId && overId !== DROP_END ? blocks.findIndex((b) => b.id === overId) : blocks.length;
      addBlock(type, index < 0 ? blocks.length : index);
      return;
    }

    // Bestehenden Block umsortieren
    if (!overId || activeId === overId) return;
    const oldIndex = blocks.findIndex((b) => b.id === activeId);
    const newIndex = overId === DROP_END ? blocks.length - 1 : blocks.findIndex((b) => b.id === overId);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(blocks, oldIndex, newIndex));
  };

  return (
    <>
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <Stack spacing={2}>
        <DropArea hasBlocks={blocks.length > 0}>
          {blocks.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                Inhalt aufbauen
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Ziehe unten einen Baustein hierher – oder klicke ihn an. Blöcke lassen sich per Drag & Drop
                sortieren und zum Aufräumen einklappen.
              </Typography>
            </Box>
          ) : (
            <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <Stack spacing={2}>
                {blocks.map((block, index) => (
                  <SortableBlock
                    key={block.id}
                    block={block}
                    index={index}
                    expanded={!collapsed.has(block.id)}
                    uploadContext={uploadContext}
                    onToggle={() => toggleCollapse(block.id)}
                    onChange={(patch) => handleChange(block.id, patch)}
                    onCommit={(patch) => handleCommit(block.id, patch)}
                    onDelete={() => requestDelete(block.id)}
                  />
                ))}
              </Stack>
            </SortableContext>
          )}
        </DropArea>

        {/* Palette */}
        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper' }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Inhalt hinzufügen — ziehen oder klicken
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            {contentBlockOrder.map((type) => (
              <PaletteItem key={type} type={type} onClick={() => addBlock(type)} />
            ))}
          </Box>
        </Box>
      </Stack>

      <DragOverlay>
        {activeDrag ? (
          <Paper
            elevation={6}
            sx={{ px: 2, py: 1, display: 'inline-flex', alignItems: 'center', gap: 1, borderRadius: 2 }}
          >
            {activeDrag.icon}
            <Typography fontWeight={600}>{activeDrag.label}</Typography>
          </Paper>
        ) : null}
      </DragOverlay>
    </DndContext>

    <Dialog open={pendingDelete !== null} onClose={() => setPendingDelete(null)}>
      <DialogTitle>Block löschen?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Möchtest du diesen Baustein wirklich löschen? Das kann nicht rückgängig gemacht werden.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setPendingDelete(null)}>Abbrechen</Button>
        <Button onClick={confirmDelete} color="error" variant="contained" autoFocus>
          Löschen
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}

function DropArea({ hasBlocks, children }: { hasBlocks: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: DROP_END });
  return (
    <Box
      ref={setNodeRef}
      sx={{
        borderRadius: 3,
        border: hasBlocks ? 'none' : '2px dashed',
        borderColor: isOver ? 'primary.main' : 'divider',
        bgcolor: hasBlocks ? 'transparent' : isOver ? (t) => t.palette.action.hover : 'background.default',
        transition: 'background-color 0.15s ease, border-color 0.15s ease',
        outline: hasBlocks && isOver ? '2px dashed' : 'none',
        outlineColor: 'primary.main',
        outlineOffset: 4,
        minHeight: hasBlocks ? 0 : 160,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      {children}
    </Box>
  );
}

function PaletteItem({ type, onClick }: { type: ContentBlockType; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `${PALETTE_PREFIX}${type}` });
  return (
    <ButtonBase
      ref={setNodeRef}
      onClick={onClick}
      focusRipple
      sx={{
        flex: { xs: '1 1 100%', sm: '1 1 30%', md: '1 1 23%' },
        minWidth: 150,
        justifyContent: 'flex-start',
        gap: 1,
        p: 1.25,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        textAlign: 'left',
        opacity: isDragging ? 0.4 : 1,
        cursor: 'grab',
        transition: 'border-color 0.15s ease, background-color 0.15s ease',
        '&:hover': { borderColor: 'primary.main', bgcolor: (t) => t.palette.action.hover },
      }}
      {...attributes}
      {...listeners}
    >
      <Box sx={{ color: 'primary.main', display: 'inline-flex' }}>{blockIcon[type]}</Box>
      <Box sx={{ overflow: 'hidden' }}>
        <Typography fontWeight={600} noWrap>
          {contentBlockMeta[type].label}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'normal' }}>
          {contentBlockMeta[type].description}
        </Typography>
      </Box>
    </ButtonBase>
  );
}

type SortableBlockProps = {
  block: ContentBlock;
  index: number;
  expanded: boolean;
  uploadContext: UploadContext;
  onToggle: () => void;
  onChange: (patch: Partial<ContentBlock>) => void;
  onCommit: (patch: Partial<ContentBlock>) => void;
  onDelete: () => void;
};

function SortableBlock({
  block,
  index,
  expanded,
  uploadContext,
  onToggle,
  onChange,
  onCommit,
  onDelete,
}: SortableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  return (
    <Card
      ref={setNodeRef}
      variant="outlined"
      style={{ transform: CSS.Transform.toString(transform), transition }}
      sx={{ opacity: isDragging ? 0.6 : 1 }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 1.5, py: 1, cursor: 'pointer' }}
        onClick={onToggle}
      >
        <Tooltip title="Ziehen zum Sortieren">
          <IconButton
            size="small"
            sx={{ cursor: 'grab', touchAction: 'none' }}
            onClick={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <DragIndicatorIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Box sx={{ color: 'primary.main', display: 'inline-flex' }}>{blockIcon[block.type]}</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap>
            {index + 1}. {contentBlockMeta[block.type].label}
          </Typography>
          {!expanded && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {blockSummary(block)}
            </Typography>
          )}
        </Box>
        <Tooltip title="Block löschen">
          <IconButton
            size="small"
            color="error"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Stack>

      <Collapse in={expanded} unmountOnExit>
        <CardContent sx={{ pt: 0 }}>
          <Divider sx={{ mb: 2 }} />
          {block.type === 'text' && <TextBlockEditor block={block} onChange={onChange} />}
          {block.type === 'image' && (
            <ImageBlockEditor block={block} uploadContext={uploadContext} onChange={onChange} onCommit={onCommit} />
          )}
          {block.type === 'video' && (
            <VideoBlockEditor block={block} uploadContext={uploadContext} onCommit={onCommit} />
          )}
          {block.type === 'pdf' && (
            <PdfBlockEditor block={block} uploadContext={uploadContext} onCommit={onCommit} />
          )}
          {block.type === 'audio' && (
            <AudioBlockEditor block={block} uploadContext={uploadContext} onCommit={onCommit} />
          )}
          {block.type === 'file' && (
            <FileBlockEditor block={block} uploadContext={uploadContext} onCommit={onCommit} />
          )}
          {block.type === 'embed' && <EmbedBlockEditor block={block} onChange={onChange} />}
          {block.type === 'divider' && (
            <Typography variant="caption" color="text.secondary">
              Wird im Kurs als Trennlinie angezeigt.
            </Typography>
          )}
        </CardContent>
      </Collapse>
    </Card>
  );
}
