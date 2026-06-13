import { Drawer, List, ListItemButton, ListItemIcon, ListItemText, Box, Typography, Divider, ButtonBase, IconButton, Tooltip, alpha } from '@mui/material';
import { darken, lighten, getLuminance } from '@mui/system';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SchoolIcon from '@mui/icons-material/School';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import { useNavigation } from '../context/NavigationContext';

const navigationItems = [
  { label: 'Home', icon: <HomeOutlinedIcon />, path: '/home' },
  { label: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { label: 'Kurse', icon: <SchoolIcon />, path: '/courses' },
  { label: 'Mitglieder', icon: <GroupOutlinedIcon />, path: '/members' },
];

const drawerWidthExpanded = 330;
const drawerWidthCollapsed = 80;

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { confirmNavigation } = useNavigation();
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [authUser, setAuthUser] = useState<User | null>(auth.currentUser);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [logoVersion, setLogoVersion] = useState<number | null>(null);

  const drawerWidth = collapsed ? drawerWidthCollapsed : drawerWidthExpanded;

  // Speichere collapsed-Status im localStorage
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(collapsed));
  }, [collapsed]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authUser) {
      setLogoUrl('');
      setLogoVersion(null);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'users', authUser.uid), (snapshot) => {
      const data = snapshot.data();
      setLogoUrl(data?.logoUrl ?? '');
      setLogoVersion(typeof data?.logoVersion === 'number' ? data.logoVersion : null);
    });

    return () => unsubscribe();
  }, [authUser]);

  const buildLogoSrc = (url?: string, version?: number | null) => {
    if (!url) return '';
    if (!version) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${version}`;
  };

  const logoSrc = buildLogoSrc(logoUrl, logoVersion);

  const handleNavigate = async (path: string) => {
    const canNavigate = await confirmNavigation(path);
    if (canNavigate) {
      navigate(path);
    }
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: {
          width: drawerWidth,
          boxSizing: 'border-box',
          borderRight: '1px solid',
          borderColor: (theme) => theme.palette.divider,
          backgroundImage: (theme) =>
            theme.palette.mode === 'light'
              ? 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)'
              : 'linear-gradient(180deg, #1f2432 0%, #161b27 100%)',
          color: (theme) => theme.palette.text.primary,
          transition: 'width 0.3s ease',
          overflowX: 'hidden',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ px: 3, minHeight: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {!collapsed && (
            <ButtonBase
              onClick={() => handleNavigate('/home')}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1.5,
                borderRadius: 2,
                px: 1,
                py: 0.5,
                '&:hover': {
                  backgroundColor: 'transparent',
                },
              }}
            >
              {logoSrc && (
                <Box
                  component="img"
                  src={logoSrc}
                  alt="Logo"
                  sx={{
                    height: 48,
                    maxWidth: 48,
                    objectFit: 'contain',
                    p: 0.5,
                  }}
                />
              )}
              <Typography variant="h5" fontWeight={800} letterSpacing={0.6}>
                Content
                <Box component="span" sx={{ fontWeight: 400 }}>Lab</Box>
              </Typography>
            </ButtonBase>
          )}
          <IconButton 
            onClick={() => setCollapsed(!collapsed)}
            sx={{ ml: collapsed ? 'auto' : 0, mr: collapsed ? 'auto' : 0 }}
          >
            {collapsed ? <MenuIcon /> : <ChevronLeftIcon />}
          </IconButton>
        </Box>
        <Divider sx={{ mx: collapsed ? 1 : 3, mb: 1 }} />
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', py: 2 }}>
          <List sx={{ mt: 0 }}>
            {navigationItems.map((item) => {
              const isActive = item.path === '/courses' 
                ? location.pathname.startsWith('/courses')
                : location.pathname === item.path;
              
              const button = (
                <ListItemButton
                  key={item.path}
                  onClick={() => handleNavigate(item.path)}
                  sx={(theme) => ({
                    mx: collapsed ? 1 : 2,
                    mb: 0.75,
                    borderRadius: 2,
                    gap: 1.5,
                    px: collapsed ? 1.5 : 2,
                    py: 1.25,
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    transition: 'all 0.2s ease',
                    backgroundColor: isActive
                      ? alpha(theme.palette.primary.main, 0.15)
                      : 'transparent',
                    color: isActive
                      ? (() => {
                          const lum = getLuminance(theme.palette.primary.main);
                          if (theme.palette.mode === 'dark') {
                            return lum < 0.3 ? lighten(theme.palette.primary.main, 0.5) : theme.palette.primary.main;
                          } else {
                            return lum > 0.7 ? darken(theme.palette.primary.main, 0.5) : theme.palette.primary.main;
                          }
                        })()
                      : theme.palette.text.secondary,
                    boxShadow: 'none',
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                      color: (() => {
                        const lum = getLuminance(theme.palette.primary.main);
                        if (theme.palette.mode === 'dark') {
                          return lum < 0.3 ? lighten(theme.palette.primary.main, 0.5) : theme.palette.primary.main;
                        } else {
                          return lum > 0.7 ? darken(theme.palette.primary.main, 0.5) : theme.palette.primary.main;
                        }
                      })(),
                      '& .MuiListItemIcon-root': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.5),
                        color: theme.palette.primary.contrastText,
                      },
                    },
                  })}
                >
                  <ListItemIcon
                    sx={(theme) => ({
                      minWidth: 0,
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isActive
                        ? theme.palette.primary.main
                        : theme.palette.mode === 'light'
                        ? '#e2e8f0'
                        : '#1e293b',
                      color: isActive
                        ? theme.palette.primary.contrastText
                        : theme.palette.mode === 'light'
                        ? '#475569'
                        : '#cbd5f5',
                      transition: 'all 0.2s ease',
                    })}
                  >
                    {item.icon}
                  </ListItemIcon>
                  {!collapsed && (
                    <ListItemText
                      primaryTypographyProps={{ fontWeight: isActive ? 600 : 500 }}
                      primary={item.label}
                    />
                  )}
                </ListItemButton>
              );

              return collapsed ? (
                <Tooltip key={item.path} title={item.label} placement="right">
                  {button}
                </Tooltip>
              ) : button;
            })}
          </List>
          <Divider sx={{ mx: collapsed ? 1 : 3, mb: 1 }} />
        </Box>
      </Box>
    </Drawer>
  );
}
