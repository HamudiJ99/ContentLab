import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth } from '../firebase/firebaseConfig';

type AuthMode = 'login' | 'register';

const errorMessages: Record<string, string> = {
  'auth/invalid-credential': 'E-Mail oder Passwort ist falsch.',
  'auth/user-not-found': 'Kein Konto mit dieser E-Mail gefunden.',
  'auth/wrong-password': 'Falsches Passwort.',
  'auth/email-already-in-use': 'Diese E-Mail wird bereits verwendet.',
  'auth/weak-password': 'Passwort muss mindestens 6 Zeichen lang sein.',
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const navigate = useNavigate();
  const theme = useTheme();
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setInfo('');

    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        navigate('/');
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
        setInfo('Konto erstellt! Du bist jetzt angemeldet.');
        navigate('/');
      }
    } catch (firebaseError) {
      setError(translateError(firebaseError));
    } finally {
      setLoading(false);
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
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.palette.background.default,
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
        <Box mb={3}>
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
  );
}
