import { useEffect, useMemo, useState, useCallback, useRef, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  alpha,
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Link,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { darken, lighten, getLuminance } from '@mui/system';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';
import { useNavigation } from '../context/NavigationContext';
import LessonContentBuilder from '../components/lessonBuilder/LessonContentBuilder';
import { isConfirmDeleteEnabled } from '../utils/preferences';
import {
  resolveBlocks,
  blocksTotalDuration,
  type ContentBlock,
} from '../types/lessonContent';

const getStatusStyles = (brandColor: string) => ({
  published: {
    label: 'Veröffentlicht',
    dot: '#22c55e',
    color: brandColor,
    chipBg: 'rgba(34, 197, 94, 0.15)',
    chipText: '#15803d',
  },
  draft: {
    label: 'Entwurf',
    dot: brandColor,
    color: brandColor,
    chipBg: `${brandColor}20`,
    chipText: brandColor,
  },
  disabled: {
    label: 'Deaktiviert',
    dot: '#ef4444',
    color: brandColor,
    chipBg: 'rgba(239, 68, 68, 0.15)',
    chipText: '#b91c1c',
  },
} as const);

type LessonStatus = 'published' | 'draft' | 'disabled';
// 'lesson' = Baukasten-Lektion. video/pdf/text bleiben als Legacy nur lesbar.
type LessonType = 'subchapter' | 'lesson' | 'video' | 'pdf' | 'text';

type CourseMeta = { id: string; title: string };
type ChapterMeta = { id: string; title: string };

type LessonData = {
  id: string;
  title: string;
  type: LessonType;
  shortDescription: string;
  status: LessonStatus;
  parentLessonId: string | null;
};

type LessonFormState = {
  title: string;
  shortDescription: string;
  status: LessonStatus;
};

const emptyLessonForm: LessonFormState = {
  title: '',
  shortDescription: '',
  status: 'published',
};

type NavLesson = {
  id: string;
  chapterId: string;
  title: string;
};

const LessonEditor = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const primaryColor = theme.palette.primary.main;
  const statusStyles = useMemo(() => getStatusStyles(primaryColor), [primaryColor]);
  const { courseId, chapterId, lessonId } = useParams<{ courseId: string; chapterId: string; lessonId: string }>();
  const { registerNavigationGuard, unregisterNavigationGuard } = useNavigation();
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [course, setCourse] = useState<CourseMeta | null>(null);
  const [chapter, setChapter] = useState<ChapterMeta | null>(null);
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [lessonForm, setLessonForm] = useState<LessonFormState>(emptyLessonForm);
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [courseLoading, setCourseLoading] = useState(true);
  const [chapterLoading, setChapterLoading] = useState(true);
  const [lessonLoading, setLessonLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [saveSuccessOpen, setSaveSuccessOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [blockedNavigation, setBlockedNavigation] = useState<(() => void) | null>(null);
  const hasUnsavedChangesRef = useRef(false);
  const isLoadingLessonRef = useRef(false);
  const [warningEnabled, setWarningEnabled] = useState(true);
  const [allNavLessons, setAllNavLessons] = useState<NavLesson[]>([]);

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const saved = localStorage.getItem('showUnsavedWarning');
    if (saved !== null) {
      setWarningEnabled(saved === 'true');
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => setCurrentUser(user));
    return unsubscribe;
  }, []);

  // Warnung beim Verlassen der Seite
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && warningEnabled) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, warningEnabled]);

  const navigationGuard = useCallback(() => {
    if (hasUnsavedChangesRef.current && warningEnabled) {
      setShowUnsavedDialog(true);
      return false;
    }
    return true;
  }, [warningEnabled]);

  useEffect(() => {
    registerNavigationGuard(navigationGuard);
    return () => unregisterNavigationGuard();
  }, [navigationGuard, registerNavigationGuard, unregisterNavigationGuard]);

  const courseRef = useMemo(() => {
    if (!currentUser || !courseId) return null;
    return doc(db, 'users', currentUser.uid, 'courses', courseId);
  }, [currentUser, courseId]);

  const chaptersCollection = useMemo(() => (courseRef ? collection(courseRef, 'chapters') : null), [courseRef]);

  const chapterRef = useMemo(
    () => (chaptersCollection && chapterId ? doc(chaptersCollection, chapterId) : null),
    [chaptersCollection, chapterId],
  );

  const lessonsCollection = useMemo(() => (chapterRef ? collection(chapterRef, 'lessons') : null), [chapterRef]);

  const lessonRef = useMemo(
    () => (lessonsCollection && lessonId ? doc(lessonsCollection, lessonId) : null),
    [lessonsCollection, lessonId],
  );

  useEffect(() => {
    if (!courseRef) {
      setCourse(null);
      setCourseLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(
      courseRef,
      (snapshot) => {
        setCourse(snapshot.exists() ? { id: snapshot.id, title: snapshot.data().title ?? 'Unbenannter Kurs' } : null);
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
        setChapter(snapshot.exists() ? { id: snapshot.id, title: snapshot.data().title ?? 'Kapitel' } : null);
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
            type: (data.type as LessonType) ?? 'lesson',
            shortDescription: typeof data.shortDescription === 'string' ? data.shortDescription : '',
            status: (data.status as LessonStatus) ?? 'draft',
            parentLessonId: typeof data.parentLessonId === 'string' ? data.parentLessonId : null,
          };
          isLoadingLessonRef.current = true;
          setLesson(loadedLesson);
          setBlocks(resolveBlocks(data));
          setLessonForm({
            title: loadedLesson.title,
            shortDescription: loadedLesson.shortDescription,
            status: loadedLesson.status,
          });
          setHasUnsavedChanges(false);
          setTimeout(() => {
            isLoadingLessonRef.current = false;
          }, 0);
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

  // Alle Lektionen für die Vor/Zurück-Navigation
  useEffect(() => {
    if (!chaptersCollection || !courseRef) {
      setAllNavLessons([]);
      return;
    }
    let cancelled = false;
    const loadAllLessons = async () => {
      try {
        const chaptersSnap = await getDocs(chaptersCollection);
        const sortedChapters = chaptersSnap.docs
          .map((d) => ({ id: d.id, position: d.data().position ?? 0 }))
          .sort((a, b) => a.position - b.position);
        const result: NavLesson[] = [];
        for (const chapterItem of sortedChapters) {
          const lessonsSnap = await getDocs(collection(courseRef, 'chapters', chapterItem.id, 'lessons'));
          const sortedLessons = lessonsSnap.docs
            .map((d) => ({
              id: d.id,
              chapterId: chapterItem.id,
              title: d.data().title ?? 'Lektion',
              type: d.data().type as LessonType,
              position: d.data().position ?? 0,
              parentLessonId: d.data().parentLessonId ?? null,
            }))
            .filter((l) => l.type !== 'subchapter' && !l.parentLessonId)
            .sort((a, b) => a.position - b.position);
          result.push(...sortedLessons.map((l) => ({ id: l.id, chapterId: l.chapterId, title: l.title })));
        }
        if (!cancelled) setAllNavLessons(result);
      } catch {
        if (!cancelled) setAllNavLessons([]);
      }
    };
    loadAllLessons();
    return () => {
      cancelled = true;
    };
  }, [chaptersCollection, courseRef]);

  const handleLessonInputChange =
    (field: keyof LessonFormState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setLessonForm((prev) => ({ ...prev, [field]: value }));
      setHasUnsavedChanges(true);
    };

  const handleLessonStatusSelect = (status: LessonStatus) => {
    setLessonForm((prev) => ({ ...prev, status }));
    setHasUnsavedChanges(true);
  };

  // Kurs-Gesamtdauer aus den gespeicherten Lektions-Dauern neu berechnen.
  const updateCourseDuration = useCallback(async () => {
    if (!currentUser || !courseId) return;
    try {
      let totalSeconds = 0;
      const chaptersSnapshot = await getDocs(collection(db, 'users', currentUser.uid, 'courses', courseId, 'chapters'));
      for (const chapterDoc of chaptersSnapshot.docs) {
        const lessonsSnapshot = await getDocs(collection(chapterDoc.ref, 'lessons'));
        for (const lessonDoc of lessonsSnapshot.docs) {
          const d = lessonDoc.data().videoDuration;
          if (typeof d === 'number' && isFinite(d)) totalSeconds += d;
        }
      }
      let formattedDuration = '0:00';
      if (totalSeconds > 0) {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);
        formattedDuration =
          hours > 0
            ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            : `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
      await setDoc(
        doc(db, 'users', currentUser.uid, 'courses', courseId),
        { duration: formattedDuration },
        { merge: true },
      );
    } catch (error) {
      console.error('Could not update course duration:', error);
    }
  }, [currentUser, courseId]);

  // Sofort speichern (nach Medien-Upload/-Entfernen im Baukasten).
  const persistBlocks = useCallback(
    async (next: ContentBlock[]) => {
      if (!lessonRef) return;
      try {
        await updateDoc(lessonRef, {
          blocks: next,
          type: 'lesson',
          videoDuration: blocksTotalDuration(next),
          updatedAt: serverTimestamp(),
        });
        await updateCourseDuration();
      } catch (error) {
        console.error('Could not persist blocks:', error);
        setPageError('Inhalt konnte nicht gespeichert werden.');
      }
    },
    [lessonRef, updateCourseDuration],
  );

  const handleSaveLesson = async () => {
    if (!lessonRef) return;
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
        status: lessonForm.status,
        type: 'lesson',
        blocks,
        videoDuration: blocksTotalDuration(blocks),
        updatedAt: serverTimestamp(),
      });
      setHasUnsavedChanges(false);
      setSaveSuccessOpen(true);
      await updateCourseDuration();
    } catch (error) {
      console.error('Could not save lesson:', error);
      setPageError('Lektion konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLesson = async () => {
    if (!lessonRef || !courseRef || !lesson) return;
    if (isConfirmDeleteEnabled() && !window.confirm('Lektion wirklich löschen?')) return;
    setPageError(null);
    setActionLoading(true);
    try {
      await deleteDoc(lessonRef);
      if (lesson.type !== 'subchapter') {
        await updateDoc(courseRef, { lessons: increment(-1) });
      }
      await updateCourseDuration();
      setHasUnsavedChanges(false);
      navigate(`/courses/${courseId}`);
    } catch (error) {
      console.error('Could not delete lesson:', error);
      setPageError('Lektion konnte nicht gelöscht werden.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleNavigateTo = (path: string) => {
    if (hasUnsavedChanges && warningEnabled) {
      setBlockedNavigation(() => () => navigate(path));
      setShowUnsavedDialog(true);
    } else {
      navigate(path);
    }
  };

  const handleBackToCourse = () => handleNavigateTo(courseId ? `/courses/${courseId}` : '/courses');

  const handleNavigateToLesson = (targetChapterId: string, targetLessonId: string) =>
    handleNavigateTo(`/courses/${courseId}/chapters/${targetChapterId}/lessons/${targetLessonId}`);

  const handleConfirmNavigation = () => {
    setShowUnsavedDialog(false);
    setHasUnsavedChanges(false);
    if (blockedNavigation) {
      blockedNavigation();
      setBlockedNavigation(null);
    }
  };

  const handleCancelNavigation = () => {
    setShowUnsavedDialog(false);
    setBlockedNavigation(null);
  };

  const currentNavIndex = allNavLessons.findIndex((l) => l.id === lessonId);
  const prevNavLesson = currentNavIndex > 0 ? allNavLessons[currentNavIndex - 1] : null;
  const nextNavLesson =
    currentNavIndex >= 0 && currentNavIndex < allNavLessons.length - 1 ? allNavLessons[currentNavIndex + 1] : null;

  const isSubchapter = lesson?.type === 'subchapter';
  const isEditableLesson = Boolean(lesson) && !isSubchapter;

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
              borderColor: isActive ? primaryColor : undefined,
              bgcolor: isActive ? primaryColor : undefined,
              color: isActive ? '#fff' : undefined,
              boxShadow: 'none',
              '&:hover': isActive ? { borderColor: primaryColor, bgcolor: primaryColor } : undefined,
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
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1160, mx: 'auto', width: '100%' }}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          component="button"
          onClick={(e) => {
            e.preventDefault();
            handleNavigateTo('/courses');
          }}
          underline="hover"
          color="inherit"
          sx={{ cursor: 'pointer' }}
        >
          Kurse
        </Link>
        <Link
          component="button"
          onClick={(e) => {
            e.preventDefault();
            handleNavigateTo(`/courses/${courseId}`);
          }}
          underline="hover"
          color="inherit"
          sx={{ cursor: 'pointer' }}
        >
          {course?.title ?? 'Kurs'}
        </Link>
        <Typography color="text.primary">{lessonForm.title || 'Lektion'}</Typography>
      </Breadcrumbs>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems="flex-start"
        justifyContent="space-between"
        mb={3}
      >
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            {lessonForm.title || 'Lektion'}
          </Typography>
          <Typography color="text.secondary">
            {chapter?.title ? `${chapter.title} · ${course?.title ?? ''}` : course?.title ?? ''}
          </Typography>
        </Box>
        <Stack spacing={1} alignItems={{ xs: 'flex-start', md: 'flex-end' }}>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={handleBackToCourse} sx={{ textTransform: 'none' }}>
            Zurück zum Kurs
          </Button>
          {allNavLessons.length > 1 && (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Tooltip title={prevNavLesson ? prevNavLesson.title : ''}>
                <span>
                  <IconButton
                    size="small"
                    disabled={!prevNavLesson}
                    onClick={() => prevNavLesson && handleNavigateToLesson(prevNavLesson.chapterId, prevNavLesson.id)}
                    sx={{ border: '1px solid', borderColor: 'divider' }}
                  >
                    <ArrowBackIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={nextNavLesson ? nextNavLesson.title : ''}>
                <span>
                  <IconButton
                    size="small"
                    disabled={!nextNavLesson}
                    onClick={() => nextNavLesson && handleNavigateToLesson(nextNavLesson.chapterId, nextNavLesson.id)}
                    sx={{ border: '1px solid', borderColor: 'divider' }}
                  >
                    <ArrowForwardIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          )}
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
        <Alert severity="warning">Diese Lektion wurde nicht gefunden oder wurde gelöscht.</Alert>
      ) : !isEditableLesson ? (
        <Alert
          severity="info"
          sx={{
            backgroundColor: (t) => alpha(t.palette.primary.main, 0.1),
            color: (t) => {
              const lum = getLuminance(t.palette.primary.main);
              return t.palette.mode === 'dark'
                ? lum < 0.3
                  ? lighten(t.palette.primary.main, 0.5)
                  : t.palette.primary.main
                : lum > 0.7
                  ? darken(t.palette.primary.main, 0.5)
                  : t.palette.primary.main;
            },
          }}
        >
          Unterkapitel haben keinen eigenen Inhalt. Sie gruppieren Lektionen.
        </Alert>
      ) : (
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Status
            </Typography>
            {renderStatusButtons()}
          </Box>
          <TextField label="Name der Lektion" value={lessonForm.title} onChange={handleLessonInputChange('title')} fullWidth />
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
              Inhalt
            </Typography>
            <LessonContentBuilder
              blocks={blocks}
              uploadContext={{ userId: currentUser.uid, courseId, lessonId }}
              onChange={(next) => {
                setBlocks(next);
                if (!isLoadingLessonRef.current) setHasUnsavedChanges(true);
              }}
              onPersist={(next) => {
                setBlocks(next);
                void persistBlocks(next);
              }}
            />
          </Box>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', sm: 'center' }}
          >
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
            <Button
              variant="contained"
              onClick={handleSaveLesson}
              disabled={saving || !lessonForm.title.trim()}
              sx={{ textTransform: 'none', minWidth: 160 }}
            >
              {saving ? 'Speichert...' : 'Änderungen speichern'}
            </Button>
          </Stack>
        </Stack>
      )}

      <Dialog open={showUnsavedDialog} onClose={handleCancelNavigation}>
        <DialogTitle>Nicht gespeicherte Änderungen</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Du hast nicht gespeicherte Änderungen. Möchtest du diese Seite wirklich verlassen? Alle nicht gespeicherten
            Änderungen gehen verloren.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelNavigation} color="primary">
            Abbrechen
          </Button>
          <Button onClick={handleConfirmNavigation} color="error" variant="contained" autoFocus>
            Trotzdem verlassen
          </Button>
        </DialogActions>
      </Dialog>

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
