import { useEffect, useState, useMemo } from 'react';
import type { MouseEvent, ChangeEvent } from 'react';
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
  alpha,
  TextField,
  InputAdornment,
  Paper,
  LinearProgress,
  Avatar,
  Collapse,
} from '@mui/material';
import { darken, lighten, getLuminance } from '@mui/system';
import Grid from '@mui/material/Grid';
import SchoolIcon from '@mui/icons-material/School';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import LayersIcon from '@mui/icons-material/Layers';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import DashboardIcon from '@mui/icons-material/Dashboard';
import Tooltip from '@mui/material/Tooltip';
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
  // For search indexing
  chapterTitles?: string[];
  lessonTitles?: string[];
};

type CourseProgress = {
  courseId: string;
  completedLessons: string[];
  totalLessons: number;
  percentage: number;
  lastAccessedAt?: Date;
};

type SearchResult = {
  type: 'course' | 'chapter' | 'lesson';
  courseId: string;
  courseTitle: string;
  title: string;
  subtitle?: string;
  coverImageUrl?: string;
  coverColor?: string;
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
  const isDark = theme.palette.mode === 'dark';
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
  
  // Search functionality
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Color utilities
  const getContrastColor = (bgColor: string): string => {
    try {
      const lum = getLuminance(bgColor);
      return lum > 0.5 ? '#000000' : '#ffffff';
    } catch {
      return '#ffffff';
    }
  };

  const getLighterColor = (color: string): string => {
    try {
      const lum = getLuminance(color);
      if (isDark) {
        return lum < 0.3 ? lighten(color, 0.3) : color;
      }
      return lum > 0.7 ? darken(color, 0.2) : lighten(color, 0.2);
    } catch {
      return color;
    }
  };

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

          // Zähle veröffentlichte Lektionen und sammle Titel für Suche
          let publishedLessons = 0;
          const chapterTitles: string[] = [];
          const lessonTitles: string[] = [];
          
          for (const chapterDoc of publishedChapters) {
            const chapterData = chapterDoc.data();
            if (chapterData.title) chapterTitles.push(chapterData.title);
            
            const lessonsSnapshot = await getDocs(
              collection(chapterDoc.ref, 'lessons')
            );
            lessonsSnapshot.docs.forEach((lessonDoc) => {
              const lessonData = lessonDoc.data();
              if (lessonData.status === 'published' && lessonData.type !== 'subchapter') {
                publishedLessons++;
                if (lessonData.title) lessonTitles.push(lessonData.title);
              }
            });
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
              chapterTitles,
              lessonTitles,
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
          let sharedChapterTitles: string[] = [];
          let sharedLessonTitles: string[] = [];

          if ((sharedLessonCount === 0 || sharedChapterCount === 0) && ownerId) {
            try {
              const ownerCourseRef = doc(db, 'users', ownerId, 'courses', courseId);
              const ownerCourseSnapshot = await getDoc(ownerCourseRef);
              if (ownerCourseSnapshot.exists()) {
                const chaptersSnapshot = await getDocs(collection(ownerCourseRef, 'chapters'));
                const publishedChapters = chaptersSnapshot.docs.filter((chapterDoc) => chapterDoc.data().status === 'published');
                sharedChapterCount = publishedChapters.length;
                
                for (const chapterDoc of publishedChapters) {
                  const chapterData = chapterDoc.data();
                  if (chapterData.title) sharedChapterTitles.push(chapterData.title);
                  
                  const lessonsSnapshot = await getDocs(collection(chapterDoc.ref, 'lessons'));
                  lessonsSnapshot.docs.forEach((lessonDoc) => {
                    const lessonData = lessonDoc.data();
                    if (lessonData.status === 'published' && lessonData.type !== 'subchapter') {
                      if (sharedLessonCount === 0) sharedLessonCount++;
                      if (lessonData.title) sharedLessonTitles.push(lessonData.title);
                    }
                  });
                }
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
            chapterTitles: sharedChapterTitles,
            lessonTitles: sharedLessonTitles,
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

  // Search functionality
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const query = searchQuery.toLowerCase().trim();
    const results: SearchResult[] = [];

    courses.forEach((course) => {
      // Search in course title
      if (course.title.toLowerCase().includes(query)) {
        results.push({
          type: 'course',
          courseId: course.id,
          courseTitle: course.title,
          title: course.title,
          subtitle: `${course.chapters} Kapitel · ${course.lessons} Lektionen`,
          coverImageUrl: course.coverImageUrl,
          coverColor: course.coverColor,
        });
      }

      // Search in chapter titles
      course.chapterTitles?.forEach((chapterTitle) => {
        if (chapterTitle.toLowerCase().includes(query)) {
          results.push({
            type: 'chapter',
            courseId: course.id,
            courseTitle: course.title,
            title: chapterTitle,
            subtitle: course.title,
            coverImageUrl: course.coverImageUrl,
            coverColor: course.coverColor,
          });
        }
      });

      // Search in lesson titles
      course.lessonTitles?.forEach((lessonTitle) => {
        if (lessonTitle.toLowerCase().includes(query)) {
          results.push({
            type: 'lesson',
            courseId: course.id,
            courseTitle: course.title,
            title: lessonTitle,
            subtitle: course.title,
            coverImageUrl: course.coverImageUrl,
            coverColor: course.coverColor,
          });
        }
      });
    });

    // Deduplicate and limit
    const uniqueResults = results.filter((result, index, self) =>
      index === self.findIndex((r) => r.type === result.type && r.title === result.title && r.courseId === result.courseId)
    );

    setSearchResults(uniqueResults.slice(0, 15));
    setIsSearching(false);
  }, [searchQuery, courses]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalCourses = courses.length;
    const completedCourses = courses.filter((c) => {
      const progress = courseProgress[c.id];
      return progress?.percentage >= 100;
    }).length;
    const totalLessons = courses.reduce((sum, c) => sum + c.lessons, 0);
    const completedLessons = Object.values(courseProgress).reduce((sum, p) => sum + p.completedLessons.length, 0);
    const avgProgress = totalCourses > 0 
      ? Math.round(courses.reduce((sum, c) => sum + (courseProgress[c.id]?.percentage || 0), 0) / totalCourses)
      : 0;
    return { totalCourses, completedCourses, totalLessons, completedLessons, avgProgress };
  }, [courses, courseProgress]);

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
        <Alert severity="info">Bitte melde dich an, um dein Dashboard zu sehen.</Alert>
      </Box>
    );
  }

  const getFilteredCourses = () => {
    switch (activeTab) {
      case 0:
        return inProgressCourses;
      case 1:
        return notStartedCourses;
      case 2:
        return completedCourses;
      case 3:
        return displayedCourses;
      default:
        return courses;
    }
  };

  const filteredCourses = getFilteredCourses();

  // All courses option (tab index 3)
  const allCourses = displayedCourses;

  const lighterPrimary = getLighterColor(primaryColor);
  const textOnPrimary = getContrastColor(primaryColor);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1160, mx: 'auto', width: '100%' }}>
      
      {/* HERO BANNER - Kompakt */}
      <Paper
        elevation={0}
        sx={{
          background: `linear-gradient(135deg, ${primaryColor}, ${lighterPrimary})`,
          borderRadius: 3,
          p: { xs: 2, md: 2.5 },
          mb: 3,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ position: 'absolute', right: -20, top: -20, opacity: 0.08 }}>
          <DashboardIcon sx={{ fontSize: 160, color: textOnPrimary }} />
        </Box>
        
        <Stack 
          direction={{ xs: 'column', sm: 'row' }} 
          spacing={2} 
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
        >
          <Box>
            <Typography 
              variant="h5" 
              fontWeight={700} 
              sx={{ color: textOnPrimary, mb: 0.25 }}
            >
              Dein Dashboard
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ color: alpha(textOnPrimary, 0.8) }}
            >
              Verwalte und lerne deine Kurse
            </Typography>
          </Box>
          
          {/* Quick Stats */}
          <Stack direction="row" spacing={1.5}>
            <Paper
              elevation={0}
              sx={{
                px: 2,
                py: 1,
                borderRadius: 2,
                bgcolor: alpha(textOnPrimary, 0.15),
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <AutoStoriesIcon sx={{ color: textOnPrimary, fontSize: 18 }} />
              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ color: textOnPrimary, lineHeight: 1 }}>
                  {loading ? '-' : stats.totalCourses}
                </Typography>
                <Typography variant="caption" sx={{ color: alpha(textOnPrimary, 0.8), fontSize: '0.65rem' }}>
                  Kurse
                </Typography>
              </Box>
            </Paper>
            <Paper
              elevation={0}
              sx={{
                px: 2,
                py: 1,
                borderRadius: 2,
                bgcolor: alpha(textOnPrimary, 0.15),
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <EmojiEventsIcon sx={{ color: textOnPrimary, fontSize: 18 }} />
              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ color: textOnPrimary, lineHeight: 1 }}>
                  {loading ? '-' : stats.completedCourses}
                </Typography>
                <Typography variant="caption" sx={{ color: alpha(textOnPrimary, 0.8), fontSize: '0.65rem' }}>
                  Abgeschlossen
                </Typography>
              </Box>
            </Paper>
          </Stack>
        </Stack>
      </Paper>

      {/* SEARCH BAR */}
      <Box sx={{ mb: 3, position: 'relative' }}>
        <TextField
          fullWidth
          placeholder="Kurse, Kapitel oder Lektionen suchen..."
          value={searchQuery}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchQuery('')}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 3,
              bgcolor: 'background.paper',
              '&:hover': {
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: alpha(primaryColor, 0.5),
                },
              },
              '&.Mui-focused': {
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: primaryColor,
                  borderWidth: 2,
                },
              },
            },
          }}
        />
        
        {/* Search Results Dropdown */}
        <Collapse in={searchQuery.length > 0 && searchResults.length > 0}>
          <Paper
            elevation={8}
            sx={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              mt: 1,
              borderRadius: 3,
              overflow: 'hidden',
              zIndex: 1000,
              maxHeight: 400,
              overflowY: 'auto',
            }}
          >
            <Box sx={{ p: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 1, display: 'block' }}>
                {searchResults.length} Ergebnis{searchResults.length !== 1 ? 'se' : ''} gefunden
              </Typography>
              {searchResults.map((result, index) => (
                <Box
                  key={`${result.type}-${result.courseId}-${index}`}
                  onClick={() => {
                    navigate(`/learn/${result.courseId}`);
                    setSearchQuery('');
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 1.5,
                    borderRadius: 2,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    '&:hover': {
                      bgcolor: alpha(primaryColor, 0.08),
                    },
                  }}
                >
                  <Avatar
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      bgcolor: result.coverColor || primaryColor,
                    }}
                    src={result.coverImageUrl}
                  >
                    {result.type === 'course' && <SchoolIcon sx={{ fontSize: 20 }} />}
                    {result.type === 'chapter' && <LayersIcon sx={{ fontSize: 20 }} />}
                    {result.type === 'lesson' && <MenuBookIcon sx={{ fontSize: 20 }} />}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {result.title}
                      </Typography>
                      <Chip
                        label={result.type === 'course' ? 'Kurs' : result.type === 'chapter' ? 'Kapitel' : 'Lektion'}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.65rem',
                          bgcolor: result.type === 'course' 
                            ? alpha(primaryColor, 0.1) 
                            : result.type === 'chapter'
                              ? alpha('#f59e0b', 0.1)
                              : alpha('#22c55e', 0.1),
                          color: result.type === 'course' 
                            ? primaryColor 
                            : result.type === 'chapter'
                              ? '#d97706'
                              : '#16a34a',
                        }}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {result.subtitle}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        </Collapse>
      </Box>

      {loading ? (
        <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }}>
          <CircularProgress />
        </Stack>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : courses.length === 0 ? (
        <Alert 
          severity="info"
          sx={{
            backgroundColor: alpha(primaryColor, 0.1),
            color: isDark 
              ? getLuminance(primaryColor) < 0.3 ? lighten(primaryColor, 0.5) : primaryColor
              : getLuminance(primaryColor) > 0.7 ? darken(primaryColor, 0.5) : primaryColor,
            '& .MuiAlert-icon': {
              color: isDark 
                ? getLuminance(primaryColor) < 0.3 ? lighten(primaryColor, 0.5) : primaryColor
                : getLuminance(primaryColor) > 0.7 ? darken(primaryColor, 0.5) : primaryColor,
            },
            borderRadius: 3,
          }}
        >
          Noch keine Kurse oder Einladungen sichtbar. Erstelle einen Kurs oder nimm eine Einladung an.
        </Alert>
      ) : (
        <Box>
          {/* Header with Filter Chips */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            sx={{ mb: 2.5 }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <SchoolIcon sx={{ color: primaryColor, fontSize: 24 }} />
              <Typography variant="h6" fontWeight={700}>
                Meine Kurse
              </Typography>
            </Stack>
            
            {hiddenCourseCount > 0 && (
              <Tooltip title={showHiddenCourses ? 'Versteckte ausblenden' : `${hiddenCourseCount} versteckte Kurse anzeigen`}>
                <IconButton
                  size="small"
                  onClick={() => setShowHiddenCourses((prev) => !prev)}
                  sx={{ 
                    bgcolor: showHiddenCourses ? alpha(primaryColor, 0.1) : 'transparent',
                    '&:hover': { bgcolor: alpha(primaryColor, 0.15) },
                  }}
                >
                  {showHiddenCourses ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            )}
          </Stack>

          {/* Filter Chips statt Tabs */}
          <Stack direction="row" spacing={1} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
            <Chip
              label={`Alle ${allCourses.length}`}
              onClick={() => setActiveTab(3)}
              variant={activeTab === 3 ? 'filled' : 'outlined'}
              sx={{
                fontWeight: 600,
                borderRadius: 2,
                px: 0.5,
                bgcolor: activeTab === 3 ? primaryColor : 'transparent',
                color: activeTab === 3 ? textOnPrimary : 'text.primary',
                borderColor: activeTab === 3 ? primaryColor : 'divider',
                '&:hover': {
                  bgcolor: activeTab === 3 ? primaryColor : alpha(primaryColor, 0.08),
                },
              }}
            />
            <Chip
              label={`In Bearbeitung ${inProgressCourses.length}`}
              onClick={() => setActiveTab(0)}
              variant={activeTab === 0 ? 'filled' : 'outlined'}
              sx={{
                fontWeight: 600,
                borderRadius: 2,
                px: 0.5,
                bgcolor: activeTab === 0 ? primaryColor : 'transparent',
                color: activeTab === 0 ? textOnPrimary : 'text.primary',
                borderColor: activeTab === 0 ? primaryColor : 'divider',
                '&:hover': {
                  bgcolor: activeTab === 0 ? primaryColor : alpha(primaryColor, 0.08),
                },
              }}
            />
            <Chip
              label={`Verfügbar ${notStartedCourses.length}`}
              onClick={() => setActiveTab(1)}
              variant={activeTab === 1 ? 'filled' : 'outlined'}
              sx={{
                fontWeight: 600,
                borderRadius: 2,
                px: 0.5,
                bgcolor: activeTab === 1 ? primaryColor : 'transparent',
                color: activeTab === 1 ? textOnPrimary : 'text.primary',
                borderColor: activeTab === 1 ? primaryColor : 'divider',
                '&:hover': {
                  bgcolor: activeTab === 1 ? primaryColor : alpha(primaryColor, 0.08),
                },
              }}
            />
            <Chip
              icon={<CheckCircleIcon sx={{ fontSize: 16, color: activeTab === 2 ? '#fff !important' : '#22c55e !important' }} />}
              label={`Abgeschlossen ${completedCourses.length}`}
              onClick={() => setActiveTab(2)}
              variant={activeTab === 2 ? 'filled' : 'outlined'}
              sx={{
                fontWeight: 600,
                borderRadius: 2,
                px: 0.5,
                bgcolor: activeTab === 2 ? '#22c55e' : 'transparent',
                color: activeTab === 2 ? '#fff' : 'text.primary',
                borderColor: activeTab === 2 ? '#22c55e' : 'divider',
                '&:hover': {
                  bgcolor: activeTab === 2 ? '#22c55e' : alpha('#22c55e', 0.08),
                },
              }}
            />
          </Stack>

          {filteredCourses.length === 0 ? (
            <Alert 
              severity="info" 
              sx={{ 
                borderRadius: 3,
                backgroundColor: alpha(primaryColor, 0.1),
                color: isDark 
                  ? getLuminance(primaryColor) < 0.3 ? lighten(primaryColor, 0.5) : primaryColor
                  : getLuminance(primaryColor) > 0.7 ? darken(primaryColor, 0.5) : primaryColor,
                '& .MuiAlert-icon': {
                  color: isDark 
                    ? getLuminance(primaryColor) < 0.3 ? lighten(primaryColor, 0.5) : primaryColor
                    : getLuminance(primaryColor) > 0.7 ? darken(primaryColor, 0.5) : primaryColor,
                },
              }}
            >
              {!showHiddenCourses && hiddenCourseCount > 0 && displayedCourses.length === 0
                ? 'Alle Kurse sind ausgeblendet. Blende sie über den Button oben wieder ein.'
                : activeTab === 0
                  ? 'Keine Kurse in Bearbeitung.'
                  : activeTab === 1
                    ? 'Keine verfügbaren Kurse.'
                    : activeTab === 2
                      ? 'Keine abgeschlossenen Kurse.'
                      : 'Keine Kurse vorhanden.'}
            </Alert>
          ) : (
            <Grid
              container
              spacing={3}
              sx={{
                maxWidth: '100%',
              }}
            >
              {filteredCourses.map((course) => {
                const progress = courseProgress[course.id];
                const percentage = progress?.percentage || 0;
                const isCompleted = percentage >= 100;
                const coverColor = course.coverColor || primaryColor;
                const hiddenMeta = hiddenCourses.get(course.id);
                const isHidden = Boolean(hiddenMeta);
                  
                return (
                  <Grid
                    key={course.id}
                    size={{ xs: 12, sm: 6, md: 4, lg: 3 }}
                  >
                    {/* Modern Card Design */}
                    <Card
                      sx={{
                        height: '100%',
                        minHeight: 340,
                        display: 'flex',
                        flexDirection: 'column',
                        cursor: 'pointer',
                        borderRadius: 4,
                        border: '1px solid',
                        borderColor: 'divider',
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        overflow: 'hidden',
                        bgcolor: 'background.paper',
                        '&:hover': {
                          transform: 'translateY(-6px)',
                          boxShadow: isDark 
                            ? '0 20px 40px rgba(0,0,0,0.4)'
                            : '0 20px 40px rgba(0,0,0,0.12)',
                          borderColor: alpha(primaryColor, 0.3),
                        },
                      }}
                      onClick={() => handleStartCourse(course.id)}
                    >
                      {/* Cover Image with Frame */}
                      <Box sx={{ p: 1.5, pb: 0 }}>
                        <Box
                          sx={{
                            position: 'relative',
                            borderRadius: 3,
                            overflow: 'hidden',
                            border: '1px solid',
                            borderColor: isDark ? alpha('#fff', 0.1) : alpha('#000', 0.08),
                          }}
                        >
                          {course.coverImageUrl ? (
                            <CardMedia
                              component="img"
                              image={course.coverImageUrl}
                              alt={course.title}
                              sx={{ 
                                height: 140, 
                                width: '100%', 
                                objectFit: 'cover',
                              }}
                            />
                          ) : (
                            <Box
                              sx={{
                                height: 140,
                                background: `linear-gradient(135deg, ${coverColor}, ${getLighterColor(coverColor)})`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {isCompleted ? (
                                <CheckCircleIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.9)' }} />
                              ) : (
                                <SchoolIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.9)' }} />
                              )}
                            </Box>
                          )}
                          
                          {/* Progress Bar on Image */}
                          {percentage > 0 && percentage < 100 && (
                            <Box
                              sx={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height: 5,
                                bgcolor: 'rgba(0,0,0,0.4)',
                              }}
                            >
                              <Box
                                sx={{
                                  height: '100%',
                                  bgcolor: primaryColor,
                                  width: `${percentage}%`,
                                  transition: 'width 0.3s ease',
                                  borderRadius: '0 2px 2px 0',
                                  boxShadow: `0 0 8px ${alpha(primaryColor, 0.6)}`,
                                }}
                              />
                            </Box>
                          )}
                          
                          {/* Completed Badge */}
                          {isCompleted && (
                            <Chip
                              icon={<CheckCircleIcon sx={{ fontSize: 14, color: '#fff !important' }} />}
                              label="Abgeschlossen"
                              size="small"
                              sx={{
                                position: 'absolute',
                                top: 10,
                                left: 10,
                                fontWeight: 600,
                                fontSize: '0.7rem',
                                bgcolor: '#22c55e',
                                color: '#fff',
                                '& .MuiChip-icon': { color: '#fff' },
                              }}
                            />
                          )}
                        </Box>
                      </Box>

                      {/* Card Content */}
                      <CardContent
                        sx={{
                          p: 2,
                          pt: 1.5,
                          flexGrow: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          bgcolor: 'background.paper',
                        }}
                      >
                        {/* Title Row */}
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: 0.5,
                            mb: 0.5,
                          }}
                        >
                          <Typography
                            variant="subtitle1"
                            fontWeight={700}
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              lineHeight: 1.3,
                              minHeight: 42,
                            }}
                          >
                            {course.title}
                          </Typography>
                          <IconButton
                            aria-label="Kursaktionen"
                            onClick={(event) => handleCourseMenuOpen(event, course)}
                            size="small"
                            sx={{ 
                              mt: -0.5, 
                              mr: -1,
                              opacity: 0.7,
                              '&:hover': { opacity: 1 },
                            }}
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </Box>

                        {/* Shared/Hidden Badges - Fixed Height Area */}
                        <Box sx={{ minHeight: 28, mb: 0.5 }}>
                          {course.isShared && (
                            <Chip
                              label={course.ownerName ? `Eingeladen von ${course.ownerName}` : 'Eingeladener Kurs'}
                              size="small"
                              variant="outlined"
                              sx={{ 
                                height: 24,
                                fontSize: '0.7rem',
                                borderColor: alpha(primaryColor, 0.3),
                                color: primaryColor,
                              }}
                            />
                          )}
                          {isHidden && (
                            <Chip
                              label="Versteckt"
                              size="small"
                              variant="outlined"
                              sx={{ 
                                height: 24,
                                fontSize: '0.7rem',
                                ml: course.isShared ? 0.5 : 0,
                              }}
                            />
                          )}
                        </Box>

                        {/* Stats Row - Always at Bottom */}
                        <Box sx={{ mt: 'auto' }}>
                          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <LayersIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary" fontWeight={500}>
                                {course.chapters} Kapitel
                              </Typography>
                            </Stack>
                            <Typography variant="caption" color="text.secondary">•</Typography>
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <MenuBookIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary" fontWeight={500}>
                                {course.lessons} Lektionen
                              </Typography>
                            </Stack>
                          </Stack>
                          
                          {/* Progress Section - Fixed Height */}
                          <Box sx={{ minHeight: 32 }}>
                            {percentage > 0 ? (
                              <Stack spacing={0.5}>
                                <LinearProgress
                                  variant="determinate"
                                  value={percentage}
                                  sx={{
                                    height: 6,
                                    borderRadius: 3,
                                    bgcolor: alpha(isCompleted ? '#22c55e' : primaryColor, 0.15),
                                    '& .MuiLinearProgress-bar': {
                                      borderRadius: 3,
                                      bgcolor: isCompleted ? '#22c55e' : primaryColor,
                                    },
                                  }}
                                />
                                <Typography 
                                  variant="caption" 
                                  fontWeight={600} 
                                  sx={{ color: isCompleted ? '#22c55e' : primaryColor }}
                                >
                                  {percentage}% abgeschlossen
                                </Typography>
                              </Stack>
                            ) : (
                              <Button
                                variant="contained"
                                fullWidth
                                size="small"
                                startIcon={<PlayArrowIcon />}
                                sx={{ 
                                  textTransform: 'none', 
                                  fontWeight: 600,
                                  borderRadius: 2,
                                  py: 0.75,
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartCourse(course.id);
                                }}
                              >
                                Kurs starten
                              </Button>
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
          
          {/* Course Context Menu */}
          <Menu
            anchorEl={menuAnchorEl}
            open={Boolean(menuAnchorEl) && Boolean(menuCourse)}
            onClose={handleCourseMenuClose}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            sx={{
              '& .MuiPaper-root': {
                borderRadius: 3,
                minWidth: 200,
              },
            }}
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
          
          {/* Snackbar */}
          <Snackbar
            open={actionSnackbar.open}
            autoHideDuration={3500}
            onClose={() => setActionSnackbar((prev) => ({ ...prev, open: false }))}
          >
            <Alert
              severity={actionSnackbar.severity}
              variant="filled"
              onClose={() => setActionSnackbar((prev) => ({ ...prev, open: false }))}
              sx={{ width: '100%', borderRadius: 2 }}
            >
              {actionSnackbar.message}
            </Alert>
          </Snackbar>
          
          {/* Delete Confirmation Dialog */}
          <Dialog 
            open={deleteDialogOpen} 
            onClose={handleCancelRemoveCourse} 
            maxWidth="xs" 
            fullWidth
            sx={{
              '& .MuiPaper-root': {
                borderRadius: 3,
              },
            }}
          >
            <DialogTitle>Kurs dauerhaft entfernen?</DialogTitle>
            <DialogContent>
              <DialogContentText>
                {deleteTarget
                  ? `Der Kurs "${deleteTarget.title}" wird dauerhaft aus deinem Dashboard gelöscht. Um erneut Zugriff zu erhalten, brauchst du eine neue Einladung.`
                  : 'Kurs wird dauerhaft entfernt.'}
              </DialogContentText>
            </DialogContent>
            <DialogActions sx={{ p: 2.5, pt: 1 }}>
              <Button onClick={handleCancelRemoveCourse} sx={{ borderRadius: 2 }}>
                Abbrechen
              </Button>
              <Button 
                color="error" 
                variant="contained" 
                onClick={handleConfirmRemoveCourse}
                sx={{ borderRadius: 2 }}
              >
                Entfernen
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}
    </Box>
  );
}
