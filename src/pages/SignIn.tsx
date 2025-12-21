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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setInfo('');

    if (!email.trim() || !password.trim()) {
      setError('Bitte E-Mail und Passwort eingeben.');
      return;
    }

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
        background: 'linear-gradient(135deg, #e3f2fd 0%, #fce4ec 100%)',
        p: 2,
      }}
    >
      <Paper elevation={3} sx={{ maxWidth: 420, width: '100%', p: 4 }}>
        <Typography variant="h4" fontWeight={700} mb={1}>
          ContentLab
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={3}>
          Melde dich an, um deine Kurse und Inhalte zu verwalten.
        </Typography>

        <Tabs
          value={mode}
          onChange={(_, value) => setMode(value)}
          variant="fullWidth"
          sx={{ mb: 3 }}
        >
          <Tab label="Login" value="login" />
          <Tab label="Registrieren" value="register" />
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
            sx={{ mt: 3 }}
            disabled={loading}
          >
            {mode === 'login' ? 'Login' : 'Konto erstellen'}
          </Button>
        </Box>

        {mode === 'login' && (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Link component="button" type="button" variant="body2" onClick={handlePasswordReset}>
              Passwort vergessen?
            </Link>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
