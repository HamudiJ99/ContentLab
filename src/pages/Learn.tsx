import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Typography,
  Box,
  Button,
  Stack,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Alert,
  alpha,
  Paper,
  Divider,
  Drawer,
  IconButton,
  TextField,
  Tooltip,
  useTheme,
} from '@mui/material';
import { darken, lighten, getLuminance } from '@mui/system';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import FolderIcon from '@mui/icons-material/Folder';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import NoteAltOutlinedIcon from '@mui/icons-material/NoteAltOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';
import LessonContentView from '../components/lessonBuilder/LessonContentView';
import { resolveBlocks, type ContentBlock } from '../types/lessonContent';

type Course = {
  id: string;
  title: string;
  description: string;
  coverImageUrl?: string;
  coverColor?: string;
};

type Chapter = {
  id: string;
  title: string;
  description: string;
  position: number;
};

type LessonType = 'video' | 'pdf' | 'text' | 'subchapter';

type Attachment = {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: number;
};

type Lesson = {
  id: string;
  chapterId: string;
  title: string;
  type: LessonType;
  position: number;
  shortDescription?: string;
  content?: string;
  pdfUrl?: string;
  videoUrl?: string;
  videoDuration?: number;
  parentLessonId?: string;
  attachments?: Attachment[];
  blocks?: ContentBlock[];
};

type FlatLesson = Lesson & {
  chapterTitle: string;
};

type Note = {
  id: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
};

