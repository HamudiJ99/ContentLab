import React from 'react';
import { Card, CardContent, CardMedia, Typography, Box, IconButton, Menu, MenuItem } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';


interface CourseCardProps {
  title: string;
  description: string;
  lessons?: number;
  participants?: number;
  duration?: string;
  onEdit?: () => void;
  onDelete?: () => void;
}


const CourseCard: React.FC<CourseCardProps> = ({ title, description, lessons, participants, duration, onEdit, onDelete }) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <Card sx={{ display: 'flex', alignItems: 'center', mb: 2, boxShadow: '0 2px 8px #f0f1f2', borderRadius: 2, position: 'relative' }}>
      {/* Drei-Punkte-Menü */}
      <IconButton
        aria-label="more"
        aria-controls="course-menu"
        aria-haspopup="true"
        onClick={handleMenu}
        sx={{ position: 'absolute', top: 8, right: 8 }}
      >
        <MoreVertIcon />
      </IconButton>
      <Menu
        id="course-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => { handleClose(); onEdit && onEdit(); }}>Bearbeiten</MenuItem>
        <MenuItem onClick={() => { handleClose(); onDelete && onDelete(); }}>Löschen</MenuItem>
      </Menu>
      <CardMedia
        component="img"
        sx={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 2, m: 2 }}
        image="https://images.unsplash.com/photo-1503676382389-4809596d5290?auto=format&fit=crop&w=80&q=80"
        alt="Kursbild"
      />
      <CardContent sx={{ flex: 1 }}>
        <Typography variant="h6" component="div">
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </CardContent>
      {(lessons || participants || duration) && (
        <Box sx={{ pr: 2, minWidth: 100, textAlign: 'right' }}>
          {lessons !== undefined && (
            <Typography variant="caption" color="text.secondary">{lessons} Lektionen</Typography>
          )}<br />
          {participants !== undefined && (
            <Typography variant="caption" color="text.secondary">{participants} TN</Typography>
          )}<br />
          {duration && (
            <Typography variant="caption" color="text.secondary">{duration}</Typography>
          )}
        </Box>
      )}
    </Card>
  );
};

export default CourseCard;
