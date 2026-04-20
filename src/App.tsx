

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { NavigationProvider } from './context/NavigationContext';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Courses = lazy(() => import('./pages/Courses'));
const CourseEditor = lazy(() => import('./pages/CourseEditor'));
const LessonEditor = lazy(() => import('./pages/LessonEditor'));
const Learn = lazy(() => import('./pages/Learn'));
const Profile = lazy(() => import('./pages/Profile'));
const Home = lazy(() => import('./pages/Home'));
const Members = lazy(() => import('./pages/Members'));
const SignIn = lazy(() => import('./pages/SignIn'));
const Settings = lazy(() => import('./pages/Settings'));

const PageLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
    <CircularProgress size={32} />
  </Box>
);

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
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/auth" element={<SignIn />} />
            <Route path="/signin" element={<SignIn />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="/home" element={<Home />} />
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
        </Suspense>
      </NavigationProvider>
    </BrowserRouter>
  );
}

export default App;
