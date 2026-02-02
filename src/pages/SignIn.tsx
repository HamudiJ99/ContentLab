import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Link,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, updateProfile, type User } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth, db } from '../firebase/firebaseConfig';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import Footer from '../components/Footer';

type AuthMode = 'login' | 'register';

const errorMessages: Record<string, string> = {
  'auth/invalid-credential': 'E-Mail oder Passwort ist falsch.',
  'auth/user-not-found': 'Kein Konto mit dieser E-Mail gefunden.',
  'auth/wrong-password': 'Falsches Passwort.',
  'auth/email-already-in-use': 'Diese E-Mail wird bereits verwendet.',
  'auth/weak-password': 'Passwort muss mindestens 6 Zeichen lang sein.',
  'auth/invalid-email': 'Ungültige E-Mail-Adresse.',
};

function translateError(error: unknown): string {
  if (error instanceof FirebaseError) {
    return errorMessages[error.code] ?? 'Ein unbekannter Fehler ist aufgetreten.';
  }
  return 'Ein unbekannter Fehler ist aufgetreten.';
}

export default function SignIn() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const navigate = useNavigate();
  const theme = useTheme();
  const [searchParams] = useSearchParams();

  // E-Mail Vorbefüllung aus URL Parameter
  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
      setMode('register'); // Automatisch auf Registrierung wechseln
    }
  }, [searchParams]);
  
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setInfo('');

    // Validierung für Registrierung
    if (mode === 'register') {
      if (!displayName.trim()) {
        setError('Bitte gib einen Anzeigenamen ein.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Die Passwörter stimmen nicht überein.');
        return;
      }
      if (password.length < 6) {
        setError('Passwort muss mindestens 6 Zeichen lang sein.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        navigate('/');
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        
        // Setze den Anzeigenamen
        await updateProfile(userCredential.user, {
          displayName: displayName.trim(),
        });
        
        // Prüfe ob es pending invitations für diese E-Mail gibt
        const normalizedEmail = email.trim().toLowerCase();
        await processPendingInvitations(normalizedEmail, userCredential.user);
        
        setInfo('Konto erstellt! Du bist jetzt angemeldet.');
        navigate('/');
      }
    } catch (firebaseError) {
      setError(translateError(firebaseError));
    } finally {
      setLoading(false);
    }
  };

  // Verarbeite pending invitations nach Registrierung
  const processPendingInvitations = async (email: string, user: User) => {
    try {
      console.log('🔍 Prüfe pending invitations für:', email);
      const pendingInvitationRef = doc(db, 'pendingInvitations', email);
      const pendingSnapshot = await getDoc(pendingInvitationRef);
      
      if (!pendingSnapshot.exists()) {
        console.log('ℹ️ Keine pending invitations gefunden');
        return; // Keine pending invitations
      }
      
      const pendingData = pendingSnapshot.data();
      const courses = pendingData.courses || [];
      
      if (courses.length === 0) {
        console.log('ℹ️ Pending invitation existiert, aber keine Kurse darin');
        return;
      }
      
      console.log(`✅ ${courses.length} Kurs-Einladung(en) gefunden für ${email}`, courses);
      
      // Für jeden Kursbesitzer erstelle Member-Eintrag
      const ownerMap = new Map<string, any[]>();
      
      courses.forEach((course: any) => {
        const ownerId = course.ownerId;
        if (!ownerMap.has(ownerId)) {
          ownerMap.set(ownerId, []);
        }
        ownerMap.get(ownerId)?.push(course);
      });
      
      // Erstelle für jeden Owner ein Member-Dokument
      for (const [ownerId, ownerCourses] of ownerMap.entries()) {
        console.log(`📝 Erstelle Member und Enrollments für Owner: ${ownerId}`, ownerCourses);
        
        const memberRef = collection(db, 'users', ownerId, 'members');
        const courseIds = ownerCourses.map(c => c.courseId);
        
        await addDoc(memberRef, {
          name: displayName.trim(),
          email: email,
          photoURL: user.photoURL || null,
          role: 'student',
          status: 'active',
          assignedCourseIds: courseIds,
          groupIds: [],
          courseInvitations: courseIds.map(cId => ({
            courseId: cId,
            status: 'invited',
            invitedAt: new Date(),
          })),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        
        console.log(`✅ Member-Dokument erstellt für ${email}`);
        
        // Erstelle courseInvitations Dokumente + Enrollments für jeden Kurs
        for (const course of ownerCourses) {
          console.log(`📚 Erstelle Enrollment für Kurs: ${course.courseTitle} (${course.courseId})`);
          
          const invitationId = `${email}_${course.courseId}_${ownerId}`;
          const invitationRef = doc(db, 'courseInvitations', invitationId);
          
          await setDoc(invitationRef, {
            inviteeEmail: email,
            ownerId: ownerId,
            ownerEmail: course.ownerEmail,
            ownerName: course.ownerName,
            courseId: course.courseId,
            courseTitle: course.courseTitle,
            courseDescription: course.courseDescription,
            coverImageUrl: course.coverImageUrl,
            coverColor: course.coverColor,
            status: 'pending',
            createdAt: serverTimestamp(),
          });
          
          console.log(`✅ CourseInvitation erstellt: ${invitationId}`);
          
          // Erstelle enrollment damit Kurs im Dashboard erscheint
          const enrollmentRef = doc(db, 'users', user.uid, 'enrollments', course.courseId);
          await setDoc(enrollmentRef, {
            courseId: course.courseId,
            ownerId: ownerId,
            courseTitle: course.courseTitle,
            courseDescription: course.courseDescription,
            coverImageUrl: course.coverImageUrl,
            coverColor: course.coverColor,
            ownerEmail: course.ownerEmail,
            ownerName: course.ownerName,
            startedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          });
          
          console.log(`✅ Enrollment erstellt in users/${user.uid}/enrollments/${course.courseId}`);
        }
        
        console.log(`✅ Member-Eintrag erstellt für Owner ${ownerId} mit ${courseIds.length} Kurs(en)`);
      }
      
      // Lösche pending invitation
      await deleteDoc(pendingInvitationRef);
      console.log('✅ Pending invitations verarbeitet und gelöscht');
      
    } catch (error) {
      console.error('Fehler beim Verarbeiten von pending invitations:', error);
      // Fehler nicht werfen - Registrierung soll trotzdem erfolgreich sein
    }
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setError('Bitte E-Mail eingeben, um das Passwort zurückzusetzen.');
      return;
    }

    setError('');
    setInfo('');
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo('Passwort-Reset-E-Mail wurde versendet.');
    } catch (firebaseError) {
      setError(translateError(firebaseError));
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: theme.palette.background.default }}>
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          p: 2,
          transition: 'background-color 0.3s ease',
        }}
      >
        <Paper
        elevation={theme.palette.mode === 'light' ? 4 : 0}
        sx={{
          maxWidth: 440,
          width: '100%',
          p: { xs: 3, sm: 4 },
          borderRadius: 4,
          border:
            theme.palette.mode === 'dark'
              ? '1px solid rgba(148, 163, 184, 0.2)'
              : '1px solid rgba(15, 23, 42, 0.08)',
          backgroundColor: theme.palette.background.paper,
          boxShadow:
            theme.palette.mode === 'dark'
              ? '0 25px 60px rgba(2, 6, 23, 0.65)'
              : '0 25px 60px rgba(15, 23, 42, 0.15)',
        }}
      >
        <Box mb={3} textAlign="center">
          <Typography variant="h4" fontWeight={700} gutterBottom>
            ContentLab
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Melde dich an, um deine Workflows, Kurse und Bibliotheken zu verwalten.
          </Typography>
        </Box>

        <Tabs
          value={mode}
          onChange={(_, value) => setMode(value)}
          variant="fullWidth"
          sx={{
            mb: 3,
            borderRadius: 2,
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: 3,
              backgroundColor: theme.palette.primary.main,
            },
          }}
        >
          <Tab label="Login" value="login" sx={{ fontWeight: 600 }} />
          <Tab label="Registrieren" value="register" sx={{ fontWeight: 600 }} />
        </Tabs>

        <Box component="form" onSubmit={handleSubmit} noValidate>
          {mode === 'register' && (
            <TextField
              label="Anzeigename"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              fullWidth
              margin="normal"
              autoComplete="name"
              placeholder="Dein Name im Profil"
            />
          )}
          
          <TextField
            label="E-Mail"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            fullWidth
            margin="normal"
            autoComplete="email"
          />
          
          <TextField
            label="Passwort"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            fullWidth
            margin="normal"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          
          {mode === 'register' && (
            <TextField
              label="Passwort bestätigen"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              fullWidth
              margin="normal"
              autoComplete="new-password"
              error={confirmPassword.length > 0 && password !== confirmPassword}
              helperText={
                confirmPassword.length > 0 && password !== confirmPassword
                  ? 'Passwörter stimmen nicht überein'
                  : ''
              }
            />
          )}

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          {info && (
            <Alert severity="success" sx={{ mt: 2 }}>
              {info}
            </Alert>
          )}

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            sx={{ mt: 3, py: 1.25 }}
            disabled={loading}
          >
            {loading ? 'Wird gesendet…' : mode === 'login' ? 'Login' : 'Konto erstellen'}
          </Button>
        </Box>

        {mode === 'login' && (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Link
              component="button"
              type="button"
              variant="body2"
              onClick={handlePasswordReset}
              sx={{ color: theme.palette.primary.main, fontWeight: 600 }}
            >
              Passwort vergessen?
            </Link>
          </Box>
        )}
      </Paper>
      </Box>
      <Footer />
    </Box>
  );
}
