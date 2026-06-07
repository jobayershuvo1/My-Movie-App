import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { useDownloadStore } from '../../store/downloads';
import { motion } from 'motion/react';
import { 
  User, 
  Mail, 
  Shield, 
  Calendar, 
  Camera, 
  Upload, 
  Check, 
  AlertCircle, 
  Loader2, 
  Sparkles, 
  Clock, 
  ArrowLeft,
  Tv,
  Trash2,
  Film,
  Bookmark,
  Download,
  Pause,
  Play,
  X,
  HardDrive,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

// Predefined modern cinema-themed avatars (high quality SVG mock images or high resolution cinema icons)
const PRESET_AVATARS = [
  { name: 'Popcorn', url: 'https://images.unsplash.com/photo-1578496479914-7ef3b0193be3?auto=format&fit=crop&w=150&h=150&q=80' },
  { name: 'Director clapper', url: 'https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?auto=format&fit=crop&w=150&h=150&q=80' },
  { name: 'Neon VR', url: 'https://images.unsplash.com/photo-1593508512255-86ab42a8e620?auto=format&fit=crop&w=150&h=150&q=80' },
  { name: 'Classic Camera', url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=150&h=150&q=80' },
  { name: 'Gold Ticket', url: 'https://images.unsplash.com/photo-1543536448-d209d2d13a1c?auto=format&fit=crop&w=150&h=150&q=80' },
  { name: 'VIP Lounge', url: 'https://images.unsplash.com/photo-1585647347483-22b66260dfff?auto=format&fit=crop&w=150&h=150&q=80' },
];

export default function Profile() {
  const { profile, updateProfileState } = useAuthStore();
  const navigate = useNavigate();

  const { 
    downloads, 
    loadDownloads, 
    pauseDownload, 
    resumeDownload, 
    cancelDownload, 
    clearHistory 
  } = useDownloadStore();

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stats & Watchlist
  const [userRequestsCount, setUserRequestsCount] = useState<number>(0);
  const [userDownloadsCount, setUserDownloadsCount] = useState<number>(0);
  const [watchlist, setWatchlist] = useState<any[]>([]);

  useEffect(() => {
    if (!profile) {
      navigate('/login');
      return;
    }
    setFullName(profile.full_name || '');
    setAvatarUrl(profile.avatar_url || '');

    // Load user downloads
    loadDownloads(profile.id);

    // Fetch watchlist
    const stored = localStorage.getItem(`cinevault_watchlist_user_${profile.id}`);
    if (stored) {
      try {
        setWatchlist(JSON.parse(stored));
      } catch (e) {
        console.warn('Error parsing watchlist in profile:', e);
      }
    }

    // Fetch stats for current user
    const fetchUserStats = async () => {
      if (!supabase || !profile) return;
      try {
        // Fetch request count
        const { count: reqCount } = await supabase
          .from('movie_requests')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id);
        
        if (reqCount !== null) setUserRequestsCount(reqCount);

        // Fetch download order count
        const { count: dlCount } = await supabase
          .from('download_requests')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id);

        if (dlCount !== null) setUserDownloadsCount(dlCount);
      } catch (err) {
        console.warn('Error fetching profile stats:', err);
      }
    };

    fetchUserStats();
  }, [profile, navigate, loadDownloads]);

  const removeWatchlistItem = (movieId: string) => {
    if (!profile) return;
    const storedKey = `cinevault_watchlist_user_${profile.id}`;
    const stored = localStorage.getItem(storedKey);
    if (stored) {
      try {
        let list = JSON.parse(stored);
        list = list.filter((item: any) => item.id !== movieId);
        localStorage.setItem(storedKey, JSON.stringify(list));
        setWatchlist(list);
      } catch (e) {
        console.warn(e);
      }
    }
  };

  if (!profile) {
    return null;
  }

  // Local Image Upload Handler with Canvas Compression
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFileError('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFileError('File sits too large. Selected image should be less than 5MB.');
      return;
    }

    setFileError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas to resize to 192x192 (optimized avatar size for storage efficiency)
        const canvas = document.createElement('canvas');
        const SIZE = 192;
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Draw standard crop/resize to fill canvas square perfectly
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, SIZE, SIZE);
          
          try {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            setAvatarUrl(dataUrl);
            setSuccess(false);
          } catch (canvasErr) {
            setFileError('Canvasing compression failed. Using original base.');
            setAvatarUrl(event.target?.result as string);
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setFileError('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleApplyCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrlInput.trim()) return;
    setAvatarUrl(customUrlInput.trim());
    setCustomUrlInput('');
    setSuccess(false);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim() || null,
          avatar_url: avatarUrl || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      // Update state in Zustand Store
      updateProfileState({
        full_name: fullName.trim() || null,
        avatar_url: avatarUrl || null
      });

      setSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      setError(err.message || 'Something went wrong while saving changes.');
    } finally {
      setLoading(false);
    }
  };

  const roleConfigs: Record<string, { label: string; color: string; bg: string }> = {
    super_admin: { label: 'SUPER ADMIN', color: 'text-red-400 border-red-500/30', bg: 'bg-red-500/10' },
    admin: { label: 'ADMIN CMS', color: 'text-orange-400 border-orange-500/30', bg: 'bg-orange-500/10' },
    moderator: { label: 'MODERATOR', color: 'text-blue-400 border-blue-500/30', bg: 'bg-blue-500/10' },
    editor: { label: 'EDITOR', color: 'text-purple-400 border-purple-500/30', bg: 'bg-purple-500/10' },
    user: { label: 'MEMBER', color: 'text-zinc-400 border-zinc-700', bg: 'bg-zinc-800/30' }
  };

  const currentRole = roleConfigs[profile.role] || roleConfigs.user;

  return (
    <div className="flex-1 bg-gradient-to-b from-zinc-950 to-zinc-900 pb-20 pt-10">
      <div className="max-w-4xl mx-auto px-4">
        
        {/* Back Link */}
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-zinc-400 hover:text-white mb-8 group transition-colors focus:outline-none"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Go Back</span>
        </button>

        {/* Welcome Block */}
        <div className="relative mb-8 bg-zinc-900/60 border border-white/5 rounded-3xl p-6 md:p-8 overflow-hidden backdrop-blur-md">
          <div className="absolute right-0 top-0 w-80 h-80 bg-red-600/5 rounded-full blur-[100px] pointer-events-none -mr-20 -mt-20"></div>
          
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8 relative z-10">
            {/* Display Avatar */}
            <div className="relative group shrink-0">
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-2 border-zinc-700 group-hover:border-red-500 transition-all duration-300 shadow-2xl bg-zinc-800 flex items-center justify-center">
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt={fullName || 'Avatar'} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User className="w-12 h-12 text-zinc-500" />
                )}
              </div>
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </div>

            {/* Profile Brief Info */}
            <div className="text-center md:text-left flex-1">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
                <h1 className="text-2xl md:text-3xl font-extrabold font-sans text-white tracking-tight">
                  {fullName || 'CineVault Member'}
                </h1>
                <span className={`text-[10px] uppercase font-mono tracking-widest font-bold px-2 py-0.5 border rounded ${currentRole.color} ${currentRole.bg}`}>
                  {currentRole.label}
                </span>
              </div>
              <p className="text-zinc-400 text-sm flex items-center justify-center md:justify-start gap-1.5 mb-2">
                <Mail className="w-4 h-4 text-zinc-500" />
                {profile.email}
              </p>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs font-mono text-zinc-500 mt-2">
                <span className="flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-zinc-600" />
                  ID: {profile.id.substring(0, 8)}...
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-zinc-600" />
                  Joined: {new Date(profile.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Form Fields */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Feedback Notifications */}
            {success && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3 text-emerald-400 text-sm"
              >
                <div className="p-1 bg-emerald-500/20 rounded-md shrink-0 mt-0.5">
                  <Check className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold">Profile Update Successful!</p>
                  <p className="text-emerald-400/80 mt-0.5 text-xs">Your updated full name and avatar settings have been updated and are live on CineVault.</p>
                </div>
              </motion.div>
            )}

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 text-red-400 text-sm"
              >
                <div className="p-1 bg-red-500/20 rounded-md shrink-0 mt-0.5">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold">Database Update Failed</p>
                  <p className="text-red-400/80 mt-0.5 text-xs">{error}</p>
                </div>
              </motion.div>
            )}

            {/* Profile Settings Box */}
            <form onSubmit={handleUpdateProfile} className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6 md:p-8 space-y-6 backdrop-blur-md">
              <div className="border-b border-white/5 pb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-red-500" />
                  Personal Information
                </h2>
                <p className="text-xs text-zinc-500 mt-1">Configure your display name and premium profile picture credentials</p>
              </div>

              {/* Edit full name */}
              <div className="space-y-2">
                <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400">Display Name / Full Name</label>
                <div className="relative">
                  <input 
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl py-3 px-4 pl-11 text-white text-sm focus:outline-none focus:border-red-500 focus:bg-zinc-950 placeholder-zinc-600 transition-all font-sans"
                    required
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                    <User className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Custom Image URL or Upload File Section */}
              <div className="space-y-4 border-t border-white/5 pt-6">
                <div>
                  <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-widest block mb-1">Profile Photo / Avatar</h3>
                  <p className="text-[11px] text-zinc-500">Use preset avatars, upload from your files, or link an external picture address</p>
                </div>

                {/* Grid of Preset Avatars */}
                <div className="space-y-2.5">
                  <span className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500">Select Preset Cinematic Avatar</span>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                    {PRESET_AVATARS.map((av) => (
                      <button
                        key={av.name}
                        type="button"
                        onClick={() => {
                          setAvatarUrl(av.url);
                          setSuccess(false);
                        }}
                        className={`relative rounded-xl overflow-hidden aspect-square border-2 transition-all hover:scale-105 active:scale-95 bg-zinc-800 flex items-center justify-center ${
                          avatarUrl === av.url ? 'border-red-500 ring-2 ring-red-500/20' : 'border-zinc-800'
                        }`}
                        title={av.name}
                      >
                        <img src={av.url} alt={av.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        {avatarUrl === av.url && (
                          <div className="absolute inset-0 bg-red-600/30 backdrop-blur-[1px] flex items-center justify-center">
                            <div className="bg-red-600 text-white rounded-full p-1 shadow">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* File upload widget */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  
                  {/* File Upload Trigger */}
                  <div className="space-y-2 text-left">
                    <span className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500">Upload Image File</span>
                    <label className="relative group cursor-pointer flex flex-col items-center justify-center border border-dashed border-zinc-800 hover:border-red-500/50 rounded-xl p-4 bg-zinc-950/20 hover:bg-zinc-950/60 transition-all text-center h-[110px]">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden" 
                      />
                      <Upload className="w-5 h-5 text-zinc-500 group-hover:text-red-500 transition-colors mb-2" />
                      <span className="text-[11px] text-zinc-400 font-medium">Click to select photo</span>
                      <span className="text-[9px] text-zinc-600 mt-1">Automatic resize & compression</span>
                    </label>
                    {fileError && <span className="text-[10px] text-red-500 block">{fileError}</span>}
                  </div>

                  {/* Custom URL form */}
                  <div className="space-y-2">
                    <span className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500">Link External Picture URL</span>
                    <div className="space-y-2">
                      <input 
                        type="url"
                        value={customUrlInput}
                        onChange={(e) => setCustomUrlInput(e.target.value)}
                        placeholder="https://example.com/avatar.jpg"
                        className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-red-500 focus:bg-zinc-950 placeholder-zinc-700 font-mono transition-all"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCustomUrl}
                        className="w-full bg-zinc-800 text-white hover:bg-zinc-700 py-1.5 px-3 rounded-lg text-xs font-semibold hover:border-zinc-500 border border-zinc-800 transition-all cursor-pointer active:scale-[0.98]"
                      >
                        Apply Photo URL
                      </button>
                    </div>
                  </div>

                </div>

              </div>

              {/* Submit Buttons */}
              <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="w-full sm:w-auto text-zinc-400 hover:text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-all shadow-lg hover:shadow-red-600/20 active:scale-[0.98] disabled:opacity-50 disabled:scale-100 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer cursor-pointers"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving Profile...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* My Downloads Center */}
            <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6 md:p-8 space-y-6 backdrop-blur-md">
              <div className="border-b border-white/5 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Download className="w-5 h-5 text-red-500" />
                    My Downloads
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1">Track actual progress and download history of files you've interacted with</p>
                </div>
                {downloads.length > 0 && (
                  <button 
                    onClick={() => clearHistory(profile.id)}
                    className="text-xs font-mono font-bold text-zinc-500 hover:text-red-500 transition-colors flex items-center gap-1 cursor-pointer bg-transparent border-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear History
                  </button>
                )}
              </div>

              {downloads.length > 0 ? (
                <div className="space-y-4">
                  {downloads.map((dl) => (
                    <div 
                      key={dl.id} 
                      className="bg-zinc-950/40 border border-white/5 p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-stretch md:items-center relative overflow-hidden group hover:border-white/10 transition-colors"
                    >
                      {/* Left: Poster */}
                      <Link to={`/movie/${dl.movieId}`} className="flex items-center gap-4 flex-1 min-w-0">
                        {dl.posterUrl ? (
                          <img src={dl.posterUrl} className="w-12 h-16 rounded-xl object-cover border border-white/10 shrink-0" alt="" />
                        ) : (
                          <div className="w-12 h-16 rounded-xl bg-zinc-900 flex items-center justify-center shrink-0 border border-white/5">
                            <Film className="w-5 h-5 text-zinc-600" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h3 className="font-bold text-white text-sm md:text-base group-hover:text-red-500 transition-colors truncate">{dl.movieTitle}</h3>
                            <span className="text-[9px] uppercase font-mono tracking-wider font-bold bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                              {dl.quality}
                            </span>
                          </div>
                          <div className="text-xs text-zinc-400 font-mono flex items-center gap-1.5 flex-wrap">
                            <HardDrive className="w-3.5 h-3.5 text-zinc-500" />
                            <span>Server: {dl.serverName}</span>
                            <span className="text-zinc-650">•</span>
                            <span>{dl.fileSize}</span>
                          </div>
                        </div>
                      </Link>

                      {/* Right: Progress and Controls */}
                      <div className="flex-1 flex flex-col justify-center min-w-[200px]">
                        <div className="flex justify-between items-center text-xs font-mono mb-1.5">
                          <div className="flex items-center gap-2">
                            {dl.status === 'downloading' && (
                              <span className="text-red-400 font-bold flex items-center gap-1">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </span>
                                Downloading
                              </span>
                            )}
                            {dl.status === 'paused' && <span className="text-zinc-500">Paused</span>}
                            {dl.status === 'completed' && <span className="text-emerald-400 font-bold flex items-center gap-1">✓ Completed</span>}
                          </div>
                          <span className="text-white font-bold">{dl.progress}%</span>
                        </div>

                        {/* Progress Bar background */}
                        <div className="w-full bg-zinc-900 rounded-full h-2 mb-2 overflow-hidden border border-white/5">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${
                              dl.status === 'completed' 
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-400' 
                                : dl.status === 'paused' 
                                  ? 'bg-zinc-700' 
                                  : 'bg-gradient-to-r from-red-600 to-rose-500'
                            }`}
                            style={{ width: `${dl.progress}%` }}
                          />
                        </div>

                        {/* Speed & ETA / Completed details */}
                        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                          <span>{dl.downloadSpeed}</span>
                          <span>{dl.timeLeft}</span>
                        </div>
                      </div>

                      {/* Controls Buttons */}
                      <div className="flex items-center gap-2 shrink-0 md:pl-2">
                        {dl.status === 'downloading' && (
                          <button
                            onClick={() => pauseDownload(dl.id)}
                            className="bg-zinc-900 border border-white/5 hover:border-zinc-700 text-zinc-400 hover:text-white p-2 rounded-xl transition-all cursor-pointer"
                            title="Pause Download"
                          >
                            <Pause className="w-4 h-4" />
                          </button>
                        )}
                        {dl.status === 'paused' && (
                          <button
                            onClick={() => resumeDownload(dl.id)}
                            className="bg-zinc-900 border border-white/5 hover:border-zinc-700 text-zinc-400 hover:text-white p-2 rounded-xl transition-all cursor-pointer"
                            title="Resume Download"
                          >
                            <Play className="w-4 h-4 text-red-500" />
                          </button>
                        )}
                        {['downloading', 'paused', 'queued'].includes(dl.status) && (
                          <button
                            onClick={() => cancelDownload(dl.id)}
                            className="bg-zinc-900 border border-white/5 hover:border-red-500/20 text-zinc-500 hover:text-red-400 p-2 rounded-xl transition-all cursor-pointer"
                            title="Cancel Download"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        {dl.status === 'completed' && (
                          <div className="flex items-center gap-1.5">
                            <Link
                              to={`/movie/${dl.movieId}`}
                              className="bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1 transition-all"
                            >
                              Play <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                            <button
                              onClick={() => cancelDownload(dl.id)}
                              className="bg-zinc-900 border border-white/5 hover:border-red-500/20 text-zinc-500 hover:text-red-400 p-2 rounded-xl transition-all cursor-pointer"
                              title="Remove Log"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-white/5 rounded-2xl py-8 px-4 text-center">
                  <Download className="w-8 h-8 text-zinc-700 mx-auto mb-3 animate-bounce" />
                  <p className="text-zinc-400 text-sm font-semibold">No Download Logs Detected</p>
                  <p className="text-zinc-620 text-xs mt-1 max-w-sm mx-auto">Click "Get Link" on any available movie page server to begin tracking direct real-time high speed mirrors.</p>
                </div>
              )}
            </div>

          </div>

          {/* Sidebar Area with Profile statistics, system role, guidelines */}
          <div className="space-y-6">
            
            {/* Account Dashboard Stats */}
            <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6 backdrop-blur-md">
              <h3 className="text-xs uppercase font-mono text-zinc-500 tracking-widest font-bold border-b border-white/5 pb-3">Your CineVault Stats</h3>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-center">
                  <span className="text-3xl font-extrabold text-white block mb-0.5">{userRequestsCount}</span>
                  <span className="text-[10px] uppercase font-mono text-zinc-500">My Requests</span>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-center">
                  <span className="text-3xl font-extrabold text-white block mb-0.5">{userDownloadsCount}</span>
                  <span className="text-[10px] uppercase font-mono text-zinc-500">Downloads</span>
                </div>
              </div>
            </div>

            {/* Watchlist Section */}
            <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6 backdrop-blur-md space-y-4">
              <h3 className="text-xs uppercase font-mono text-zinc-500 tracking-widest font-bold border-b border-white/5 pb-3">My Watchlist ({watchlist.length})</h3>
              {watchlist.length > 0 ? (
                <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                  {watchlist.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 bg-zinc-950/40 border border-white/5 hover:border-white/10 p-2 rounded-2xl transition-all">
                      <Link to={`/movie/${item.id}`} className="flex items-center gap-3 flex-1 min-w-0 group">
                        {item.poster_url ? (
                          <img src={item.poster_url} className="w-9 h-12 rounded-lg object-cover shrink-0 border border-white/5" alt="" />
                        ) : (
                          <div className="w-9 h-12 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 border border-white/5">
                            <Film className="w-4 h-4 text-zinc-600" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-white group-hover:text-red-500 transition-colors truncate">{item.title}</h4>
                          <span className="text-[10px] font-mono text-zinc-500">{item.release_year || 'TBA'}</span>
                        </div>
                      </Link>
                      <button 
                        onClick={() => removeWatchlistItem(item.id)}
                        className="text-zinc-600 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-500/10 cursor-pointer transition-colors"
                        title="Remove from watchlist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-4 text-center">
                  <Bookmark className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
                  <p className="text-xs text-zinc-500">Your watchlist is currently empty.</p>
                </div>
              )}
            </div>

            {/* CineVault Platform Profile Guidelines */}
            <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6 backdrop-blur-md space-y-4">
              <h3 className="text-xs uppercase font-mono text-zinc-500 tracking-widest font-bold border-b border-white/5 pb-3">Security & Guidelines</h3>
              
              <div className="space-y-3.5 text-xs">
                
                <div className="flex items-start gap-2.5 text-zinc-400">
                  <div className="p-1 bg-red-500/10 rounded-lg text-red-400 shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <p className="leading-relaxed">
                    <strong className="text-white font-semibold">Gleaming Avatars:</strong> Profile picture files are loaded as highly optimized localized images. They work perfectly in offline previews and full production.
                  </p>
                </div>

                <div className="flex items-start gap-2.5 text-zinc-400">
                  <div className="p-1 bg-blue-500/10 rounded-lg text-blue-400 shrink-0 mt-0.5">
                    <Tv className="w-3.5 h-3.5" />
                  </div>
                  <p className="leading-relaxed">
                    <strong className="text-white font-semibold">Forum Display:</strong> Your updated name and avatar will be shown besides comment threads, request listings, and reviews directories.
                  </p>
                </div>

                <div className="flex items-start gap-2.5 text-zinc-400">
                  <div className="p-1 bg-orange-500/10 rounded-lg text-orange-400 shrink-0 mt-0.5">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <p className="leading-relaxed">
                    <strong className="text-white font-semibold">Immediate Effect:</strong> Local sessions sync straight away, ensuring a seamless user experience across pages.
                  </p>
                </div>

              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
