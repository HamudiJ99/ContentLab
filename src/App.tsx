

import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Courses from './pages/Courses';
import Profile from './pages/Profile';
import Home from './pages/Home';
import Members from './pages/Members';
import SignIn from './pages/SignIn';

const AppLayout = () => (
  <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: (theme) => theme.palette.background.default }}>
    <Sidebar />
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: (theme) => theme.palette.background.default,
      }}
    >
      <Header />
      <Box sx={{ flex: 1, backgroundColor: (theme) => theme.palette.background.default }}>
        <Outlet />
      </Box>
    </Box>
  </Box>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<SignIn />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/home" element={<Home />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/members" element={<Members />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
