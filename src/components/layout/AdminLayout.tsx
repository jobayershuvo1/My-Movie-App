import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Film, 
  Link as LinkIcon, 
  Users, 
  Settings, 
  LogOut, 
  Download, 
  Menu, 
  X,
  Activity
} from 'lucide-react';
import { useAuthStore } from '../../store/auth';

const SIDERBAR_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
  { icon: Film, label: 'Movies & Series', path: '/admin/movies' },
  { icon: LinkIcon, label: 'Link Checker', path: '/admin/links' },
  { icon: Download, label: 'Download Control', path: '/admin/downloads' },
  { icon: Activity, label: 'System Logs', path: '/admin/logs' },
  { icon: Users, label: 'Users', path: '/admin/users' },
  { icon: Settings, label: 'Settings', path: '/admin/settings' },
];

export default function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const { signOut, profile } = useAuthStore();

  const allowedSidebarItems = SIDERBAR_ITEMS.filter((item) => {
    if (item.path === '/admin/users' || item.path === '/admin/settings') {
      return profile?.role === 'super_admin';
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex font-sans">
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)} 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 lg:hidden transition-all duration-300"
        />
      )}

      {/* Sidebar Container */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-zinc-950 border-r border-white/5 flex flex-col z-40 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/5">
          <Link to="/" className="flex items-center gap-2 text-red-600" onClick={() => setIsSidebarOpen(false)}>
            <Film className="w-5 h-5" />
            <span className="text-lg font-bold tracking-tight text-white/90">CINEVAULT <span className="text-[10px] uppercase tracking-wider text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-sm">CMS</span></span>
          </Link>
          <button 
            onClick={() => setIsSidebarOpen(false)} 
            className="lg:hidden p-1 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1">
          {allowedSidebarItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-red-600 text-white' 
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5">
          <button 
            onClick={() => {
              setIsSidebarOpen(false);
              signOut();
            }}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-rose-500/10 hover:text-rose-400 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-stretch overflow-y-auto w-full min-w-0">
        <div className="h-16 border-b border-white/10 glass sticky top-0 z-10 px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg lg:hidden transition-colors cursor-pointer"
              aria-label="Toggle Navigation"
            >
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h1 className="text-base sm:text-lg font-semibold text-zinc-100 truncate">
              {SIDERBAR_ITEMS.find(item => item.path === location.pathname)?.label || 'Admin Panel'}
            </h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-zinc-400 shrink-0">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="hidden sm:inline text-zinc-400 text-xs">System Live</span>
            </span>
            {profile && (
              <Link to="/profile" className="flex items-center gap-2.5 text-zinc-400 hover:text-white transition-colors border-l border-white/10 pl-4 py-1" title="View Profile">
                <div className="w-7 h-7 rounded-full overflow-hidden border border-zinc-700 hover:border-red-500 bg-zinc-800 transition-colors flex items-center justify-center shrink-0">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.full_name || 'Admin'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-[10px] font-bold text-zinc-300 uppercase">
                      {profile.full_name?.substring(0, 2) || profile.email?.substring(0, 2) || 'AD'}
                    </span>
                  )}
                </div>
                <span className="hidden sm:inline text-xs font-semibold max-w-[120px] truncate">{profile.full_name || 'Admin'}</span>
              </Link>
            )}
          </div>
        </div>
        <div className="p-4 sm:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
