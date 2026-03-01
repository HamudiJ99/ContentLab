import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Typography,
  Box,
  Card,
  CardContent,
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
  Chip,
  CircularProgress,
  Alert,
  alpha,
  Breadcrumbs,
  Link,
  Paper,
  Divider,
  IconButton,
  Tooltip,
  Dialog,
  DialogContent,
  useTheme,
  Collapse,
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
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import DescriptionIcon from '@mui/icons-material/Description';
import TableChartIcon from '@mui/icons-material/TableChart';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import ImageIcon from '@mui/icons-material/Image';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ViewStreamIcon from '@mui/icons-material/ViewStream';
import ViewSidebarIcon from '@mui/icons-material/ViewSidebar';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';

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
  parentLessonId?: string;
  attachments?: Attachment[];
};

type FlatLesson = Lesson & {
  chapterTitle: string;
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
  const [pdfFullscreen, setPdfFullscreen] = useState(false);
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(true);
  const [showMedia, setShowMedia] = useState(true);
  const [layoutMode, setLayoutMode] = useState<'stacked' | 'sideBySide'>('stacked');
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
              status: doc.data().status,
              parentLessonId: doc.data().parentLessonId,
              attachments: Array.isArray(doc.data().attachments) ? doc.data().attachments : [],
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
      {/* Kompakter Header */}
      <Box sx={{ 
        px: { xs: 2, md: 3 }, 
        py: 2, 
        borderBottom: '1px solid', 
        borderColor: 'divider',
        bgcolor: 'background.paper',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" alignItems="center" spacing={2}>
            <IconButton onClick={() => navigate('/dashboard')} size="small">
              <ArrowBackIcon />
            </IconButton>
            <Box>
              <Typography variant="h6" fontWeight={700} noWrap sx={{ maxWidth: { xs: 200, md: 400 } }}>
                {course.title}
              </Typography>
              <Stack direction="row" spacing={2} alignItems="center">
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{ 
                    width: 120, 
                    height: 6, 
                    borderRadius: 3,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  {progress}% • {completedCount}/{totalLessons} Lektionen
                </Typography>
              </Stack>
            </Box>
          </Stack>
          <Tooltip title={sidebarOpen ? 'Kursinhalt ausblenden' : 'Kursinhalt anzeigen'}>
            <IconButton onClick={() => setSidebarOpen(!sidebarOpen)}>
              <MenuBookIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Main Layout: Content Links, Sidebar Rechts */}
      <Stack direction="row" sx={{ minHeight: 'calc(100vh - 80px)' }}>
        {/* Content Area (Links) */}
        <Box sx={{ flex: 1, overflow: 'auto', height: 'calc(100vh - 80px)' }}>
          {currentLesson ? (
            <Box sx={{ maxWidth: layoutMode === 'sideBySide' ? 1400 : 1000, mx: 'auto', p: { xs: 2, md: 4 } }}>
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
                  {/* Layout Toggle für PDF/Video mit zusätzlichen Infos */}
                  {(currentLesson.type === 'pdf' || currentLesson.type === 'video') && currentLesson.content && (
                    <Tooltip title={layoutMode === 'stacked' ? 'Nebeneinander-Ansicht' : 'Untereinander-Ansicht'}>
                      <IconButton 
                        onClick={() => setLayoutMode(layoutMode === 'stacked' ? 'sideBySide' : 'stacked')}
                        sx={{ 
                          bgcolor: 'action.hover',
                          '&:hover': { bgcolor: 'action.selected' },
                        }}
                      >
                        {layoutMode === 'stacked' ? <ViewSidebarIcon /> : <ViewStreamIcon />}
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </Box>
              
              {currentLesson.type === 'text' && currentLesson.content ? (
                <Card sx={{ mb: 3 }}>
                  <CardContent sx={{ p: { xs: 2, md: 4 } }}>
                    <Box
                      sx={{
                        '& p': { margin: '0.5em 0' },
                        '& h1': { fontSize: '2em', fontWeight: 700, margin: '0.67em 0' },
                        '& h2': { fontSize: '1.5em', fontWeight: 700, margin: '0.75em 0' },
                        '& h3': { fontSize: '1.17em', fontWeight: 700, margin: '0.83em 0' },
                        '& ul, & ol': { paddingLeft: '1.5em', margin: '0.5em 0' },
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
                      }}
                      dangerouslySetInnerHTML={{ __html: currentLesson.content }}
                    />
                  </CardContent>
                </Card>
                ) : currentLesson.type === 'pdf' ? (
                  <Box>
                    {currentLesson.pdfUrl ? (
                      <Stack 
                        direction={layoutMode === 'sideBySide' && currentLesson.content ? { xs: 'column', lg: 'row' } : 'column'} 
                        spacing={2}
                        alignItems="flex-start"
                      >
                        {/* PDF Bereich */}
                        <Box sx={{ flex: layoutMode === 'sideBySide' ? 1 : 'auto', width: '100%', minWidth: 0 }}>
                          <Card>
                            <Box 
                              onClick={() => setShowMedia(!showMedia)}
                              sx={{ 
                                p: 2, 
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                '&:hover': { bgcolor: 'action.hover' },
                              }}
                            >
                              <Stack direction="row" spacing={1} alignItems="center">
                                <PictureAsPdfIcon color="error" />
                                <Typography variant="subtitle1" fontWeight={600}>
                                  PDF-Dokument
                                </Typography>
                              </Stack>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Tooltip title="Vollbild">
                                  <IconButton 
                                    size="small" 
                                    onClick={(e) => { e.stopPropagation(); setPdfFullscreen(true); }}
                                  >
                                    <FullscreenIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                {showMedia ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                              </Stack>
                            </Box>
                            <Collapse in={showMedia}>
                              <Box
                                sx={{
                                  width: '100%',
                                  height: layoutMode === 'sideBySide' ? { xs: 400, md: 500, lg: 600 } : { xs: 500, md: 700, lg: 800 },
                                  borderTop: '1px solid',
                                  borderColor: 'divider',
                                  overflow: 'hidden',
                                  bgcolor: 'background.default',
                                }}
                              >
                                <iframe
                                  src={currentLesson.pdfUrl}
                                  style={{ width: '100%', height: '100%', border: 'none' }}
                                  title={currentLesson.title}
                                />
                              </Box>
                            </Collapse>
                          </Card>
                        </Box>
                        
                        {/* Zusätzliche Informationen */}
                        {currentLesson.content && (
                          <Box sx={{ 
                            flex: layoutMode === 'sideBySide' ? 1 : 'auto', 
                            width: '100%', 
                            minWidth: 0,
                            maxWidth: layoutMode === 'sideBySide' ? { lg: 400 } : 'none',
                          }}>
                            <Card>
                              <Box 
                                onClick={() => setShowAdditionalInfo(!showAdditionalInfo)}
                                sx={{ 
                                  p: 2, 
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  '&:hover': { bgcolor: 'action.hover' },
                                }}
                              >
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <InfoOutlinedIcon color="primary" />
                                  <Typography variant="subtitle1" fontWeight={600}>
                                    Zusätzliche Informationen
                                  </Typography>
                                </Stack>
                                {showAdditionalInfo ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                              </Box>
                              <Collapse in={showAdditionalInfo}>
                                <CardContent sx={{ pt: 0, maxHeight: layoutMode === 'sideBySide' ? { lg: 550 } : 'none', overflow: 'auto' }}>
                                  <Box
                                    sx={{
                                      '& p': { margin: '0.5em 0' },
                                      '& h1': { fontSize: '2em', fontWeight: 700, margin: '0.67em 0' },
                                      '& h2': { fontSize: '1.5em', fontWeight: 700, margin: '0.75em 0' },
                                      '& h3': { fontSize: '1.17em', fontWeight: 700, margin: '0.83em 0' },
                                      '& ul, & ol': { paddingLeft: '1.5em', margin: '0.5em 0' },
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
                                      whiteSpace: 'pre-wrap',
                                    }}
                                    dangerouslySetInnerHTML={{ __html: currentLesson.content }}
                                  />
                                </CardContent>
                              </Collapse>
                            </Card>
                          </Box>
                        )}
                      </Stack>
                    ) : (
                      <Alert severity="warning">
                        PDF-Datei wurde noch nicht hochgeladen.
                      </Alert>
                    )}
                  </Box>
                ) : currentLesson.type === 'video' ? (
                  <Box>
                    {currentLesson.videoUrl ? (
                      <>
                        <Stack 
                          direction={layoutMode === 'sideBySide' && currentLesson.content ? { xs: 'column', lg: 'row' } : 'column'} 
                          spacing={2}
                          alignItems="flex-start"
                        >
                          {/* Video Bereich */}
                          <Box sx={{ flex: layoutMode === 'sideBySide' ? 1 : 'auto', width: '100%', minWidth: 0 }}>
                            <Card>
                              <Box 
                                onClick={() => setShowMedia(!showMedia)}
                                sx={{ 
                                  p: 2, 
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  '&:hover': { bgcolor: 'action.hover' },
                                }}
                              >
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <VideoLibraryIcon color="primary" />
                                  <Typography variant="subtitle1" fontWeight={600}>
                                    Video
                                  </Typography>
                                </Stack>
                                {showMedia ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                              </Box>
                              <Collapse in={showMedia}>
                                <Box
                                  sx={{
                                    width: '100%',
                                    height: layoutMode === 'sideBySide' ? { xs: 300, md: 400, lg: 450 } : 500,
                                    borderTop: '1px solid',
                                    borderColor: 'divider',
                                    overflow: 'hidden',
                                    bgcolor: 'background.default',
                                  }}
                                >
                                  <video
                                    src={currentLesson.videoUrl}
                                    controls
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                  />
                                </Box>
                              </Collapse>
                            </Card>
                          </Box>
                          
                          {/* Zusätzliche Informationen */}
                          {currentLesson.content && (
                            <Box sx={{ 
                              flex: layoutMode === 'sideBySide' ? 1 : 'auto', 
                              width: '100%', 
                              minWidth: 0,
                              maxWidth: layoutMode === 'sideBySide' ? { lg: 400 } : 'none',
                            }}>
                              <Card>
                                <Box 
                                  onClick={() => setShowAdditionalInfo(!showAdditionalInfo)}
                                  sx={{ 
                                    p: 2, 
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    '&:hover': { bgcolor: 'action.hover' },
                                  }}
                                >
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    <InfoOutlinedIcon color="primary" />
                                    <Typography variant="subtitle1" fontWeight={600}>
                                      Zusätzliche Informationen
                                    </Typography>
                                  </Stack>
                                  {showAdditionalInfo ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                </Box>
                                <Collapse in={showAdditionalInfo}>
                                  <CardContent sx={{ pt: 0, maxHeight: layoutMode === 'sideBySide' ? { lg: 400 } : 'none', overflow: 'auto' }}>
                                    <Box
                                      sx={{
                                        '& p': { margin: '0.5em 0' },
                                        '& h1': { fontSize: '2em', fontWeight: 700, margin: '0.67em 0' },
                                        '& h2': { fontSize: '1.5em', fontWeight: 700, margin: '0.75em 0' },
                                        '& h3': { fontSize: '1.17em', fontWeight: 700, margin: '0.83em 0' },
                                        '& ul, & ol': { paddingLeft: '1.5em', margin: '0.5em 0' },
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
                                        whiteSpace: 'pre-wrap',
                                      }}
                                      dangerouslySetInnerHTML={{ __html: currentLesson.content }}
                                    />
                                  </CardContent>
                                </Collapse>
                              </Card>
                            </Box>
                          )}
                        </Stack>
                        
                        {/* Dateianhänge - immer unter beiden Bereichen */}
                        {currentLesson.attachments && currentLesson.attachments.length > 0 && (
                          <Box sx={{ mt: 3 }}>
                            <Typography variant="h6" gutterBottom fontWeight={600}>
                              <AttachFileIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 22 }} />
                              Zusätzliche Materialien
                            </Typography>
                            <Stack spacing={1.5}>
                              {currentLesson.attachments.map((attachment) => {
                                const getIcon = () => {
                                  if (attachment.type.includes('pdf')) return <PictureAsPdfIcon sx={{ color: '#e53935' }} />;
                                  if (attachment.type.includes('word') || attachment.type.includes('document')) return <DescriptionIcon sx={{ color: '#1976d2' }} />;
                                  if (attachment.type.includes('sheet') || attachment.type.includes('excel')) return <TableChartIcon sx={{ color: '#2e7d32' }} />;
                                  if (attachment.type.includes('presentation') || attachment.type.includes('powerpoint')) return <SlideshowIcon sx={{ color: '#ed6c02' }} />;
                                  if (attachment.type.includes('image')) return <ImageIcon sx={{ color: '#9c27b0' }} />;
                                  return <InsertDriveFileIcon sx={{ color: 'text.secondary' }} />;
                                };
                                const formatSize = (bytes: number) => {
                                  if (bytes < 1024) return `${bytes} B`;
                                  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                                  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
                                };
                                return (
                                  <Paper
                                    key={attachment.id}
                                    elevation={0}
                                    sx={{
                                      p: 2,
                                      border: '1px solid',
                                      borderColor: 'divider',
                                      borderRadius: 2,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 2,
                                      transition: 'all 0.2s ease',
                                      '&:hover': {
                                        borderColor: 'primary.main',
                                        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                                      },
                                    }}
                                  >
                                    <Box sx={{ display: 'flex', alignItems: 'center', fontSize: 28 }}>
                                      {getIcon()}
                                    </Box>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                      <Typography 
                                        variant="body2" 
                                        fontWeight={600}
                                        sx={{ 
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {attachment.name}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {formatSize(attachment.size)}
                                      </Typography>
                                    </Box>
                                    <Stack direction="row" spacing={0.5}>
                                      <Tooltip title="Öffnen">
                                        <IconButton
                                          size="small"
                                          onClick={() => window.open(attachment.url, '_blank')}
                                          sx={{ color: 'primary.main' }}
                                        >
                                          <OpenInNewIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip title="Herunterladen">
                                        <IconButton
                                          size="small"
                                          component="a"
                                          href={attachment.url}
                                          download={attachment.name}
                                          target="_blank"
                                          sx={{ color: 'primary.main' }}
                                        >
                                          <DownloadIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    </Stack>
                                  </Paper>
                                );
                              })}
                            </Stack>
                          </Box>
                        )}
                      </>
                    ) : (
                      <Alert severity="warning">
                        Video-Datei wurde noch nicht hochgeladen.
                      </Alert>
                    )}
                  </Box>
                ) : (
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
                    Dieser Lektionstyp wird noch nicht unterstützt.
                  </Alert>
                )}
                
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
            height: 'calc(100vh - 80px)', 
            overflow: 'auto',
            p: 2,
          }}>
            <Typography variant="overline" color="text.secondary" sx={{ px: 1, mb: 1, display: 'block' }}>
              Kursinhalt • {chapters.length} Kapitel
            </Typography>
            
            {chapters.map((chapter) => {
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
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {chapter.title}
                        </Typography>
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
                      {standaloneLessons.map((lesson) => {
                        const isCompleted = completedLessons.has(lesson.id);
                        const isActive = currentLessonId === lesson.id;

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
                              primary={lesson.title}
                              primaryTypographyProps={{
                                variant: 'body2',
                                fontWeight: isActive ? 600 : 400,
                                color: isActive ? 'primary.main' : 'text.primary',
                              }}
                            />
                          </ListItemButton>
                        );
                      })}
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
                                    primary={lesson.title}
                                    primaryTypographyProps={{
                                      variant: 'body2',
                                      fontWeight: isActive ? 600 : 400,
                                      color: isActive ? 'primary.main' : 'text.primary',
                                    }}
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

      {/* PDF Vollbild Dialog */}
      <Dialog
        open={pdfFullscreen}
        onClose={() => setPdfFullscreen(false)}
        maxWidth={false}
        fullScreen
        sx={{ 
          '& .MuiDialog-paper': { 
            bgcolor: 'background.default',
          },
        }}
      >
        <DialogContent sx={{ p: 0, position: 'relative' }}>
          <IconButton
            onClick={() => setPdfFullscreen(false)}
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              zIndex: 1,
              bgcolor: 'background.paper',
              boxShadow: 2,
              '&:hover': { bgcolor: 'background.paper' },
            }}
          >
            <CloseIcon />
          </IconButton>
          {currentLesson?.pdfUrl && (
            <iframe
              src={currentLesson.pdfUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title={currentLesson.title}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
