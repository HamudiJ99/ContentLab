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
  Breadcrumbs,
  Link,
  Paper,
  Divider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
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

type Lesson = {
  id: string;
  chapterId: string;
  title: string;
  type: LessonType;
  position: number;
  shortDescription?: string;
  content?: string;
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
              status: doc.data().status,
            }))
            .filter((lesson) => lesson.type !== 'subchapter' && lesson.status === 'published')
            .sort((a, b) => a.position - b.position)
            .map(({ status, ...lesson }) => lesson);
        }
        setLessonsByChapter(lessonsByChap);

        // Lade Fortschritt
        const progressDoc = await getDoc(
          doc(db, 'users', currentUser.uid, 'courseProgress', courseId)
        );

        if (progressDoc.exists()) {
          const progressData = progressDoc.data();
          setCompletedLessons(new Set(progressData.completedLessons || []));
          
          // Finde letzte nicht abgeschlossene Lektion
          const allLessons = loadedChapters.flatMap((ch) => lessonsByChap[ch.id] || []);
          const nextLesson = allLessons.find((lesson) => 
            !progressData.completedLessons?.includes(lesson.id)
          );
          setCurrentLessonId(nextLesson?.id || allLessons[0]?.id || null);
        } else {
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

  const allLessons: FlatLesson[] = chapters.flatMap((chapter) =>
    (lessonsByChapter[chapter.id] || []).map((lesson) => ({
      ...lesson,
      chapterTitle: chapter.title,
    }))
  );

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
    if (newCompleted.has(lessonId)) {
      newCompleted.delete(lessonId);
    } else {
      newCompleted.add(lessonId);
    }
    setCompletedLessons(newCompleted);

    try {
      const progressRef = doc(db, 'users', currentUser.uid, 'courseProgress', courseId);
      await setDoc(
        progressRef,
        {
          completedLessons: Array.from(newCompleted),
          lastAccessedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
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

  const getLessonIcon = (type: LessonType) => {
    switch (type) {
      case 'video':
        return <PlayCircleOutlineIcon />;
      case 'text':
        return <ArticleOutlinedIcon />;
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
        <Alert severity="info">Bitte melde dich an, um diesen Kurs zu sehen.</Alert>
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
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1160, mx: 'auto', width: '100%' }}>
      {/* Header */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          component="button"
          onClick={() => navigate('/')}
          underline="hover"
          color="inherit"
          sx={{ cursor: 'pointer' }}
        >
          Dashboard
        </Link>
        <Typography color="text.primary">{course.title}</Typography>
      </Breadcrumbs>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            {course.title}
          </Typography>
          {course.description && (
            <Typography color="text.secondary">{course.description}</Typography>
          )}
        </Box>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/')}
          sx={{ alignSelf: 'flex-start' }}
        >
          Zurück
        </Button>
      </Stack>

      {/* Fortschrittsanzeige */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="h6" fontWeight={600}>
              Kursfortschritt
            </Typography>
            <Chip
              icon={progress === 100 ? <CheckCircleIcon /> : undefined}
              label={`${completedCount} / ${totalLessons} Lektionen`}
              color={progress === 100 ? 'success' : 'default'}
            />
          </Stack>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 8, borderRadius: 4, mb: 1 }}
          />
          <Typography variant="body2" color="text.secondary">
            {progress}% abgeschlossen
          </Typography>
          {progress === 100 && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Herzlichen Glückwunsch! Du hast diesen Kurs abgeschlossen! 🎉
            </Alert>
          )}
        </CardContent>
      </Card>

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3}>
        {/* Lektionsinhalt */}
        <Box sx={{ flex: 1 }}>
          {currentLesson ? (
            <Card>
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  {currentLesson.chapterTitle}
                </Typography>
                <Typography variant="h5" fontWeight={700} gutterBottom>
                  {currentLesson.title}
                </Typography>
                {currentLesson.shortDescription && (
                  <Typography variant="body1" color="text.secondary" paragraph>
                    {currentLesson.shortDescription}
                  </Typography>
                )}
                <Divider sx={{ my: 3 }} />
                {currentLesson.type === 'text' && currentLesson.content ? (
                  <Typography
                    variant="body1"
                    sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}
                  >
                    {currentLesson.content}
                  </Typography>
                ) : (
                  <Alert severity="info">
                    {currentLesson.type === 'video'
                      ? 'Video-Inhalte werden hier angezeigt.'
                      : 'PDF-Inhalte werden hier angezeigt.'}
                  </Alert>
                )}
                <Divider sx={{ my: 3 }} />
                <Stack direction="row" spacing={2} justifyContent="space-between">
                  <Button
                    variant="outlined"
                    startIcon={<ArrowBackIcon />}
                    disabled={!previousLesson}
                    onClick={() => previousLesson && handleSelectLesson(previousLesson.id, previousLesson.chapterId)}
                  >
                    Zurück
                  </Button>
                  <Stack direction="row" spacing={2}>
                    {!completedLessons.has(currentLesson.id) ? (
                      <Button
                        variant="contained"
                        onClick={handleCompleteLesson}
                        startIcon={<CheckCircleIcon />}
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
                        Weiter
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ) : (
            <Alert severity="info">Wähle eine Lektion aus, um zu beginnen.</Alert>
          )}
        </Box>

        {/* Kapitel & Lektionen Liste */}
        <Paper
          sx={{
            width: { xs: '100%', lg: 380 },
            maxHeight: { xs: 'auto', lg: '80vh' },
            overflow: 'auto',
            p: 2,
          }}
        >
          <Typography variant="h6" fontWeight={600} mb={2}>
            Kursinhalt
          </Typography>
          {chapters.map((chapter) => {
            const chapterLessons = lessonsByChapter[chapter.id] || [];
            const chapterCompleted = chapterLessons.every((lesson) =>
              completedLessons.has(lesson.id)
            );

            return (
              <Accordion
                key={chapter.id}
                expanded={expandedChapters.has(chapter.id)}
                onChange={() => handleToggleChapter(chapter.id)}
                sx={{ mb: 1 }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Stack direction="row" spacing={1} alignItems="center" flex={1}>
                    {chapterCompleted ? (
                      <CheckCircleIcon color="success" fontSize="small" />
                    ) : (
                      <RadioButtonUncheckedIcon fontSize="small" color="action" />
                    )}
                    <Typography fontWeight={600}>{chapter.title}</Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  <List disablePadding>
                    {chapterLessons.map((lesson) => {
                      const isCompleted = completedLessons.has(lesson.id);
                      const isActive = currentLessonId === lesson.id;

                      return (
                        <ListItemButton
                          key={lesson.id}
                          selected={isActive}
                          onClick={() => handleSelectLesson(lesson.id, chapter.id)}
                          sx={{
                            pl: 4,
                            borderLeft: isActive ? '3px solid' : '3px solid transparent',
                            borderColor: 'primary.main',
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            {isCompleted ? (
                              <CheckCircleIcon color="success" fontSize="small" />
                            ) : (
                              getLessonIcon(lesson.type)
                            )}
                          </ListItemIcon>
                          <ListItemText
                            primary={lesson.title}
                            primaryTypographyProps={{
                              variant: 'body2',
                              fontWeight: isActive ? 600 : 400,
                            }}
                          />
                        </ListItemButton>
                      );
                    })}
                  </List>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Paper>
      </Stack>
    </Box>
  );
}
