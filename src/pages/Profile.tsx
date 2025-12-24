import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import SaveIcon from '@mui/icons-material/Save';
import LockResetIcon from '@mui/icons-material/LockReset';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import GavelIcon from '@mui/icons-material/Gavel';
import { FirebaseError } from 'firebase/app';
import {
  EmailAuthProvider,
  deleteUser,
  onAuthStateChanged,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '../firebase/firebaseConfig';

type ProfileForm = {
  displayName: string;
  avatarUrl: string;
  avatarVersion: number | null;
};

const emptyProfile: ProfileForm = {
  displayName: '',
  avatarUrl: '',
  avatarVersion: null,
};

const buildAvatarSrc = (url?: string | null, version?: number | null) => {
  if (!url) {
    return '';
  }
  if (!version) {
    return url;
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${version}`;
};

const errorMessages: Record<string, string> = {
  'auth/wrong-password': 'Das Passwort ist nicht korrekt.',
  'auth/weak-password': 'Das neue Passwort muss mindestens 6 Zeichen lang sein.',
  'auth/requires-recent-login': 'Bitte erneut anmelden und die Aktion wiederholen.',
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof FirebaseError) {
    return errorMessages[error.code] ?? 'Es ist ein Fehler aufgetreten.';
  }
  return 'Es ist ein Fehler aufgetreten.';
};

export default function Profile() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfile);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileFeedback, setProfileFeedback] = useState<{ success?: string; error?: string }>({});
  const [saveLoading, setSaveLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordFeedback, setPasswordFeedback] = useState<{ success?: string; error?: string }>({});
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const revokePreviewUrl = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  };

  const clearAvatarPreview = () => {
    revokePreviewUrl();
    setAvatarPreview(null);
  };

  const refreshAuthUser = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      setCurrentUser(auth.currentUser);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => () => {
    revokePreviewUrl();
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      if (!currentUser) {
        setProfileLoading(false);
        return;
      }
      setProfileLoading(true);
      try {
        const snapshot = await getDoc(doc(db, 'users', currentUser.uid));
        const data = snapshot.data() ?? {};
        setProfileForm({
          displayName: data.displayName ?? currentUser.displayName ?? currentUser.email?.split('@')[0] ?? '',
          avatarUrl: data.avatarUrl ?? currentUser.photoURL ?? '',
          avatarVersion: typeof data.avatarVersion === 'number' ? data.avatarVersion : null,
        });
      } catch (error) {
        setProfileFeedback({ error: 'Profil konnte nicht geladen werden.' });
      } finally {
        setProfileLoading(false);
      }
    };
    loadProfile();
  }, [currentUser]);

  const handleInputChange = (field: keyof ProfileForm) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setProfileForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSaveProfile = async () => {
    if (!currentUser) {
      return;
    }
    if (!profileForm.displayName.trim()) {
      setProfileFeedback({ error: 'Bitte einen Accountnamen angeben.' });
      return;
    }
    setSaveLoading(true);
    setProfileFeedback({});
    const shouldUploadAvatar = Boolean(pendingAvatarFile);
    if (shouldUploadAvatar) {
      setAvatarUploading(true);
    }
    try {
      let nextAvatarUrl: string | null = profileForm.avatarUrl || null;
      let nextAvatarVersion: number | null = profileForm.avatarVersion;
      if (pendingAvatarFile && currentUser) {
        const storageRef = ref(storage, `profilePictures/${currentUser.uid}`);
        await uploadBytes(storageRef, pendingAvatarFile);
        nextAvatarUrl = await getDownloadURL(storageRef);
        nextAvatarVersion = Date.now();
      }
      const profilePayload: Record<string, unknown> = {
        displayName: profileForm.displayName.trim(),
        updatedAt: serverTimestamp(),
      };
      if (nextAvatarUrl) {
        profilePayload.avatarUrl = nextAvatarUrl;
      }
      if (typeof nextAvatarVersion === 'number') {
        profilePayload.avatarVersion = nextAvatarVersion;
      }
      await setDoc(
        doc(db, 'users', currentUser.uid),
        profilePayload,
        { merge: true },
      );
      await updateProfile(currentUser, {
        displayName: profileForm.displayName.trim(),
        photoURL: nextAvatarUrl,
      });
      await refreshAuthUser();
      setProfileForm((prev) => ({
        ...prev,
        displayName: profileForm.displayName.trim(),
        avatarUrl: nextAvatarUrl ?? '',
        avatarVersion: nextAvatarVersion,
      }));
      if (pendingAvatarFile) {
        clearAvatarPreview();
        setPendingAvatarFile(null);
      }
      setProfileFeedback({ success: 'Profil aktualisiert.' });
    } catch (error) {
      setProfileFeedback({ error: 'Profil konnte nicht gespeichert werden.' });
    } finally {
      if (shouldUploadAvatar) {
        setAvatarUploading(false);
      }
      setSaveLoading(false);
    }
  };

  const handleAvatarUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    revokePreviewUrl();
    const previewUrl = URL.createObjectURL(file);
    previewUrlRef.current = previewUrl;
    setAvatarPreview(previewUrl);
    setPendingAvatarFile(file);
    setProfileFeedback({ success: 'Neues Profilbild ausgewählt. Bitte speichern, um es zu übernehmen.' });
    event.target.value = '';
  };

  const handlePasswordChange = async () => {
    if (!currentUser || !currentUser.email) {
      return;
    }
    if (!passwordForm.current || !passwordForm.next || !passwordForm.confirm) {
      setPasswordFeedback({ error: 'Bitte alle Passwortfelder ausfüllen.' });
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordFeedback({ error: 'Passwörter stimmen nicht überein.' });
      return;
    }
    setPasswordLoading(true);
    setPasswordFeedback({});
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, passwordForm.current);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, passwordForm.next);
      setPasswordFeedback({ success: 'Passwort aktualisiert.' });
      setPasswordForm({ current: '', next: '', confirm: '' });
    } catch (error) {
      setPasswordFeedback({ error: getErrorMessage(error) });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleAccountDeletion = async () => {
    if (!currentUser || !currentUser.email) {
      return;
    }
    if (!deletePassword) {
      setDeleteError('Bitte Passwort eingeben.');
      return;
    }
    setDeleteLoading(true);
    setDeleteError('');
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, deletePassword);
      await reauthenticateWithCredential(currentUser, credential);
      await deleteDoc(doc(db, 'users', currentUser.uid));
      await deleteUser(currentUser);
      setDeleteDialogOpen(false);
      navigate('/auth');
    } catch (error) {
      setDeleteError(getErrorMessage(error));
    } finally {
      setDeleteLoading(false);
      setDeletePassword('');
    }
  };

  if (!currentUser) {
    return (
      <Box sx={{ p: { xs: 2, md: 4 } }}>
        <Card sx={{ p: 4, borderRadius: 4 }}>
          <Typography variant="h6" fontWeight={600} mb={2}>
            Bitte anmelden
          </Typography>
          <Typography color="text.secondary" mb={3}>
            Um dein Profil zu bearbeiten, melde dich mit deinem ContentLab-Konto an.
          </Typography>
          <Button variant="contained" onClick={() => navigate('/auth')}>
            Zur Anmeldung
          </Button>
        </Card>
      </Box>
    );
  }

  const avatarSrc = avatarPreview ?? buildAvatarSrc(profileForm.avatarUrl, profileForm.avatarVersion);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 960, mx: 'auto' }}>
      <Typography variant="h4" fontWeight={700} mb={3}>
        Profil
      </Typography>
      <Card
        sx={{
          p: { xs: 3, md: 5 },
          borderRadius: 4,
          border: (theme) => `1px solid ${theme.palette.divider}`,
          backgroundColor: (theme) => theme.palette.background.paper,
        }}
      >
        {profileFeedback.error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {profileFeedback.error}
          </Alert>
        )}
        {profileFeedback.success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {profileFeedback.success}
          </Alert>
        )}
        <Stack spacing={4}>
          {profileLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={3}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
              >
                <Box sx={{ position: 'relative' }}>
                  <Avatar
                    src={avatarSrc || undefined}
                    alt={profileForm.displayName}
                    onClick={() => !avatarUploading && fileInputRef.current?.click()}
                    sx={{
                      width: 120,
                      height: 120,
                      fontSize: 36,
                      bgcolor: 'primary.main',
                      cursor: avatarUploading ? 'not-allowed' : 'pointer',
                      transition: 'transform 0.2s ease',
                      '&:hover': {
                        transform: avatarUploading ? 'none' : 'scale(1.02)',
                      },
                    }}
                  >
                    {profileForm.displayName ? profileForm.displayName[0]?.toUpperCase() : currentUser.email?.[0]}
                  </Avatar>
                  {avatarUploading && (
                    <CircularProgress size={48} sx={{ position: 'absolute', top: 36, left: 36 }} />
                  )}
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight={700}>
                    {profileForm.displayName || 'Neues Profil'}
                  </Typography>
                  <Typography color="text.secondary" mb={2}>
                    {currentUser.email}
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={handleAvatarUpload}
                    />
                    <Button
                      variant="outlined"
                      startIcon={<PhotoCameraIcon />}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={avatarUploading}
                    >
                      Profilbild ändern
                    </Button>
                  </Stack>
                </Box>
              </Stack>

              <Divider />

              <Box>
                <Typography variant="h6" fontWeight={600} mb={2}>
                  Accountname
                </Typography>
                <TextField
                  label="Name"
                  value={profileForm.displayName}
                  onChange={handleInputChange('displayName')}
                  fullWidth
                />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSaveProfile}
                    disabled={saveLoading || avatarUploading}
                  >
                    {saveLoading ? 'Speichern…' : 'Profil speichern'}
                  </Button>
                </Box>
              </Box>

              <Divider />

              <Box>
                <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                  <LockResetIcon color="primary" />
                  <Box>
                    <Typography variant="h6" fontWeight={600}>
                      Passwort ändern
                    </Typography>
                    <Typography color="text.secondary">
                      Aus Sicherheitsgründen ist die Eingabe des aktuellen Passworts notwendig.
                    </Typography>
                  </Box>
                </Stack>
                {passwordFeedback.error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {passwordFeedback.error}
                  </Alert>
                )}
                {passwordFeedback.success && (
                  <Alert severity="success" sx={{ mb: 2 }}>
                    {passwordFeedback.success}
                  </Alert>
                )}
                <Box
                  sx={{
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                    alignItems: 'center',
                  }}
                >
                  <TextField
                    label="Aktuelles Passwort"
                    type="password"
                    value={passwordForm.current}
                    onChange={(event) => setPasswordForm((prev) => ({ ...prev, current: event.target.value }))}
                    fullWidth
                  />
                  <TextField
                    label="Neues Passwort"
                    type="password"
                    value={passwordForm.next}
                    onChange={(event) => setPasswordForm((prev) => ({ ...prev, next: event.target.value }))}
                    fullWidth
                  />
                  <TextField
                    label="Neues Passwort bestätigen"
                    type="password"
                    value={passwordForm.confirm}
                    onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirm: event.target.value }))}
                    fullWidth
                  />
                  <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handlePasswordChange}
                      disabled={passwordLoading}
                    >
                      {passwordLoading ? 'Wird aktualisiert…' : 'Passwort speichern'}
                    </Button>
                  </Box>
                </Box>
              </Box>

              <Divider />

              <Box>
                <Stack direction="row" spacing={2} alignItems="center" mb={1.5}>
                  <GavelIcon color="action" />
                  <Box>
                    <Typography variant="h6" fontWeight={600}>
                      Rechtliches
                    </Typography>
                    <Typography color="text.secondary">
                      Zugriff auf unsere rechtlichen Hinweise.
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Button component="a" href="/datenschutz">
                    Datenschutz
                  </Button>
                  <Button component="a" href="/impressum">
                    Impressum
                  </Button>
                </Stack>
              </Box>

              <Divider />

              <Box>
                <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                  <DeleteOutlineIcon color="error" />
                  <Box>
                    <Typography variant="h6" fontWeight={600}>
                      Account löschen
                    </Typography>
                    <Typography color="text.secondary">
                      Diese Aktion kann nicht rückgängig gemacht werden. Dein Konto wird dauerhaft entfernt.
                    </Typography>
                  </Box>
                </Stack>
                <Button variant="outlined" color="error" onClick={() => setDeleteDialogOpen(true)}>
                  Account endgültig löschen
                </Button>
              </Box>
            </>
          )}
        </Stack>
      </Card>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Account löschen</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Bitte bestätige die Löschung, indem du dein aktuelles Passwort eingibst.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Passwort"
            type="password"
            fullWidth
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
          />
          {deleteError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {deleteError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Abbrechen</Button>
          <Button color="error" onClick={handleAccountDeletion} disabled={deleteLoading}>
            {deleteLoading ? 'Wird gelöscht…' : 'Löschen'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
