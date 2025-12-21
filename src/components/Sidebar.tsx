import { Drawer, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SchoolIcon from '@mui/icons-material/School';

const drawerWidth = 220;

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box', background: '#f7f8fa', borderRight: 'none' },
      }}
    >
      <List>
        <ListItemButton selected={location.pathname === '/'} onClick={() => navigate('/')}>
          <ListItemIcon>
            <DashboardIcon />
          </ListItemIcon>
          <ListItemText primary="Dashboard" />
        </ListItemButton>
        <ListItemButton selected={location.pathname === '/courses'} onClick={() => navigate('/courses')}>
          <ListItemIcon>
            <SchoolIcon />
          </ListItemIcon>
          <ListItemText primary="Kurse" />
        </ListItemButton>
      </List>
    </Drawer>
  );
}
