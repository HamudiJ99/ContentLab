import { useState, type ReactElement, type MouseEvent } from 'react';
import {
  Card,
  Box,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Stack,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ImageIcon from '@mui/icons-material/Image';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import LayersIcon from '@mui/icons-material/Layers';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

export type CourseCardProps = {
  title: string;
  description: string;
  chapters?: number;
  lessons?: number;
  duration?: string;
  coverImageUrl?: string;
  coverColor?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onOpen?: () => void;
};

export default function CourseCard({
  title,
  description,
  chapters,
  lessons,
  duration,
  coverImageUrl,
  coverColor,
  onEdit,
  onDelete,
  onOpen,
}: CourseCardProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const stats = [
    chapters !== undefined
      ? {
          icon: <LayersIcon fontSize="small" />,
          label: `${chapters} Kapitel`,
        }
      : null,
    lessons !== undefined
      ? {
          icon: <MenuBookIcon fontSize="small" />,
          label: `${lessons} Lektionen`,
        }
      : null,
    duration
      ? {
          icon: <AccessTimeIcon fontSize="small" />,
          label: duration,
        }
      : null,
  ].filter(Boolean) as { icon: ReactElement; label: string }[];

  const handleMenuOpen = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  return (
    <Card
      draggable={false}
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 3,
        p: { xs: 2, md: 3 },
        borderRadius: 3,
        minHeight: { xs: 140, md: 150 },
        border: (theme) => `1px solid ${theme.palette.divider}`,
        boxShadow: (theme) => (theme.palette.mode === 'light' ? '0 12px 24px rgba(15, 23, 42, 0.08)' : '0 12px 24px rgba(2, 6, 23, 0.65)'),
        background: (theme) => (theme.palette.mode === 'light' ? theme.palette.background.paper : theme.palette.background.default),
        userSelect: 'none',
        cursor: onOpen ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
        '&:hover': {
          boxShadow: (theme) => (theme.palette.mode === 'light' ? '0 16px 28px rgba(15, 23, 42, 0.12)' : '0 16px 32px rgba(2, 6, 23, 0.8)'),
          borderColor: (theme) => theme.palette.primary.main,
        },
      }}
      onClick={() => {
        if (onOpen) {
          onOpen();
        }
      }}
    >
      <Box
        sx={{
          width: 120,
          minHeight: 120,
          borderRadius: 2,
          background: coverImageUrl
            ? undefined
            : coverColor && coverColor.trim()
              ? coverColor
              : 'linear-gradient(135deg, #a855f7, #6366f1)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {coverImageUrl ? (
          <Box
            component="img"
            src={coverImageUrl}
            alt={`${title} Cover`}
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <ImageIcon sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 48, pointerEvents: 'none' }} />
        )}
      </Box>
      <Box sx={{ flex: 1 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          spacing={2}
          alignItems="flex-start"
          sx={{ flexWrap: 'nowrap' }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              {title}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 0.5,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minHeight: 40,
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
              }}
            >
              {description}
            </Typography>
          </Box>
          <IconButton
            onClick={(event) => {
              event.stopPropagation();
              handleMenuOpen(event);
            }}
            aria-label="Kursaktionen"
            sx={{ flexShrink: 0 }}
          >
            <MoreVertIcon />
          </IconButton>
        </Stack>
        {stats.length > 0 && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} mt={3}>
            {stats.map((stat) => (
              <Stack key={stat.label} direction="row" spacing={1} alignItems="center">
                {stat.icon}
                <Typography variant="body2" fontWeight={600} color="text.secondary">
                  {stat.label}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleMenuClose}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
      >
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onEdit?.();
          }}
        >
          Bearbeiten
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onDelete?.();
          }}
        >
          Löschen
        </MenuItem>
      </Menu>
    </Card>
  );
}
