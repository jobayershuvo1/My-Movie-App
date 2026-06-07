import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './store/auth';
import { isSupabaseConfigured } from './lib/supabase';
import { HelmetProvider } from 'react-helmet-async';

// Layouts
import PublicLayout from './components/layout/PublicLayout';
import AdminLayout from './components/layout/AdminLayout';

// Pages
import Home from './pages/public/Home';
import Movies from './pages/public/Movies';
import Search from './pages/public/Search';
import Requests from './pages/public/Requests';
import MovieDetail from './pages/public/MovieDetail';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import Profile from './pages/public/Profile';
import Dashboard from './pages/admin/Dashboard';
import AdminMovies from './pages/admin/Movies';
import AdminLinks from './pages/admin/Links';
import AdminDownloads from './pages/admin/Downloads';
import AdminUsers from './pages/admin/Users';
import AdminSettings from './pages/admin/Settings';
import Logs from './pages/admin/Logs';
import SetupGuide from './pages/SetupGuide';

export default function App() {
  const { initialize, isLoading, profile } = useAuthStore();

  useEffect(() => {
    if (isSupabaseConfigured) {
      initialize();
    }
  }, [initialize]);

  if (!isSupabaseConfigured) {
    return <SetupGuide />;
  }

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-zinc-950 text-white">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-zinc-400 font-medium tracking-wide text-sm">LOADING CINEVAULT</p>
        </div>
      </div>
    );
  }

  const hasCMSAccess = ['super_admin', 'admin', 'moderator', 'editor'].includes(profile?.role || '');

  return (
    <HelmetProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/movies" element={<Movies />} />
            <Route path="/search" element={<Search />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/movie/:id" element={<MovieDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          
          {/* Admin CMS Routes */}
          <Route path="/admin" element={hasCMSAccess ? <AdminLayout /> : <Navigate to="/login" replace />}>
            <Route index element={<Dashboard />} />
            <Route path="movies" element={<AdminMovies />} />
            <Route path="links" element={<AdminLinks />} />
            <Route path="downloads" element={<AdminDownloads />} />
            <Route path="logs" element={<Logs />} />
            <Route path="users" element={profile?.role === 'super_admin' ? <AdminUsers /> : <Navigate to="/admin" replace />} />
            <Route path="settings" element={profile?.role === 'super_admin' ? <AdminSettings /> : <Navigate to="/admin" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </HelmetProvider>
  );
}
