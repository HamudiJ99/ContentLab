import { useMemo, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { ThemeProvider, CssBaseline, createTheme } from '@mui/material';
import { ColorModeContext } from './ColorModeContext';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';

type Props = {
  children: ReactNode;
};

const STORAGE_KEY = 'contentlab-color-mode';

export default function AppThemeProvider({ children }: Props) {
  const getInitialMode = (): 'light' | 'dark' => {
    if (typeof window === 'undefined') {
      return 'light';
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const [mode, setMode] = useState<'light' | 'dark'>(getInitialMode);
  const [user, setUser] = useState<User | null>(null);
  const [hasLoadedRemoteMode, setHasLoadedRemoteMode] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (!firebaseUser) {
        setHasLoadedRemoteMode(false);
        setMode(getInitialMode());
        return;
      }

      try {
        const prefRef = doc(db, 'users', firebaseUser.uid);
        const snapshot = await getDoc(prefRef);
        if (snapshot.exists()) {
          const storedMode = snapshot.data().colorMode;
          if (storedMode === 'light' || storedMode === 'dark') {
            setMode(storedMode);
            setHasLoadedRemoteMode(true);
            return;
          }
        }

        const fallbackMode = getInitialMode();
        setMode(fallbackMode);
        await setDoc(prefRef, { colorMode: fallbackMode }, { merge: true });
      } catch (error) {
        console.error('Konnte Theme-Präferenz nicht laden', error);
      } finally {
        setHasLoadedRemoteMode(true);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !hasLoadedRemoteMode) {
      return;
    }

    const prefRef = doc(db, 'users', user.uid);
    setDoc(prefRef, { colorMode: mode }, { merge: true }).catch((error) => {
      console.error('Konnte Theme-Präferenz nicht speichern', error);
    });
  }, [mode, user, hasLoadedRemoteMode]);

  const toggleColorMode = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const theme = useMemo(() => {
    const lightBackground = {
      default: '#f4f6fb',
      paper: '#ffffff',
    };
    const darkBackground = {
      default: '#0b0f19',
      paper: '#161c2a',
    };

    return createTheme({
      palette: {
        mode,
        background: mode === 'light' ? lightBackground : darkBackground,
        divider: mode === 'light' ? 'rgba(15, 23, 42, 0.08)' : 'rgba(148, 163, 184, 0.2)',
      },
      typography: {
        fontFamily: 'Inter, Roboto, Arial, sans-serif',
      },
    });
  }, [mode]);

  return (
    <ColorModeContext.Provider value={{ mode, toggleColorMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
