import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Switch,
  FormControlLabel,
  Divider,
  Button,
  Breadcrumbs,
  Link,
  TextField,
  Chip,

} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { auth, db } from '../firebase/firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';

const PRESET_COLORS = [
  { name: 'Blau (Standard)', value: '#1D8BF1' },
  { name: 'Lila', value: '#8B5CF6' },
  { name: 'Grün', value: '#10B981' },
  { name: 'Orange', value: '#F59E0B' },
  { name: 'Rot', value: '#EF4444' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Türkis', value: '#14B8A6' },
  { name: 'Indigo', value: '#6366F1' },
];

// Default news settings

const DEFAULT_NEWS_SETTINGS = {
  course_completed: true,
  course_created: true,
  invitation_received: true,
  member_added: false,
};

export type NewsSettings = {
  course_completed: boolean;
  course_created: boolean;
  invitation_received: boolean;
  member_added: boolean;
};

export default function Settings() {
  const navigate = useNavigate();
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(true);
  const [brandColor, setBrandColor] = useState('#1D8BF1');
  const [customColor, setCustomColor] = useState('#1D8BF1');
  const [newsSettings, setNewsSettings] = useState<NewsSettings>(DEFAULT_NEWS_SETTINGS);

  useEffect(() => {
    const saved = localStorage.getItem('showUnsavedWarning');
    if (saved !== null) {
      setShowUnsavedWarning(saved === 'true');
    }
    const savedColor = localStorage.getItem('brandColor');
    if (savedColor) {
      setBrandColor(savedColor);
      setCustomColor(savedColor);
    }
    const savedNewsSettings = localStorage.getItem('newsSettings');
    if (savedNewsSettings) {
      setNewsSettings({ ...DEFAULT_NEWS_SETTINGS, ...JSON.parse(savedNewsSettings) });
    }
  }, []);

  const handleToggleWarning = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.checked;
    setShowUnsavedWarning(newValue);
    localStorage.setItem('showUnsavedWarning', String(newValue));
  };

  const handleColorChange = async (color: string) => {
    setBrandColor(color);
    setCustomColor(color);
    localStorage.setItem('brandColor', color);
    
    // Speichere auch in Firestore wenn User eingeloggt ist
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const prefRef = doc(db, 'users', currentUser.uid);
        await setDoc(prefRef, { brandColor: color }, { merge: true });
      } catch (error) {
        console.error('Konnte Brand Color nicht in Firestore speichern:', error);
      }
    }
    
    // Seite neu laden um Theme zu aktualisieren
    window.location.reload();
  };

  const handleNewsSettingChange = (key: keyof NewsSettings) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const newSettings = { ...newsSettings, [key]: event.target.checked };
    setNewsSettings(newSettings);
    localStorage.setItem('newsSettings', JSON.stringify(newSettings));
  };

  const handleClearDismissedNews = () => {
    localStorage.removeItem('dismissedActivities');
    alert('Alle entfernten Neuigkeiten werden wieder angezeigt.');
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1160, mx: 'auto', width: '100%' }}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          component="button"
          onClick={() => navigate('/')}
          underline="hover"
          color="inherit"
          sx={{ cursor: 'pointer' }}
        >
          Dashboard
        </Link>
        <Typography color="text.primary">Einstellungen</Typography>
      </Breadcrumbs>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Einstellungen
          </Typography>
          <Typography color="text.secondary">
            Passe deine Arbeitsumgebung an
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/')}
          sx={{ alignSelf: 'flex-start' }}
        >
          Zurück
        </Button>
      </Stack>

      <Stack spacing={3}>
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Design-Anpassung
            </Typography>
            <Divider sx={{ my: 2 }} />
            
            <Stack spacing={3}>
              <Box>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Primäre Markenfarbe
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
                  Wähle eine Farbe, die alle Buttons, Links und Akzente ersetzt.
                </Typography>
                
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 3 }}>
                  {PRESET_COLORS.map((preset) => (
                    <Chip
                      key={preset.value}
                      label={preset.name}
                      onClick={() => handleColorChange(preset.value)}
                      icon={
                        brandColor === preset.value ? (
                          <CheckIcon sx={{ color: 'white !important' }} />
                        ) : undefined
                      }
                      sx={{
                        bgcolor: preset.value,
                        color: 'white',
                        fontWeight: 600,
                        border: brandColor === preset.value ? '3px solid' : '2px solid transparent',
                        borderColor: brandColor === preset.value ? 'white' : 'transparent',
                        boxShadow: brandColor === preset.value ? '0 0 0 2px ' + preset.value : 'none',
                        '&:hover': {
                          bgcolor: preset.value,
                          opacity: 0.9,
                        },
                      }}
                    />
                  ))}
                </Box>

                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <TextField
                    type="color"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    label="Benutzerdefinierte Farbe"
                    size="small"
                    sx={{ width: 120 }}
                  />
                  <Button
                    variant="outlined"
                    onClick={() => handleColorChange(customColor)}
                    disabled={customColor === brandColor}
                  >
                    Farbe anwenden
                  </Button>
                </Box>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Editor-Einstellungen
            </Typography>
            <Divider sx={{ my: 2 }} />
            
            <Stack spacing={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={showUnsavedWarning}
                  onChange={handleToggleWarning}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body1" fontWeight={500}>
                    Warnung bei ungespeicherten Änderungen
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Zeige eine Warnung an, wenn du eine Seite mit ungespeicherten Änderungen verlässt
                  </Typography>
                </Box>
              }
              sx={{ alignItems: 'flex-start', ml: 0 }}
            />
          </Stack>
              </CardContent>
            </Card>

        {/* Neuigkeiten-Einstellungen */}
        <Card>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} mb={1}>
              <NotificationsNoneIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h6" fontWeight={600}>
                Neuigkeiten
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Wähle aus, welche Aktivitäten in deinem Neuigkeiten-Feed angezeigt werden sollen.
            </Typography>
            <Divider sx={{ my: 2 }} />
            
            <Stack spacing={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={newsSettings.course_completed}
                    onChange={handleNewsSettingChange('course_completed')}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1" fontWeight={500}>
                      Abgeschlossene Kurse
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Benachrichtigung wenn du einen Kurs vollständig abschließt
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: 'flex-start', ml: 0 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={newsSettings.course_created}
                    onChange={handleNewsSettingChange('course_created')}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1" fontWeight={500}>
                      Neue Kurse erstellt
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Benachrichtigung wenn du einen neuen Kurs erstellst
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: 'flex-start', ml: 0 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={newsSettings.invitation_received}
                    onChange={handleNewsSettingChange('invitation_received')}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1" fontWeight={500}>
                      Kurs-Einladungen
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Benachrichtigung wenn du zu einem Kurs eingeladen wirst
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: 'flex-start', ml: 0 }}
              />

              <Divider />



              <FormControlLabel
                control={
                  <Switch
                    checked={newsSettings.member_added}
                    onChange={handleNewsSettingChange('member_added')}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1" fontWeight={500}>
                      Neue Mitglieder
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Benachrichtigung wenn jemand deine Kurs-Einladung annimmt
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: 'flex-start', ml: 0 }}
              />

              <Divider />

              <Box>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleClearDismissedNews}
                  sx={{ mt: 1 }}
                >
                  Entfernte Neuigkeiten zurücksetzen
                </Button>
                <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                  Zeigt alle manuell entfernten Neuigkeiten wieder an
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
            </Stack>
          </Box>
        );
      }
