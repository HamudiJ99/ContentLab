import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  Link,
  Menu,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import AddIcon from '@mui/icons-material/Add';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FolderIcon from '@mui/icons-material/Folder';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import UploadIcon from '@mui/icons-material/Upload';
import CollectionsIcon from '@mui/icons-material/Collections';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '../firebase/firebaseConfig';

const statusStyles = {
  published: { label: 'Veröffentlicht', dot: '#22c55e', color: '#22c55e' },
  draft: { label: 'Entwurf', dot: '#fbbf24', color: '#fbbf24' },
  disabled: { label: 'Deaktiviert', dot: '#a1a1aa', color: '#a1a1aa' },
} as const;

type ChapterStatus = keyof typeof statusStyles;

type CourseData = {
  id: string;
  title: string;
  description: string;
  coverImageUrl?: string;
};

type Chapter = {
  id: string;
  title: string;
  description: string;
  status: ChapterStatus;
  coverImageUrl?: string;
  position: number;
};

type CourseFormState = {
  title: string;
  description: string;
  coverImageUrl: string;
};

const emptyCourseForm: CourseFormState = {
  title: '',
  description: '',
  coverImageUrl: '',
};

type ChapterFormState = {
  title: string;
  description: string;
  status: ChapterStatus;
  coverImageUrl: string;
};

const emptyChapterForm: ChapterFormState = {
  title: '',
  description: '',
  status: 'draft',
  coverImageUrl: '',
};

