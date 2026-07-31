import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { useAuthStore } from './store/auth';
import { HelmetProvider } from 'react-helmet-async';

// Layouts
import PublicLayout from './components/layout/PublicLayout';
import AdminLayout from './components/layout/AdminLayout';

// Pages (lazy-loaded for route-level code splitting)
const Home = lazy(() => import('./pages/public/Home'));
const Movies = lazy(() => import('./pages/public/Movies'));
const Search = lazy(() => import('./pages/public/Search'));
const Requests = lazy(() => import('./pages/public/Requests'));
const MovieDetail = lazy(() => import('./pages/public/MovieDetail'));
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const Profile = lazy(() => import('./pages/public/Profile'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminMovies = lazy(() => import('./pages/admin/Movies'));
const AdminLinks = lazy(() => import('./pages/admin/Links'));
const AdminDownloads = lazy(() => import('./pages/admin/Downloads'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminSettings = lazy(() => import('./pages/admin/Settings'));
const Logs = lazy(() => import('./pages/admin/Logs'));

function PageLoader() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-zinc-950 text-white">
      <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

export default function App() {
  const { initialize, isLoading, profile } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

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
        <Suspense fallback={<PageLoader />}>
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
              <Route path="/reset-password" element={<ResetPassword />} />
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
        </Suspense>
      </BrowserRouter>
    </HelmetProvider>
  );
}
