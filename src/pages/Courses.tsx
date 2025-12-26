import { useMemo, useState, type DragEvent } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  ListItemText,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemAvatar,
  Avatar,
  Divider,
  Switch,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import SearchIcon from '@mui/icons-material/Search';
import TuneIcon from '@mui/icons-material/Tune';
import AddIcon from '@mui/icons-material/Add';
import CategoryIcon from '@mui/icons-material/Category';
import FolderIcon from '@mui/icons-material/Folder';
import SchoolIcon from '@mui/icons-material/School';
import EmojiObjectsIcon from '@mui/icons-material/EmojiObjects';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import CloseIcon from '@mui/icons-material/Close';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import CourseCard from '../components/CourseCard';

type CategoryIconKey = 'school' | 'idea' | 'video' | 'people' | 'folder';

type Category = {
  id: string;
  name: string;
  icon: CategoryIconKey;
  showInFilters: boolean;
};

type Course = {
  id: number;
  title: string;
  description: string;
  chapters: number;
  lessons: number;
  duration: string;
  categoryIds: string[];
};

const categoryIconMap: Record<CategoryIconKey, typeof FolderIcon> = {
  school: SchoolIcon,
  idea: EmojiObjectsIcon,
  video: PlayCircleOutlineIcon,
  people: PeopleAltIcon,
  folder: FolderIcon,
};

const iconOptions: { value: CategoryIconKey; label: string }[] = [
  { value: 'school', label: 'Training' },
  { value: 'idea', label: 'Ideen' },
  { value: 'video', label: 'Video' },
  { value: 'people', label: 'Team' },
  { value: 'folder', label: 'Allgemein' },
];

const emptyCourseForm = {
  title: '',
  description: '',
  categoryIds: [] as string[],
};

