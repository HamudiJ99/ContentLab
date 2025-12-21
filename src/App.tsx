

import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Courses from './pages/Courses';
import SignIn from './pages/SignIn';

const AppLayout = () => (
  <Box sx={{ display: 'flex', minHeight: '100vh', background: '#f7f8fa' }}>
    <Sidebar />
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Header />
      <Box sx={{ flex: 1 }}>
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
          <Route path="/courses" element={<Courses />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