export default function Learn() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [course, setCourse] = useState<Course | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [lessonsByChapter, setLessonsByChapter] = useState<Record<string, Lesson[]>>({});
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [expandedSubchapters, setExpandedSubchapters] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const theme = useTheme();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUser || !courseId) {
      setLoading(false);
      return;
    }

    const loadCourseData = async () => {
      setLoading(true);
      setError(null);
      try {
        let ownerId = currentUser.uid;
        let courseDocRef = doc(db, 'users', ownerId, 'courses', courseId);
        let courseDoc = await getDoc(courseDocRef);

        if (!courseDoc.exists()) {
          const enrollmentDoc = await getDoc(doc(db, 'users', currentUser.uid, 'enrollments', courseId));
          if (!enrollmentDoc.exists()) {
            setError('Kurs nicht gefunden oder nicht freigegeben');
            setLoading(false);
            return;
          }

          const enrollmentData = enrollmentDoc.data();
          ownerId = enrollmentData.ownerId;
          if (!ownerId) {
            setError('Kurszuordnung unvollständig. Bitte erneut einladen.');
            setLoading(false);
            return;
          }

          courseDocRef = doc(db, 'users', ownerId, 'courses', courseId);
          courseDoc = await getDoc(courseDocRef);
          if (!courseDoc.exists()) {
            setError('Der Kurs ist nicht mehr verfügbar.');
            setLoading(false);
            return;
          }
        }

        const courseData = courseDoc.data();
        setCourse({
          id: courseDoc.id,
          title: courseData.title ?? 'Kurs',
          description: courseData.description ?? '',
          coverImageUrl: courseData.coverImageUrl,
          coverColor: courseData.coverColor,
        });

        // Lade alle Kapitel und filtere veröffentlichte
        const chaptersSnapshot = await getDocs(
          collection(db, 'users', ownerId, 'courses', courseId, 'chapters')
        );

        const loadedChapters = chaptersSnapshot.docs
          .map((doc, index) => ({
            id: doc.id,
            title: doc.data().title ?? 'Kapitel',
            description: doc.data().description ?? '',
            position: doc.data().position ?? index,
            status: doc.data().status,
          }))
          .filter((chapter) => chapter.status === 'published')
          .sort((a, b) => a.position - b.position)
          .map(({ status, ...chapter }) => chapter);
        
        setChapters(loadedChapters);

        // Lade veröffentlichte Lektionen für jedes Kapitel
        const lessonsByChap: Record<string, Lesson[]> = {};
        for (const chapter of loadedChapters) {
          const lessonsSnapshot = await getDocs(
            collection(db, 'users', ownerId, 'courses', courseId, 'chapters', chapter.id, 'lessons')
          );

          lessonsByChap[chapter.id] = lessonsSnapshot.docs
            .map((doc, index) => ({
              id: doc.id,
              chapterId: chapter.id,
              title: doc.data().title ?? 'Lektion',
              type: (doc.data().type as LessonType) ?? 'text',
              position: doc.data().position ?? index,
              shortDescription: doc.data().shortDescription,
              content: doc.data().content,
              pdfUrl: doc.data().pdfUrl,
              videoUrl: doc.data().videoUrl,
              videoDuration: typeof doc.data().videoDuration === 'number' ? doc.data().videoDuration : undefined,
              status: doc.data().status,
              parentLessonId: doc.data().parentLessonId,
              attachments: Array.isArray(doc.data().attachments) ? doc.data().attachments : [],
              blocks: resolveBlocks(doc.data()),
            }))
            .filter((lesson) => lesson.status === 'published')
            .sort((a, b) => a.position - b.position)
            .map(({ status, ...lesson }) => lesson);
        }
        setLessonsByChapter(lessonsByChap);

        // Lade Fortschritt
        const progressDoc = await getDoc(
          doc(db, 'users', currentUser.uid, 'courseProgress', courseId)
        );

        // Erstelle Set mit allen verfügbaren Lektions-IDs
        const allLessons = loadedChapters.flatMap((ch) => lessonsByChap[ch.id] || []);
        const availableLessonIds = new Set(allLessons.map(l => l.id));

        if (progressDoc.exists()) {
          const progressData = progressDoc.data();
          
          // Filtere completedLessons: Behalte nur IDs, die noch in verfügbaren Lektionen existieren
          const validCompletedLessons = (progressData.completedLessons || [])
            .filter((lessonId: string) => availableLessonIds.has(lessonId));
          
          setCompletedLessons(new Set(validCompletedLessons));
          
          // Wenn sich die completedLessons geändert haben (wegen deaktivierten/gelöschten Lektionen),
          // aktualisiere das Progress-Dokument
          if (validCompletedLessons.length !== (progressData.completedLessons || []).length) {
            await setDoc(
              doc(db, 'users', currentUser.uid, 'courseProgress', courseId),
              {
                completedLessons: validCompletedLessons,
                totalLessons: allLessons.length,
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          }
          
          // Finde letzte nicht abgeschlossene Lektion
          const nextLesson = allLessons.find((lesson) => 
            !validCompletedLessons.includes(lesson.id)
          );
          setCurrentLessonId(nextLesson?.id || allLessons[0]?.id || null);
        } else {
          // Kein Fortschritt vorhanden - initialisiere mit leerem Set
          setCompletedLessons(new Set());
          
          // Starte mit erster Lektion
          const firstChapter = loadedChapters[0];
          if (firstChapter && lessonsByChap[firstChapter.id]?.[0]) {
            setCurrentLessonId(lessonsByChap[firstChapter.id][0].id);
          }
        }

        // Expandiere das Kapitel der aktuellen Lektion
        if (loadedChapters.length > 0) {
          setExpandedChapters(new Set([loadedChapters[0].id]));
        }

      } catch (err) {
        console.error('Fehler beim Laden:', err);
        setError('Kursdaten konnten nicht geladen werden');
      } finally {
        setLoading(false);
      }
    };

    loadCourseData();
  }, [currentUser, courseId]);

  // Notes Firestore collection — stored under current user, keyed by lesson
  const notesCollection = useMemo(() => {
    if (!currentUser || !courseId || !currentLessonId) return null;
    // Find chapterId from lessonsByChapter (available as state)
    let chapterId: string | null = null;
    for (const [cId, lessons] of Object.entries(lessonsByChapter)) {
      if (lessons.some((l) => l.id === currentLessonId)) {
        chapterId = cId;
        break;
      }
    }
    if (!chapterId) return null;
    return collection(
      db,
      'users', currentUser.uid,
      'courses', courseId,
      'chapters', chapterId,
      'lessons', currentLessonId,
      'notes'
    );
  }, [currentUser, courseId, currentLessonId, lessonsByChapter]);

  // Reset notes when lesson changes
  const prevLessonIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevLessonIdRef.current !== currentLessonId) {
      prevLessonIdRef.current = currentLessonId;
      setNotes([]);
      setNewNoteText('');
      setEditingNoteId(null);
      setEditingNoteText('');
    }
  }, [currentLessonId]);

  // Load notes when panel opens
  useEffect(() => {
    if (!notesOpen || !notesCollection) return;
    let cancelled = false;
    const loadNotes = async () => {
      setNotesLoading(true);
      try {
        const snap = await getDocs(notesCollection);
        if (!cancelled) {
          const loaded: Note[] = snap.docs.map((d) => ({
            id: d.id,
            text: d.data().text ?? '',
            createdAt: d.data().createdAt?.toDate?.() ?? new Date(),
            updatedAt: d.data().updatedAt?.toDate?.() ?? new Date(),
          })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          setNotes(loaded);
        }
      } finally {
        if (!cancelled) setNotesLoading(false);
      }
    };
    loadNotes();
    return () => { cancelled = true; };
  }, [notesOpen, notesCollection]);

  const handleAddNote = async () => {
    if (!notesCollection || !newNoteText.trim()) return;
    setSavingNote(true);
    try {
      const id = crypto.randomUUID();
      const now = new Date();
      await setDoc(doc(notesCollection, id), { text: newNoteText.trim(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      setNotes((prev) => [{ id, text: newNoteText.trim(), createdAt: now, updatedAt: now }, ...prev]);
      setNewNoteText('');
    } finally {
      setSavingNote(false);
    }
  };

  const handleSaveEditNote = async (id: string) => {
    if (!notesCollection || !editingNoteText.trim()) return;
    setSavingNote(true);
    try {
      await updateDoc(doc(notesCollection, id), { text: editingNoteText.trim(), updatedAt: serverTimestamp() });
      setNotes((prev) => prev.map((n) => n.id === id ? { ...n, text: editingNoteText.trim(), updatedAt: new Date() } : n));
      setEditingNoteId(null);
      setEditingNoteText('');
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!notesCollection) return;
    await deleteDoc(doc(notesCollection, id));
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const formatNoteDate = (d: Date) =>
    d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  const allLessons: FlatLesson[] = chapters.flatMap((chapter) => {
    const chapterLessons = lessonsByChapter[chapter.id] || [];
    const standaloneLessons = chapterLessons.filter(l => !l.parentLessonId && l.type !== 'subchapter');
    const subchapters = chapterLessons.filter(l => l.type === 'subchapter');
    
    const result: FlatLesson[] = [];
    
    // Füge eigenständige Lektionen hinzu
    standaloneLessons.forEach(lesson => {
      result.push({
        ...lesson,
        chapterTitle: chapter.title,
      });
    });
    
    // Füge Unterkapitel mit ihren Kindern hinzu
    subchapters.forEach(subchapter => {
      const subLessons = chapterLessons.filter(l => l.parentLessonId === subchapter.id);
      // Unterkapitel selbst nicht hinzufügen (nicht anklickbar)
      // Nur die Kinder hinzufügen
      subLessons.forEach(lesson => {
        result.push({
          ...lesson,
          chapterTitle: chapter.title,
        });
      });
    });
    
    return result;
  });

  const currentLesson = currentLessonId
    ? allLessons.find((lesson) => lesson.id === currentLessonId)
    : null;

  const currentLessonIndex = currentLesson
    ? allLessons.findIndex((lesson) => lesson.id === currentLesson.id)
    : -1;

  const nextLesson = currentLessonIndex >= 0 && currentLessonIndex < allLessons.length - 1
    ? allLessons[currentLessonIndex + 1]
    : null;

  const previousLesson = currentLessonIndex > 0
    ? allLessons[currentLessonIndex - 1]
    : null;

  const totalLessons = allLessons.length;
  const completedCount = completedLessons.size;
  const progress = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  const handleCompleteLesson = async () => {
    if (!currentUser || !courseId || !currentLessonId) return;

    const newCompleted = new Set(completedLessons);
    newCompleted.add(currentLessonId);
    setCompletedLessons(newCompleted);

    try {
      const progressRef = doc(db, 'users', currentUser.uid, 'courseProgress', courseId);
      await setDoc(
        progressRef,
        {
          completedLessons: Array.from(newCompleted),
          lastAccessedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          [`lessonCompletedAt.${currentLessonId}`]: serverTimestamp(),
        },
        { merge: true }
      );

      // Gehe zur nächsten Lektion
      if (nextLesson) {
        setCurrentLessonId(nextLesson.id);
        
        // Expandiere das Kapitel der nächsten Lektion
        setExpandedChapters((prev) => new Set(prev).add(nextLesson.chapterId));
      }
    } catch (err) {
      console.error('Fehler beim Speichern des Fortschritts:', err);
    }
  };

  const handleToggleComplete = async (lessonId: string) => {
    if (!currentUser || !courseId) return;

    const newCompleted = new Set(completedLessons);
    const isCompleting = !newCompleted.has(lessonId);
    if (isCompleting) {
      newCompleted.add(lessonId);
    } else {
      newCompleted.delete(lessonId);
    }
    setCompletedLessons(newCompleted);

    try {
      const progressRef = doc(db, 'users', currentUser.uid, 'courseProgress', courseId);
      const updateData: Record<string, unknown> = {
        completedLessons: Array.from(newCompleted),
        lastAccessedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      if (isCompleting) {
        updateData[`lessonCompletedAt.${lessonId}`] = serverTimestamp();
      }
      
      await setDoc(progressRef, updateData, { merge: true });
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
    }
  };

  const handleSelectLesson = (lessonId: string, chapterId: string) => {
    setCurrentLessonId(lessonId);
    setExpandedChapters((prev) => new Set(prev).add(chapterId));
  };

  const handleToggleChapter = (chapterId: string) => {
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

  const handleToggleSubchapter = (subchapterId: string) => {
    setExpandedSubchapters((prev) => {
      const next = new Set(prev);
      if (next.has(subchapterId)) {
        next.delete(subchapterId);
      } else {
        next.add(subchapterId);
      }
      return next;
    });
  };

  const getLessonIcon = (type: LessonType) => {
    switch (type) {
      case 'video':
        return <PlayCircleOutlineIcon />;
      case 'text':
        return <ArticleOutlinedIcon />;
      case 'pdf':
        return <PictureAsPdfOutlinedIcon />;
      default:
        return <ArticleOutlinedIcon />;
    }
  };

  if (!courseId) {
    return (
      <Box sx={{ p: 4, maxWidth: 1160, mx: 'auto' }}>
        <Alert severity="error">Kurs-ID fehlt</Alert>
      </Box>
    );
  }

  if (!currentUser) {
    return (
      <Box sx={{ p: 4, maxWidth: 1160, mx: 'auto' }}>
        <Alert 
          severity="info"
          sx={{
            backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.1),
            color: (theme) => {
              const lum = getLuminance(theme.palette.primary.main);
              if (theme.palette.mode === 'dark') {
                return lum < 0.3 ? lighten(theme.palette.primary.main, 0.5) : theme.palette.primary.main;
              } else {
                return lum > 0.7 ? darken(theme.palette.primary.main, 0.5) : theme.palette.primary.main;
              }
            },
            '& .MuiAlert-icon': {
              color: (theme) => {
                const lum = getLuminance(theme.palette.primary.main);
                if (theme.palette.mode === 'dark') {
                  return lum < 0.3 ? lighten(theme.palette.primary.main, 0.5) : theme.palette.primary.main;
                } else {
                  return lum > 0.7 ? darken(theme.palette.primary.main, 0.5) : theme.palette.primary.main;
                }
              },
            },
          }}
        >
          Bitte melde dich an, um diesen Kurs zu sehen.
        </Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  if (error || !course) {
    return (
      <Box sx={{ p: 4, maxWidth: 1160, mx: 'auto' }}>
        <Alert severity="error">{error || 'Kurs nicht gefunden'}</Alert>
        <Button onClick={() => navigate('/')} sx={{ mt: 2 }}>
          Zurück zum Dashboard
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Kurs-Header mit Cover */}
      <Box
        sx={{
          position: 'relative',
          bgcolor: course.coverColor ?? 'primary.main',
          backgroundImage: course.coverImageUrl ? `url(${course.coverImageUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          minHeight: headerCollapsed ? 0 : { xs: 130, md: 160 },
          maxHeight: headerCollapsed ? 0 : 500,
          overflow: 'hidden',
          transition: 'min-height 0.3s ease, max-height 0.3s ease',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
        }}
      >
        {/* Gradient-Overlay for readability */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.6) 100%)',
          }}
        />
        <IconButton
            onClick={() => navigate('/dashboard')}
            size="small"
            sx={{ color: 'white', position: 'absolute', top: 12, left: { xs: 8, md: 16 }, zIndex: 1, '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}
          >
            <ArrowBackIcon />
          </IconButton>
        <Box sx={{ position: 'relative', px: { xs: 2, md: 3 }, pb: 2, pt: '52px', pr: { xs: '100px', md: '120px' } }}>
            {/* Left: title + description */}
              <Typography variant="h5" fontWeight={700} color="white" sx={{ maxWidth: { xs: '100%', md: 700 } }}>
                {course.title}
              </Typography>
              {course.description && (() => {
                const LIMIT = 200;
                const isLong = course.description.length > LIMIT;
                const displayed = descExpanded || !isLong
                  ? course.description
                  : course.description.slice(0, LIMIT) + '…';
                return (
                  <Box>
                    <Typography
                      variant="body2"
                      color="rgba(255,255,255,0.85)"
                      sx={{ mt: 0.5, maxWidth: { xs: '100%', md: 700 }, whiteSpace: 'pre-wrap' }}
                    >
                      {displayed}
                    </Typography>
                    {isLong && (
                      <Typography
                        variant="caption"
                        onClick={() => setDescExpanded((v) => !v)}
                        sx={{
                          color: 'rgba(255,255,255,0.7)',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          mt: 0.25,
                          display: 'inline-block',
                          '&:hover': { color: 'white' },
                        }}
                      >
                        {descExpanded ? 'Weniger anzeigen' : 'Mehr anzeigen'}
                      </Typography>
                    )}
                  </Box>
                );
              })()}
        </Box>

        {/* Progress: absolute bottom-right */}
        <Box sx={{ position: 'absolute', bottom: 'auto', top: { xs: 36, md: 40 }, right: { xs: 12, md: 20 }, zIndex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Box sx={{ position: 'relative', display: 'inline-flex' }}>
            <CircularProgress
              variant="determinate"
              value={100}
              size={72}
              thickness={4}
              sx={{ color: 'rgba(255,255,255,0.25)', position: 'absolute' }}
            />
            <CircularProgress
              variant="determinate"
              value={progress}
              size={72}
              thickness={4}
              sx={{ color: 'white' }}
            />
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="body2" fontWeight={700} color="white">{progress}%</Typography>
            </Box>
          </Box>
          <Typography variant="caption" color="rgba(255,255,255,0.85)" sx={{ mt: 0.75, whiteSpace: 'nowrap' }}>
            {completedCount}/{totalLessons} Lektionen
          </Typography>
        </Box>
      </Box>

      {/* Schmale Leiste für Sidebar-Toggle */}
      <Box sx={{
        px: { xs: 2, md: 3 },
        py: 0.75,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <Tooltip title={headerCollapsed ? 'Kurscover einblenden' : 'Kurscover ausblenden'}>
          <IconButton size="small" onClick={() => setHeaderCollapsed((v) => !v)}>
            {headerCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
          </IconButton>
        </Tooltip>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Tooltip title="Meine Notizen">
            <span>
              <IconButton size="small" onClick={() => setNotesOpen(true)} disabled={!currentLessonId}>
                <NoteAltOutlinedIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={sidebarOpen ? 'Kursinhalt ausblenden' : 'Kursinhalt anzeigen'}>
            <IconButton size="small" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <MenuBookIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Main Layout: Content Links, Sidebar Rechts */}
      <Stack direction="row" sx={{ minHeight: 'calc(100vh - 48px)' }}>
        {/* Content Area (Links) */}
        <Box sx={{ flex: 1, overflow: 'auto', height: 'calc(100vh - 48px)' }}>
          {currentLesson ? (
            <Box sx={{ maxWidth: 1000, mx: 'auto', p: { xs: 2, md: 4 } }}>
              <Box sx={{ mb: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="overline" color="text.secondary">
                      {currentLesson.chapterTitle}
                    </Typography>
                    <Typography variant="h4" fontWeight={700} gutterBottom>
                      {currentLesson.title}
                    </Typography>
                    {currentLesson.shortDescription && (
                      <Typography variant="body1" color="text.secondary">
                        {currentLesson.shortDescription}
                      </Typography>
                    )}
                  </Box>
                </Stack>
              </Box>
              
              <LessonContentView blocks={currentLesson.blocks ?? []} />

                {/* Navigation Buttons */}
                <Divider sx={{ my: 4 }} />
                <Stack direction="row" spacing={2} justifyContent="space-between">
                  <Button
                    variant="outlined"
                    startIcon={<ArrowBackIcon />}
                    disabled={!previousLesson}
                    onClick={() => previousLesson && handleSelectLesson(previousLesson.id, previousLesson.chapterId)}
                  >
                    Vorherige Lektion
                  </Button>
                  <Stack direction="row" spacing={2}>
                    {!completedLessons.has(currentLesson.id) ? (
                      <Button
                        variant="contained"
                        onClick={handleCompleteLesson}
                        startIcon={<CheckCircleIcon />}
                        color="success"
                      >
                        Als erledigt markieren
                      </Button>
                    ) : (
                      <Button
                        variant="outlined"
                        onClick={() => handleToggleComplete(currentLesson.id)}
                      >
                        Als unerledigt markieren
                      </Button>
                    )}
                    {nextLesson && (
                      <Button
                        variant="contained"
                        endIcon={<ArrowForwardIcon />}
                        onClick={() => handleSelectLesson(nextLesson.id, nextLesson.chapterId)}
                      >
                        Nächste Lektion
                      </Button>
                    )}
                  </Stack>
                </Stack>
            </Box>
          ) : (
            /* Willkommens-Ansicht wenn keine Lektion ausgewählt */
            <Box 
              sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                minHeight: 400,
                textAlign: 'center',
                p: 4,
              }}
            >
              <Box
                sx={{
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 3,
                }}
              >
                <PlayArrowIcon sx={{ fontSize: 60, color: 'primary.main' }} />
              </Box>
              <Typography variant="h5" fontWeight={700} gutterBottom>
                Bereit zum Lernen?
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 400 }}>
                Wähle eine Lektion aus dem Kursinhalt, um zu beginnen.
                {totalLessons > 0 && ` Dieser Kurs enthält ${totalLessons} Lektionen.`}
              </Typography>
              {totalLessons > 0 && (
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<PlayArrowIcon />}
                  onClick={() => {
                    // Finde erste nicht-abgeschlossene Lektion oder erste Lektion
                    const allLessons = Object.values(lessonsByChapter).flat().filter(l => l.type !== 'subchapter');
                    const nextLesson = allLessons.find(l => !completedLessons.has(l.id)) || allLessons[0];
                    if (nextLesson) {
                      handleSelectLesson(nextLesson.id, nextLesson.chapterId);
                    }
                  }}
                >
                  {progress > 0 ? 'Lernen fortsetzen' : 'Kurs starten'}
                </Button>
              )}
              {progress === 100 && (
                <Alert severity="success" sx={{ mt: 3 }}>
                  Du hast diesen Kurs bereits abgeschlossen! 🎉
                </Alert>
              )}
            </Box>
          )}
        </Box>

        {/* Sidebar - Kursinhalt (Rechts) */}
        <Box
          sx={{
            width: sidebarOpen ? { xs: '100%', md: 320, lg: 360 } : 0,
            minWidth: sidebarOpen ? { xs: '100%', md: 320, lg: 360 } : 0,
            borderLeft: sidebarOpen ? '1px solid' : 'none',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            overflow: 'hidden',
            transition: 'all 0.3s ease',
            display: { xs: sidebarOpen ? 'block' : 'none', md: 'block' },
          }}
        >
          <Box sx={{ 
            height: 'calc(100vh - 48px)', 
            overflow: 'auto',
            p: 2,
          }}>
            <Typography variant="overline" color="text.secondary" sx={{ px: 1, mb: 1, display: 'block' }}>
              Kursinhalt • {chapters.length} Kapitel
            </Typography>
            
            {chapters.map((chapter, chapterIndex) => {
              const chapterLessons = lessonsByChapter[chapter.id] || [];
              const standaloneLessons = chapterLessons.filter(l => !l.parentLessonId && l.type !== 'subchapter');
              const subchapters = chapterLessons.filter(l => l.type === 'subchapter');
              const allClickableLessons = chapterLessons.filter(l => l.type !== 'subchapter');
              const chapterCompleted = allClickableLessons.length > 0 && allClickableLessons.every((lesson) =>
                completedLessons.has(lesson.id)
              );
              const chapterProgress = allClickableLessons.length > 0 
                ? Math.round((allClickableLessons.filter(l => completedLessons.has(l.id)).length / allClickableLessons.length) * 100)
                : 0;

              return (
                <Accordion
                  key={chapter.id}
                  expanded={expandedChapters.has(chapter.id)}
                  onChange={() => handleToggleChapter(chapter.id)}
                  sx={{ 
                    mb: 1, 
                    boxShadow: 'none',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: '8px !important',
                    '&:before': { display: 'none' },
                    '&.Mui-expanded': { margin: '0 0 8px 0' },
                  }}
                >
                  <AccordionSummary 
                    expandIcon={<ExpandMoreIcon />}
                    sx={{ 
                      minHeight: 56,
                      '&.Mui-expanded': { minHeight: 56 },
                    }}
                  >
                    <Stack spacing={0.5} flex={1} pr={2}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {chapterCompleted ? (
                          <CheckCircleIcon color="success" sx={{ fontSize: 18 }} />
                        ) : (
                          <RadioButtonUncheckedIcon sx={{ fontSize: 18 }} color="action" />
                        )}
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                            Abschnitt {chapterIndex + 1}
                          </Typography>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {chapter.title}
                          </Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ pl: 3.5 }}>
                        <LinearProgress
                          variant="determinate"
                          value={chapterProgress}
                          sx={{ 
                            flex: 1, 
                            height: 4, 
                            borderRadius: 2,
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                          }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 40 }}>
                          {chapterProgress}%
                        </Typography>
                      </Stack>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 0 }}>
                    <List disablePadding dense>
                      {(() => {
                        // compute global lesson index offset for this chapter
                        const chaptersBeforeThis = chapters.slice(0, chapterIndex);
                        const lessonsBefore = chaptersBeforeThis.reduce((acc, ch) => {
                          const cls = lessonsByChapter[ch.id] || [];
                          return acc + cls.filter(l => l.type !== 'subchapter').length;
                        }, 0);
                        return standaloneLessons.map((lesson, lessonIdx) => {
                          const isCompleted = completedLessons.has(lesson.id);
                          const isActive = currentLessonId === lesson.id;
                          const globalNumber = lessonsBefore + lessonIdx + 1;
                          const formatDuration = (seconds: number) => {
                            const m = Math.floor(seconds / 60);
                            const s = seconds % 60;
                            return `${m}:${String(s).padStart(2, '0')}`;
                          };

                          return (
                            <ListItemButton
                              key={lesson.id}
                              selected={isActive}
                              onClick={() => handleSelectLesson(lesson.id, chapter.id)}
                              sx={{
                                pl: 3,
                                py: 1.5,
                                borderLeft: isActive ? '3px solid' : '3px solid transparent',
                                borderColor: 'primary.main',
                                bgcolor: isActive ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                                '&:hover': {
                                  bgcolor: alpha(theme.palette.primary.main, 0.05),
                                },
                              }}
                            >
                              <ListItemIcon sx={{ minWidth: 32 }}>
                                {isCompleted ? (
                                  <CheckCircleIcon color="success" sx={{ fontSize: 18 }} />
                                ) : (
                                  <Box sx={{ color: isActive ? 'primary.main' : 'text.secondary' }}>
                                    {getLessonIcon(lesson.type)}
                                  </Box>
                                )}
                              </ListItemIcon>
                              <ListItemText
                                primary={
                                  <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 0.5 }}>
                                    <Typography
                                      component="span"
                                      variant="body2"
                                      fontWeight={isActive ? 600 : 400}
                                      color={isActive ? 'primary.main' : 'text.primary'}
                                      sx={{ minWidth: 0, flex: 1 }}
                                    >
                                      {globalNumber}. {lesson.title}
                                    </Typography>
                                    {lesson.type === 'video' && lesson.videoDuration && lesson.videoDuration > 0 && (
                                      <Typography
                                        component="span"
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                                      >
                                        {formatDuration(lesson.videoDuration)}
                                      </Typography>
                                    )}
                                  </Box>
                                }
                              />
                            </ListItemButton>
                          );
                        });
                      })()}
                      {subchapters.map((subchapter) => {
                        const subLessons = chapterLessons.filter(l => l.parentLessonId === subchapter.id);
                        const allSubCompleted = subLessons.every((lesson) => completedLessons.has(lesson.id));
                        const isSubchapterExpanded = expandedSubchapters.has(subchapter.id);

                        return (
                          <Box key={subchapter.id}>
                            <ListItemButton
                              onClick={() => handleToggleSubchapter(subchapter.id)}
                              sx={{
                                pl: 3,
                              }}
                            >
                              <ListItemIcon sx={{ minWidth: 32 }}>
                                {isSubchapterExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                              </ListItemIcon>
                              <ListItemIcon sx={{ minWidth: 32 }}>
                                {allSubCompleted ? (
                                  <CheckCircleIcon color="success" sx={{ fontSize: 18 }} />
                                ) : (
                                  <FolderIcon fontSize="small" color="primary" />
                                )}
                              </ListItemIcon>
                              <ListItemText
                                primary={subchapter.title}
                                primaryTypographyProps={{
                                  variant: 'body2',
                                  fontWeight: 600,
                                }}
                              />
                            </ListItemButton>
                            {isSubchapterExpanded && subLessons.map((lesson) => {
                              const isCompleted = completedLessons.has(lesson.id);
                              const isActive = currentLessonId === lesson.id;
                              const subLessonGlobalIdx = (() => {
                                const chaptersBeforeThis = chapters.slice(0, chapterIndex);
                                const lessonsBefore = chaptersBeforeThis.reduce((acc, ch) => {
                                  const cls = lessonsByChapter[ch.id] || [];
                                  return acc + cls.filter(l => l.type !== 'subchapter').length;
                                }, 0);
                                const allNonSubInChapter = chapterLessons.filter(l => l.type !== 'subchapter');
                                return lessonsBefore + allNonSubInChapter.findIndex(l => l.id === lesson.id) + 1;
                              })();
                              const formatDur = (seconds: number) => {
                                const m = Math.floor(seconds / 60);
                                const s = seconds % 60;
                                return `${m}:${String(s).padStart(2, '0')}`;
                              };

                              return (
                                <ListItemButton
                                  key={lesson.id}
                                  selected={isActive}
                                  onClick={() => handleSelectLesson(lesson.id, chapter.id)}
                                  sx={{
                                    pl: 6,
                                    py: 1.5,
                                    borderLeft: isActive ? '3px solid' : '3px solid transparent',
                                    borderColor: 'primary.main',
                                    bgcolor: isActive ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                                  }}
                                >
                                  <ListItemIcon sx={{ minWidth: 32 }}>
                                    {isCompleted ? (
                                      <CheckCircleIcon color="success" sx={{ fontSize: 18 }} />
                                    ) : (
                                      <Box sx={{ color: isActive ? 'primary.main' : 'text.secondary' }}>
                                        {getLessonIcon(lesson.type)}
                                      </Box>
                                    )}
                                  </ListItemIcon>
                                  <ListItemText
                                    primary={
                                      <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 0.5 }}>
                                        <Typography
                                          component="span"
                                          variant="body2"
                                          fontWeight={isActive ? 600 : 400}
                                          color={isActive ? 'primary.main' : 'text.primary'}
                                          sx={{ minWidth: 0, flex: 1 }}
                                        >
                                          {subLessonGlobalIdx}. {lesson.title}
                                        </Typography>
                                        {lesson.type === 'video' && lesson.videoDuration && lesson.videoDuration > 0 && (
                                          <Typography
                                            component="span"
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                                          >
                                            {formatDur(lesson.videoDuration)}
                                          </Typography>
                                        )}
                                      </Box>
                                    }
                                  />
                                </ListItemButton>
                              );
                            })}
                          </Box>
                        );
                      })}
                    </List>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Box>
        </Box>
      </Stack>

      {/* Notes Drawer */}
      <Drawer
        anchor="right"
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        sx={{ '& .MuiDrawer-paper': { width: { xs: '100%', sm: 400 }, p: 3, display: 'flex', flexDirection: 'column' } }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <NoteAltOutlinedIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>Meine Notizen</Typography>
          </Stack>
          <IconButton size="small" onClick={() => setNotesOpen(false)}><CloseIcon /></IconButton>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
          Notizen sind nur für dich sichtbar und werden pro Lektion gespeichert.
        </Typography>
        <Stack spacing={1} mb={3}>
          <TextField
            multiline
            minRows={2}
            maxRows={6}
            placeholder="Neue Notiz schreiben…"
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            fullWidth
            size="small"
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddNote(); }}
          />
          <Button
            variant="contained"
            size="small"
            disabled={!newNoteText.trim() || savingNote}
            onClick={handleAddNote}
            sx={{ alignSelf: 'flex-end' }}
          >
            {savingNote ? <CircularProgress size={16} color="inherit" /> : 'Hinzufügen'}
          </Button>
        </Stack>
        <Divider sx={{ mb: 2 }} />
        {notesLoading ? (
          <Stack alignItems="center" py={4}><CircularProgress size={28} /></Stack>
        ) : notes.length === 0 ? (
          <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 4 }}>
            Noch keine Notizen vorhanden.
          </Typography>
        ) : (
          <Stack spacing={2} sx={{ overflowY: 'auto', flex: 1 }}>
            {notes.map((note) => (
              <Paper key={note.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                {editingNoteId === note.id ? (
                  <Stack spacing={1}>
                    <TextField
                      multiline minRows={2} maxRows={8}
                      value={editingNoteText}
                      onChange={(e) => setEditingNoteText(e.target.value)}
                      fullWidth size="small" autoFocus
                    />
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button size="small" onClick={() => { setEditingNoteId(null); setEditingNoteText(''); }}>Abbrechen</Button>
                      <Button size="small" variant="contained" disabled={savingNote || !editingNoteText.trim()} onClick={() => handleSaveEditNote(note.id)}>
                        {savingNote ? <CircularProgress size={14} color="inherit" /> : 'Speichern'}
                      </Button>
                    </Stack>
                  </Stack>
                ) : (
                  <>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 1 }}>{note.text}</Typography>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" color="text.secondary">{formatNoteDate(note.updatedAt)}</Typography>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Bearbeiten">
                          <IconButton size="small" onClick={() => { setEditingNoteId(note.id); setEditingNoteText(note.text); }}>
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Löschen">
                          <IconButton size="small" color="error" onClick={() => handleDeleteNote(note.id)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </>
                )}
              </Paper>
            ))}
          </Stack>
        )}
      </Drawer>
    </Box>
  );
}
