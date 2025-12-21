import { useState } from 'react';
import { Box, Typography, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import CourseCard from '../components/CourseCard';

interface Course {
  id: number;
  title: string;
  description: string;
  lessons?: number;
  participants?: number;
  duration?: string;
}

function Courses() {
  const [courses, setCourses] = useState<Course[]>([
    {
      id: 1,
      title: '[Demo] Mitarbeiter Schulung und Training',
      description: 'Die Kursvorlage zur Mitarbeiterschulung inklusive Training.',
      lessons: 12,
      participants: 87,
      duration: '3:03:19',
    },
  ]);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const handleAddCourse = () => {
    if (newTitle.trim()) {
      setCourses([
        ...courses,
        { id: Date.now(), title: newTitle, description: newDesc },
      ]);
      setNewTitle('');
      setNewDesc('');
    }
  };

  // Kurs löschen
  const handleDelete = (id: number) => {
    setCourses(courses.filter((c) => c.id !== id));
  };

  // Kurs bearbeiten
  const handleEdit = (course: Course) => {
    setEditId(course.id);
    setEditTitle(course.title);
    setEditDesc(course.description);
    setEditOpen(true);
  };

  const handleEditSave = () => {
    if (editId === null) {
      return;
    }
    setCourses((prev) => prev.map((c) => (c.id === editId ? { ...c, title: editTitle, description: editDesc } : c)));
    handleEditCancel();
  };

  const handleEditCancel = () => {
    setEditOpen(false);
    setEditId(null);
    setEditTitle('');
    setEditDesc('');
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" fontWeight={700} mb={2}>
        Meine Kurse
      </Typography>
      <Box>
        {courses.map((course) => (
          <CourseCard
            key={course.id}
            title={course.title}
            description={course.description}
            lessons={course.lessons}
            participants={course.participants}
            duration={course.duration}
            onDelete={() => handleDelete(course.id)}
            onEdit={() => handleEdit(course)}
          />
        ))}
      </Box>
      <Box sx={{ mt: 4, display: 'flex', gap: 2, alignItems: 'center' }}>
        <TextField
          label="Kursname"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          size="small"
        />
        <TextField
          label="Beschreibung"
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          size="small"
        />
        <Button variant="contained" onClick={handleAddCourse}>
          Neuer Kurs
        </Button>
      </Box>

      {/* Bearbeiten Dialog */}
      <Dialog open={editOpen} onClose={handleEditCancel}>
        <DialogTitle>Kurs bearbeiten</DialogTitle>
        <DialogContent>
          <TextField
            label="Kursname"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            fullWidth
            margin="normal"
          />
          <TextField
            label="Beschreibung"
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            fullWidth
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditCancel}>Abbrechen</Button>
          <Button onClick={handleEditSave} variant="contained">Speichern</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Courses;
