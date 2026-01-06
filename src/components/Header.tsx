import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Box,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Badge,
  Typography,
  Stack,
  Button,
  CircularProgress,
  Snackbar,
  Alert,
} from '@mui/material';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import LogoutIcon from '@mui/icons-material/Logout';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { signOut, onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  updateDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';
import { useColorMode } from '../context/ColorModeContext';

const buildAvatarSrc = (url?: string, version?: number) => {
  if (!url) {
    return undefined;
  }
  if (!version) {
    return url;
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${version}`;
};

type CourseInvitation = {
  id: string;
  courseId: string;
  courseTitle: string;
  courseDescription?: string;
  coverImageUrl?: string | null;
  coverColor?: string | null;
  chapterCount?: number;
  lessonCount?: number;
  ownerId: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
  status: 'pending' | 'accepted' | 'revoked';
  createdAt?: Date | null;
};

export default function Header() {
  const navigate = useNavigate();
  const { mode, toggleColorMode } = useColorMode();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notificationsAnchorEl, setNotificationsAnchorEl] = useState<null | HTMLElement>(null);
  const [authUser, setAuthUser] = useState<User | null>(auth.currentUser);
  const [profileData, setProfileData] = useState<{ avatarUrl?: string; displayName?: string; avatarVersion?: number }>({});
  const [courseInvitations, setCourseInvitations] = useState<CourseInvitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [acceptingInvitationId, setAcceptingInvitationId] = useState<string | null>(null);
  const [notificationSnackbar, setNotificationSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });
  const menuOpen = Boolean(anchorEl);
  const notificationsMenuOpen = Boolean(notificationsAnchorEl);
  const isDarkMode = mode === 'dark';
  const hasPendingInvites = courseInvitations.length > 0;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authUser) {
      setProfileData({});
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'users', authUser.uid), (snapshot) => {
      setProfileData((snapshot.data() as { avatarUrl?: string; displayName?: string; avatarVersion?: number }) ?? {});
    });

    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    if (!authUser?.email) {
      setCourseInvitations([]);
      return;
    }

    const normalizedEmail = authUser.email.toLowerCase();
    setInvitationsLoading(true);

    const invitationsQuery = query(
      collection(db, 'courseInvitations'),
      where('inviteeEmail', '==', normalizedEmail)
    );

    const unsubscribe = onSnapshot(
      invitationsQuery,
      (snapshot) => {
        const pendingInvitations: CourseInvitation[] = snapshot.docs
          .map((docSnapshot) => {
            const data = docSnapshot.data();
            return {
              id: docSnapshot.id,
              courseId: data.courseId,
              courseTitle: data.courseTitle ?? 'Kurs',
              ownerId: data.ownerId ?? '',
              ownerName: data.ownerName,
              ownerEmail: data.ownerEmail,
              status: data.status ?? 'pending',
              createdAt: data.createdAt?.toDate?.() ?? null,
            } as CourseInvitation;
          })
          .filter((invitation) => invitation.status === 'pending');
        setCourseInvitations(pendingInvitations);
        setInvitationsLoading(false);
      },
      (error) => {
        console.error('Einladungen konnten nicht geladen werden', error);
        setInvitationsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [authUser?.email]);

  const handleMenuOpen = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationsOpen = (event: MouseEvent<HTMLElement>) => {
    setNotificationsAnchorEl(event.currentTarget);
  };

  const handleNotificationsClose = () => {
    setNotificationsAnchorEl(null);
  };

  const handleProfileClick = () => {
    navigate('/profile');
    handleMenuClose();
  };

  const handleThemeToggle = () => {
    toggleColorMode();
    handleMenuClose();
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/auth');
    } catch (error) {
      console.error('Logout failed', error);
    } finally {
      handleMenuClose();
    }
  };

  const handleAcceptInvitation = async (invitation: CourseInvitation) => {
    if (!authUser) return;
    setAcceptingInvitationId(invitation.id);
    try {
      await updateDoc(doc(db, 'courseInvitations', invitation.id), {
        status: 'accepted',
        inviteeUid: authUser.uid,
        acceptedAt: serverTimestamp(),
      });

      let courseTitle = invitation.courseTitle;
      let courseDescription = invitation.courseDescription ?? '';
      let coverImageUrl = invitation.coverImageUrl ?? null;
      let coverColor = invitation.coverColor ?? null;
      let chapterCount = invitation.chapterCount ?? 0;
      let lessonCount = invitation.lessonCount ?? 0;

      if (invitation.ownerId) {
        try {
          const ownerCourseRef = doc(db, 'users', invitation.ownerId, 'courses', invitation.courseId);
          const courseSnapshot = await getDoc(ownerCourseRef);

          if (courseSnapshot.exists()) {
            const courseData = courseSnapshot.data();
            courseTitle = courseData.title ?? courseTitle;
            courseDescription = courseData.description ?? courseDescription;
            coverImageUrl = courseData.coverImageUrl ?? coverImageUrl;
            coverColor = courseData.coverColor ?? coverColor;

            const chaptersSnapshot = await getDocs(collection(ownerCourseRef, 'chapters'));
            const publishedChapters = chaptersSnapshot.docs.filter((chapterDoc) => chapterDoc.data().status === 'published');
            chapterCount = publishedChapters.length;

            let publishedLessons = 0;
            for (const chapterDoc of publishedChapters) {
              const lessonsSnapshot = await getDocs(collection(chapterDoc.ref, 'lessons'));
              publishedLessons += lessonsSnapshot.docs.filter((lessonDoc) => {
                const lessonData = lessonDoc.data();
                return lessonData.status === 'published' && lessonData.type !== 'subchapter';
              }).length;
            }
            lessonCount = publishedLessons;
          }
        } catch (innerError) {
          console.warn('Kursdetails konnten nicht vollständig synchronisiert werden', innerError);
        }
      }

      await setDoc(
        doc(db, 'users', authUser.uid, 'enrollments', invitation.courseId),
        {
          courseId: invitation.courseId,
          courseTitle,
          courseDescription,
          coverImageUrl,
          coverColor,
          chapters: chapterCount,
          lessons: lessonCount,
          ownerId: invitation.ownerId,
          ownerName: invitation.ownerName ?? null,
          ownerEmail: invitation.ownerEmail ?? null,
          joinedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setNotificationSnackbar({
        open: true,
        message: 'Einladung angenommen. Der Kurs ist jetzt verfügbar.',
        severity: 'success',
      });
    } catch (error) {
      console.error('Einladung konnte nicht angenommen werden', error);
      setNotificationSnackbar({
        open: true,
        message: 'Einladung konnte nicht angenommen werden.',
        severity: 'error',
      });
    } finally {
      setAcceptingInvitationId(null);
    }
  };

  const avatarSrc = profileData.avatarUrl
    ? buildAvatarSrc(profileData.avatarUrl, profileData.avatarVersion)
    : authUser?.photoURL;

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        backgroundImage: (theme) =>
          theme.palette.mode === 'light'
            ? 'linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%)'
            : 'linear-gradient(90deg, #1f2432 0%, #191f2c 100%)',
        backdropFilter: 'blur(10px)',
        color: (theme) => theme.palette.text.primary,
        borderBottom: '1px solid',
        borderColor: (theme) => theme.palette.divider,
      }}
    >
      <Toolbar sx={{ justifyContent: 'flex-end', minHeight: 64, px: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={handleNotificationsOpen} size="large" color="inherit">
            <Badge color="error" variant="dot" overlap="circular" invisible={!hasPendingInvites}>
              <NotificationsNoneIcon />
            </Badge>
          </IconButton>
          <Menu
            anchorEl={notificationsAnchorEl}
            open={notificationsMenuOpen}
            onClose={handleNotificationsClose}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            disableAutoFocusItem
            PaperProps={{ sx: { width: 360, maxWidth: '90vw' } }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography fontWeight={700}>Benachrichtigungen</Typography>
              <Typography variant="body2" color="text.secondary">
                {hasPendingInvites ? 'Du hast neue Kurseinladungen.' : 'Keine neuen Einladungen.'}
              </Typography>
            </Box>
            <Divider />
            <Box sx={{ maxHeight: 360, overflowY: 'auto', px: 2, py: 2 }}>
              {invitationsLoading ? (
                <Stack alignItems="center" justifyContent="center" sx={{ py: 4 }}>
                  <CircularProgress size={20} />
                </Stack>
              ) : courseInvitations.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Keine offenen Einladungen.
                </Typography>
              ) : (
                <Stack spacing={2}>
                  {courseInvitations.map((invitation) => (
                    <Box
                      key={invitation.id}
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        p: 1.5,
                        backgroundColor: (theme) =>
                          theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)',
                      }}
                    >
                      <Typography fontWeight={600}>{invitation.courseTitle}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {invitation.ownerName || invitation.ownerEmail || 'Kursanbieter'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        Du wurdest eingeladen, diesen Kurs anzusehen.
                      </Typography>
                      <Stack direction="row" spacing={1} justifyContent="flex-end" mt={1.5}>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => handleAcceptInvitation(invitation)}
                          disabled={acceptingInvitationId === invitation.id}
                        >
                          {acceptingInvitationId === invitation.id ? 'Wird akzeptiert…' : 'Einladung annehmen'}
                        </Button>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          </Menu>
          <IconButton onClick={handleMenuOpen} size="large" color="inherit">
            <Avatar
              alt={profileData.displayName || authUser?.displayName || 'Profil'}
              src={avatarSrc || undefined}
            >
              {(profileData.displayName?.[0] || authUser?.displayName?.[0] || authUser?.email?.[0] || 'C').toUpperCase()}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={menuOpen}
            onClose={handleMenuClose}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          >
            <MenuItem onClick={handleProfileClick}>
              <ListItemIcon>
                <PersonOutlineIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Profil" />
            </MenuItem>
            <MenuItem onClick={handleThemeToggle}>
              <ListItemIcon>
                {isDarkMode ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
              </ListItemIcon>
              <ListItemText primary={isDarkMode ? 'Light Mode' : 'Dark Mode'} />
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Ausloggen" />
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
      <Snackbar
        open={notificationSnackbar.open}
        autoHideDuration={4000}
        onClose={() => setNotificationSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          severity={notificationSnackbar.severity}
          variant="filled"
          onClose={() => setNotificationSnackbar((prev) => ({ ...prev, open: false }))}
          sx={{ width: '100%' }}
        >
          {notificationSnackbar.message}
        </Alert>
      </Snackbar>
    </AppBar>
  );
}
