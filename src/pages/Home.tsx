import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  LinearProgress,
  useTheme,
  alpha,
  Paper,
  Grid,
  Skeleton,
  Chip,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { getLuminance, lighten, darken } from '@mui/system';
import CloseIcon from '@mui/icons-material/Close';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';

// Icons
import SchoolIcon from '@mui/icons-material/School';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import VideocamIcon from '@mui/icons-material/Videocam';
import GroupsIcon from '@mui/icons-material/Groups';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddIcon from '@mui/icons-material/Add';
import TimelineIcon from '@mui/icons-material/Timeline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EditNoteIcon from '@mui/icons-material/EditNote';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import FolderOffIcon from '@mui/icons-material/FolderOff';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import FilterListIcon from '@mui/icons-material/FilterList';
import CheckIcon from '@mui/icons-material/Check';

// Types
type NewsSettings = {
  course_completed: boolean;
  course_created: boolean;
  invitation_received: boolean;
  lesson_completed: boolean;
  member_added: boolean;
};

type DismissedActivities = Record<string, number>; // ID -> dismissed timestamp

const DEFAULT_NEWS_SETTINGS: NewsSettings = {
  course_completed: true,
  course_created: true,
  invitation_received: true,
  lesson_completed: false,
  member_added: false,
};

type Course = {
  id: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  coverColor?: string;
  category: string;
  progress: number;
  lessonsCount: number;
  chaptersCount: number;
  draftLessons: number;
  createdAt?: Date;
};

type ActivityItem = {
  id: string;
  type: 'lesson_completed' | 'course_created' | 'course_completed' | 'lesson_created' | 'invitation_received' | 'member_added';
  title: string;
  subtitle: string;
  timestamp: Date;
  icon: 'check' | 'add' | 'trophy' | 'edit' | 'mail' | 'person';
  courseId?: string;
  ownerId?: string;
};

type AttentionItem = {
  id: string;
  type: 'empty_course' | 'draft_lessons' | 'inactive_course';
  title: string;
  description: string;
  courseId: string;
  severity: 'warning' | 'info';
  action: string;
};

// Utility Functions
const getTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Gerade eben';
  if (diffMins < 60) return `vor ${diffMins} Min.`;
  if (diffHours < 24) return `vor ${diffHours} Std.`;
  if (diffDays < 7) return `vor ${diffDays} Tagen`;
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
};

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Guten Morgen';
  if (hour < 18) return 'Willkommen zurück';
  return 'Guten Abend';
};

