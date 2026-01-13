

import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Courses from './pages/Courses';
import CourseEditor from './pages/CourseEditor';
import LessonEditor from './pages/LessonEditor';
import Learn from './pages/Learn';
import Profile from './pages/Profile';
import Home from './pages/Home';
import Members from './pages/Members';
import SignIn from './pages/SignIn';
import Settings from './pages/Settings';
import { NavigationProvider } from './context/NavigationContext';

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
      <NavigationProvider>
        <Routes>
          <Route path="/auth" element={<SignIn />} />
          <Route path="/signin" element={<SignIn />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/courses/:courseId" element={<CourseEditor />} />
            <Route path="/courses/:courseId/chapters/:chapterId/lessons/:lessonId" element={<LessonEditor />} />
            <Route path="/learn/:courseId" element={<Learn />} />
            <Route path="/members" element={<Members />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </NavigationProvider>
    </BrowserRouter>
  );
}

export default App;
