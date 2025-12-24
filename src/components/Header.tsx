import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Box,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import LogoutIcon from '@mui/icons-material/Logout';
import { signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';
import { useColorMode } from '../context/ColorModeContext';

const buildAvatarSrc = (url?: string, version?: number) => {
  if (!url) {
    return undefined;
  }
  if (!version) {
    return url;
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${version}`;
};

export default function Header() {
  const navigate = useNavigate();
  const { mode, toggleColorMode } = useColorMode();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [authUser, setAuthUser] = useState<User | null>(auth.currentUser);
  const [profileData, setProfileData] = useState<{ avatarUrl?: string; displayName?: string; avatarVersion?: number }>({});
  const menuOpen = Boolean(anchorEl);
  const isDarkMode = mode === 'dark';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authUser) {
      setProfileData({});
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'users', authUser.uid), (snapshot) => {
      setProfileData((snapshot.data() as { avatarUrl?: string; displayName?: string; avatarVersion?: number }) ?? {});
    });

    return () => unsubscribe();
  }, [authUser]);

  const handleMenuOpen = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleProfileClick = () => {
    navigate('/profile');
    handleMenuClose();
  };

  const handleThemeToggle = () => {
    toggleColorMode();
    handleMenuClose();
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/auth');
    } catch (error) {
      console.error('Logout failed', error);
    } finally {
      handleMenuClose();
    }
  };

  const avatarSrc = profileData.avatarUrl
    ? buildAvatarSrc(profileData.avatarUrl, profileData.avatarVersion)
    : authUser?.photoURL;

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        backgroundImage: (theme) =>
          theme.palette.mode === 'light'
            ? 'linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%)'
            : 'linear-gradient(90deg, #1f2432 0%, #191f2c 100%)',
        backdropFilter: 'blur(10px)',
        color: (theme) => theme.palette.text.primary,
        borderBottom: '1px solid',
        borderColor: (theme) => theme.palette.divider,
      }}
    >
      <Toolbar sx={{ justifyContent: 'flex-end', minHeight: 64, px: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={handleMenuOpen} size="large" color="inherit">
            <Avatar
              alt={profileData.displayName || authUser?.displayName || 'Profil'}
              src={avatarSrc || undefined}
            >
              {(profileData.displayName?.[0] || authUser?.displayName?.[0] || authUser?.email?.[0] || 'C').toUpperCase()}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={menuOpen}
            onClose={handleMenuClose}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          >
            <MenuItem onClick={handleProfileClick}>
              <ListItemIcon>
                <PersonOutlineIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Profil" />
            </MenuItem>
            <MenuItem onClick={handleThemeToggle}>
              <ListItemIcon>
                {isDarkMode ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
              </ListItemIcon>
              <ListItemText primary={isDarkMode ? 'Light Mode' : 'Dark Mode'} />
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Ausloggen" />
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
