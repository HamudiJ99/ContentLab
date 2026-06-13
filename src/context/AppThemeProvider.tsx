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
  const [brandColor, setBrandColor] = useState('#1D8BF1');

  // Lade Brand Color aus localStorage
  useEffect(() => {
    const savedColor = localStorage.getItem('brandColor');
    if (savedColor) {
      setBrandColor(savedColor);
    }
  }, []);

  // Speichere Mode nur in localStorage wenn User eingeloggt ist
  // Beim Logout wird localStorage geleert
  useEffect(() => {
    if (user && hasLoadedRemoteMode) {
      window.localStorage.setItem(STORAGE_KEY, mode);
    }
  }, [mode, user, hasLoadedRemoteMode]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (!firebaseUser) {
        // Bei Logout: State und localStorage zurücksetzen damit Login-Seite immer Standard-Design hat
        // Farbe und Mode bleiben aber in Firestore und werden beim nächsten Login wieder geladen
        setHasLoadedRemoteMode(false);
        setBrandColor('#1D8BF1');
        localStorage.removeItem('brandColor');
        localStorage.removeItem(STORAGE_KEY);
        setMode('light'); // Login-Seite immer im Light Mode
        return;
      }

      try {
        const prefRef = doc(db, 'users', firebaseUser.uid);
        const snapshot = await getDoc(prefRef);
        if (snapshot.exists()) {
          const data = snapshot.data();
          const storedMode = data.colorMode;
          const storedColor = data.brandColor;
          
          // Lade gespeicherten Modus
          if (storedMode === 'light' || storedMode === 'dark') {
            setMode(storedMode);
          }
          
          // Lade gespeicherte Brand Color
          if (storedColor && typeof storedColor === 'string') {
            setBrandColor(storedColor);
            localStorage.setItem('brandColor', storedColor);
          }
          
          setHasLoadedRemoteMode(true);
          return;
        }

        // Kein Firestore-Eintrag vorhanden - erstelle einen mit Defaults
        const fallbackMode = getInitialMode();
        setMode(fallbackMode);
        await setDoc(prefRef, { 
          colorMode: fallbackMode,
          brandColor: '#1D8BF1'
        }, { merge: true });
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
    
    // Berechne dunklere und hellere Varianten der Brand Color
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      } : { r: 29, g: 139, b: 241 };
    };

    const rgbToHex = (r: number, g: number, b: number) => {
      return '#' + [r, g, b].map(x => {
        const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('');
    };

    const rgb = hexToRgb(brandColor);
    const primaryColor = brandColor;
    const primaryColorDark = rgbToHex(rgb.r * 0.8, rgb.g * 0.8, rgb.b * 0.8);
    const primaryColorLight = rgbToHex(
      Math.min(255, rgb.r + (255 - rgb.r) * 0.3),
      Math.min(255, rgb.g + (255 - rgb.g) * 0.3),
      Math.min(255, rgb.b + (255 - rgb.b) * 0.3)
    );
    const outlinedHoverColor = mode === 'light' 
      ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)` 
      : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`;

    // Berechne relative Leuchtdichte (WCAG) um Textfarbe zu bestimmen
    const getRelativeLuminance = (r: number, g: number, b: number) => {
      const [rs, gs, bs] = [r, g, b].map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };
    const luminance = getRelativeLuminance(rgb.r, rgb.g, rgb.b);
    // Schwelle bei 0.179: darunter weißer Text, darüber dunkler Text
    const contrastText = luminance > 0.179 ? '#111111' : '#ffffff';
    // Für Outlined-Buttons: bei sehr hellen Farben dunklere Variante nutzen damit der Rand sichtbar bleibt
    const outlinedColor = luminance > 0.5 ? primaryColorDark : primaryColor;

    return createTheme({
      palette: {
        mode,
        primary: {
          main: primaryColor,
          dark: primaryColorDark,
          light: primaryColorLight,
          contrastText,
        },
        background: mode === 'light' ? lightBackground : darkBackground,
        divider: mode === 'light' ? 'rgba(15, 23, 42, 0.08)' : 'rgba(148, 163, 184, 0.2)',
      },
      typography: {
        fontFamily: 'Inter, Roboto, Arial, sans-serif',
        button: {
          fontWeight: 600,
          textTransform: 'none',
        },
      },
      components: {
        MuiButton: {
          styleOverrides: {
            root: {
              fontWeight: 600,
            },
            containedPrimary: {
              backgroundColor: primaryColor,
              color: contrastText,
              '&:hover': {
                backgroundColor: primaryColorDark,
              },
            },
            outlinedPrimary: {
              borderColor: outlinedColor,
              color: outlinedColor,
              backgroundColor: mode === 'light' ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.04)` : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`,
              '&:hover': {
                borderColor: outlinedColor,
                backgroundColor: outlinedHoverColor,
              },
            },
            textPrimary: {
              color: outlinedColor,
            },
          },
        },
      },
    });
  }, [mode, brandColor]);

  return (
    <ColorModeContext.Provider value={{ mode, toggleColorMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