export default function Courses() {
  const [categories, setCategories] = useState<Category[]>([
    { id: 'finance', name: 'Finanzen', icon: 'school', showInFilters: true },
    { id: 'onboarding', name: 'Onboarding', icon: 'people', showInFilters: true },
  ]);
  const [courses, setCourses] = useState<Course[]>([
    {
      id: 1,
      title: '02 | Buchhaltung',
      description: 'Zertifizierungslauf für dein internes Finanzteam.',
      chapters: 3,
      lessons: 12,
      duration: '1:36',
      categoryIds: ['finance'],
    },
    {
      id: 2,
      title: '01 | Onboarding PlanVision3D',
      description: 'Begleitender Kurs für neue Teammitglieder.',
      chapters: 2,
      lessons: 8,
      duration: '2:12',
      categoryIds: ['onboarding'],
    },
  ]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'uncategorized' | string>('all');
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', icon: iconOptions[0].value });
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [courseForm, setCourseForm] = useState({ ...emptyCourseForm });
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null);
  const [draggingCourseId, setDraggingCourseId] = useState<number | null>(null);
  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(null);
  const transparentDragImage = useMemo(() => {
    if (typeof document === 'undefined') {
      return null;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 0;
    canvas.height = 0;
    return canvas;
  }, []);

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const matchesSearch = `${course.title} ${course.description}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesCategory =
        selectedCategory === 'all'
          ? true
          : selectedCategory === 'uncategorized'
            ? course.categoryIds.length === 0
            : course.categoryIds.includes(selectedCategory);
      return matchesSearch && matchesCategory;
    });
  }, [courses, searchTerm, selectedCategory]);

  const visibleCategories = useMemo(
    () => categories.filter((category) => category.showInFilters !== false),
    [categories],
  );

  const handleOpenCategoryDialog = (category?: Category) => {
    if (category) {
      setEditingCategoryId(category.id);
      setCategoryForm({ name: category.name, icon: category.icon });
    } else {
      setEditingCategoryId(null);
      setCategoryForm({ name: '', icon: iconOptions[0].value });
    }
    setCategoryDialogOpen(true);
  };

  const handleSaveCategory = () => {
    if (!categoryForm.name.trim()) {
      return;
    }
    if (editingCategoryId) {
      setCategories((prev) => prev.map((cat) => (cat.id === editingCategoryId ? { ...cat, ...categoryForm } : cat)));
    } else {
      const id = typeof crypto?.randomUUID === 'function'
        ? crypto.randomUUID()
        : `cat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setCategories((prev) => [...prev, { id, ...categoryForm, showInFilters: true }]);
    }
    setCategoryDialogOpen(false);
  };

  const handleDeleteCategory = (categoryId: string) => {
    setCategories((prev) => prev.filter((cat) => cat.id !== categoryId));
    setCourses((prev) =>
      prev.map((course) =>
        course.categoryIds.includes(categoryId)
          ? { ...course, categoryIds: course.categoryIds.filter((id) => id !== categoryId) }
          : course,
      ),
    );
    if (selectedCategory === categoryId) {
      setSelectedCategory('all');
    }
  };

  const handleToggleCategoryVisibility = (categoryId: string, isVisible: boolean) => {
    setCategories((prev) =>
      prev.map((category) =>
        category.id === categoryId ? { ...category, showInFilters: isVisible } : category,
      ),
    );
    if (!isVisible && selectedCategory === categoryId) {
      setSelectedCategory('all');
    }
  };

  const handleOpenCourseDialog = (course?: Course) => {
    if (course) {
      setEditingCourseId(course.id);
      setCourseForm({
        title: course.title,
        description: course.description,
        categoryIds: course.categoryIds,
      });
    } else {
      setEditingCourseId(null);
      setCourseForm({ ...emptyCourseForm });
    }
    setCourseDialogOpen(true);
  };

  const handleSaveCourse = () => {
    if (!courseForm.title.trim()) {
      return;
    }
    setCourses((prev) => {
      if (editingCourseId) {
        return prev.map((course) =>
          course.id === editingCourseId
            ? {
                ...course,
                title: courseForm.title,
                description: courseForm.description,
                categoryIds: courseForm.categoryIds,
              }
            : course,
        );
      }
      const newCourse: Course = {
        id: Date.now(),
        title: courseForm.title,
        description: courseForm.description,
        chapters: 0,
        lessons: 0,
        duration: '0:00',
        categoryIds: courseForm.categoryIds,
      };
      return [newCourse, ...prev];
    });
    setCourseDialogOpen(false);
  };

  const handleDeleteCourse = (id: number) => {
    setCourses((prev) => prev.filter((course) => course.id !== id));
  };

  const renderCategoryIcon = (iconKey?: CategoryIconKey) => {
    const IconComponent = iconKey ? categoryIconMap[iconKey] : FolderIcon;
    return <IconComponent fontSize="small" />;
  };

  const handleCourseCategoryChange = (event: SelectChangeEvent<string[]>) => {
    const {
      target: { value },
    } = event;
    setCourseForm((prev) => ({
      ...prev,
      categoryIds: typeof value === 'string' ? value.split(',') : value,
    }));
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>, courseId: number) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(courseId));
    if (transparentDragImage) {
      event.dataTransfer.setDragImage(transparentDragImage, 0, 0);
    }
    setDraggingCourseId(courseId);
  };

  const handleDragOverCourse = (event: DragEvent<HTMLDivElement>, targetCourseId: number) => {
    event.preventDefault();
    if (draggingCourseId === null || draggingCourseId === targetCourseId) {
      return;
    }
    setCourses((prev) => {
      const updated = [...prev];
      const fromIndex = updated.findIndex((course) => course.id === draggingCourseId);
      const toIndex = updated.findIndex((course) => course.id === targetCourseId);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
        return prev;
      }
      const [movedCourse] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, movedCourse);
      return updated;
    });
  };

  const handleDropOnCourse = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDraggingCourseId(null);
  };

  const handleDragOverEndZone = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDropAtEnd = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (draggingCourseId === null) {
      return;
    }
    setCourses((prev) => {
      const updated = [...prev];
      const fromIndex = updated.findIndex((course) => course.id === draggingCourseId);
      if (fromIndex === -1 || fromIndex === updated.length - 1) {
        return prev;
      }
      const [movedCourse] = updated.splice(fromIndex, 1);
      updated.push(movedCourse);
      return updated;
    });
    setDraggingCourseId(null);
  };

  const handleDragEnd = () => {
    setDraggingCourseId(null);
  };

  const handleCategoryDragStart = (event: DragEvent<HTMLLIElement>, categoryId: string) => {
    event.dataTransfer.effectAllowed = 'move';
    setDraggingCategoryId(categoryId);
  };

  const handleCategoryDragOver = (event: DragEvent<HTMLLIElement>, targetCategoryId: string) => {
    event.preventDefault();
    if (!draggingCategoryId || draggingCategoryId === targetCategoryId) {
      return;
    }
    setCategories((prev) => {
      const updated = [...prev];
      const fromIndex = updated.findIndex((category) => category.id === draggingCategoryId);
      const toIndex = updated.findIndex((category) => category.id === targetCategoryId);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
        return prev;
      }
      const [movedCategory] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, movedCategory);
      return updated;
    });
  };

  const handleCategoryDrop = (event: DragEvent<HTMLLIElement>) => {
    event.preventDefault();
    setDraggingCategoryId(null);
  };

  const handleCategoryDragOverEndZone = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleCategoryDropAtEnd = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!draggingCategoryId) {
      return;
    }
    setCategories((prev) => {
      const updated = [...prev];
      const fromIndex = updated.findIndex((category) => category.id === draggingCategoryId);
      if (fromIndex === -1 || fromIndex === updated.length - 1) {
        return prev;
      }
      const [movedCategory] = updated.splice(fromIndex, 1);
      updated.push(movedCategory);
      return updated;
    });
    setDraggingCategoryId(null);
  };

  return (
    <Box
      sx={{
        p: { xs: 2, md: 4 },
        maxWidth: 1160,
        mx: 'auto',
        width: '100%',
      }}
    >
      <Box mb={4}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Meine Kurse
        </Typography>
        <Typography color="text.secondary">
          Verwalte deine Lerninhalte, Kategorien und Kursstarts an einem Ort.
        </Typography>
      </Box>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        mb={3}
        alignItems={{ xs: 'stretch', md: 'center' }}
        sx={{ flexWrap: { xs: 'wrap', md: 'nowrap' } }}
      >
        <TextField
          placeholder="Kurse durchsuchen"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          fullWidth
          sx={{
            flex: { xs: '1 1 100%', md: '0 0 360px' },
            maxWidth: { md: 420 },
            '& .MuiOutlinedInput-root': {
              borderRadius: 2.5,
            },
          }}
        />
        <Button
          variant="outlined"
          startIcon={<TuneIcon />}
          sx={{
            whiteSpace: 'nowrap',
            px: 2.5,
            minHeight: 44,
            textTransform: 'none',
            fontWeight: 600,
            borderColor: (theme) => theme.palette.mode === 'dark' ? '#1a65ff' : undefined,
            color: (theme) => theme.palette.mode === 'dark' ? '#1a65ff' : undefined,
            '&:hover': {
              borderColor: (theme) => (theme.palette.mode === 'dark' ? '#1a65ff' : undefined),
              bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(26,101,255,0.12)' : undefined),
            },
          }}
          onClick={() => setCategoryDrawerOpen(true)}
        >
          Kategorien
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenCourseDialog()}
          sx={{
            whiteSpace: 'nowrap',
            px: 3,
            minHeight: 44,
            ml: { md: 'auto' },
            textTransform: 'none',
            alignSelf: { xs: 'stretch', md: 'center' },
            flexShrink: 0,
            fontWeight: 700,
            bgcolor: (theme) => (theme.palette.mode === 'dark' ? '#1a65ff' : undefined),
            '&:hover': {
              bgcolor: (theme) => (theme.palette.mode === 'dark' ? '#1a65ff' : undefined),
              filter: (theme) => (theme.palette.mode === 'dark' ? 'brightness(1.05)' : undefined),
            },
          }}
        >
          Kurs erstellen
        </Button>
      </Stack>

      <Stack direction="row" spacing={1.5} mb={3} flexWrap="wrap">
        <Chip
          label="Alle"
          icon={<CategoryIcon fontSize="small" />}
          onClick={() => setSelectedCategory('all')}
          color={selectedCategory === 'all' ? 'primary' : 'default'}
        />
        <Chip
          label="Ohne Kategorie"
          onClick={() => setSelectedCategory('uncategorized')}
          color={selectedCategory === 'uncategorized' ? 'primary' : 'default'}
        />
        {visibleCategories.map((category) => (
          <Chip
            key={category.id}
            label={category.name}
            icon={renderCategoryIcon(category.icon)}
            onClick={() => setSelectedCategory(category.id)}
            color={selectedCategory === category.id ? 'primary' : 'default'}
            sx={{
              fontWeight: 600,
              transition: 'transform 0.15s ease, background-color 0.15s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                backgroundColor: (theme) =>
                  selectedCategory === category.id
                    ? theme.palette.primary.light
                    : theme.palette.action.hover,
              },
            }}
          />
        ))}
      </Stack>

      <Box>
        {filteredCourses.length === 0 ? (
          <Box
            sx={{
              border: (theme) => `1px dashed ${theme.palette.divider}`,
              borderRadius: 3,
              p: 4,
              textAlign: 'center',
            }}
          >
            <Typography variant="h6" gutterBottom>
              Keine Kurse gefunden
            </Typography>
            <Typography color="text.secondary" mb={2}>
              Passe die Suche oder Kategorie an oder erstelle deinen ersten Kurs.
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenCourseDialog()}>
              Kurs anlegen
            </Button>
          </Box>
        ) : (
          <>
            {filteredCourses.map((course) => {
              const isDragging = draggingCourseId === course.id;
              return (
                <Box
                  key={course.id}
                  draggable
                  onDragStart={(event) => handleDragStart(event, course.id)}
                  onDragOver={(event) => handleDragOverCourse(event, course.id)}
                  onDrop={handleDropOnCourse}
                  onDragEnd={handleDragEnd}
                  sx={{
                    cursor: isDragging ? 'grabbing' : 'grab',
                    mb: 2.5,
                    opacity: isDragging ? 0.7 : 1,
                    transform: isDragging ? 'scale(1.02)' : 'none',
                    transition: 'opacity 0.1s ease, transform 0.1s ease',
                  }}
                >
                  <CourseCard
                    title={course.title}
                    description={course.description}
                    chapters={course.chapters}
                    lessons={course.lessons}
                    duration={course.duration}
                    onEdit={() => handleOpenCourseDialog(course)}
                    onDelete={() => handleDeleteCourse(course.id)}
                  />
                </Box>
              );
            })}
            <Box onDragOver={handleDragOverEndZone} onDrop={handleDropAtEnd} sx={{ height: 24 }} />
          </>
        )}
      </Box>

      <Drawer anchor="right" open={categoryDrawerOpen} onClose={() => setCategoryDrawerOpen(false)}>
        <Box
          sx={{
            width: { xs: 320, sm: 380 },
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            p: 3,
            gap: 2,
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Kategorien
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Verwalte Namen, Symbole und Zuordnungen.
              </Typography>
            </Box>
            <IconButton onClick={() => setCategoryDrawerOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
          <Divider />
          <List sx={{ flex: 1, overflowY: 'auto' }}>
            {categories.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Typography variant="body1" gutterBottom>
                  Noch keine Kategorien.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Lege deine erste Kategorie an, um Kurse zu strukturieren.
                </Typography>
              </Box>
            ) : (
              <>
                {categories.map((category) => {
                  const IconComponent = categoryIconMap[category.icon];
                  const usage = courses.filter((course) => course.categoryIds.includes(category.id)).length;
                  const isCategoryDragging = draggingCategoryId === category.id;
                  return (
                    <ListItem
                      key={category.id}
                      draggable
                      onDragStart={(event) => handleCategoryDragStart(event, category.id)}
                      onDragOver={(event) => handleCategoryDragOver(event, category.id)}
                      onDrop={handleCategoryDrop}
                      onDragEnd={handleCategoryDrop}
                      sx={{
                        borderRadius: 2,
                        mb: 1,
                        bgcolor: isCategoryDragging ? 'action.hover' : 'transparent',
                        transition: 'background-color 0.15s ease, transform 0.15s ease',
                        '&:hover': {
                          bgcolor: 'action.hover',
                          transform: isCategoryDragging ? 'none' : 'translateX(4px)',
                        },
                      }}
                      secondaryAction={
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Switch
                            size="small"
                            checked={category.showInFilters !== false}
                            onChange={(event) => handleToggleCategoryVisibility(category.id, event.target.checked)}
                            inputProps={{ 'aria-label': 'Kategorie in Filter anzeigen' }}
                          />
                          <IconButton size="small" onClick={() => handleOpenCategoryDialog(category)}>
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleDeleteCategory(category.id)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      }
                    >
                      <ListItemIcon sx={{ minWidth: 28, color: 'text.disabled' }}>
                        <DragIndicatorIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'action.hover', color: 'text.primary' }}>
                          <IconComponent fontSize="small" />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={category.name}
                        secondary={`${usage} Kurs${usage === 1 ? '' : 'e'}`}
                      />
                    </ListItem>
                  );
                })}
                <Box onDragOver={handleCategoryDragOverEndZone} onDrop={handleCategoryDropAtEnd} sx={{ height: 16 }} />
              </>
            )}
          </List>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenCategoryDialog()}
            sx={{ mt: 1, py: 1.5, fontWeight: 700 }}
          >
            Neue Kategorie erstellen
          </Button>
        </Box>
      </Drawer>

      {/* Kategorie Dialog */}
      <Dialog open={categoryDialogOpen} onClose={() => setCategoryDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingCategoryId ? 'Kategorie bearbeiten' : 'Kategorie erstellen'}</DialogTitle>
        <DialogContent>
          <TextField
            label="Neuer Kategoriename"
            value={categoryForm.name}
            onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
            fullWidth
            margin="normal"
          />
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Kategorie-Symbol
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(64px, 1fr))',
              gap: 1,
              mt: 1,
            }}
          >
            {iconOptions.map((option) => {
              const IconComponent = categoryIconMap[option.value];
              const selected = categoryForm.icon === option.value;
              return (
                <Box key={option.value}>
                  <Tooltip title={option.label} arrow>
                    <IconButton
                      onClick={() => setCategoryForm((prev) => ({ ...prev, icon: option.value }))}
                      sx={{
                        width: '100%',
                        borderRadius: 2,
                        border: (theme) => `1px solid ${selected ? theme.palette.primary.main : theme.palette.divider}`,
                        backgroundColor: (theme) => (selected ? theme.palette.action.selected : 'transparent'),
                      }}
                    >
                      <IconComponent />
                    </IconButton>
                  </Tooltip>
                </Box>
              );
            })}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryDialogOpen(false)}>Abbrechen</Button>
          <Button variant="contained" onClick={handleSaveCategory}>
            Speichern
          </Button>
        </DialogActions>
      </Dialog>

      {/* Kurs Dialog */}
      <Dialog open={courseDialogOpen} onClose={() => setCourseDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCourseId ? 'Kurs bearbeiten' : 'Kurs erstellen'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Kursname"
              value={courseForm.title}
              onChange={(event) => setCourseForm((prev) => ({ ...prev, title: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Beschreibung"
              value={courseForm.description}
              onChange={(event) => setCourseForm((prev) => ({ ...prev, description: event.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
            <FormControl fullWidth>
              <InputLabel id="course-categories-label">Kategorien</InputLabel>
              <Select
                labelId="course-categories-label"
                multiple
                value={courseForm.categoryIds}
                label="Kategorien"
                onChange={handleCourseCategoryChange}
                renderValue={(selected) =>
                  selected.length
                    ? categories
                        .filter((category) => selected.includes(category.id))
                        .map((category) => category.name)
                        .join(', ')
                    : 'Keine Kategorie'
                }
              >
                {categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    <Checkbox checked={courseForm.categoryIds.includes(category.id)} />
                    <ListItemText primary={category.name} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCourseDialogOpen(false)}>Abbrechen</Button>
          <Button variant="contained" onClick={handleSaveCourse}>
            Speichern
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