const CourseEditor = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [course, setCourse] = useState<CourseData | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [courseLoading, setCourseLoading] = useState(true);
  const [chaptersLoading, setChaptersLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [propertiesDialogOpen, setPropertiesDialogOpen] = useState(false);
  const [courseForm, setCourseForm] = useState<CourseFormState>(emptyCourseForm);
  const [courseSaving, setCourseSaving] = useState(false);
  const [courseCoverFile, setCourseCoverFile] = useState<File | null>(null);
  const courseCoverInputRef = useRef<HTMLInputElement>(null);
  const [chapterDialogOpen, setChapterDialogOpen] = useState(false);
  const [chapterDialogMode, setChapterDialogMode] = useState<'create' | 'edit'>('create');
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [chapterForm, setChapterForm] = useState<ChapterFormState>(emptyChapterForm);
  const [chapterCoverFile, setChapterCoverFile] = useState<File | null>(null);
  const chapterCoverInputRef = useRef<HTMLInputElement>(null);
  const [chapterSaving, setChapterSaving] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [statusMenu, setStatusMenu] = useState<{ anchorEl: HTMLElement | null; chapterId: string | null }>({
    anchorEl: null,
    chapterId: null,
  });
  const [actionsMenu, setActionsMenu] = useState<{ anchorEl: HTMLElement | null; chapterId: string | null }>({
    anchorEl: null,
    chapterId: null,
  });
  const ownerId = currentUser?.uid ?? 'shared';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUser || !courseId) {
      setCourse(null);
      setChapters([]);
      setCourseLoading(false);
      setChaptersLoading(false);
      return;
    }
    setCourseLoading(true);
    setChaptersLoading(true);
    const courseRef = doc(db, 'users', currentUser.uid, 'courses', courseId);
    const chaptersQuery = query(collection(courseRef, 'chapters'), orderBy('position', 'asc'));

    const unsubscribeCourse = onSnapshot(
      courseRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setCourse(null);
        } else {
          const data = snapshot.data();
          setCourse({
            id: snapshot.id,
            title: data.title ?? 'Unbenannter Kurs',
            description: data.description ?? '',
            coverImageUrl: typeof data.coverImageUrl === 'string' ? data.coverImageUrl : undefined,
          });
        }
        setCourseLoading(false);
      },
      () => {
        setPageError('Kurs konnte nicht geladen werden.');
        setCourseLoading(false);
      },
    );

    const unsubscribeChapters = onSnapshot(
      chaptersQuery,
      (snapshot) => {
        const loadedChapters: Chapter[] = snapshot.docs.map((docSnapshot, index) => {
          const data = docSnapshot.data();
          return {
            id: docSnapshot.id,
            title: data.title ?? 'Neues Kapitel',
            description: data.description ?? '',
            status: (data.status as ChapterStatus) ?? 'draft',
            coverImageUrl: typeof data.coverImageUrl === 'string' ? data.coverImageUrl : undefined,
            position: typeof data.position === 'number' ? data.position : index,
          };
        });
        setChapters(loadedChapters.sort((a, b) => a.position - b.position));
        setChaptersLoading(false);
      },
      () => {
        setPageError('Kapitel konnten nicht geladen werden.');
        setChaptersLoading(false);
      },
    );

    return () => {
      unsubscribeCourse();
      unsubscribeChapters();
    };
  }, [currentUser, courseId]);

  const courseRef = useMemo(() => {
    if (!currentUser || !courseId) {
      return null;
    }
    return doc(db, 'users', currentUser.uid, 'courses', courseId);
  }, [currentUser, courseId]);

  const chaptersCollection = useMemo(() => {
    if (!courseRef) {
      return null;
    }
    return collection(courseRef, 'chapters');
  }, [courseRef]);

  const handleOpenPropertiesDialog = () => {
    if (!course) {
      return;
    }
    setCourseForm({
      title: course.title,
      description: course.description,
      coverImageUrl: course.coverImageUrl ?? '',
    });
    setCourseCoverFile(null);
    setPropertiesDialogOpen(true);
  };

  const handleCourseInputChange = (field: keyof CourseFormState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setCourseForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleCourseCoverChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setCourseCoverFile(file ?? null);
  };

  const uploadCoverImage = async (file: File, path: string) => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  };

  const handleSaveCourseProperties = async () => {
    if (!courseRef || !course) {
      return;
    }
    if (!courseForm.title.trim()) {
      setPageError('Bitte einen Kursnamen angeben.');
      return;
    }
    setPageError(null);
    setCourseSaving(true);
    try {
      let coverUrl = courseForm.coverImageUrl.trim();
      if (courseCoverFile) {
        coverUrl = await uploadCoverImage(courseCoverFile, `courseCovers/${ownerId}/${course.id}`);
      }
      await setDoc(
        courseRef,
        {
          title: courseForm.title.trim(),
          description: courseForm.description.trim(),
          coverImageUrl: coverUrl,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setPropertiesDialogOpen(false);
    } catch (error) {
      setPageError('Eigenschaften konnten nicht gespeichert werden.');
    } finally {
      setCourseSaving(false);
    }
  };

  const handleOpenChapterDialog = (mode: 'create' | 'edit', chapter?: Chapter) => {
    setChapterDialogMode(mode);
    if (mode === 'edit' && chapter) {
      setActiveChapterId(chapter.id);
      setChapterForm({
        title: chapter.title,
        description: chapter.description,
        status: chapter.status,
        coverImageUrl: chapter.coverImageUrl ?? '',
      });
    } else {
      setActiveChapterId(null);
      setChapterForm(emptyChapterForm);
    }
    setChapterCoverFile(null);
    setChapterDialogOpen(true);
  };

  const handleChapterInputChange = (field: keyof ChapterFormState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setChapterForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleChapterCoverChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setChapterCoverFile(file ?? null);
  };

  const saveChapter = async () => {
    if (!chaptersCollection || !courseRef) {
      return;
    }
    if (!chapterForm.title.trim()) {
      setPageError('Bitte einen Kapitelnamen angeben.');
      return;
    }
    setPageError(null);
    setChapterSaving(true);
    try {
      if (chapterDialogMode === 'create') {
        const newChapterRef = doc(chaptersCollection);
        let coverUrl = chapterForm.coverImageUrl.trim();
        if (chapterCoverFile) {
          coverUrl = await uploadCoverImage(chapterCoverFile, `courseChapters/${ownerId}/${courseRef.id}/${newChapterRef.id}`);
        }
        await setDoc(newChapterRef, {
          title: chapterForm.title.trim(),
          description: chapterForm.description.trim(),
          status: chapterForm.status,
          coverImageUrl: coverUrl,
          position: chapters.length,
          createdAt: serverTimestamp(),
        });
        setExpandedChapters((prev) => new Set(prev).add(newChapterRef.id));
      } else if (activeChapterId) {
        const chapterRef = doc(chaptersCollection, activeChapterId);
        let coverUrl = chapterForm.coverImageUrl.trim();
        if (chapterCoverFile) {
          coverUrl = await uploadCoverImage(chapterCoverFile, `courseChapters/${ownerId}/${courseRef.id}/${activeChapterId}`);
        }
        await updateDoc(chapterRef, {
          title: chapterForm.title.trim(),
          description: chapterForm.description.trim(),
          status: chapterForm.status,
          coverImageUrl: coverUrl,
          updatedAt: serverTimestamp(),
        });
      }
      setChapterDialogOpen(false);
    } catch (error) {
      setPageError('Kapitel konnte nicht gespeichert werden.');
    } finally {
      setChapterSaving(false);
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (!chaptersCollection || !window.confirm('Kapitel wirklich löschen?')) {
      return;
    }
    try {
      await deleteDoc(doc(chaptersCollection, chapterId));
    } catch (error) {
      setPageError('Kapitel konnte nicht gelöscht werden.');
    }
  };

  const handleDuplicateChapter = async (chapter: Chapter) => {
    if (!chaptersCollection || !courseRef) {
      return;
    }
    try {
      const newChapterRef = doc(chaptersCollection);
      await setDoc(newChapterRef, {
        title: `${chapter.title} Kopie`,
        description: chapter.description,
        status: chapter.status,
        coverImageUrl: chapter.coverImageUrl ?? '',
        position: chapters.length,
        createdAt: serverTimestamp(),
      });
      setExpandedChapters((prev) => new Set(prev).add(newChapterRef.id));
    } catch (error) {
      setPageError('Kapitel konnte nicht dupliziert werden.');
    }
  };

  const handleStatusMenuOpen = (chapterId: string, anchorEl: HTMLElement) => {
    setStatusMenu({ anchorEl, chapterId });
  };

  const handleActionsMenuOpen = (chapterId: string, anchorEl: HTMLElement) => {
    setActionsMenu({ anchorEl, chapterId });
  };

  const handleCloseMenus = () => {
    setStatusMenu({ anchorEl: null, chapterId: null });
    setActionsMenu({ anchorEl: null, chapterId: null });
  };

  const handleSelectStatus = async (nextStatus: ChapterStatus) => {
    if (!chaptersCollection || !statusMenu.chapterId) {
      handleCloseMenus();
      return;
    }
    try {
      await updateDoc(doc(chaptersCollection, statusMenu.chapterId), { status: nextStatus });
    } catch (error) {
      setPageError('Status konnte nicht aktualisiert werden.');
    } finally {
      handleCloseMenus();
    }
  };

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  };

  const collapseAll = () => {
    setExpandedChapters(new Set());
  };

  const renderChapterCard = (chapter: Chapter) => {
    const expanded = expandedChapters.has(chapter.id);
    const statusConfig = statusStyles[chapter.status];
    return (
      <Paper
        key={chapter.id}
        variant="outlined"
        sx={{
          borderRadius: 3,
          p: 3,
          backgroundColor: (theme) => (theme.palette.mode === 'dark' ? '#111325' : theme.palette.background.paper),
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}>
            <FolderIcon />
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              {chapter.title}
            </Typography>
            {chapter.description ? (
              <Typography variant="body2" color="text.secondary">
                {chapter.description}
              </Typography>
            ) : null}
          </Box>
          <Button
            variant="outlined"
            size="small"
            onClick={(event) => handleStatusMenuOpen(chapter.id, event.currentTarget)}
            startIcon={<Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: statusConfig.dot }} />}
            sx={{ textTransform: 'none', borderColor: 'rgba(255,255,255,0.08)' }}
          >
            {statusConfig.label}
          </Button>
          <IconButton onClick={() => toggleChapter(chapter.id)}>
            {expanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
          <IconButton onClick={(event) => handleActionsMenuOpen(chapter.id, event.currentTarget)}>
            <MoreVertIcon />
          </IconButton>
        </Stack>
        {expanded && (
          <Box mt={3}>
            <Divider sx={{ mb: 3 }} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.secondary">
                Noch keine Lektionen hinzugefügt.
              </Typography>
              <Button startIcon={<AddIcon />} variant="outlined" sx={{ textTransform: 'none' }}>
                Lektion hinzufügen
              </Button>
            </Stack>
          </Box>
        )}
      </Paper>
    );
  };

  if (!courseId) {
    return null;
  }

  if (!currentUser) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="info">Bitte melde dich an, um Kurse zu bearbeiten.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, pb: 6 }}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={RouterLink} to="/courses" underline="hover" color="inherit">
          Kursübersicht
        </Link>
        <Typography color="text.primary">{course?.title ?? 'Kurs'}</Typography>
      </Breadcrumbs>

      {pageError ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {pageError}
        </Alert>
      ) : null}

      {courseLoading ? (
        <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }}>
          <CircularProgress />
        </Stack>
      ) : course ? (
        <>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }} mb={4}
            justifyContent="space-between">
            <Box>
              <Typography variant="h4" fontWeight={700} gutterBottom>
                {course.title}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Button
                variant="outlined"
                startIcon={<SettingsOutlinedIcon />}
                onClick={handleOpenPropertiesDialog}
                sx={{ textTransform: 'none' }}
              >
                Eigenschaften
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                sx={{ textTransform: 'none' }}
                onClick={() => handleOpenChapterDialog('create')}
              >
                Kapitel
              </Button>
              <Tooltip title="Alle Kapitel einklappen">
                <IconButton onClick={collapseAll}>
                  <KeyboardArrowUpIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          {chaptersLoading ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
              <CircularProgress size={32} />
            </Stack>
          ) : chapters.length === 0 ? (
            <Paper
              variant="outlined"
              sx={{
                borderRadius: 3,
                p: 4,
                textAlign: 'center',
                backgroundColor: (theme) => (theme.palette.mode === 'dark' ? '#111325' : theme.palette.background.paper),
              }}
            >
              <Typography variant="h6" gutterBottom>
                Du hast noch keine Kapitel angelegt.
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                Erstelle dein erstes Kapitel, um mit dem Kursaufbau zu beginnen.
              </Typography>
              <Button startIcon={<AddIcon />} onClick={() => handleOpenChapterDialog('create')} sx={{ textTransform: 'none' }}>
              Kapitel hinzufügen
            </Button>
              
            </Paper>
          ) : (
            <Stack spacing={2.5}>
              {chapters.map((chapter) => renderChapterCard(chapter))}
            </Stack>
          )}

         
        </>
      ) : (
        <Paper sx={{ p: 4 }}>
          <Typography variant="h6" gutterBottom>
            Dieser Kurs wurde nicht gefunden.
          </Typography>
          <Button variant="outlined" onClick={() => navigate('/courses')}>
            Zur Kursübersicht
          </Button>
        </Paper>
      )}

      <Dialog open={propertiesDialogOpen} onClose={() => setPropertiesDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Kursspezifische Eigenschaften</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} mt={1}>
            <TextField label="Kursname" value={courseForm.title} onChange={handleCourseInputChange('title')} fullWidth />
            <TextField
              label="Kurzbeschreibung"
              value={courseForm.description}
              onChange={handleCourseInputChange('description')}
              fullWidth
              multiline
              minRows={3}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <Box sx={{ width: 160, height: 100, borderRadius: 2, bgcolor: 'action.hover', overflow: 'hidden' }}>
                {courseCoverFile ? (
                  <Box component="img" src={URL.createObjectURL(courseCoverFile)} alt="Cover Vorschau" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : courseForm.coverImageUrl ? (
                  <Box component="img" src={courseForm.coverImageUrl} alt="Cover Vorschau" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
                    <CollectionsIcon color="disabled" />
                  </Stack>
                )}
              </Box>
              <Box>
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  ref={courseCoverInputRef}
                  onChange={handleCourseCoverChange}
                />
                <Button
                  variant="outlined"
                  startIcon={<UploadIcon />}
                  onClick={() => courseCoverInputRef.current?.click()}
                  sx={{ textTransform: 'none' }}
                >
                  Vorschaubild auswählen
                </Button>
              </Box>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPropertiesDialogOpen(false)}>Abbrechen</Button>
          <Button onClick={handleSaveCourseProperties} variant="contained" disabled={courseSaving}>
            {courseSaving ? 'Speichert...' : 'Speichern'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={chapterDialogOpen} onClose={() => setChapterDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{chapterDialogMode === 'create' ? 'Kapitel erstellen' : 'Kapitel bearbeiten'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} mt={1}>
            <TextField label="Kapitelname" value={chapterForm.title} onChange={handleChapterInputChange('title')} fullWidth />
            <TextField
              label="Kurzbeschreibung"
              value={chapterForm.description}
              onChange={handleChapterInputChange('description')}
              fullWidth
              multiline
              minRows={2}
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={chapterForm.status}
                onChange={(event: SelectChangeEvent<ChapterStatus>) =>
                  setChapterForm((prev) => ({ ...prev, status: event.target.value as ChapterStatus }))
                }
              >
                {Object.entries(statusStyles).map(([value, config]) => (
                  <MenuItem key={value} value={value}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: config.dot }} />
                      <Typography>{config.label}</Typography>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <Box sx={{ width: 160, height: 100, borderRadius: 2, bgcolor: 'action.hover', overflow: 'hidden' }}>
                {chapterCoverFile ? (
                  <Box component="img" src={URL.createObjectURL(chapterCoverFile)} alt="Kapitel Cover" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : chapterForm.coverImageUrl ? (
                  <Box component="img" src={chapterForm.coverImageUrl} alt="Kapitel Cover" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
                    <CollectionsIcon color="disabled" />
                  </Stack>
                )}
              </Box>
              <Box>
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  ref={chapterCoverInputRef}
                  onChange={handleChapterCoverChange}
                />
                <Button
                  variant="outlined"
                  startIcon={<UploadIcon />}
                  onClick={() => chapterCoverInputRef.current?.click()}
                  sx={{ textTransform: 'none' }}
                >
                  Vorschaubild auswählen
                </Button>
              </Box>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChapterDialogOpen(false)}>Abbrechen</Button>
          <Button onClick={saveChapter} variant="contained" disabled={chapterSaving}>
            {chapterSaving ? 'Speichert...' : chapterDialogMode === 'create' ? 'Erstellen' : 'Speichern'}
          </Button>
        </DialogActions>
      </Dialog>

      <Menu
        anchorEl={statusMenu.anchorEl}
        open={Boolean(statusMenu.anchorEl)}
        onClose={handleCloseMenus}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {Object.entries(statusStyles).map(([value, config]) => (
          <MenuItem key={value} onClick={() => handleSelectStatus(value as ChapterStatus)}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: config.dot }} />
              <Typography>{config.label}</Typography>
            </Stack>
          </MenuItem>
        ))}
      </Menu>

      <Menu
        anchorEl={actionsMenu.anchorEl}
        open={Boolean(actionsMenu.anchorEl)}
        onClose={handleCloseMenus}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem
          onClick={() => {
            const chapter = chapters.find((item) => item.id === actionsMenu.chapterId);
            if (chapter) {
              handleOpenChapterDialog('edit', chapter);
            }
            handleCloseMenus();
          }}
        >
          Bearbeiten
        </MenuItem>
        <MenuItem
          onClick={() => {
            const chapter = chapters.find((item) => item.id === actionsMenu.chapterId);
            if (chapter) {
              handleDuplicateChapter(chapter);
            }
            handleCloseMenus();
          }}
        >
          Duplizieren
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (actionsMenu.chapterId) {
              handleDeleteChapter(actionsMenu.chapterId);
            }
            handleCloseMenus();
          }}
        >
          Löschen
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default CourseEditor;
