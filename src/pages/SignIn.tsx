import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Link,
  Tab,
  Tabs,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, updateProfile, signInWithPopup, GoogleAuthProvider, type User } from 'firebase/auth';
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
  'auth/popup-closed-by-user': 'Anmeldung abgebrochen.',
  'auth/popup-blocked': 'Popup wurde vom Browser blockiert. Bitte erlaube Popups für diese Seite.',
  'auth/account-exists-with-different-credential': 'Ein Konto mit dieser E-Mail existiert bereits mit einer anderen Anmeldemethode.',
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
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();
  const theme = useTheme();
  const [searchParams] = useSearchParams();

  // E-Mail Vorbefüllung aus URL Parameter oder localStorage
  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
      setMode('register'); // Automatisch auf Registrierung wechseln
    } else {
      // Lade gespeicherte Login-Daten
      const savedEmail = localStorage.getItem('rememberedEmail');
      const savedPassword = localStorage.getItem('rememberedPassword');
      if (savedEmail && savedPassword) {
        setEmail(savedEmail);
        setPassword(savedPassword);
        setRememberMe(true);
      }
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
        
        // Speichere oder lösche Login-Daten basierend auf "Merken" Checkbox
        if (rememberMe) {
          localStorage.setItem('rememberedEmail', email.trim());
          localStorage.setItem('rememberedPassword', password);
        } else {
          localStorage.removeItem('rememberedEmail');
          localStorage.removeItem('rememberedPassword');
        }
        
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

  const handleGoogleSignIn = async () => {
    setError('');
    setInfo('');
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      
      // Timeout hinzufügen, um schneller auf geschlossenes Popup zu reagieren
      const signInPromise = signInWithPopup(auth, provider);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('popup-timeout')), 30000); // 30 Sekunden Timeout
      });

      const result = await Promise.race([signInPromise, timeoutPromise]) as any;
      const user = result.user;

      // Prüfe ob es pending invitations für diese E-Mail gibt
      if (user.email) {
        const normalizedEmail = user.email.toLowerCase();
        await processPendingInvitations(normalizedEmail, user);
      }

      setInfo('Erfolgreich mit Google angemeldet!');
      navigate('/');
    } catch (firebaseError: any) {
      if (firebaseError?.message === 'popup-timeout') {
        setError('Die Anmeldung hat zu lange gedauert.');
        setLoading(false);
        return;
      }
      
      if (firebaseError instanceof FirebaseError) {
        if (firebaseError.code === 'auth/popup-closed-by-user') {
          setError('Anmeldung abgebrochen.');
        } else if (firebaseError.code === 'auth/cancelled-popup-request') {
          // Popup wurde bereits gecancelt, keine Fehlermeldung nötig
          setLoading(false);
          return;
        } else {
          setError(translateError(firebaseError));
        }
      } else {
        setError('Ein unbekannter Fehler ist aufgetreten.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        backgroundImage: 'url(/signin-hero.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Hauptbereich */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          p: 2,
        }}
      >
        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            maxWidth: 460,
            backgroundColor: theme.palette.background.paper,
            borderRadius: 4,
            p: { xs: 3, sm: 4 },
            boxShadow: theme.palette.mode === 'dark'
              ? '0 25px 60px rgba(2, 6, 23, 0.65)'
              : '0 25px 60px rgba(15, 23, 42, 0.2)',
            border: theme.palette.mode === 'dark'
              ? '1px solid rgba(148, 163, 184, 0.2)'
              : '1px solid rgba(15, 23, 42, 0.08)',
          }}
        >
          <Box mb={4} textAlign="center">
            <Typography variant="h4" fontWeight={700} gutterBottom>
              ContentLab
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Einloggen, um loszulegen
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
                required
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
              required
            />
            
            <TextField
              label="Passwort"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              fullWidth
              margin="normal"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="Passwort-Sichtbarkeit umschalten"
                      onClick={() => setShowPassword(!showPassword)}
                      onMouseDown={(e) => e.preventDefault()}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            
            {mode === 'register' && (
              <TextField
                label="Passwort bestätigen"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                fullWidth
                margin="normal"
                autoComplete="new-password"
                required
                error={confirmPassword.length > 0 && password !== confirmPassword}
                helperText={
                  confirmPassword.length > 0 && password !== confirmPassword
                    ? 'Passwörter stimmen nicht überein'
                    : ''
                }
              />
            )}

            {mode === 'login' && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    color="primary"
                  />
                }
                label="Merken"
                sx={{ mt: 1 }}
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
              {loading ? 'Wird gesendet…' : mode === 'login' ? 'Einloggen' : 'Konto erstellen'}
            </Button>

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
          </Box>

          <Divider sx={{ my: 3 }}>
            <Typography variant="body2" color="text.secondary">
              oder
            </Typography>
          </Divider>

          {/* Google Sign-In Button */}
          <Button
            variant="outlined"
            fullWidth
            size="large"
            onClick={handleGoogleSignIn}
            disabled={loading}
            sx={{
              py: 1.25,
              textTransform: 'none',
              fontWeight: 600,
              borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.23)' : 'rgba(0,0,0,0.23)',
              color: theme.palette.text.primary,
              '&:hover': {
                borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
              },
            }}
            startIcon={
              <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <g fill="none" fillRule="evenodd">
                  <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </g>
              </svg>
            }
          >
            Mit Google anmelden
          </Button>
        </Box>
      </Box>
      
      {/* Footer über die gesamte Breite */}
      <Footer />
    </Box>
  );
}
