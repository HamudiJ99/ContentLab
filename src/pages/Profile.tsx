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
  Slider,
} from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import SaveIcon from '@mui/icons-material/Save';
import LockResetIcon from '@mui/icons-material/LockReset';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import GavelIcon from '@mui/icons-material/Gavel';
import Cropper, { type Area } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
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
  logoUrl: string;
  logoVersion: number | null;
};

const emptyProfile: ProfileForm = {
  displayName: '',
  avatarUrl: '',
  avatarVersion: null,
  logoUrl: '',
  logoVersion: null,
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
  const [logoUploading, setLogoUploading] = useState(false);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordFeedback, setPasswordFeedback] = useState<{ success?: string; error?: string }>({});
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const logoPreviewUrlRef = useRef<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoCropDialogOpen, setLogoCropDialogOpen] = useState(false);
  const [logoCropImageSrc, setLogoCropImageSrc] = useState<string | null>(null);
  const [logoCrop, setLogoCrop] = useState({ x: 0, y: 0 });
  const [logoZoom, setLogoZoom] = useState(1);
  const [logoCroppedAreaPixels, setLogoCroppedAreaPixels] = useState<Area | null>(null);
  const [pendingLogoFileName, setPendingLogoFileName] = useState('logo.jpg');
  const [logoDragActive, setLogoDragActive] = useState(false);

  const revokePreviewUrl = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  };

  const revokeLogoPreviewUrl = () => {
    if (logoPreviewUrlRef.current) {
      URL.revokeObjectURL(logoPreviewUrlRef.current);
      logoPreviewUrlRef.current = null;
    }
  };

  const clearAvatarPreview = () => {
    revokePreviewUrl();
    setAvatarPreview(null);
  };

  const clearLogoPreview = () => {
    revokeLogoPreviewUrl();
    setLogoPreview(null);
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
    revokeLogoPreviewUrl();
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
          logoUrl: data.logoUrl ?? '',
          logoVersion: typeof data.logoVersion === 'number' ? data.logoVersion : null,
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
      setProfileFeedback({ error: 'Bitte einen Anzeigenamen angeben.' });
      return;
    }
    setSaveLoading(true);
    setProfileFeedback({});
    const shouldUploadAvatar = Boolean(pendingAvatarFile);
    const shouldUploadLogo = Boolean(pendingLogoFile);
    if (shouldUploadAvatar) {
      setAvatarUploading(true);
    }
    if (shouldUploadLogo) {
      setLogoUploading(true);
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

      let nextLogoUrl: string | null = profileForm.logoUrl || null;
      let nextLogoVersion: number | null = profileForm.logoVersion;
      if (pendingLogoFile && currentUser) {
        const logoStorageRef = ref(storage, `logos/${currentUser.uid}`);
        await uploadBytes(logoStorageRef, pendingLogoFile);
        nextLogoUrl = await getDownloadURL(logoStorageRef);
        nextLogoVersion = Date.now();
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
      if (nextLogoUrl) {
        profilePayload.logoUrl = nextLogoUrl;
      }
      if (typeof nextLogoVersion === 'number') {
        profilePayload.logoVersion = nextLogoVersion;
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
        logoUrl: nextLogoUrl ?? '',
        logoVersion: nextLogoVersion,
      }));
      if (pendingAvatarFile) {
        clearAvatarPreview();
        setPendingAvatarFile(null);
      }
      if (pendingLogoFile) {
        clearLogoPreview();
        setPendingLogoFile(null);
      }
      setProfileFeedback({ success: 'Profil aktualisiert.' });
    } catch (error) {
      setProfileFeedback({ error: 'Profil konnte nicht gespeichert werden.' });
    } finally {
      if (shouldUploadAvatar) {
        setAvatarUploading(false);
      }
      if (shouldUploadLogo) {
        setLogoUploading(false);
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

  const handleLogoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setPendingLogoFileName(file.name || 'logo.jpg');
    const reader = new FileReader();
    reader.onload = () => {
      setLogoCropImageSrc(reader.result as string);
      setLogoCrop({ x: 0, y: 0 });
      setLogoZoom(1);
      setLogoCroppedAreaPixels(null);
      setLogoCropDialogOpen(true);
    };
    reader.onerror = () => {
      setProfileFeedback({ error: 'Bild konnte nicht geladen werden.' });
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleLogoCloseCropDialog = () => {
    setLogoCropDialogOpen(false);
    setLogoCropImageSrc(null);
    setLogoCroppedAreaPixels(null);
    setLogoCrop({ x: 0, y: 0 });
    setLogoZoom(1);
  };

  const handleLogoConfirmCrop = async () => {
    if (!logoCroppedAreaPixels || !logoCropImageSrc) {
      return;
    }
    try {
      // Use PNG to preserve transparency
      const mimeType = 'image/png';
      const blob = await getCroppedBlob(logoCropImageSrc, logoCroppedAreaPixels, mimeType);
      const croppedFile = new File([blob], pendingLogoFileName, { type: mimeType });
      
      revokeLogoPreviewUrl();
      const previewUrl = URL.createObjectURL(croppedFile);
      logoPreviewUrlRef.current = previewUrl;
      setLogoPreview(previewUrl);
      setPendingLogoFile(croppedFile);
      setProfileFeedback({ success: 'Logo zugeschnitten. Bitte speichern, um es zu übernehmen.' });
      handleLogoCloseCropDialog();
    } catch (error) {
      setProfileFeedback({ error: 'Logo konnte nicht zugeschnitten werden.' });
    }
  };

  const handleLogoCropComplete = (_croppedArea: Area, croppedAreaPixels: Area) => {
    setLogoCroppedAreaPixels(croppedAreaPixels);
  };
  const handleLogoDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setLogoDragActive(true);
  };

  const handleLogoDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setLogoDragActive(false);
  };

  const handleLogoDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setLogoDragActive(false);

    if (logoUploading) return;

    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        setPendingLogoFileName(file.name);
        reader.onload = () => {
          setLogoCropImageSrc(reader.result as string);
          setLogoCrop({ x: 0, y: 0 });
          setLogoZoom(1);
          setLogoCropDialogOpen(true);
        };
        reader.readAsDataURL(file);
      }
    }
  };
  const handlePasswordChange = async () => {
    if (!currentUser || !currentUser.email) {
      return;
    }
    if (!passwordForm.current || !passwordForm.next) {
      setPasswordFeedback({ error: 'Bitte aktuelles und neues Passwort eingeben.' });
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
  const logoSrc = logoPreview ?? buildAvatarSrc(profileForm.logoUrl, profileForm.logoVersion);

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
                <Box sx={{ flex: 1 }}>
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
                  Anzeigename
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
                  <Box />
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
                <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                  <PhotoCameraIcon color="primary" />
                  <Box>
                    <Typography variant="h6" fontWeight={600}>
                      Firmenlogo
                    </Typography>
                    <Typography color="text.secondary">
                      Das Logo wird in der Seitenleiste neben dem ContentLab-Namen angezeigt.
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="flex-start">
                  <Box>
                    <Box sx={{ position: 'relative' }}>
                      <Box
                        onClick={() => !logoUploading && logoFileInputRef.current?.click()}
                        onDragOver={handleLogoDragOver}
                        onDragLeave={handleLogoDragLeave}
                        onDrop={handleLogoDrop}
                        sx={{
                          width: 200,
                          height: 200,
                          border: '2px dashed',
                          borderColor: logoDragActive ? 'primary.main' : (logoSrc ? 'primary.main' : 'divider'),
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: logoUploading ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s ease',
                          overflow: 'hidden',
                          bgcolor: (theme) => {
                            if (logoDragActive) return theme.palette.mode === 'dark' ? 'rgba(33,150,243,0.15)' : 'rgba(33,150,243,0.08)';
                            return theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)';
                          },
                          '&:hover': {
                            borderColor: 'primary.main',
                            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                          },
                        }}
                      >
                        {logoSrc ? (
                          <img
                            src={logoSrc}
                            alt="Logo"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                              padding: '16px',
                            }}
                          />
                        ) : (
                          <Stack alignItems="center" spacing={1}>
                            <PhotoCameraIcon sx={{ fontSize: 56, color: 'text.disabled' }} />
                            <Typography variant="caption" color="text.secondary" textAlign="center" px={2}>
                              Bild hineinziehen oder klicken
                            </Typography>
                          </Stack>
                        )}
                      </Box>
                      {logoUploading && (
                        <CircularProgress size={64} sx={{ position: 'absolute', top: 68, left: 68 }} />
                      )}
                    </Box>
                    <input
                      ref={logoFileInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={handleLogoUpload}
                    />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" fontWeight={600} mb={1}>
                      Empfohlenes Format
                    </Typography>
                    <Stack spacing={1} mb={2}>
                      <Typography variant="body2" color="text.secondary">
                        • Format: PNG mit transparentem Hintergrund
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        • Seitenverhältnis: Quadratisch (1:1)
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        • Mindestgröße: 512 × 512 Pixel
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        • Maximale Dateigröße: 2 MB
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      Tipp: Ein Logo mit transparentem Hintergrund passt sich automatisch an den Dark Mode an.
                    </Typography>
                  </Box>
                </Stack>
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

      {/* Logo Crop Dialog */}
      <Dialog
        open={logoCropDialogOpen}
        onClose={handleLogoCloseCropDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Logo zuschneiden</DialogTitle>
        <DialogContent>
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              height: 400,
              backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
            }}
          >
            <Cropper
              image={logoCropImageSrc ?? undefined}
              crop={logoCrop}
              zoom={logoZoom}
              aspect={1}
              onCropChange={setLogoCrop}
              onZoomChange={setLogoZoom}
              onCropComplete={handleLogoCropComplete}
            />
          </Box>
          <Box sx={{ mt: 2 }}>
            <Typography gutterBottom>Zoom</Typography>
            <Slider
              value={logoZoom}
              min={1}
              max={3}
              step={0.1}
              onChange={(_, value) => setLogoZoom(value as number)}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleLogoCloseCropDialog}>Abbrechen</Button>
          <Button onClick={handleLogoConfirmCrop} variant="contained">
            Zuschneiden
          </Button>
        </DialogActions>
      </Dialog>

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

// Helper functions for image cropping
function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });
}

async function getCroppedBlob(
  imageSrc: string,
  pixelCrop: Area,
  mimeType: string = 'image/png'
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas context not available');
  }

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // Clear canvas to transparent for PNG
  if (mimeType === 'image/png') {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas is empty'));
        }
      },
      mimeType,
      mimeType === 'image/png' ? 1.0 : 0.92
    );
  });
}