export default function Home() {
  const theme = useTheme();
  const navigate = useNavigate();
  const primaryColor = theme.palette.primary.main;
  const isDark = theme.palette.mode === 'dark';

  // State
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [dismissedActivities, setDismissedActivities] = useState<DismissedActivities>(() => {
    const saved = localStorage.getItem('dismissedActivities');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migration: If old format (array), convert to empty object
        if (Array.isArray(parsed)) {
          return {};
        }
        return parsed;
      } catch {
        return {};
      }
    }
    return {};
  });
  const [newsSettings] = useState<NewsSettings>(() => {
    const saved = localStorage.getItem('newsSettings');
    return saved ? { ...DEFAULT_NEWS_SETTINGS, ...JSON.parse(saved) } : DEFAULT_NEWS_SETTINGS;
  });
  const [courseFilterAnchor, setCourseFilterAnchor] = useState<null | HTMLElement>(null);
  const [courseSortBy, setCourseSortBy] = useState<'progress' | 'completed-first' | 'newest' | 'highest-progress' | 'lowest-progress'>('progress');
  const [stats, setStats] = useState({
    totalCourses: 0,
    completedCourses: 0,
    totalLessons: 0,
    completedLessons: 0,
    avgProgress: 0,
    weeklyActivity: 0,
  });

  // Derived values
  const currentCourse = useMemo(() => {
    const inProgress = courses.filter(c => c.progress > 0 && c.progress < 100);
    if (inProgress.length > 0) {
      return inProgress.sort((a, b) => b.progress - a.progress)[0];
    }
    return courses[0] || null;
  }, [courses]);

  const sortedCourses = useMemo(() => {
    const sorted = [...courses];
    switch (courseSortBy) {
      case 'completed-first':
        return sorted.sort((a, b) => {
          if (a.progress === 100 && b.progress !== 100) return -1;
          if (a.progress !== 100 && b.progress === 100) return 1;
          return b.progress - a.progress;
        });
      case 'newest':
        return sorted.sort((a, b) => {
          const timeA = a.createdAt?.getTime() || 0;
          const timeB = b.createdAt?.getTime() || 0;
          return timeB - timeA;
        });
      case 'highest-progress':
        return sorted.sort((a, b) => b.progress - a.progress);
      case 'lowest-progress':
        return sorted.sort((a, b) => a.progress - b.progress);
      case 'progress':
      default:
        return sorted.sort((a, b) => {
          if (a.progress > 0 && a.progress < 100 && (b.progress === 0 || b.progress === 100)) return -1;
          if (b.progress > 0 && b.progress < 100 && (a.progress === 0 || a.progress === 100)) return 1;
          return b.progress - a.progress;
        });
    }
  }, [courses, courseSortBy]);

  const completionRate = useMemo(() => {
    if (stats.totalCourses === 0) return 0;
    return Math.round((stats.completedCourses / stats.totalCourses) * 100);
  }, [stats]);

  // Color utilities
  const getContrastColor = (bgColor: string): string => {
    const lum = getLuminance(bgColor);
    return lum > 0.5 ? '#000000' : '#ffffff';
  };

  const getLighterColor = (color: string): string => {
    const lum = getLuminance(color);
    if (isDark) {
      return lum < 0.3 ? lighten(color, 0.3) : color;
    }
    return lum > 0.7 ? darken(color, 0.2) : lighten(color, 0.2);
  };

  // Data loading
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        loadUserData(currentUser.uid);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadUserData = async (userId: string) => {
    try {
      setLoading(true);

      // Phase 1: Load top-level collections in parallel
      const [hiddenCoursesSnapshot, coursesSnapshot, enrollmentsSnapshot] = await Promise.all([
        getDocs(collection(db, 'users', userId, 'hiddenCourses')),
        getDocs(collection(db, 'users', userId, 'courses')),
        getDocs(collection(db, 'users', userId, 'enrollments')),
      ]);

      const hiddenCourseIds = new Set<string>();
      hiddenCoursesSnapshot.docs.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        if (data.hidden !== false) {
          hiddenCourseIds.add(docSnapshot.id);
        }
      });

      const coursesData: Course[] = [];
      const attentionData: AttentionItem[] = [];
      const activityData: ActivityItem[] = [];
      let totalLessonsCount = 0;
      let completedLessonsCount = 0;

      // Phase 2: Process own courses in parallel
      const visibleCourseDocs = coursesSnapshot.docs.filter(d => !hiddenCourseIds.has(d.id));

      const ownCourseResults = await Promise.all(
        visibleCourseDocs.map(async (courseDoc) => {
          const courseData = courseDoc.data();

          // Load chapters and progress in parallel
          const [chaptersSnapshot, progressDoc] = await Promise.all([
            getDocs(collection(db, 'users', userId, 'courses', courseDoc.id, 'chapters')),
            getDoc(doc(db, 'users', userId, 'courseProgress', courseDoc.id)),
          ]);

          const publishedChapters = chaptersSnapshot.docs.filter(
            (d) => d.data().status === 'published'
          );

          // Load all lessons in parallel
          const lessonSnapshots = await Promise.all(
            chaptersSnapshot.docs.map(chapterDoc => getDocs(collection(chapterDoc.ref, 'lessons')))
          );

          let publishedLessons = 0;
          let draftLessons = 0;
          const publishedLessonIds: string[] = [];
          const lessonTitles: Record<string, string> = {};

          lessonSnapshots.forEach((lessonsSnapshot) => {
            lessonsSnapshot.docs.forEach((lessonDoc) => {
              const lessonData = lessonDoc.data();
              if (lessonData.type !== 'subchapter') {
                if (lessonData.status === 'published') {
                  publishedLessons++;
                  publishedLessonIds.push(lessonDoc.id);
                  lessonTitles[lessonDoc.id] = lessonData.title || 'Unbenannte Lektion';
                } else if (lessonData.status === 'draft') {
                  draftLessons++;
                }
              }
            });
          });

          let progress = 0;
          let completedCount = 0;
          const localActivities: ActivityItem[] = [];

          if (progressDoc.exists()) {
            const progressData = progressDoc.data();
            const validCompleted = Array.isArray(progressData.completedLessons)
              ? progressData.completedLessons.filter((id: string) => publishedLessonIds.includes(id))
              : [];
            completedCount = validCompleted.length;

            if (publishedLessons > 0) {
              progress = Math.round((completedCount / publishedLessons) * 100);
            }

            const lessonCompletedAt = progressData.lessonCompletedAt;
            if (lessonCompletedAt && typeof lessonCompletedAt === 'object') {
              Object.entries(lessonCompletedAt).forEach(([lessonId, timestamp]) => {
                if (publishedLessonIds.includes(lessonId) && timestamp) {
                  const ts = (timestamp as { toDate?: () => Date });
                  localActivities.push({
                    id: `lesson-${courseDoc.id}-${lessonId}`,
                    type: 'lesson_completed',
                    title: `"${lessonTitles[lessonId] || 'Lektion'}" abgeschlossen`,
                    subtitle: courseData.title || 'Kurs',
                    timestamp: ts.toDate?.() || new Date(),
                    icon: 'check',
                    courseId: courseDoc.id,
                  });
                }
              });
            }

            if (progress === 100) {
              localActivities.push({
                id: `completed-${courseDoc.id}`,
                type: 'course_completed',
                title: `"${courseData.title || 'Unbenannter Kurs'}" abgeschlossen`,
                subtitle: `${publishedLessons} Lektionen`,
                timestamp: progressDoc.data()?.lastAccessedAt?.toDate?.() || new Date(),
                icon: 'trophy',
              });
            }
          }

          if (courseData.createdAt) {
            localActivities.push({
              id: `created-${courseDoc.id}`,
              type: 'course_created',
              title: `Kurs "${courseData.title || 'Unbenannter Kurs'}" erstellt`,
              subtitle: courseData.category || 'Allgemein',
              timestamp: courseData.createdAt.toDate?.() || new Date(),
              icon: 'add',
            });
          }

          const course: Course = {
            id: courseDoc.id,
            title: courseData.title || 'Unbenannter Kurs',
            description: courseData.description || '',
            thumbnailUrl: courseData.coverImageUrl,
            coverColor: courseData.coverColor,
            category: courseData.category || 'Allgemein',
            lessonsCount: publishedLessons,
            chaptersCount: publishedChapters.length,
            draftLessons,
            progress,
            createdAt: courseData.createdAt?.toDate?.(),
          };

          const localAttention: AttentionItem[] = [];
          if (publishedLessons === 0 && chaptersSnapshot.docs.length > 0) {
            localAttention.push({
              id: `empty-${courseDoc.id}`,
              type: 'empty_course',
              title: course.title,
              description: 'Dieser Kurs hat noch keine veröffentlichten Lektionen',
              courseId: courseDoc.id,
              severity: 'warning',
              action: 'Inhalt hinzufügen',
            });
          }
          if (draftLessons > 0) {
            localAttention.push({
              id: `draft-${courseDoc.id}`,
              type: 'draft_lessons',
              title: course.title,
              description: `${draftLessons} Lektion${draftLessons > 1 ? 'en' : ''} im Entwurf`,
              courseId: courseDoc.id,
              severity: 'info',
              action: 'Veröffentlichen',
            });
          }

          return { course, activities: localActivities, attention: localAttention, publishedLessons, completedCount };
        })
      );

      for (const result of ownCourseResults) {
        coursesData.push(result.course);
        activityData.push(...result.activities);
        attentionData.push(...result.attention);
        totalLessonsCount += result.publishedLessons;
        completedLessonsCount += result.completedCount;
      }

      // Phase 3: Process enrolled courses in parallel
      const visibleEnrollments = enrollmentsSnapshot.docs.filter(
        d => !hiddenCourseIds.has(d.id) && d.data().ownerId
      );

      const enrolledResults = await Promise.all(
        visibleEnrollments.map(async (enrollmentDoc) => {
          const enrollmentData = enrollmentDoc.data();
          const ownerId = enrollmentData.ownerId;
          const courseId = enrollmentDoc.id;

          try {
            const courseDocSnapshot = await getDoc(
              doc(db, 'users', ownerId, 'courses', courseId)
            );

            if (!courseDocSnapshot.exists()) return null;

            const courseData = courseDocSnapshot.data();
            const chaptersSnapshot = await getDocs(
              collection(db, 'users', ownerId, 'courses', courseId, 'chapters')
            );

            const publishedChapters = chaptersSnapshot.docs.filter(
              (d) => d.data().status === 'published'
            );

            if (publishedChapters.length === 0) return null;

            // Load all lessons and progress in parallel
            const [progressDoc, ...lessonSnapshots] = await Promise.all([
              getDoc(doc(db, 'users', userId, 'courseProgress', courseId)),
              ...publishedChapters.map(chapterDoc => getDocs(collection(chapterDoc.ref, 'lessons'))),
            ]);

            let publishedLessons = 0;
            const publishedLessonIds: string[] = [];

            lessonSnapshots.forEach((lessonsSnapshot) => {
              lessonsSnapshot.docs.forEach((lessonDoc) => {
                const lessonData = lessonDoc.data();
                if (lessonData.status === 'published' && lessonData.type !== 'subchapter') {
                  publishedLessons++;
                  publishedLessonIds.push(lessonDoc.id);
                }
              });
            });

            if (publishedLessons === 0) return null;

            let progress = 0;
            let localCompletedCount = 0;
            if (progressDoc.exists()) {
              const progressData = progressDoc.data();
              const validCompleted = Array.isArray(progressData.completedLessons)
                ? progressData.completedLessons.filter((id: string) => publishedLessonIds.includes(id))
                : [];
              localCompletedCount = validCompleted.length;

              if (publishedLessons > 0) {
                progress = Math.round((validCompleted.length / publishedLessons) * 100);
              }
            }

            return {
              course: {
                id: courseId,
                title: courseData.title || 'Unbenannter Kurs',
                description: courseData.description || '',
                thumbnailUrl: courseData.coverImageUrl,
                coverColor: courseData.coverColor,
                category: courseData.category || 'Allgemein',
                lessonsCount: publishedLessons,
                chaptersCount: publishedChapters.length,
                draftLessons: 0,
                progress,
                createdAt: courseData.createdAt?.toDate?.(),
              } as Course,
              publishedLessons,
              completedCount: localCompletedCount,
            };
          } catch (error) {
            console.error('Fehler beim Laden des enrolled Kurses:', error);
            return null;
          }
        })
      );

      for (const result of enrolledResults) {
        if (!result) continue;
        coursesData.push(result.course);
        totalLessonsCount += result.publishedLessons;
        completedLessonsCount += result.completedCount;
      }

      // Sort courses
      coursesData.sort((a, b) => {
        if (a.progress > 0 && a.progress < 100 && (b.progress === 0 || b.progress === 100)) return -1;
        if (b.progress > 0 && b.progress < 100 && (a.progress === 0 || a.progress === 100)) return 1;
        return b.progress - a.progress;
      });

      // Phase 4: Load invitations in parallel
      if (auth.currentUser?.email) {
        const normalizedEmail = auth.currentUser.email.toLowerCase();

        const [invitationsSnapshot, acceptedSnapshot] = await Promise.all([
          getDocs(query(
            collection(db, 'courseInvitations'),
            where('inviteeEmail', '==', normalizedEmail)
          )),
          getDocs(query(
            collection(db, 'courseInvitations'),
            where('ownerId', '==', userId),
            where('status', '==', 'accepted')
          )),
        ]);

        invitationsSnapshot.docs.forEach((invDoc) => {
          const invData = invDoc.data();
          if (invData.status === 'pending' && invData.createdAt) {
            activityData.push({
              id: `invitation-${invDoc.id}`,
              type: 'invitation_received',
              title: `Einladung zu "${invData.courseTitle || 'Kurs'}"`,
              subtitle: invData.ownerName ? `von ${invData.ownerName}` : 'Neue Kurseinladung',
              timestamp: invData.createdAt.toDate?.() || new Date(),
              icon: 'mail',
              courseId: invData.courseId,
              ownerId: invData.ownerId,
            });
          }
        });

        acceptedSnapshot.docs.forEach((invDoc) => {
          const invData = invDoc.data();
          if (invData.acceptedAt) {
            activityData.push({
              id: `member-${invDoc.id}`,
              type: 'member_added',
              title: `Neues Mitglied in "${invData.courseTitle || 'Kurs'}"`,
              subtitle: invData.inviteeEmail || 'Einladung angenommen',
              timestamp: invData.acceptedAt.toDate?.() || new Date(),
              icon: 'person',
              courseId: invData.courseId,
            });
          }
        });
      }

      activityData.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      setCourses(coursesData);
      setAttentionItems(attentionData.slice(0, 3));
      setActivities(activityData.slice(0, 8));

      const completedCourses = coursesData.filter(c => c.progress === 100).length;
      const avgProgress = coursesData.length > 0
        ? Math.round(coursesData.reduce((sum, c) => sum + c.progress, 0) / coursesData.length)
        : 0;

      setStats({
        totalCourses: coursesData.length,
        completedCourses,
        totalLessons: totalLessonsCount,
        completedLessons: completedLessonsCount,
        avgProgress,
        weeklyActivity: activityData.filter(a => {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return a.timestamp > weekAgo;
        }).length,
      });

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // LANDING PAGE (Not logged in)
  // ============================================
  if (!user) {
    return (
      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1160, mx: 'auto', width: '100%' }}>
        <Paper
          elevation={0}
          sx={{
            background: `linear-gradient(135deg, ${alpha(primaryColor, 0.08)}, ${alpha(primaryColor, 0.02)})`,
            borderRadius: 4,
            p: { xs: 4, md: 8 },
            mb: 6,
            textAlign: 'center',
            border: '1px solid',
            borderColor: alpha(primaryColor, 0.1),
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '24px',
                background: `linear-gradient(135deg, ${primaryColor}, ${getLighterColor(primaryColor)})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 8px 32px ${alpha(primaryColor, 0.3)}`,
              }}
            >
              <SchoolIcon sx={{ fontSize: 42, color: getContrastColor(primaryColor) }} />
            </Box>
          </Box>
          <Typography variant="h2" fontWeight={800} mb={2} sx={{ fontSize: { xs: '2rem', md: '3rem' } }}>
            Deine Lernplattform
          </Typography>
          <Typography variant="h6" color="text.secondary" mb={4} sx={{ maxWidth: 600, mx: 'auto', fontWeight: 400 }}>
            Erstelle, verwalte und teile professionelle Online-Kurse mit Video-Aufnahmen und interaktiven Inhalten
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button variant="contained" size="large" startIcon={<PlayArrowIcon />} onClick={() => navigate('/signin')} sx={{ px: 4, py: 1.5, borderRadius: 2 }}>
              Jetzt loslegen
            </Button>
            <Button variant="outlined" size="large" onClick={() => navigate('/courses')} sx={{ px: 4, py: 1.5, borderRadius: 2 }}>
              Kurse ansehen
            </Button>
          </Stack>
        </Paper>

        <Grid container spacing={3}>
          {[
            { icon: <VideocamIcon />, title: 'Video-Aufnahmen', description: 'Nimm direkt im Browser professionelle Lektionen auf', color: '#ef4444' },
            { icon: <AutoStoriesIcon />, title: 'Rich Content', description: 'Erstelle interaktive Inhalte mit dem integrierten Editor', color: '#22c55e' },
            { icon: <TimelineIcon />, title: 'Fortschritts-Tracking', description: 'Verfolge den Lernfortschritt deiner Teilnehmer', color: '#3b82f6' },
            { icon: <GroupsIcon />, title: 'Team-Verwaltung', description: 'Verwalte Mitglieder und Berechtigungen zentral', color: '#f59e0b' },
          ].map((feature, index) => (
            <Grid size={{ xs: 12, sm: 6 }} key={index}>
              <Card elevation={0} sx={{ height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 3, transition: 'all 0.2s', '&:hover': { borderColor: alpha(primaryColor, 0.3), transform: 'translateY(-2px)' } }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: alpha(feature.color, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', color: feature.color }}>
                      {feature.icon}
                    </Box>
                    <Box>
                      <Typography variant="h6" fontWeight={700} mb={0.5}>{feature.title}</Typography>
                      <Typography variant="body2" color="text.secondary">{feature.description}</Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  // ============================================
  // DASHBOARD (Logged in)
  // ============================================
  const lighterPrimary = getLighterColor(primaryColor);
  const textOnPrimary = getContrastColor(primaryColor);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1160, mx: 'auto', width: '100%' }}>
      
      {/* HERO SECTION */}
      <Paper
        elevation={0}
        sx={{
          background: `linear-gradient(135deg, ${primaryColor}, ${lighterPrimary})`,
          borderRadius: 4,
          p: { xs: 3, md: 4 },
          mb: 3,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ position: 'absolute', right: -20, top: -20, opacity: 0.1 }}>
          <RocketLaunchIcon sx={{ fontSize: 200, color: textOnPrimary }} />
        </Box>

        <Grid container spacing={3} alignItems="center">
          <Grid size={{ xs: 12, md: 7 }}>
            <Typography variant="overline" sx={{ color: alpha(textOnPrimary, 0.7), fontWeight: 600, letterSpacing: 1.5 }}>
              {getGreeting()}
            </Typography>
            <Typography variant="h4" fontWeight={800} sx={{ color: textOnPrimary, mb: 1 }}>
              {user.displayName || 'Willkommen zurück'}!
            </Typography>
            
            {loading ? (
              <Skeleton variant="text" width={200} sx={{ bgcolor: alpha(textOnPrimary, 0.1) }} />
            ) : currentCourse ? (
              <Box sx={{ mt: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                  <Typography variant="body2" sx={{ color: alpha(textOnPrimary, 0.8) }}>
                    Aktueller Kurs:
                  </Typography>
                  <Typography variant="body2" fontWeight={700} sx={{ color: textOnPrimary }}>
                    {currentCourse.title}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={2} alignItems="center">
                  <LinearProgress
                    variant="determinate"
                    value={currentCourse.progress}
                    sx={{
                      flex: 1,
                      height: 8,
                      borderRadius: 4,
                      bgcolor: alpha(textOnPrimary, 0.2),
                      '& .MuiLinearProgress-bar': {
                        bgcolor: textOnPrimary,
                        borderRadius: 4,
                      },
                    }}
                  />
                  <Typography variant="body2" fontWeight={700} sx={{ color: textOnPrimary, minWidth: 45 }}>
                    {currentCourse.progress}%
                  </Typography>
                </Stack>
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: alpha(textOnPrimary, 0.8), mt: 1 }}>
                Erstelle deinen ersten Kurs und starte durch!
              </Typography>
            )}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 3 }}>
              {currentCourse && currentCourse.progress < 100 ? (
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<PlayArrowIcon />}
                  onClick={() => navigate(`/learn/${currentCourse.id}`)}
                  sx={{
                    bgcolor: textOnPrimary,
                    color: primaryColor,
                    px: 3,
                    py: 1.2,
                    borderRadius: 2,
                    fontWeight: 700,
                    '&:hover': { bgcolor: alpha(textOnPrimary, 0.9) },
                  }}
                >
                  Weiterarbeiten
                </Button>
              ) : (
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<AddIcon />}
                  onClick={() => navigate('/courses')}
                  sx={{
                    bgcolor: textOnPrimary,
                    color: primaryColor,
                    px: 3,
                    py: 1.2,
                    borderRadius: 2,
                    fontWeight: 700,
                    '&:hover': { bgcolor: alpha(textOnPrimary, 0.9) },
                  }}
                >
                  Neuen Kurs erstellen
                </Button>
              )}
              <Button
                variant="outlined"
                size="large"
                startIcon={<EditNoteIcon />}
                onClick={() => navigate('/courses')}
                sx={{
                  borderColor: alpha(textOnPrimary, 0.5),
                  color: textOnPrimary,
                  px: 3,
                  py: 1.2,
                  borderRadius: 2,
                  '&:hover': {
                    borderColor: textOnPrimary,
                    bgcolor: alpha(textOnPrimary, 0.1),
                  },
                }}
              >
                Kurse verwalten
              </Button>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 5 }} sx={{ display: { xs: 'none', md: 'block' } }}>
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 3,
                  bgcolor: alpha(textOnPrimary, 0.15),
                  backdropFilter: 'blur(10px)',
                  minWidth: 100,
                  textAlign: 'center',
                }}
              >
                <Typography variant="h4" fontWeight={800} sx={{ color: textOnPrimary }}>
                  {loading ? '-' : stats.totalCourses}
                </Typography>
                <Typography variant="caption" sx={{ color: alpha(textOnPrimary, 0.8) }}>
                  Kurse
                </Typography>
              </Paper>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 3,
                  bgcolor: alpha(textOnPrimary, 0.15),
                  backdropFilter: 'blur(10px)',
                  minWidth: 100,
                  textAlign: 'center',
                }}
              >
                <Typography variant="h4" fontWeight={800} sx={{ color: textOnPrimary }}>
                  {loading ? '-' : `${stats.avgProgress}%`}
                </Typography>
                <Typography variant="caption" sx={{ color: alpha(textOnPrimary, 0.8) }}>
                  Fortschritt
                </Typography>
              </Paper>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* ATTENTION + INSIGHTS ROW */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        
        {/* Attention Section */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card elevation={0} sx={{ height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                <WarningAmberIcon sx={{ color: '#f59e0b', fontSize: 20 }} />
                <Typography variant="subtitle1" fontWeight={700}>
                  Braucht Aufmerksamkeit
                </Typography>
              </Stack>

              {loading ? (
                <Stack spacing={2}>
                  {[1, 2].map(i => <Skeleton key={i} variant="rounded" height={60} sx={{ borderRadius: 2 }} />)}
                </Stack>
              ) : attentionItems.length > 0 ? (
                <Stack spacing={1.5}>
                  {attentionItems.map((item) => (
                    <Paper
                      key={item.id}
                      elevation={0}
                      onClick={() => navigate(`/courses/${item.courseId}`)}
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        bgcolor: item.severity === 'warning' ? alpha('#f59e0b', 0.08) : alpha(primaryColor, 0.05),
                        border: '1px solid',
                        borderColor: item.severity === 'warning' ? alpha('#f59e0b', 0.2) : alpha(primaryColor, 0.1),
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          bgcolor: item.severity === 'warning' ? alpha('#f59e0b', 0.12) : alpha(primaryColor, 0.08),
                          transform: 'translateX(4px)',
                        },
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {item.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.description}
                          </Typography>
                        </Box>
                        <Chip
                          label={item.action}
                          size="small"
                          sx={{
                            ml: 1,
                            fontSize: '0.7rem',
                            height: 24,
                            bgcolor: item.severity === 'warning' ? alpha('#f59e0b', 0.15) : alpha(primaryColor, 0.1),
                            color: item.severity === 'warning' ? '#d97706' : primaryColor,
                          }}
                        />
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <CheckCircleIcon sx={{ fontSize: 40, color: '#22c55e', mb: 1, opacity: 0.7 }} />
                  <Typography variant="body2" color="text.secondary">
                    Alles erledigt! Keine offenen Punkte.
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Performance Insights */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card elevation={0} sx={{ height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                <TrendingUpIcon sx={{ color: primaryColor, fontSize: 20 }} />
                <Typography variant="subtitle1" fontWeight={700}>
                  Performance
                </Typography>
              </Stack>

              <Grid container spacing={2}>
                {[
                  {
                    label: 'Abschlussrate',
                    value: loading ? '-' : `${completionRate}%`,
                    icon: <EmojiEventsIcon />,
                    color: completionRate >= 70 ? '#22c55e' : completionRate >= 40 ? '#f59e0b' : '#ef4444',
                    bg: completionRate >= 70 ? alpha('#22c55e', 0.1) : completionRate >= 40 ? alpha('#f59e0b', 0.1) : alpha('#ef4444', 0.1),
                  },
                  {
                    label: 'Ø Fortschritt',
                    value: loading ? '-' : `${stats.avgProgress}%`,
                    icon: <TimelineIcon />,
                    color: primaryColor,
                    bg: alpha(primaryColor, 0.1),
                  },
                  {
                    label: 'Lektionen',
                    value: loading ? '-' : stats.completedLessons,
                    icon: <AutoStoriesIcon />,
                    color: stats.completedLessons > 0 ? '#8b5cf6' : 'text.secondary',
                    bg: stats.completedLessons > 0 ? alpha('#8b5cf6', 0.1) : alpha('#888', 0.1),
                  },
                  {
                    label: 'Abgeschlossen',
                    value: loading ? '-' : `${stats.completedCourses}/${stats.totalCourses}`,
                    icon: <CheckCircleIcon />,
                    color: '#22c55e',
                    bg: alpha('#22c55e', 0.1),
                  },
                ].map((stat, index) => (
                  <Grid size={{ xs: 6 }} key={index}>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: stat.bg, height: '100%' }}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box sx={{ color: stat.color }}>{stat.icon}</Box>
                        <Box>
                          <Typography variant="h6" fontWeight={800} sx={{ color: stat.color, lineHeight: 1.2 }}>
                            {stat.value}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {stat.label}
                          </Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ACTIVITY + COURSES ROW */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        
        {/* Neuigkeiten */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card elevation={0} sx={{ height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                <NotificationsNoneIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                <Typography variant="subtitle1" fontWeight={700}>
                  Neuigkeiten
                </Typography>
              </Stack>

              {loading ? (
                <Stack spacing={2}>
                  {[1, 2, 3].map(i => <Skeleton key={i} variant="rounded" height={50} sx={{ borderRadius: 2 }} />)}
                </Stack>
              ) : activities.filter(a => {
                // Check settings filter
                if (a.type === 'course_completed' && !newsSettings.course_completed) return false;
                if (a.type === 'course_created' && !newsSettings.course_created) return false;
                if (a.type === 'invitation_received' && !newsSettings.invitation_received) return false;
                if (a.type === 'lesson_completed' && !newsSettings.lesson_completed) return false;
                if (a.type === 'member_added' && !newsSettings.member_added) return false;
                // Check dismissed (only if activity timestamp <= dismissed timestamp)
                const dismissedAt = dismissedActivities[a.id];
                if (dismissedAt && a.timestamp.getTime() <= dismissedAt) return false;
                return true;
              }).length > 0 ? (
                <Stack spacing={0}>
                  {activities.filter(a => {
                    if (a.type === 'course_completed' && !newsSettings.course_completed) return false;
                    if (a.type === 'course_created' && !newsSettings.course_created) return false;
                    if (a.type === 'invitation_received' && !newsSettings.invitation_received) return false;
                    if (a.type === 'lesson_completed' && !newsSettings.lesson_completed) return false;
                    if (a.type === 'member_added' && !newsSettings.member_added) return false;
                    const dismissedAt = dismissedActivities[a.id];
                    if (dismissedAt && a.timestamp.getTime() <= dismissedAt) return false;
                    return true;
                  }).slice(0, 5).map((activity, index, arr) => (
                    <Box
                      key={activity.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        py: 1.5,
                        borderBottom: index < arr.length - 1 ? '1px solid' : 'none',
                        borderColor: 'divider',
                        cursor: activity.type === 'invitation_received' ? 'pointer' : 'default',
                        borderRadius: 1,
                        mx: -1,
                        px: 1,
                        transition: 'all 0.15s',
                        '&:hover': activity.type === 'invitation_received' ? {
                          bgcolor: alpha(primaryColor, 0.05),
                        } : {},
                      }}
                      onClick={() => {
                        if (activity.type === 'invitation_received') {
                          navigate('/dashboard');
                        }
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          mr: 1.5,
                          bgcolor: activity.icon === 'trophy' ? alpha('#f59e0b', 0.15) :
                                   activity.icon === 'check' ? alpha('#22c55e', 0.15) :
                                   activity.icon === 'mail' ? alpha('#3b82f6', 0.15) :
                                   activity.icon === 'person' ? alpha('#8b5cf6', 0.15) :
                                   alpha(primaryColor, 0.15),
                        }}
                      >
                        {activity.icon === 'trophy' && <EmojiEventsIcon sx={{ fontSize: 16, color: '#f59e0b' }} />}
                        {activity.icon === 'check' && <CheckCircleIcon sx={{ fontSize: 16, color: '#22c55e' }} />}
                        {activity.icon === 'add' && <AddIcon sx={{ fontSize: 16, color: primaryColor }} />}
                        {activity.icon === 'edit' && <EditNoteIcon sx={{ fontSize: 16, color: primaryColor }} />}
                        {activity.icon === 'mail' && <MailOutlineIcon sx={{ fontSize: 16, color: '#3b82f6' }} />}
                        {activity.icon === 'person' && <PersonAddIcon sx={{ fontSize: 16, color: '#8b5cf6' }} />}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {activity.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {activity.subtitle ? `${activity.subtitle} · ` : ''}{getTimeAgo(activity.timestamp)}
                        </Typography>
                      </Box>
                      <Tooltip title="Entfernen">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            const newDismissed = {
                              ...dismissedActivities,
                              [activity.id]: activity.timestamp.getTime(),
                            };
                            setDismissedActivities(newDismissed);
                            localStorage.setItem('dismissedActivities', JSON.stringify(newDismissed));
                          }}
                          sx={{
                            opacity: 0.5,
                            '&:hover': { opacity: 1, color: 'error.main' },
                          }}
                        >
                          <CloseIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CheckCircleIcon sx={{ fontSize: 40, color: '#22c55e', mb: 1, opacity: 0.7 }} />
                  <Typography variant="body2" color="text.secondary">
                    Alles gelesen!
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Courses Preview */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card elevation={0} sx={{ height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <SchoolIcon sx={{ color: primaryColor, fontSize: 20 }} />
                  <Typography variant="subtitle1" fontWeight={700}>
                    Deine Kurse
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Tooltip title="Sortierung">
                    <IconButton
                      size="small"
                      onClick={(e) => setCourseFilterAnchor(e.currentTarget)}
                      sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
                    >
                      <FilterListIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                  </Tooltip>
                  <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/courses')} sx={{ textTransform: 'none' }}>
                    Alle anzeigen
                  </Button>
                </Stack>
              </Stack>

              <Menu
                anchorEl={courseFilterAnchor}
                open={Boolean(courseFilterAnchor)}
                onClose={() => setCourseFilterAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                <MenuItem
                  onClick={() => {
                    setCourseSortBy('progress');
                    setCourseFilterAnchor(null);
                  }}
                >
                  <ListItemIcon>
                    {courseSortBy === 'progress' && <CheckIcon fontSize="small" />}
                  </ListItemIcon>
                  <ListItemText>In Bearbeitung zuerst</ListItemText>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setCourseSortBy('completed-first');
                    setCourseFilterAnchor(null);
                  }}
                >
                  <ListItemIcon>
                    {courseSortBy === 'completed-first' && <CheckIcon fontSize="small" />}
                  </ListItemIcon>
                  <ListItemText>Abgeschlossene zuerst</ListItemText>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setCourseSortBy('newest');
                    setCourseFilterAnchor(null);
                  }}
                >
                  <ListItemIcon>
                    {courseSortBy === 'newest' && <CheckIcon fontSize="small" />}
                  </ListItemIcon>
                  <ListItemText>Zuletzt hinzugefügt</ListItemText>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setCourseSortBy('highest-progress');
                    setCourseFilterAnchor(null);
                  }}
                >
                  <ListItemIcon>
                    {courseSortBy === 'highest-progress' && <CheckIcon fontSize="small" />}
                  </ListItemIcon>
                  <ListItemText>Höchster Fortschritt</ListItemText>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setCourseSortBy('lowest-progress');
                    setCourseFilterAnchor(null);
                  }}
                >
                  <ListItemIcon>
                    {courseSortBy === 'lowest-progress' && <CheckIcon fontSize="small" />}
                  </ListItemIcon>
                  <ListItemText>Niedrigster Fortschritt</ListItemText>
                </MenuItem>
              </Menu>

              {loading ? (
                <Stack spacing={2}>
                  {[1, 2, 3].map(i => <Skeleton key={i} variant="rounded" height={70} sx={{ borderRadius: 2 }} />)}
                </Stack>
              ) : sortedCourses.length > 0 ? (
                <Stack spacing={1.5}>
                  {sortedCourses.slice(0, 4).map((course) => (
                    <Paper
                      key={course.id}
                      elevation={0}
                      onClick={() => navigate(`/learn/${course.id}`)}
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          borderColor: alpha(primaryColor, 0.3),
                          bgcolor: alpha(primaryColor, 0.03),
                          transform: 'translateX(4px)',
                        },
                      }}
                    >
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Box
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 2,
                            background: course.thumbnailUrl
                              ? `url(${course.thumbnailUrl})`
                              : course.coverColor 
                                ? course.coverColor
                                : `linear-gradient(135deg, ${primaryColor}, ${lighterPrimary})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            flexShrink: 0,
                          }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={700} noWrap>
                            {course.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {course.lessonsCount} Lektionen · {course.chaptersCount} Kapitel
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={course.progress}
                            sx={{
                              mt: 1,
                              height: 4,
                              borderRadius: 2,
                              bgcolor: alpha(primaryColor, 0.1),
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 2,
                                bgcolor: course.progress === 100 ? '#22c55e' : primaryColor,
                              },
                            }}
                          />
                        </Box>
                        <Stack alignItems="flex-end" spacing={0.5}>
                          <Typography variant="body2" fontWeight={700} sx={{ color: course.progress === 100 ? '#22c55e' : primaryColor }}>
                            {course.progress}%
                          </Typography>
                          {course.progress === 100 && (
                            <CheckCircleIcon sx={{ fontSize: 16, color: '#22c55e' }} />
                          )}
                        </Stack>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <FolderOffIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    Noch keine Kurse vorhanden
                  </Typography>
                  <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => navigate('/courses')}>
                    Ersten Kurs erstellen
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
