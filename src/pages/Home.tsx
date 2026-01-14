import { useEffect, useState } from 'react';
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
  IconButton,
  Grid
} from '@mui/material';
import { darken, lighten, getLuminance } from '@mui/system';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';
import SchoolIcon from '@mui/icons-material/School';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import VideocamIcon from '@mui/icons-material/Videocam';
import GroupsIcon from '@mui/icons-material/Groups';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AddIcon from '@mui/icons-material/Add';
import TimelineIcon from '@mui/icons-material/Timeline';

type Course = {
  id: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  category: string;
  progress?: number;
  lessonsCount?: number;
  createdBy?: string;
};

export default function Home() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentCourses, setRecentCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState({ courses: 0, lessons: 0, members: 0 });

  // Funktion zur Aufhellung der Farbe
  const getLighterColor = (color: string): string => {
    // Konvertiere Hex zu RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;

    // Konvertiere RGB zu HSL
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let l = (max + min) / 2;
    const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);

    if (max !== min) {
      if (max === r) h = ((g - b) / (max - min) + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / (max - min) + 2) / 6;
      else h = ((r - g) / (max - min) + 4) / 6;
    }

    // Erhöhe Lightness um 25%
    l = Math.min(1, l + 0.25);

    // Konvertiere HSL zurück zu RGB
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const rNew = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
    const gNew = Math.round(hue2rgb(p, q, h) * 255);
    const bNew = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

    return `#${((1 << 24) + (rNew << 16) + (gNew << 8) + bNew).toString(16).slice(1)}`;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        loadUserData(currentUser.uid);
      } else {
        // Lade Statistiken auch für nicht-eingeloggte Benutzer
        loadPublicStats();
      }
    });
    return () => unsubscribe();
  }, []);

  const loadPublicStats = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      setStats({
        courses: 0,
        lessons: 0,
        members: usersSnapshot.size,
      });
    } catch (error) {
      console.error('Fehler beim Laden der öffentlichen Statistiken:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserData = async (userId: string) => {
    try {
      // Lade Kurse des Benutzers
      const coursesRef = collection(db, 'users', userId, 'courses');
      const coursesSnapshot = await getDocs(coursesRef);
      
      const coursesData: Course[] = [];
      let totalLessons = 0;

      for (const courseDoc of coursesSnapshot.docs) {
        const courseData = courseDoc.data();
        
        // Lade alle Kapitel und zähle veröffentlichte Lektionen
        const chaptersSnapshot = await getDocs(
          collection(db, 'users', userId, 'courses', courseDoc.id, 'chapters')
        );

        const publishedChapters = chaptersSnapshot.docs.filter(
          (doc) => doc.data().status === 'published'
        );

        if (publishedChapters.length === 0) continue;

        let publishedLessons = 0;
        for (const chapterDoc of publishedChapters) {
          const lessonsSnapshot = await getDocs(
            collection(chapterDoc.ref, 'lessons')
          );
          publishedLessons += lessonsSnapshot.docs.filter(
            (doc) => doc.data().status === 'published' && doc.data().type !== 'subchapter'
          ).length;
        }

        if (publishedLessons === 0) continue;

        totalLessons += publishedLessons;

        // Lade Fortschritt für diesen Kurs
        const progressDoc = await getDoc(
          doc(db, 'users', userId, 'courseProgress', courseDoc.id)
        );

        let progress = 0;
        if (progressDoc.exists()) {
          const progressData = progressDoc.data();
          const completedLessons = Array.isArray(progressData.completedLessons)
            ? progressData.completedLessons.length
            : 0;
          const totalLessonCount = progressData.totalLessons || publishedLessons;
          
          if (totalLessonCount > 0) {
            progress = Math.round((completedLessons / totalLessonCount) * 100);
          } else if (progressData.percentage !== undefined) {
            progress = progressData.percentage;
          }
        }

        coursesData.push({
          id: courseDoc.id,
          title: courseData.title || 'Unbenannter Kurs',
          description: courseData.description || '',
          thumbnailUrl: courseData.coverImageUrl,
          category: courseData.category || 'Allgemein',
          lessonsCount: publishedLessons,
          createdBy: courseData.createdBy,
          progress,
        });
      }

      setRecentCourses(coursesData);

      // Lade globale Statistiken
      const usersSnapshot = await getDocs(collection(db, 'users'));
      
      setStats({
        courses: coursesData.length,
        lessons: totalLessons,
        members: usersSnapshot.size,
      });
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    // Landing Page für nicht-eingeloggte Benutzer
    return (
      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1160, mx: 'auto', width: '100%' }}>
        {/* Hero Section mit Gradient Background */}
        <Paper
          elevation={0}
          sx={{
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)}, ${alpha(theme.palette.secondary.main, 0.05)})`,
            borderRadius: 4,
            p: { xs: 4, md: 8 },
            mb: 6,
            textAlign: 'center',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SchoolIcon sx={{ fontSize: 48, color: 'white' }} />
            </Box>
          </Box>
          <Typography
            variant="h2"
            fontWeight={800}
            mb={2}
            sx={{ fontSize: { xs: '2rem', md: '3rem' } }}
          >
            Deine Lernplattform
          </Typography>
          <Typography
            variant="h6"
            color="text.secondary"
            mb={4}
            sx={{ maxWidth: 600, mx: 'auto', fontWeight: 400 }}
          >
            Erstelle, verwalte und teile professionelle Online-Kurse mit Video-Aufnahmen und
            interaktiven Inhalten
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrowIcon />}
              onClick={() => navigate('/signin')}
              sx={{ px: 4, py: 1.5 }}
            >
              Jetzt loslegen
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/courses')}
              sx={{ px: 4, py: 1.5 }}
            >
              Kurse ansehen
            </Button>
          </Stack>
        </Paper>

        {/* Features in Cards mit Icons */}
        <Grid container spacing={3} sx={{ mb: 6 }}>
          {[
            {
              icon: <VideocamIcon />,
              title: 'Video-Aufnahmen',
              description: 'Nimm direkt im Browser professionelle Lektionen auf',
              gradient: `linear-gradient(135deg, ${theme.palette.error.main}, ${theme.palette.error.dark})`,
            },
            {
              icon: <AutoStoriesIcon />,
              title: 'Rich Content',
              description: 'Erstelle interaktive Inhalte mit dem integrierten Editor',
              gradient: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`,
            },
            {
              icon: <TimelineIcon />,
              title: 'Fortschritts-Tracking',
              description: 'Verfolge den Lernfortschrift deiner Teilnehmer',
              gradient: `linear-gradient(135deg, ${theme.palette.info.main}, ${theme.palette.info.dark})`,
            },
            {
              icon: <GroupsIcon />,
              title: 'Team-Verwaltung',
              description: 'Verwalte Mitglieder und Berechtigungen zentral',
              gradient: `linear-gradient(135deg, ${theme.palette.warning.main}, ${theme.palette.warning.dark})`,
            },
          ].map((feature, index) => (
            <Grid size={{ xs: 12, sm: 6 }} key={index}>
              <Card
                sx={{
                  height: '100%',
                  transition: 'all 0.3s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: (() => {
                      const lum = getLuminance(theme.palette.primary.main);
                      const color = theme.palette.mode === 'dark'
                        ? (lum < 0.3 ? lighten(theme.palette.primary.main, 0.5) : theme.palette.primary.main)
                        : (lum > 0.7 ? darken(theme.palette.primary.main, 0.5) : theme.palette.primary.main);
                      return `0 0 24px ${alpha(color, 0.4)}`;
                    })(),
                  },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: 2,
                        background: feature.gradient,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        flexShrink: 0,
                      }}
                    >
                      {feature.icon}
                    </Box>
                    <Box>
                      <Typography variant="h6" fontWeight={700} mb={1}>
                        {feature.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {feature.description}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Platform Stats */}
        {(stats.courses > 0 || stats.members > 0) && (
          <Card sx={{ textAlign: 'center' }}>
            <CardContent sx={{ py: 5 }}>
              <Typography variant="h5" fontWeight={700} mb={4}>
                Die Plattform in Zahlen
              </Typography>
              <Grid container spacing={4}>
                {[
                  { label: 'Kurse', value: stats.courses, icon: SchoolIcon },
                  { label: 'Lektionen', value: stats.lessons, icon: AutoStoriesIcon },
                  { label: 'Mitglieder', value: stats.members, icon: GroupsIcon },
                ].map((stat, index) => (
                  <Grid size={{ xs: 12, sm: 4 }} key={index}>
                    <Stack alignItems="center" spacing={1}>
                      <stat.icon sx={{ fontSize: 40, color: 'primary.main' }} />
                      <Typography variant="h3" fontWeight={800}>
                        {stat.value}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {stat.label}
                      </Typography>
                    </Stack>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        )}
      </Box>
    );
  }

  // Dashboard für eingeloggte Benutzer
  const lighterColor = getLighterColor(theme.palette.primary.main);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1160, mx: 'auto', width: '100%' }}>
      {/* Welcome Header mit Gradient */}
      <Paper
        elevation={0}
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${lighterColor})`,
          color: (() => {
            const lum = getLuminance(theme.palette.primary.main);
            // Bei sehr hellen Farben (wie weiß) → dunklen Text
            // Bei sehr dunklen Farben im Dark Mode → hellen Text bleibt
            if (lum > 0.7) {
              return theme.palette.mode === 'dark' ? '#000' : '#000';
            }
            return 'white';
          })(),
          p: 4,
          borderRadius: 3,
          mb: 4,
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h4" fontWeight={700} mb={0.5}>
              Hallo, {user.displayName || 'Lernender'}!
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.95 }}>
              Deine Lernübersicht für heute
            </Typography>
          </Box>
          <LocalFireDepartmentIcon 
            sx={{ 
              fontSize: 60, 
              opacity: (() => {
                const lum = getLuminance(theme.palette.primary.main);
                return lum > 0.7 ? 0.15 : 0.3;
              })()
            }} 
          />
        </Stack>
      </Paper>

      {/* Quick Stats Grid */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    MEINE KURSE
                  </Typography>
                  <SchoolIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                </Stack>
                <Typography variant="h3" fontWeight={800}>
                  {recentCourses.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Aktive Kurse
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card sx={{ height: '100%', background: `linear-gradient(135deg, ${alpha('#22c55e', 0.15)}, ${alpha('#22c55e', 0.08)})` }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    ABGESCHLOSSEN
                  </Typography>
                  <CheckCircleIcon sx={{ fontSize: 20, color: '#22c55e' }} />
                </Stack>
                <Typography variant="h3" fontWeight={800}>
                  {recentCourses.filter(c => c.progress === 100).length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Kurse beendet
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Features Section */}

      <Grid container spacing={2} sx={{ mb: 4 }}>
        {[
          {
            icon: <VideocamIcon />,
            title: 'Video-Aufnahmen',
            description: 'Nimm Lektionen direkt im Browser auf',
            gradient: `linear-gradient(135deg, ${theme.palette.error.main}, ${theme.palette.error.dark})`,
          },
          {
            icon: <AutoStoriesIcon />,
            title: 'Rich Content',
            description: 'Interaktive Inhalte mit Editor erstellen',
            gradient: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`,
          },
          {
            icon: <TimelineIcon />,
            title: 'Fortschritts-Tracking',
            description: 'Lernfortschritt deiner Teilnehmer verfolgen',
            gradient: `linear-gradient(135deg, ${theme.palette.info.main}, ${theme.palette.info.dark})`,
          },
          {
            icon: <GroupsIcon />,
            title: 'Team-Verwaltung',
            description: 'Mitglieder und Berechtigungen verwalten',
            gradient: `linear-gradient(135deg, ${theme.palette.warning.main}, ${theme.palette.warning.dark})`,
          },
        ].map((feature, index) => (
          <Grid size={{ xs: 6, sm: 6, md: 6 }} key={index}>
            <Card
              sx={{
                height: '100%',
                transition: 'all 0.2s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: (() => {
                    const lum = getLuminance(theme.palette.primary.main);
                    const color = theme.palette.mode === 'dark'
                      ? (lum < 0.3 ? lighten(theme.palette.primary.main, 0.5) : theme.palette.primary.main)
                      : (lum > 0.7 ? darken(theme.palette.primary.main, 0.5) : theme.palette.primary.main);
                    return `0 0 16px ${alpha(color, 0.35)}`;
                  })(),
                },
              }}
            >
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      background: feature.gradient,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      flexShrink: 0,
                    }}
                  >
                    {feature.icon}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight={700} mb={0.5}>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {feature.description}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card>
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6" fontWeight={700}>
              Deine Kurse
            </Typography>
            <Button
              size="small"
              endIcon={<ArrowForwardIcon />}
              onClick={() => navigate('/courses')}
            >
              Alle anzeigen
            </Button>
          </Stack>

          {loading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">Lade Kurse...</Typography>
            </Box>
          ) : recentCourses.length > 0 ? (
            <Stack spacing={2}>
              {recentCourses.slice(0, 3).map((course) => (
                <Paper
                  key={course.id}
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.02),
                      boxShadow: theme.shadows[2],
                    },
                  }}
                  onClick={() => navigate(`/learn/${course.id}`)}
                >
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: 2,
                        background: course.thumbnailUrl
                          ? `url(${course.thumbnailUrl})`
                          : `linear-gradient(135deg, ${theme.palette.primary.main}, ${lighterColor})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        flexShrink: 0,
                      }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle1" fontWeight={700} noWrap>
                        {course.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {course.lessonsCount} Lektionen
                      </Typography>
                      {course.progress !== undefined && (
                        <Box sx={{ mt: 1 }}>
                          <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                            <LinearProgress
                              variant="determinate"
                              value={course.progress}
                              sx={{ flex: 1, height: 6, borderRadius: 3 }}
                            />
                            <Typography variant="caption" fontWeight={600} sx={{ minWidth: 40 }}>
                              {course.progress}%
                            </Typography>
                          </Stack>
                        </Box>
                      )}
                    </Box>
                    <IconButton size="small">
                      <PlayArrowIcon />
                    </IconButton>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <SchoolIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
              <Typography variant="body2" color="text.secondary" mb={2}>
                Du hast noch keine Kurse erstellt
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => navigate('/courses')}
              >
                Ersten Kurs erstellen
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
