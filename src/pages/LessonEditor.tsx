import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  IconButton,
  Link,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';

const brandStatusColor = '#1a65ff';
const statusButtonActiveColor = '#1d8bf2';
const statusStyles = {
  published: {
    label: 'Veröffentlicht',
    dot: '#22c55e',
    color: brandStatusColor,
    chipBg: 'rgba(34, 197, 94, 0.15)',
    chipText: '#15803d',
  },
  draft: {
    label: 'Entwurf',
    dot: '#1a65ff',
    color: brandStatusColor,
    chipBg: 'rgba(26, 101, 255, 0.12)',
    chipText: '#1a65ff',
  },
  disabled: {
    label: 'Deaktiviert',
    dot: '#ef4444',
    color: brandStatusColor,
    chipBg: 'rgba(239, 68, 68, 0.15)',
    chipText: '#b91c1c',
  },
} as const;

type LessonStatus = keyof typeof statusStyles;
type LessonType = 'subchapter' | 'video' | 'pdf' | 'text';

type CourseMeta = {
  id: string;
  title: string;
};

type ChapterMeta = {
  id: string;
  title: string;
};

type LessonData = {
  id: string;
  title: string;
  type: LessonType;
  shortDescription: string;
  content: string;
  status: LessonStatus;
  parentLessonId: string | null;
};

type LessonFormState = {
  title: string;
  shortDescription: string;
  content: string;
  status: LessonStatus;
};

const emptyLessonForm: LessonFormState = {
  title: '',
  shortDescription: '',
  content: '',
  status: 'draft',
};

