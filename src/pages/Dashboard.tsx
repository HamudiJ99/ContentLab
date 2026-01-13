import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Box,
  Card,
  CardContent,
  CardMedia,
  Button,
  Stack,
  Chip,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  useTheme,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import SchoolIcon from '@mui/icons-material/School';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';

type Course = {
  id: string;
  title: string;
  description: string;
  categoryIds: string[];
  coverImageUrl?: string;
  coverColor?: string;
  chapters: number;
  lessons: number;
  ownerId: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
  isShared?: boolean;
  startedAt?: Date | null;
};

type CourseProgress = {
  courseId: string;
  completedLessons: string[];
  totalLessons: number;
  percentage: number;
  lastAccessedAt?: Date;
};

const normalizeCount = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const normalizePercentage = (value: unknown): number | null => {
  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? parseFloat(value)
        : null;
  if (numericValue === null || !Number.isFinite(numericValue)) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(numericValue)));
};

export default function Dashboard() {
  const navigate = useNavigate();
  const theme = useTheme();
  const primaryColor = theme.palette.primary.main;
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseProgress, setCourseProgress] = useState<Record<string, CourseProgress>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [hiddenCourses, setHiddenCourses] = useState<Map<string, { mode: 'hidden' | 'removed' }>>(new Map());
  const [showHiddenCourses, setShowHiddenCourses] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuCourse, setMenuCourse] = useState<Course | null>(null);
  const [actionSnackbar, setActionSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setCourses([]);
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        // Lade alle Kurse
        const coursesSnapshot = await getDocs(
          collection(db, 'users', currentUser.uid, 'courses')
        );
        
        const loadedCourses: Course[] = [];
        
        for (const courseDoc of coursesSnapshot.docs) {
          const courseData = courseDoc.data();
          
          // Lade alle Kapitel und filtere veröffentlichte
          const chaptersSnapshot = await getDocs(
            collection(db, 'users', currentUser.uid, 'courses', courseDoc.id, 'chapters')
          );

          const publishedChapters = chaptersSnapshot.docs.filter(
            (doc) => doc.data().status === 'published'
          );

          if (publishedChapters.length === 0) continue;

          // Zähle veröffentlichte Lektionen
          let publishedLessons = 0;
          for (const chapterDoc of publishedChapters) {
            const lessonsSnapshot = await getDocs(
              collection(chapterDoc.ref, 'lessons')
            );
            publishedLessons += lessonsSnapshot.docs.filter(
              (doc) => doc.data().status === 'published' && doc.data().type !== 'subchapter'
            ).length;
          }

          if (publishedLessons > 0) {
            loadedCourses.push({
              id: courseDoc.id,
              title: courseData.title ?? 'Unbenannter Kurs',
              description: courseData.description ?? '',
              categoryIds: Array.isArray(courseData.categoryIds) ? courseData.categoryIds : [],
              coverImageUrl: courseData.coverImageUrl,
              coverColor: courseData.coverColor,
              chapters: publishedChapters.length,
              lessons: publishedLessons,
              ownerId: currentUser.uid,
            });
          }
        }

        // Lade Kurse aus Teilnahmen (Einladungen)
        const enrollmentsSnapshot = await getDocs(
          collection(db, 'users', currentUser.uid, 'enrollments')
        );
        const sharedCourses: Course[] = [];
        for (const enrollmentDoc of enrollmentsSnapshot.docs) {
          const data = enrollmentDoc.data();
          const ownerId = data.ownerId;
          const courseId = data.courseId ?? enrollmentDoc.id;
          if (!ownerId || !courseId) continue;

          let sharedLessonCount = normalizeCount(
            data.lessons ??
              data.lessonCount ??
              data.totalLessons ??
              data.expectedLessonCount ??
              data.progressLessonCount ??
              0
          );
          let sharedChapterCount = normalizeCount(data.chapters ?? data.chapterCount);

          if ((sharedLessonCount === 0 || sharedChapterCount === 0) && ownerId) {
            try {
              const ownerCourseRef = doc(db, 'users', ownerId, 'courses', courseId);
              const ownerCourseSnapshot = await getDoc(ownerCourseRef);
              if (ownerCourseSnapshot.exists()) {
                const chaptersSnapshot = await getDocs(collection(ownerCourseRef, 'chapters'));
                const publishedChapters = chaptersSnapshot.docs.filter((chapterDoc) => chapterDoc.data().status === 'published');
                sharedChapterCount = publishedChapters.length;
                if (sharedLessonCount === 0) {
                  let lessonCount = 0;
                  for (const chapterDoc of publishedChapters) {
                    const lessonsSnapshot = await getDocs(collection(chapterDoc.ref, 'lessons'));
                    lessonCount += lessonsSnapshot.docs.filter((lessonDoc) => {
                      const lessonData = lessonDoc.data();
                      return lessonData.status === 'published' && lessonData.type !== 'subchapter';
                    }).length;
                  }
                  sharedLessonCount = lessonCount;
                }
              }
            } catch (sharedDetailError) {
              console.warn('Gemeinsamer Kurs konnte nicht synchronisiert werden', sharedDetailError);
            }
          }

          sharedCourses.push({
            id: courseId,
            title: data.courseTitle ?? 'Kurs',
            description: data.courseDescription ?? '',
            categoryIds: [],
            coverImageUrl: data.coverImageUrl ?? undefined,
            coverColor: data.coverColor ?? undefined,
            chapters: sharedChapterCount,
            lessons: sharedLessonCount,
            ownerId,
            ownerName: data.ownerName ?? data.ownerEmail ?? null,
            ownerEmail: data.ownerEmail ?? null,
            isShared: true,
            startedAt: data.startedAt?.toDate?.() ?? null,
          });
        }

        const hiddenSnapshot = await getDocs(
          collection(db, 'users', currentUser.uid, 'hiddenCourses')
        );
        const fetchedHidden = new Map<string, { mode: 'hidden' | 'removed' }>();
        hiddenSnapshot.docs.forEach((docSnapshot) => {
          const data = docSnapshot.data();
          if (data.hidden === false) {
            return;
          }
          const mode = data.action === 'removed' ? 'removed' : 'hidden';
          fetchedHidden.set(docSnapshot.id, { mode });
        });
        setHiddenCourses(fetchedHidden);

        const combinedCourses = [...loadedCourses, ...sharedCourses];

        // Lade Fortschritt für jeden Kurs
        const progressData: Record<string, CourseProgress> = {};
        for (const course of combinedCourses) {
          const progressDoc = await getDoc(
            doc(db, 'users', currentUser.uid, 'courseProgress', course.id)
          );
          
          if (progressDoc.exists()) {
            const data = progressDoc.data();
            const completedLessons = Array.isArray(data.completedLessons) ? data.completedLessons : [];
            const completedCount = completedLessons.length;
            const totalLessonCandidates = [
              normalizeCount(course.lessons),
              normalizeCount(data.totalLessons),
              normalizeCount(data.expectedLessonCount),
              normalizeCount(data.lessonCount),
              normalizeCount(data.progressLessonCount),
            ];
            const totalLessons = totalLessonCandidates.find((count) => count > 0) ?? 0;
            const derivedPercentage =
              totalLessons > 0
                ? Math.max(0, Math.min(100, Math.round((completedCount / totalLessons) * 100)))
                : null;
            const storedPercentage = normalizePercentage(data.percentage);
            const percentage = derivedPercentage ?? storedPercentage ?? 0;

            progressData[course.id] = {
              courseId: course.id,
              completedLessons,
              totalLessons,
              percentage,
              lastAccessedAt: data.lastAccessedAt?.toDate(),
            };
          } else {
            progressData[course.id] = {
              courseId: course.id,
              completedLessons: [],
              totalLessons: course.lessons,
              percentage: 0,
            };
          }
        }
        setCourseProgress(progressData);

        const startedTimestamps: Record<string, Date> = {};
        Object.values(progressData).forEach((progress) => {
          if (progress.lastAccessedAt) {
            startedTimestamps[progress.courseId] = progress.lastAccessedAt;
          } else if (progress.completedLessons.length > 0) {
            startedTimestamps[progress.courseId] = new Date();
          }
        });

        setCourses(
          combinedCourses.map((course) => {
            const progress = progressData[course.id];
            const normalizedLessons = course.lessons > 0 ? course.lessons : progress?.totalLessons ?? 0;
            return {
              ...course,
              lessons: normalizedLessons,
              startedAt: startedTimestamps[course.id] ?? null,
            };
          })
        );
      } catch (err) {
        console.error('Fehler beim Laden der Daten:', err);
        setError('Kurse konnten nicht geladen werden.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser]);

  const handleStartCourse = (courseId: string) => {
    navigate(`/learn/${courseId}`);
  };

  const handleCourseMenuOpen = (event: MouseEvent<HTMLElement>, course: Course) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setMenuCourse(course);
  };

  const handleCourseMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuCourse(null);
  };

  const hiddenCourseCount = hiddenCourses.size;

  const handleHideCourse = async (course: Course) => {
    if (!currentUser) return;
    try {
      await setDoc(
        doc(db, 'users', currentUser.uid, 'hiddenCourses', course.id),
        {
          hidden: true,
          action: 'hidden',
          ownerId: course.ownerId,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setHiddenCourses((prev) => {
        const next = new Map(prev);
        next.set(course.id, { mode: 'hidden' });
        return next;
      });
      setActionSnackbar({ open: true, message: 'Kurs wurde ausgeblendet.', severity: 'success' });
    } catch (err) {
      console.error('Kurs konnte nicht ausgeblendet werden', err);
      setActionSnackbar({ open: true, message: 'Kurs konnte nicht ausgeblendet werden.', severity: 'error' });
    } finally {
      handleCourseMenuClose();
    }
  };

  const handleRemoveCourseRequest = (course: Course) => {
    if (!course.isShared) return;
    setDeleteTarget(course);
    setDeleteDialogOpen(true);
    handleCourseMenuClose();
  };

  const handleConfirmRemoveCourse = async () => {
    if (!currentUser || !deleteTarget || !deleteTarget.isShared) return;
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'enrollments', deleteTarget.id));
      await deleteDoc(doc(db, 'users', currentUser.uid, 'courseProgress', deleteTarget.id));
      await deleteDoc(doc(db, 'users', currentUser.uid, 'hiddenCourses', deleteTarget.id));
      setCourses((prev) => prev.filter((course) => course.id !== deleteTarget.id));
      setCourseProgress((prev) => {
        const next = { ...prev };
        delete next[deleteTarget.id];
        return next;
      });
      setHiddenCourses((prev) => {
        const next = new Map(prev);
        next.delete(deleteTarget.id);
        return next;
      });
      setActionSnackbar({ open: true, message: 'Kurs wurde dauerhaft entfernt.', severity: 'success' });
    } catch (err) {
      console.error('Kurs konnte nicht entfernt werden', err);
      setActionSnackbar({ open: true, message: 'Kurs konnte nicht entfernt werden.', severity: 'error' });
    } finally {
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  const handleCancelRemoveCourse = () => {
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  const handleUnhideCourse = async (course: Course) => {
    if (!currentUser) return;
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'hiddenCourses', course.id));
      setHiddenCourses((prev) => {
        const next = new Map(prev);
        next.delete(course.id);
        return next;
      });
      setActionSnackbar({ open: true, message: 'Kurs wurde wieder eingeblendet.', severity: 'success' });
    } catch (err) {
      console.error('Kurs konnte nicht eingeblendet werden', err);
      setActionSnackbar({ open: true, message: 'Kurs konnte nicht eingeblendet werden.', severity: 'error' });
    } finally {
      handleCourseMenuClose();
    }
  };

  const displayedCourses = showHiddenCourses
    ? courses
    : courses.filter((course) => !hiddenCourses.has(course.id));

  const getProgressPercentage = (courseId: string) => {
    const progress = courseProgress[courseId];
    if (!progress) return 0;
    const clamped = Math.max(0, Math.min(100, progress.percentage || 0));
    return clamped;
  };

  const inProgressCourses = displayedCourses.filter((course) => {
    const percentage = getProgressPercentage(course.id);
    return percentage > 0 && percentage < 100;
  });

  const completedCourses = displayedCourses.filter((course) => getProgressPercentage(course.id) >= 100);

  const notStartedCourses = displayedCourses.filter((course) => getProgressPercentage(course.id) === 0);

  if (!currentUser) {
    return (
      <Box sx={{ p: 4, maxWidth: 1160, mx: 'auto' }}>
        <Alert severity="info">Bitte melde dich an, um deine Kurse zu sehen.</Alert>
      </Box>
    );
  }

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const getFilteredCourses = () => {
    switch (activeTab) {
      case 0:
        return inProgressCourses;
      case 1:
        return notStartedCourses;
      case 2:
        return completedCourses;
      default:
        return courses;
    }
  };

  const filteredCourses = getFilteredCourses();

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1160, mx: 'auto', width: '100%' }}>
      <Box mb={4}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Meine Kurse
        </Typography>
        <Typography color="text.secondary">
          Setze dein Lernen fort oder starte einen neuen Kurs
        </Typography>
      </Box>

      {loading ? (
        <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }}>
          <CircularProgress />
        </Stack>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : courses.length === 0 ? (
        <Alert severity="info">
          Noch keine Kurse oder Einladungen sichtbar. Erstelle einen Kurs oder nimm eine Einladung an.
        </Alert>
      ) : (
        <Box>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'flex-start', md: 'flex-end' }}
            justifyContent="space-between"
            sx={{ mb: 3 }}
          >
            <Tabs 
              value={activeTab} 
              onChange={handleTabChange}
              sx={{ 
                borderBottom: 1, 
                borderColor: 'divider',
                flexGrow: 1
              }}
            >
              <Tab 
                label={`Weiter lernen (${inProgressCourses.length})`}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              />
              <Tab 
                label={`Verfügbare Kurse (${notStartedCourses.length})`}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              />
              <Tab 
                label={`Abgeschlossen (${completedCourses.length})`}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              />
            </Tabs>
            <Button
              variant={showHiddenCourses ? 'outlined' : 'text'}
              size="small"
              startIcon={showHiddenCourses ? <VisibilityIcon /> : <VisibilityOffIcon />}
              onClick={() => setShowHiddenCourses((prev) => !prev)}
              disabled={hiddenCourseCount === 0}
              sx={{ textTransform: 'none' }}
            >
              {showHiddenCourses
                ? 'Versteckte Kurse ausblenden'
                : hiddenCourseCount > 0
                  ? `Versteckte Kurse anzeigen (${hiddenCourseCount})`
                  : 'Keine versteckten Kurse'}
            </Button>
          </Stack>

          {filteredCourses.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              {!showHiddenCourses && hiddenCourseCount > 0 && displayedCourses.length === 0
                ? 'Alle Kurse sind ausgeblendet. Blende sie über den Button oben wieder ein.'
                : activeTab === 0
                  ? 'Keine Kurse in Bearbeitung.'
                  : activeTab === 1
                    ? 'Keine verfügbaren Kurse.'
                    : 'Keine abgeschlossenen Kurse.'}
            </Alert>
          ) : (
            <Grid
              container
              spacing={3}
              sx={{
                maxWidth: '100%',
                justifyContent: { xs: 'flex-start', sm: 'flex-start' },
              }}
            >
              {filteredCourses.map((course) => {
                const progress = courseProgress[course.id];
                const coverColor = activeTab === 2 
                  ? (course.coverColor || '#22c55e')
                  : (course.coverColor || primaryColor);
                const hiddenMeta = hiddenCourses.get(course.id);
                const isHidden = Boolean(hiddenMeta);
                  
                  return (
                    <Grid
                      key={course.id}
                      size={{ xs: 12, sm: 4, md: 3, lg: 3 }}
                      sx={{
                        display: 'flex',
                        flexBasis: { xs: '100%', sm: '280px' },
                        maxWidth: { xs: '100%', sm: '280px' },
                      }}
                    >
                      <Card
                        sx={{
                          width: '100%',
                          height: 360,
                          display: 'flex',
                          flexDirection: 'column',
                          cursor: 'pointer',
                          border: '1px solid',
                          borderColor: 'divider',
                          transition: 'transform 0.2s, box-shadow 0.2s',
                          overflow: 'hidden',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          },
                        }}
                        onClick={() => handleStartCourse(course.id)}
                      >
                        <Box sx={{ position: 'relative' }}>
                          {course.coverImageUrl ? (
                            <CardMedia
                              component="img"
                              image={course.coverImageUrl}
                              alt={course.title}
                              sx={{ height: 160, width: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <Box
                              sx={{
                                height: 160,
                                bgcolor: coverColor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {activeTab === 2 ? (
                                <CheckCircleIcon sx={{ fontSize: 48, color: 'white', opacity: 0.9 }} />
                              ) : (
                                <SchoolIcon sx={{ fontSize: 48, color: 'white', opacity: 0.9 }} />
                              )}
                            </Box>
                          )}
                          {activeTab === 0 && progress?.percentage > 0 && (
                            <Box
                              sx={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height: 4,
                                bgcolor: 'rgba(0,0,0,0.2)',
                              }}
                            >
                              <Box
                                sx={{
                                  height: '100%',
                                  bgcolor: primaryColor,
                                  width: `${progress.percentage}%`,
                                  transition: 'width 0.3s ease',
                                }}
                              />
                            </Box>
                          )}
                          {activeTab === 2 && (
                            <Chip
                              icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                              label="Abgeschlossen"
                              size="small"
                              color="success"
                              sx={{
                                position: 'absolute',
                                top: 8,
                                left: 8,
                                fontWeight: 600,
                                fontSize: '0.75rem',
                              }}
                            />
                          )}
                        </Box>
                        <CardContent
                          sx={{
                            p: 1.5,
                            flexGrow: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1,
                            overflow: 'hidden',
                            minHeight: 0,
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              gap: 1,
                            }}
                          >
                            <Typography
                              variant="subtitle1"
                              fontWeight={700}
                              gutterBottom
                              sx={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                height: 40,
                                minHeight: 40,
                                maxHeight: 40,
                              }}
                            >
                              {course.title}
                            </Typography>
                            <IconButton
                              aria-label="Kursaktionen"
                              onClick={(event) => handleCourseMenuOpen(event, course)}
                              size="small"
                              sx={{ mt: -0.5 }}
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </Box>
                          <Box sx={{ minHeight: 32 }}>
                            {course.description ? (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  fontSize: '0.875rem',
                                  lineHeight: 1.43,
                                  maxHeight: 32,
                                }}
                              >
                                {course.description}
                              </Typography>
                            ) : (
                              <Box sx={{ height: 32 }} />
                            )}
                          </Box>
                          {course.isShared && (
                            <Chip
                              label={course.ownerName ? `Eingeladen von ${course.ownerName}` : 'Eingeladener Kurs'}
                              size="small"
                              color="primary"
                              variant="outlined"
                              sx={{ alignSelf: 'flex-start' }}
                            />
                          )}
                          {isHidden && (
                            <Chip
                              label="Versteckt"
                              size="small"
                              color="default"
                              variant="outlined"
                              sx={{ alignSelf: 'flex-start', mt: 1 }}
                            />
                          )}
                          
                          <Box sx={{ mt: 'auto' }}>
                            <Stack direction="row" spacing={0.5} alignItems="center" mb={1}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <SchoolIcon sx={{ fontSize: 14 }} />
                                {course.chapters} {course.chapters === 1 ? 'Kapitel' : 'Kapitel'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">•</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {course.lessons} {course.lessons === 1 ? 'Lektion' : 'Lektionen'}
                              </Typography>
                            </Stack>
                            
                            <Box sx={{ minHeight: 32 }}>
                              {activeTab === 0 && (
                                <Typography variant="body2" fontWeight={600} color="primary">
                                  {progress?.percentage || 0}% abgeschlossen
                                </Typography>
                              )}
                              {activeTab === 1 && (
                                <Button
                                  variant="contained"
                                  fullWidth
                                  size="small"
                                  startIcon={<PlayArrowIcon />}
                                  sx={{ textTransform: 'none', fontWeight: 600 }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartCourse(course.id);
                                  }}
                                >
                                  Kurs starten
                                </Button>
                              )}
                              {activeTab === 2 && (
                                <Typography variant="body2" fontWeight={600} color="success.main">
                                  100% abgeschlossen
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            )}
            <Menu
              anchorEl={menuAnchorEl}
              open={Boolean(menuAnchorEl) && Boolean(menuCourse)}
              onClose={handleCourseMenuClose}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            >
              {menuCourse && !hiddenCourses.has(menuCourse.id) && (
                <MenuItem onClick={() => handleHideCourse(menuCourse)}>
                  <ListItemIcon>
                    <VisibilityOffIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Kurs ausblenden" secondary="Nur für dich verborgen" />
                </MenuItem>
              )}
              {menuCourse && hiddenCourses.has(menuCourse.id) && (
                <MenuItem onClick={() => handleUnhideCourse(menuCourse)}>
                  <ListItemIcon>
                    <VisibilityIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Kurs wieder anzeigen" secondary="Zurück ins Dashboard" />
                </MenuItem>
              )}
              {menuCourse && menuCourse.isShared && (
                <MenuItem onClick={() => handleRemoveCourseRequest(menuCourse)}>
                  <ListItemIcon>
                    <DeleteOutlineIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Kurs entfernen" secondary="Einladung erneut nötig" />
                </MenuItem>
              )}
            </Menu>
            <Snackbar
              open={actionSnackbar.open}
              autoHideDuration={3500}
              onClose={() => setActionSnackbar((prev) => ({ ...prev, open: false }))}
            >
              <Alert
                severity={actionSnackbar.severity}
                variant="filled"
                onClose={() => setActionSnackbar((prev) => ({ ...prev, open: false }))}
                sx={{ width: '100%' }}
              >
                {actionSnackbar.message}
              </Alert>
            </Snackbar>
            <Dialog open={deleteDialogOpen} onClose={handleCancelRemoveCourse} maxWidth="xs" fullWidth>
              <DialogTitle>Kurs dauerhaft entfernen?</DialogTitle>
              <DialogContent>
                <DialogContentText>
                  {deleteTarget
                    ? `Der Kurs "${deleteTarget.title}" wird dauerhaft aus deinem Dashboard gelöscht. Um erneut Zugriff zu erhalten, brauchst du eine neue Einladung.`
                    : 'Kurs wird dauerhaft entfernt.'}
                </DialogContentText>
              </DialogContent>
              <DialogActions>
                <Button onClick={handleCancelRemoveCourse}>Abbrechen</Button>
                <Button color="error" variant="contained" onClick={handleConfirmRemoveCourse}>
                  Entfernen
                </Button>
              </DialogActions>
            </Dialog>
          </Box>
        )}
      </Box>
    );
  }
