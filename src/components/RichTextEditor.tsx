import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Box, IconButton, Paper, Stack, Divider, ToggleButton, ToggleButtonGroup, Select, MenuItem } from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import FormatStrikethroughIcon from '@mui/icons-material/FormatStrikethrough';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import FormatAlignJustifyIcon from '@mui/icons-material/FormatAlignJustify';
import CodeIcon from '@mui/icons-material/Code';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';

type RichTextEditorProps = {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  minHeight?: number;
};

export default function RichTextEditor({ content, onChange, placeholder = 'Text eingeben...', minHeight = 300 }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        strike: {
          HTMLAttributes: {
            class: 'strike-through',
          },
        },
      }),
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl focus:outline-none',
        style: `min-height: ${minHeight}px; padding: 16px;`,
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const colorOptions = [
    { value: '#000000', label: 'Schwarz' },
    { value: '#ef4444', label: 'Rot' },
    { value: '#f97316', label: 'Orange' },
    { value: '#eab308', label: 'Gelb' },
    { value: '#22c55e', label: 'Grün' },
    { value: '#3b82f6', label: 'Blau' },
    { value: '#8b5cf6', label: 'Lila' },
    { value: '#ec4899', label: 'Pink' },
  ];

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      {/* Toolbar */}
      <Box sx={{ p: 1, bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {/* Text Style */}
          <Select
            size="small"
            value={
              editor.isActive('heading', { level: 1 }) ? 'h1' :
              editor.isActive('heading', { level: 2 }) ? 'h2' :
              editor.isActive('heading', { level: 3 }) ? 'h3' :
              'paragraph'
            }
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'paragraph') {
                editor.chain().focus().setParagraph().run();
              } else if (value === 'h1') {
                editor.chain().focus().toggleHeading({ level: 1 }).run();
              } else if (value === 'h2') {
                editor.chain().focus().toggleHeading({ level: 2 }).run();
              } else if (value === 'h3') {
                editor.chain().focus().toggleHeading({ level: 3 }).run();
              }
            }}
            sx={{ minWidth: 120 }}
          >
            <MenuItem value="paragraph">Normal</MenuItem>
            <MenuItem value="h1">Überschrift 1</MenuItem>
            <MenuItem value="h2">Überschrift 2</MenuItem>
            <MenuItem value="h3">Überschrift 3</MenuItem>
          </Select>

          <Divider orientation="vertical" flexItem />

          {/* Text Formatting */}
          <ToggleButtonGroup size="small" value={[]}>
            <ToggleButton
              value="bold"
              selected={editor.isActive('bold')}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <FormatBoldIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton
              value="italic"
              selected={editor.isActive('italic')}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <FormatItalicIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton
              value="underline"
              selected={editor.isActive('underline')}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
              <FormatUnderlinedIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton
              value="strike"
              selected={editor.isActive('strike')}
              onClick={() => editor.chain().focus().toggleStrike().run()}
            >
              <FormatStrikethroughIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>

          <Divider orientation="vertical" flexItem />

          {/* Text Color */}
          <Select
            size="small"
            value={editor.getAttributes('textStyle').color || '#000000'}
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            sx={{ minWidth: 100 }}
            renderValue={(value) => (
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ width: 16, height: 16, bgcolor: value, border: 1, borderColor: 'divider', borderRadius: 0.5 }} />
                <span>Farbe</span>
              </Stack>
            )}
          >
            {colorOptions.map((color) => (
              <MenuItem key={color.value} value={color.value}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 16, height: 16, bgcolor: color.value, border: 1, borderColor: 'divider' }} />
                  <span>{color.label}</span>
                </Stack>
              </MenuItem>
            ))}
          </Select>

          <Divider orientation="vertical" flexItem />

          {/* Alignment */}
          <ToggleButtonGroup size="small" value={[]}>
            <ToggleButton
              value="left"
              selected={editor.isActive({ textAlign: 'left' })}
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
            >
              <FormatAlignLeftIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton
              value="center"
              selected={editor.isActive({ textAlign: 'center' })}
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
            >
              <FormatAlignCenterIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton
              value="right"
              selected={editor.isActive({ textAlign: 'right' })}
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
            >
              <FormatAlignRightIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton
              value="justify"
              selected={editor.isActive({ textAlign: 'justify' })}
              onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            >
              <FormatAlignJustifyIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>

          <Divider orientation="vertical" flexItem />

          {/* Lists */}
          <ToggleButtonGroup size="small" value={[]}>
            <ToggleButton
              value="bullet"
              selected={editor.isActive('bulletList')}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <FormatListBulletedIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton
              value="ordered"
              selected={editor.isActive('orderedList')}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <FormatListNumberedIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>

          <Divider orientation="vertical" flexItem />

          {/* Other */}
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            color={editor.isActive('blockquote') ? 'primary' : 'default'}
          >
            <FormatQuoteIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            color={editor.isActive('codeBlock') ? 'primary' : 'default'}
          >
            <CodeIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      {/* Editor */}
      <Box
        sx={{
          '& .ProseMirror': {
            minHeight: `${minHeight}px`,
            p: 2,
            '&:focus': {
              outline: 'none',
            },
            '& p': {
              margin: '0.5em 0',
            },
            '& h1': {
              fontSize: '2em',
              fontWeight: 700,
              margin: '0.67em 0',
            },
            '& h2': {
              fontSize: '1.5em',
              fontWeight: 700,
              margin: '0.75em 0',
            },
            '& h3': {
              fontSize: '1.17em',
              fontWeight: 700,
              margin: '0.83em 0',
            },
            '& ul, & ol': {
              paddingLeft: '1.5em',
              margin: '0.5em 0',
            },
            '& blockquote': {
              borderLeft: '3px solid',
              borderColor: 'divider',
              paddingLeft: '1em',
              marginLeft: 0,
              fontStyle: 'italic',
              color: 'text.secondary',
            },
            '& code': {
              bgcolor: 'action.hover',
              padding: '0.2em 0.4em',
              borderRadius: '3px',
              fontFamily: 'monospace',
            },
            '& pre': {
              bgcolor: 'action.hover',
              padding: '1em',
              borderRadius: '4px',
              overflow: 'auto',
              '& code': {
                bgcolor: 'transparent',
                padding: 0,
              },
            },
          },
        }}
      >
        <EditorContent editor={editor} />
      </Box>
    </Paper>
  );
}