const LessonEditor = () => {
  const navigate = useNavigate();
  const { courseId, chapterId, lessonId } = useParams<{ courseId: string; chapterId: string; lessonId: string }>();
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [course, setCourse] = useState<CourseMeta | null>(null);
  const [chapter, setChapter] = useState<ChapterMeta | null>(null);
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [lessonForm, setLessonForm] = useState<LessonFormState>(emptyLessonForm);
  const [courseLoading, setCourseLoading] = useState(true);
  const [chapterLoading, setChapterLoading] = useState(true);
  const [lessonLoading, setLessonLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [saveSuccessOpen, setSaveSuccessOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

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

  const chapterRef = useMemo(() => {
    if (!chaptersCollection || !chapterId) {
      return null;
    }
    return doc(chaptersCollection, chapterId);
  }, [chaptersCollection, chapterId]);

  const lessonsCollection = useMemo(() => {
    if (!chapterRef) {
      return null;
    }
    return collection(chapterRef, 'lessons');
  }, [chapterRef]);

  const lessonRef = useMemo(() => {
    if (!lessonsCollection || !lessonId) {
      return null;
    }
    return doc(lessonsCollection, lessonId);
  }, [lessonsCollection, lessonId]);

  useEffect(() => {
    if (!courseRef) {
      setCourse(null);
      setCourseLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(
      courseRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setCourse(null);
        } else {
          const data = snapshot.data();
          setCourse({ id: snapshot.id, title: data.title ?? 'Unbenannter Kurs' });
        }
        setCourseLoading(false);
      },
      () => {
        setCourse(null);
        setCourseLoading(false);
      },
    );
    return unsubscribe;
  }, [courseRef]);

  useEffect(() => {
    if (!chapterRef) {
      setChapter(null);
      setChapterLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(
      chapterRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setChapter(null);
        } else {
          const data = snapshot.data();
          setChapter({ id: snapshot.id, title: data.title ?? 'Kapitel' });
        }
        setChapterLoading(false);
      },
      () => {
        setChapter(null);
        setChapterLoading(false);
      },
    );
    return unsubscribe;
  }, [chapterRef]);

  useEffect(() => {
    if (!lessonRef) {
      setLesson(null);
      setLessonLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(
      lessonRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setLesson(null);
        } else {
          const data = snapshot.data();
          const loadedLesson: LessonData = {
            id: snapshot.id,
            title: data.title ?? 'Neue Lektion',
            type: (data.type as LessonType) ?? 'text',
            shortDescription: typeof data.shortDescription === 'string' ? data.shortDescription : '',
            content: typeof data.content === 'string' ? data.content : '',
            status: (data.status as LessonStatus) ?? 'draft',
            parentLessonId: typeof data.parentLessonId === 'string' ? data.parentLessonId : null,
          };
          setLesson(loadedLesson);
          setLessonForm({
            title: loadedLesson.title,
            shortDescription: loadedLesson.shortDescription,
            content: loadedLesson.content,
            status: loadedLesson.status,
          });
        }
        setLessonLoading(false);
      },
      () => {
        setLesson(null);
        setLessonLoading(false);
      },
    );
    return unsubscribe;
  }, [lessonRef]);

  const handleLessonInputChange = (field: keyof LessonFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setLessonForm((prev) => ({ ...prev, [field]: value }));
    };

  const handleLessonStatusSelect = (status: LessonStatus) => {
    setLessonForm((prev) => ({ ...prev, status }));
  };

  const handleSaveLesson = async () => {
    if (!lessonRef) {
      return;
    }
    if (!lessonForm.title.trim()) {
      setPageError('Bitte einen Lektionstitel angeben.');
      return;
    }
    setPageError(null);
    setSaving(true);
    try {
      await updateDoc(lessonRef, {
        title: lessonForm.title.trim(),
        shortDescription: lessonForm.shortDescription.trim(),
        content: lessonForm.content.trim(),
        status: lessonForm.status,
        updatedAt: serverTimestamp(),
      });
      setSaveSuccessOpen(true);
    } catch (error) {
      setPageError('Lektion konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLesson = async () => {
    if (!lessonRef || !courseRef || !lesson) {
      return;
    }
    if (!window.confirm('Lektion wirklich löschen?')) {
      return;
    }
    setPageError(null);
    setActionLoading(true);
    try {
      await deleteDoc(lessonRef);
      if (lesson.type !== 'subchapter') {
        await updateDoc(courseRef, { lessons: increment(-1) });
      }
      navigate(`/courses/${courseId}`);
    } catch (error) {
      setPageError('Lektion konnte nicht gelöscht werden.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBackToCourse = () => {
    navigate(courseId ? `/courses/${courseId}` : '/courses');
  };

  const isTextLesson = lesson?.type === 'text';

  const renderStatusButtons = () => (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {Object.entries(statusStyles).map(([value, config]) => {
        const isActive = lessonForm.status === value;
        return (
          <Button
            key={value}
            size="small"
            variant={isActive ? 'contained' : 'outlined'}
            onClick={() => handleLessonStatusSelect(value as LessonStatus)}
            sx={{
              textTransform: 'none',
              borderColor: isActive ? statusButtonActiveColor : undefined,
              bgcolor: isActive ? statusButtonActiveColor : undefined,
              color: isActive ? '#fff' : undefined,
              boxShadow: 'none',
              '&:hover': isActive
                ? {
                    borderColor: statusButtonActiveColor,
                    bgcolor: statusButtonActiveColor,
                  }
                : undefined,
            }}
          >
            {config.label}
          </Button>
        );
      })}
    </Stack>
  );

  if (!courseId || !chapterId || !lessonId) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="warning">Diese Lektion konnte nicht geladen werden.</Alert>
      </Box>
    );
  }

  if (!currentUser) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="info">Bitte melde dich an, um Lektionen zu bearbeiten.</Alert>
      </Box>
    );
  }

  const showLoader = courseLoading || chapterLoading || lessonLoading;

  return (
    <Box
      sx={{
        p: { xs: 2, md: 4 },
        maxWidth: 1160,
        mx: 'auto',
        width: '100%',
      }}
    >
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={RouterLink} to="/courses" underline="hover" color="inherit">
          Kurse
        </Link>
        {courseId ? (
          <Link component={RouterLink} to={`/courses/${courseId}`} underline="hover" color="inherit">
            {course?.title ?? 'Kurs'}
          </Link>
        ) : null}
        <Typography color="text.primary">{lessonForm.title || 'Lektion'}</Typography>
      </Breadcrumbs>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            {lessonForm.title || 'Text-Lektion'}
          </Typography>
          <Typography color="text.secondary">
            {chapter?.title ? `${chapter.title} · ${course?.title ?? ''}` : course?.title ?? ''}
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={handleBackToCourse}
            sx={{ textTransform: 'none' }}
          >
            Zurück zum Kurs
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveLesson}
            disabled={saving || !lessonForm.title.trim() || !isTextLesson}
            sx={{ textTransform: 'none', minWidth: 160 }}
          >
            {saving ? 'Speichert...' : 'Änderungen speichern'}
          </Button>
        </Stack>
      </Stack>

      {pageError ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {pageError}
        </Alert>
      ) : null}

      {showLoader ? (
        <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
          <CircularProgress />
        </Stack>
      ) : !lesson ? (
        <Alert severity="warning">
          Diese Lektion wurde nicht gefunden oder wurde gelöscht.
        </Alert>
      ) : !isTextLesson ? (
        <Alert severity="info">
          Dieser Lektionstyp wird aktuell nicht in der Textbearbeitung unterstützt.
        </Alert>
      ) : (
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Status
            </Typography>
            {renderStatusButtons()}
          </Box>
          <TextField
            label="Name der Lektion"
            value={lessonForm.title}
            onChange={handleLessonInputChange('title')}
            fullWidth
          />
          <TextField
            label="Kurzbeschreibung"
            value={lessonForm.shortDescription}
            onChange={handleLessonInputChange('shortDescription')}
            multiline
            minRows={2}
            fullWidth
          />
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Textinhalt
            </Typography>
            <TextField
              placeholder="Schreibe hier den ausführlichen Lektionstext ..."
              value={lessonForm.content}
              onChange={handleLessonInputChange('content')}
              multiline
              minRows={12}
              fullWidth
            />
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteOutlineIcon />}
              onClick={handleDeleteLesson}
              disabled={actionLoading}
              sx={{ textTransform: 'none' }}
            >
              Löschen
            </Button>
            <IconButton onClick={handleBackToCourse} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
              <ArrowBackIcon />
            </IconButton>
          </Stack>
        </Stack>
      )}
      
      <Snackbar
        open={saveSuccessOpen}
        autoHideDuration={3000}
        onClose={() => setSaveSuccessOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSaveSuccessOpen(false)}
          severity="success"
          variant="filled"
          icon={<CheckCircleIcon />}
          sx={{ width: '100%' }}
        >
          Änderungen erfolgreich gespeichert
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default LessonEditor;
