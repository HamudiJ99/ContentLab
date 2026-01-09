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
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

export default function Settings() {
  const navigate = useNavigate();
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('showUnsavedWarning');
    if (saved !== null) {
      setShowUnsavedWarning(saved === 'true');
    }
  }, []);

  const handleToggleWarning = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.checked;
    setShowUnsavedWarning(newValue);
    localStorage.setItem('showUnsavedWarning', String(newValue));
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
    </Box>
  );
}
