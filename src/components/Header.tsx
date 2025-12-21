import { AppBar, Toolbar, Box, Avatar } from '@mui/material';

export default function Header() {
  return (
    <AppBar position="static" elevation={0} sx={{ background: '#fff', color: '#222', borderBottom: '1px solid #eee' }}>
      <Toolbar sx={{ justifyContent: 'flex-end', minHeight: 64 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Profilbereich */}
          <Avatar alt="Profil" src="https://randomuser.me/api/portraits/men/32.jpg" />
        </Box>
      </Toolbar>
    </AppBar>
  );
}
