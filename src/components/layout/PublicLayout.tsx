import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Film, User, Search, Menu, X, Bell, Check, Sparkles, AlertTriangle, Play } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { Helmet } from 'react-helmet-async';
import ProgressBar from '../ui/ProgressBar';

export default function PublicLayout() {
  const { profile, signOut } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // SEO Metadata mapping for routes in PublicLayout
  const getSeoMetadata = (pathname: string) => {
    if (pathname === '/') {
      return {
        title: 'CineVault Download Hub | Stream & Download Premium Movies',
        description: 'Experience the ultimate directory of cinematic blockbusters. Access high-speed premium server download links and request your favorite films in up to 4K BluRay quality.',
      };
    }
    if (pathname === '/movies') {
      return {
        title: 'Cinematic Catalog & Library | CineVault Download Hub',
        description: 'Browse our complete catalogue of blockbusters, indie favorites, sci-fi classics, and modern cinema releases. Instant, resume-supported premium direct download links.',
      };
    }
    if (pathname === '/search') {
      return {
        title: 'Search CineVault Library | Find High Speed Downloads',
        description: 'Search for high-quality, high-speed movie releases on CineVault database. Filter by quality, language formats, and release year.',
      };
    }
    if (pathname === '/requests') {
      return {
        title: 'Request Missing Movies & Links | CineVault Community',
        description: 'Can\'t find your favorite movie? Submit high-speed download link requests on CineVault. Our moderators fulfill original quality link requests rapidly.',
      };
    }
    if (pathname === '/login') {
      return {
        title: 'Sign In Account | CineVault Members Area',
        description: 'Log into your CineVault premium dashboard. Access personalized watchlist recommendations, verify safe download mirrors, and start requesting links.',
      };
    }
    if (pathname === '/register') {
      return {
        title: 'Create Your Member Account | CineVault Registry',
        description: 'Register a community account to access our direct lightning-fast movie mirrors, rate titles, publish expert reviews, and vote on request priorities.',
      };
    }
    if (pathname === '/forgot-password') {
      return {
        title: 'Recover Account Access Password | CineVault Support',
        description: 'Easily recover your CineVault catalog member account by resetting your secure password parameters quickly.',
      };
    }
    if (pathname === '/profile') {
      return {
        title: 'My Profile Controls & Settings | CineVault Download Hub',
        description: 'Customize your CineVault screen identity. Revamp your profile picture, select custom movie avatars, alter display names, and check user logs.',
      };
    }
    
    // fallback
    return {
      title: 'CineVault Download Hub | Premium Movies & Links',
      description: 'Experience high-speed direct downloads of quality movie catalog listings with authentic IMDB reviews, metadata synchronization, and community request boards.',
    };
  };

  const seo = getSeoMetadata(location.pathname);

  // Notifications State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [showToast, setShowToast] = useState<any | null>(null);

  // Fetch from Supabase
  const fetchNotifications = async () => {
    if (!supabase || !profile) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`user_id.eq.${profile.id},user_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (!error && data) {
        setNotifications(data);
      }
    } catch (err) {
      console.warn('Could not fetch notifications:', err);
    }
  };

  // Real-time listener
  useEffect(() => {
    if (!supabase || !profile) return;

    fetchNotifications();

    // Subscribe to Postgres changes for the 'notifications' table
    const subscription = supabase
      .channel('public_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications'
        },
        (payload) => {
          const newNotif = payload.new;
          // Only process if it belongs to this user or is a broadcast
          if (newNotif.user_id === profile.id || newNotif.user_id === null) {
            setNotifications((prev) => {
              // Ensure uniqueness to maintain idempotency
              if (prev.some((n) => n.id === newNotif.id)) return prev;
              return [newNotif, ...prev];
            });
            setShowToast(newNotif);
            const timer = setTimeout(() => {
              setShowToast(null);
            }, 5000);
            return () => clearTimeout(timer);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [profile]);

  const handleMarkAsRead = async (id: string) => {
    // Optimistic Update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );

    if (!supabase) return;
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    // Optimistic Update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    if (!supabase || !profile) return;
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', profile.id);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const triggerDemoNotification = () => {
    const demoNotifs = [
      {
        id: Math.random().toString(),
        title: 'Movie Request Fulfilled! 🎬',
        message: 'Excellent news! Your request for "Spider-Man: No Way Home" is now live and ready for download!',
        type: 'request_status',
        read: false,
        created_at: new Date().toISOString()
      },
      {
        id: Math.random().toString(),
        title: 'New Release Uploaded 🍿',
        message: 'Interstellar (IMDb 8.7) is now featured and live on CineVault!',
        type: 'new_movie',
        read: false,
        created_at: new Date().toISOString()
      }
    ];
    const chosen = demoNotifs[Math.floor(Math.random() * demoNotifs.length)];
    
    // Simulate real-time insert locally
    setNotifications((prev) => [chosen, ...prev]);
    setShowToast(chosen);
    setTimeout(() => {
      setShowToast(null);
    }, 5000);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      setIsSearchOpen(false);
      setSearchQuery('');
      setIsMobileMenuOpen(false);
    }
  };

  const handleSignOut = () => {
    signOut();
    setIsMobileMenuOpen(false);
  };

  const hasAdminAccess = profile && ['super_admin', 'admin', 'editor', 'moderator'].includes(profile.role);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-red-500/30">
      <ProgressBar />
      <Helmet>
        <title>{seo.title}</title>
        <meta name="description" content={seo.description} />
        <meta property="og:title" content={seo.title} />
        <meta property="og:description" content={seo.description} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="CineVault" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seo.title} />
        <meta name="twitter:description" content={seo.description} />
      </Helmet>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 text-red-600 hover:text-red-500 transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
            <Film className="w-6 h-6" />
            <span className="text-xl font-bold tracking-tighter text-white">CINE<span className="text-red-600">VAULT</span></span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <Link to="/movies" className="hover:text-white transition-colors">Movies</Link>
            <Link to="/requests" className="hover:text-white transition-colors">Requests</Link>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            <div className="relative flex items-center">
              {isSearchOpen && (
                <form onSubmit={handleSearch} className="absolute right-8 top-1/2 -translate-y-1/2 w-48 md:w-64">
                  <input
                    autoFocus
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search movies..."
                    className="w-full bg-black/40 border border-white/10 rounded-full py-1.5 px-4 text-sm text-white focus:outline-none focus:border-red-500/50 backdrop-blur"
                  />
                </form>
              )}
              <button 
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className="text-zinc-400 hover:text-white transition-colors cursor-pointer z-10 p-1"
              >
                <Search className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Notification Bell Icon & Dropdown */}
            {profile && (
              <div className="relative">
                <button 
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className="text-zinc-400 hover:text-white transition-colors cursor-pointer p-1 relative flex items-center justify-center"
                  aria-label="View Notifications"
                >
                  <Bell className="w-4.5 h-4.5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 block w-4.5 h-4.5 text-[10px] font-bold text-white bg-red-600 rounded-full flex items-center justify-center shadow-lg border border-zinc-950 animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Dropdown Menu */}
                {isNotificationsOpen && (
                  <div className="absolute right-0 mt-3 w-80 md:w-96 glass bg-zinc-950/95 border border-white/10 rounded-xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
                    <div className="flex items-center justify-between pb-3 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4.5 h-4.5 text-red-500" />
                        <h3 className="font-bold text-white text-sm">Notifications</h3>
                      </div>
                      {unreadCount > 0 && (
                        <button 
                          onClick={handleMarkAllAsRead}
                          className="text-xs text-red-500 hover:text-red-400 font-medium transition-colors"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    {/* Pop notification helper */}
                    <div className="py-2 px-1 text-center bg-white/5 border-b border-white/5 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-zinc-400">Want to test the real-time systems?</span>
                      <button 
                        onClick={triggerDemoNotification}
                        type="button"
                        className="text-[10px] bg-red-600/20 hover:bg-red-600 border border-red-500/30 text-red-400 hover:text-white px-2 py-0.5 rounded transition-all flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" /> Test WebSockets
                      </button>
                    </div>

                    {/* Notifications list */}
                    <div className="mt-2 max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="py-8 text-center text-zinc-500 text-xs">
                          No notifications yet. You will get notified here in real-time when your movie requests are fulfilled!
                        </div>
                      ) : (
                        notifications.map((n) => {
                          let IconType = Bell;
                          let iconColor = 'text-blue-500 bg-blue-500/10';
                          if (n.type === 'request_status') {
                            IconType = Sparkles;
                            iconColor = 'text-green-400 bg-green-500/10';
                          } else if (n.type === 'new_movie') {
                            IconType = Play;
                            iconColor = 'text-red-500 bg-red-600/10';
                          }

                          return (
                            <div 
                              key={n.id} 
                              className={`p-2.5 rounded-lg border text-left transition-all ${
                                !n.read 
                                  ? 'bg-zinc-900/60 border-zinc-800' 
                                  : 'bg-transparent border-transparent'
                              }`}
                            >
                              <div className="flex items-start gap-2.5 justify-between">
                                <div className="flex gap-2">
                                  <div className={`p-1.5 rounded-md shrink-0 ${iconColor}`}>
                                    <IconType className="w-3.5 h-3.5" />
                                  </div>
                                  <div>
                                    <h4 className={`text-xs font-semibold ${!n.read ? 'text-white' : 'text-zinc-300'}`}>
                                      {n.title}
                                    </h4>
                                    <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                                      {n.message}
                                    </p>
                                    <span className="text-[9px] text-zinc-500 block mt-1">
                                      {new Date(n.created_at).toLocaleTimeString() || 'Just now'}
                                    </span>
                                  </div>
                                </div>

                                {!n.read && (
                                  <button 
                                    onClick={() => handleMarkAsRead(n.id)}
                                    className="p-1 text-zinc-500 hover:text-white rounded hover:bg-white/5 transition-colors shrink-0"
                                    title="Mark read"
                                    type="button"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {profile ? (
              <div className="hidden md:flex items-center gap-4 text-sm">
                {hasAdminAccess && (
                  <Link to="/admin" className="text-red-500 hover:text-red-400 bg-red-500/10 px-3 py-1.5 rounded-full font-medium transition-colors">
                    Admin CMS
                  </Link>
                )}
                <Link to="/profile" className="text-zinc-400 hover:text-white transition-colors">
                  Profile
                </Link>
                <button onClick={handleSignOut} className="text-zinc-400 hover:text-white cursor-pointer transition-colors">
                  Sign Out
                </button>
                <Link to="/profile" className="w-8 h-8 rounded-full overflow-hidden border border-zinc-700 hover:border-red-500 transition-colors flex items-center justify-center bg-zinc-800 focus:outline-none" title="View Profile">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.full_name || 'User'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-xs font-bold text-zinc-300 uppercase shrink-0">
                      {profile.full_name?.substring(0, 2) || profile.email?.substring(0, 2) || 'US'}
                    </span>
                  )}
                </Link>
              </div>
            ) : (
              <Link to="/login" className="hidden md:block bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
                Sign In
              </Link>
            )}

            {/* Mobile Menu Toggle Button */}
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden text-zinc-400 hover:text-white p-1 focus:outline-none cursor-pointer transition-colors"
              aria-label="Toggle Menu"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>

        </div>
      </nav>

      {/* Mobile Navigation Drawer with AnimatePresence */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-md z-[60] md:hidden"
            />

            {/* Sidebar Menu Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: '0%' }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="fixed inset-y-0 right-0 w-80 max-w-[85vw] bg-zinc-950/98 border-l border-white/10 p-6 z-[70] md:hidden flex flex-col shadow-2xl"
            >
              {/* Header of Mobile Menu */}
              <div className="flex items-center justify-between pb-6 border-b border-white/10 mb-6">
                <div className="flex items-center gap-2 text-red-600">
                  <Film className="w-5 h-5" />
                  <span className="text-lg font-bold tracking-tighter text-white">CINE<span className="text-red-600">VAULT</span></span>
                </div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-zinc-400 hover:text-white p-1 rounded-full hover:bg-white/5 transition-all cursor-pointer"
                  aria-label="Close Menu"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content body */}
              <div className="flex-1 flex flex-col justify-between overflow-y-auto pr-1">
                <div className="space-y-2 flex flex-col text-sm font-medium">
                  <span className="text-xs font-mono tracking-widest text-zinc-500 uppercase mb-2 block px-2">Navigation</span>
                  
                  <Link 
                    to="/" 
                    className="text-zinc-300 hover:text-white py-3 px-3 rounded-xl hover:bg-white/5 transition-all flex items-center gap-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Home
                  </Link>
                  <Link 
                    to="/movies" 
                    className="text-zinc-300 hover:text-white py-3 px-3 rounded-xl hover:bg-white/5 transition-all flex items-center gap-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Movies
                  </Link>
                  <Link 
                    to="/requests" 
                    className="text-zinc-300 hover:text-white py-3 px-3 rounded-xl hover:bg-white/5 transition-all flex items-center gap-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Requests
                  </Link>

                  <Link 
                    to="/profile" 
                    className="text-zinc-300 hover:text-white py-3 px-3 rounded-xl hover:bg-white/5 transition-all flex items-center gap-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    My Profile Settings
                  </Link>
                </div>

                {/* Profile and actions footer */}
                <div className="pt-6 border-t border-white/10 space-y-4">
                  {profile ? (
                    <div className="space-y-4">
                      <Link 
                        to="/profile" 
                        className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 transition-colors border border-white/5 rounded-xl block text-left"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs uppercase text-zinc-300 shrink-0">
                          {profile.avatar_url ? (
                            <img src={profile.avatar_url} alt={profile.full_name || 'User'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            profile.full_name?.substring(0, 2) || profile.email?.substring(0, 2) || 'US'
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-white text-sm font-bold truncate">{profile.full_name || 'Member'}</span>
                          <span className="text-zinc-500 text-[10px] uppercase font-mono tracking-wider">{profile.role}</span>
                        </div>
                      </Link>

                      {hasAdminAccess && (
                        <Link 
                          to="/admin" 
                          className="w-full text-center text-red-500 hover:text-red-400 bg-red-500/10 py-3 rounded-xl font-semibold border border-red-500/20 block transition-all hover:bg-red-500/20 active:scale-[0.98]"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          Admin CMS Panel
                        </Link>
                      )}

                      <button 
                        onClick={handleSignOut} 
                        className="w-full text-center text-zinc-400 hover:text-white py-3 rounded-xl border border-white/10 bg-transparent hover:bg-white/5 transition-all font-medium cursor-pointer active:scale-[0.98]"
                      >
                        Sign Out
                      </button>
                    </div>
                  ) : (
                    <Link 
                      to="/login" 
                      className="w-full text-center bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white py-3 rounded-xl font-semibold transition-all inline-block shadow-lg shadow-red-600/15"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Sign In Member
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 pt-16 flex flex-col">
        <Outlet />
      </main>

      {/* Real-time Toast Notifier */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm glass bg-zinc-950/95 border border-red-500/30 p-3.5 rounded-xl shadow-2xl flex gap-3 animate-in fade-in slide-in-from-bottom-5">
          <div className="bg-red-500/10 text-red-500 p-2 rounded-lg self-start">
            <Bell className="w-5 h-5 animate-bounce" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <h4 className="font-bold text-white text-xs">{showToast.title}</h4>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping shrink-0" />
            </div>
            <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">{showToast.message}</p>
          </div>
          <button onClick={() => setShowToast(null)} className="text-zinc-500 hover:text-white self-start cursor-pointer p-0.5 select-none hover:bg-white/5 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-white/5 glass mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <Film className="w-5 h-5 text-red-600" />
                <span className="text-lg font-bold tracking-tight text-white">CINEVAULT</span>
              </div>
              <p className="text-sm text-zinc-500 leading-relaxed">
                The ultimate platform for requesting, tracking, and downloading the latest high-tier movie releases in premium quality.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-zinc-200 mb-4">Navigation</h3>
              <ul className="space-y-2 text-sm text-zinc-500">
                <li><Link to="/" className="hover:text-red-400 transition-colors">Home</Link></li>
                <li><Link to="/trending" className="hover:text-red-400 transition-colors">Trending Now</Link></li>
                <li><Link to="/latest" className="hover:text-red-400 transition-colors">Latest Releases</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-zinc-200 mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-zinc-500">
                <li><a href="#" className="hover:text-red-400 transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-red-400 transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-red-400 transition-colors">DMCA</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/5 text-center md:text-left text-sm text-zinc-500 flex flex-col md:flex-row justify-between items-center gap-4">
            <p>&copy; {new Date().getFullYear()} CineVault. All rights reserved.</p>
            <p className="text-xs">Disclaimer: This site does not store any files on its server. All contents are provided by non-affiliated third parties.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
