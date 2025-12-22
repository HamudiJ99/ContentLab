import { Drawer, List, ListItemButton, ListItemIcon, ListItemText, Box, Typography, Divider } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SchoolIcon from '@mui/icons-material/School';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';

const navigationItems = [
  { label: 'Home', icon: <HomeOutlinedIcon />, path: '/home' },
  { label: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  { label: 'Kurse', icon: <SchoolIcon />, path: '/courses' },
  { label: 'Mitglieder', icon: <GroupOutlinedIcon />, path: '/members' },
];

const drawerWidth = 330;

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
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
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ px: 3, py: 2 }}>
          <Typography variant="h5" fontWeight={800} letterSpacing={0.6}>
            Content
            <Box component="span" sx={{ fontWeight: 400 }}>Lab</Box>
          </Typography>
        </Box>
        <Divider sx={{ mx: 3, mb: 1 }} />
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', py: 2 }}>
          <List sx={{ mt: 0 }}>
            {navigationItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <ListItemButton
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  sx={(theme) => ({
                    mx: 2,
                    mb: 0.75,
                    borderRadius: 2,
                    gap: 1.5,
                    px: 2,
                    py: 1.25,
                    alignItems: 'center',
                    transition: 'all 0.2s ease',
                    backgroundColor: isActive
                      ? theme.palette.mode === 'light'
                        ? 'rgba(148, 163, 184, 0.35)'
                        : 'rgba(100, 116, 139, 0.35)'
                      : 'transparent',
                    color: isActive
                      ? theme.palette.text.primary
                      : theme.palette.text.secondary,
                    boxShadow: isActive ? '0 6px 18px rgba(15, 23, 42, 0.06)' : 'none',
                    '&:hover': {
                      backgroundColor: theme.palette.mode === 'light'
                        ? 'rgba(148, 163, 184, 0.35)'
                        : 'rgba(100, 116, 139, 0.35)',
                      color: theme.palette.text.primary,
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
                        ? theme.palette.mode === 'light'
                          ? '#1f2937'
                          : '#e2e8f0'
                        : theme.palette.mode === 'light'
                        ? '#e2e8f0'
                        : '#1e293b',
                      color: isActive
                        ? theme.palette.mode === 'light'
                          ? '#f8fafc'
                          : '#0f172a'
                        : theme.palette.mode === 'light'
                        ? '#475569'
                        : '#cbd5f5',
                      transition: 'all 0.2s ease',
                    })}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primaryTypographyProps={{ fontWeight: isActive ? 600 : 500 }}
                    primary={item.label}
                  />
                </ListItemButton>
              );
            })}
          </List>
          <Divider sx={{ mx: 3, mb: 1 }} />
        </Box>
      </Box>
    </Drawer>
  );
}
