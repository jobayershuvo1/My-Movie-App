import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Star, Clock, Calendar, Download, AlertTriangle, ShieldCheck, HardDrive, MessageSquare, Trash2, Edit3, CheckCircle, Award, Bookmark, Share2, Copy, Check, Play, Pause, X, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/auth';
import { useDownloadStore } from '../../store/downloads';
import { motion, AnimatePresence } from 'motion/react';
import type { Movie, DownloadLink } from '../../types/database.types';
import { Helmet } from 'react-helmet-async';

function getEmbedOrVideoUrl(url: string | null): { type: 'youtube' | 'vimeo' | 'direct' | 'unrecognized'; url: string } | null {
  if (!url) return null;
  const cleanUrl = url.trim();

  // Filter out placeholder and empty content links
  if (
    cleanUrl === '' ||
    cleanUrl === 'https://' ||
    cleanUrl.startsWith('https://...') ||
    cleanUrl.toLowerCase().includes('placeholder')
  ) {
    return null;
  }

  // 1. Direct video formats (mp4, webm, ogg, mov, m4v)
  const parsedPath = cleanUrl.toLowerCase().split('?')[0];
  if (
    parsedPath.endsWith('.mp4') ||
    parsedPath.endsWith('.webm') ||
    parsedPath.endsWith('.ogg') ||
    parsedPath.endsWith('.mov') ||
    parsedPath.endsWith('.m4v') ||
    cleanUrl.includes('drive.google.com/file/') ||
    cleanUrl.includes('dl.dropboxusercontent.com/') ||
    cleanUrl.includes('.mp4?') ||
    cleanUrl.includes('.webm?')
  ) {
    return { type: 'direct', url: cleanUrl };
  }

  // 2. YouTube Shorts handler
  const shortsMatch = cleanUrl.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch && shortsMatch[1]) {
    return { type: 'youtube', url: `https://www.youtube.com/embed/${shortsMatch[1]}?autoplay=0&rel=0` };
  }

  // 3. YouTube normal watch, embed, v, etc.
  const ytReg = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const ytMatch = cleanUrl.match(ytReg);
  if (ytMatch && ytMatch[2] && ytMatch[2].length === 11) {
    return { type: 'youtube', url: `https://www.youtube.com/embed/${ytMatch[2]}?autoplay=0&rel=0` };
  }
  if (cleanUrl.includes('youtube.com/embed/')) {
    return { type: 'youtube', url: cleanUrl };
  }

  // 4. Vimeo matcher
  const vimeoReg = /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)(?:$|\/|\?)/;
  const vimeoMatch = cleanUrl.match(vimeoReg);
  if (vimeoMatch && vimeoMatch[3]) {
    return { type: 'vimeo', url: `https://player.vimeo.com/video/${vimeoMatch[3]}` };
  }

  // Handle generalized iframe fallback just in case
  return { type: 'unrecognized', url: cleanUrl };
}

export default function MovieDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuthStore();
  const navigate = useNavigate();

  const { startDownload, loadDownloads, downloads, pauseDownload, resumeDownload, cancelDownload } = useDownloadStore();
  const [showDownloadsPanel, setShowDownloadsPanel] = useState(false);
  
  const [movie, setMovie] = useState<Movie | null>(null);
  const [links, setLinks] = useState<DownloadLink[]>([]);
  const [loading, setLoading] = useState(true);

  // Watchlist & Share states
  const [isOnWatchlist, setIsOnWatchlist] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Ratings State
  const [ratings, setRatings] = useState<any[]>([]);
  const [userRating, setUserRating] = useState<any | null>(null);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [hasLoadedInitialRatings, setHasLoadedInitialRatings] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isUsingLocalStorageBackup, setIsUsingLocalStorageBackup] = useState(false);
  const [deletedCommentIds, setDeletedCommentIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(`cinevault_deleted_comments_${id}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  
  // Rating Form Inputs
  const [ratingInput, setRatingInput] = useState<number>(5);
  const [reviewInput, setReviewInput] = useState<string>('');
  const [ratingHover, setRatingHover] = useState<number | null>(null);

  const fetchRatings = useCallback(async () => {
    const localRatingsKey = `cinevault_ratings_backup_${id}`;
    const localRaw = localStorage.getItem(localRatingsKey);
    let localData: any[] = [];
    if (localRaw) {
      try {
        localData = JSON.parse(localRaw);
      } catch (e) {
        localData = [];
      }
    }

    if (!supabase || !id || isUsingLocalStorageBackup) {
      setRatings(localData);
      if (profile) {
        const mine = localData.find((r: any) => r.user_id === profile.id);
        if (mine) {
          setUserRating(mine);
          setHasLoadedInitialRatings(prev => {
            if (!prev) {
              setRatingInput(mine.rating);
              setReviewInput(mine.review_text || '');
              return true;
            }
            return prev;
          });
        }
      }
      return;
    }

    try {
      const { data, error } = await supabase
        .from('movie_ratings')
        .select(`
          id,
          movie_id,
          user_id,
          rating,
          review_text,
          created_at,
          profiles (
            id,
            email,
            full_name,
            avatar_url,
            role
          )
        `)
        .eq('movie_id', id)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase movie_ratings error, falling back to local state:', error);
        setIsUsingLocalStorageBackup(true);
        setRatings(localData);
        if (profile) {
          const mine = localData.find((r: any) => r.user_id === profile.id);
          if (mine) {
            setUserRating(mine);
            setHasLoadedInitialRatings(prev => {
              if (!prev) {
                setRatingInput(mine.rating);
                setReviewInput(mine.review_text || '');
                return true;
              }
              return prev;
            });
          }
        }
        return;
      }

      if (data) {
        setRatings(data);
        if (profile) {
          const mine = data.find((r: any) => r.user_id === profile.id);
          if (mine) {
            setUserRating(mine);
            setHasLoadedInitialRatings(prev => {
              if (!prev) {
                setRatingInput(mine.rating);
                setReviewInput(mine.review_text || '');
                return true;
              }
              return prev;
            });
          } else {
            setUserRating(null);
          }
        }
      }
    } catch (err) {
      console.warn('Error fetching ratings:', err);
      setIsUsingLocalStorageBackup(true);
      setRatings(localData);
    }
  }, [id, profile, isUsingLocalStorageBackup]);

  useEffect(() => {
    const fetchData = async () => {
      if (!supabase || !id) return;
      
      setLoading(true);
      try {
        // Reset scroll position to top of page upon navigating or changing movie ID
        window.scrollTo({ top: 0, behavior: 'instant' as any });
      } catch (scrollErr) {
        window.scrollTo(0, 0);
      }

      try {
        const { data: movieData, error: movieError } = await supabase
          .from('movies')
          .select('*')
          .eq('id', id)
          .single();
          
        if (movieError) {
          console.error('[MovieDetail] Error loading movie metadata from DB:', movieError);
        }
        
        const { data: linksData, error: linksError } = await supabase
          .from('download_links')
          .select('*')
          .eq('movie_id', id)
          .eq('status', 'active');
          
        if (linksError) {
          console.error('[MovieDetail] Error loading active download links from DB:', linksError);
        }
        
        if (movieData) {
          setMovie(movieData);
        } else {
          // If the movie can't be fetched, log custom error
          console.warn('[MovieDetail] No movie record found with ID:', id);
        }
        
        if (linksData) {
          setLinks(linksData);
        }
        
        setHasLoadedInitialRatings(false);
        setRatingInput(5);
        setReviewInput('');
        await fetchRatings();
      } catch (err) {
        console.error('[MovieDetail] Unhandled exception inside fetchData:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, profile, fetchRatings]);

  // Load downloads from store
  useEffect(() => {
    if (profile) {
      loadDownloads(profile.id);
    }
  }, [profile, loadDownloads]);

  // Real-time comments listener
  useEffect(() => {
    if (!supabase || !id) return;

    // Connect to Supabase postgres changes channel for instant reviews synchronization
    const channelName = `realtime_movie_comments_${id}`;
    const commentSubscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'movie_ratings'
        },
        async (payload) => {
          const newOrOld = (payload.new || payload.old) as any;
          if (newOrOld && newOrOld.movie_id === id) {
            await fetchRatings();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(commentSubscription);
    };
  }, [id, fetchRatings]);

  // Check Watchlist on mount / profile change
  useEffect(() => {
    if (profile && id) {
      const storedKey = `cinevault_watchlist_user_${profile.id}`;
      const stored = localStorage.getItem(storedKey);
      if (stored) {
        try {
          const list = JSON.parse(stored);
          setIsOnWatchlist(list.some((m: any) => m.id === id));
        } catch (e) {
          console.warn('Error reading watchlist parse:', e);
        }
      }
    } else {
      setIsOnWatchlist(false);
    }
  }, [id, profile]);

  const handleToggleWatchlist = () => {
    if (!profile) {
      navigate('/login');
      return;
    }
    if (!movie) return;

    const storedKey = `cinevault_watchlist_user_${profile.id}`;
    const stored = localStorage.getItem(storedKey);
    let list = [];
    if (stored) {
      try {
        list = JSON.parse(stored);
      } catch (e) {
        list = [];
      }
    }

    if (isOnWatchlist) {
      list = list.filter((m: any) => m.id !== movie.id);
      setIsOnWatchlist(false);
    } else {
      list.push({
        id: movie.id,
        title: movie.title,
        poster_url: movie.poster_url,
        release_year: movie.release_year,
        imdb_rating: movie.imdb_rating,
        added_at: new Date().toISOString()
      });
      setIsOnWatchlist(true);
    }
    localStorage.setItem(storedKey, JSON.stringify(list));
  };

  const handleCopyShare = () => {
    const shareUrl = window.location.href;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 3000);
    });
  };

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !id) return;
    setIsSubmittingRating(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    const localRatingsKey = `cinevault_ratings_backup_${id}`;
    const localRaw = localStorage.getItem(localRatingsKey) || '[]';
    let localData: any[] = [];
    try {
      localData = JSON.parse(localRaw);
    } catch {
      localData = [];
    }

    if (supabase && !isUsingLocalStorageBackup) {
      try {
        const { error } = await supabase
          .from('movie_ratings')
          .upsert({
            movie_id: id,
            user_id: profile.id,
            rating: ratingInput,
            review_text: reviewInput,
            created_at: new Date().toISOString()
          }, {
            onConflict: 'movie_id,user_id'
          });

        if (error) {
          console.warn('Upsert threw error, attempting fallback update/insert:', error);
          if (userRating) {
            const { error: updateErr } = await supabase
              .from('movie_ratings')
              .update({
                rating: ratingInput,
                review_text: reviewInput,
                created_at: new Date().toISOString()
              })
              .eq('id', userRating.id);
            if (updateErr) throw updateErr;
          } else {
            const { error: insertErr } = await supabase
              .from('movie_ratings')
              .insert({
                movie_id: id,
                user_id: profile.id,
                rating: ratingInput,
                review_text: reviewInput
              });
            if (insertErr) throw insertErr;
          }
        }

        setSubmitSuccess(true);
        setTimeout(() => setSubmitSuccess(false), 6000);
        await fetchRatings();
        setIsSubmittingRating(false);
        return;
      } catch (dbErr: any) {
        console.warn('DB submission failed, migrating/falling back to local storage backup:', dbErr);
        setIsUsingLocalStorageBackup(true);
      }
    }

    try {
      const existingIndex = localData.findIndex((r: any) => r.user_id === profile.id);
      const updatedRating = {
        id: userRating?.id || `local-${Math.random().toString(36).substring(2, 11)}`,
        movie_id: id,
        user_id: profile.id,
        rating: ratingInput,
        review_text: reviewInput,
        created_at: new Date().toISOString(),
        profiles: {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name || 'Guest User',
          avatar_url: profile.avatar_url || null,
          role: profile.role || 'user'
        }
      };

      if (existingIndex >= 0) {
        localData[existingIndex] = updatedRating;
      } else {
        localData.unshift(updatedRating);
      }

      localStorage.setItem(localRatingsKey, JSON.stringify(localData));
      setUserRating(updatedRating);
      setRatings(localData);
      
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 6000);
    } catch (localErr: any) {
      console.error('Local backup submit failed:', localErr);
      setSubmitError('Failed to save your review.');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleDeleteRating = async (idToDel?: any, userIdToDel?: string) => {
    if (!profile) return;
    const targetRatingId = idToDel || userRating?.id;
    const targetUserId = userIdToDel || profile.id;

    if (!targetRatingId) return;
    setIsSubmittingRating(true);

    // Save deleted rating ID locally immediately so it disappears from user experience instantly
    setDeletedCommentIds(prev => {
      const next = prev.includes(targetRatingId.toString()) ? prev : [...prev, targetRatingId.toString()];
      try {
        localStorage.setItem(`cinevault_deleted_comments_${id}`, JSON.stringify(next));
      } catch (err) {
        console.warn('Failed to persist deleted comment ID:', err);
      }
      return next;
    });

    const localRatingsKey = `cinevault_ratings_backup_${id}`;
    const localRaw = localStorage.getItem(localRatingsKey) || '[]';
    let localData: any[] = [];
    try {
      localData = JSON.parse(localRaw);
    } catch {
      localData = [];
    }

    if (supabase && targetRatingId && !isUsingLocalStorageBackup && !targetRatingId.toString().startsWith('local-')) {
      try {
        const { error } = await supabase
          .from('movie_ratings')
          .delete()
          .eq('id', targetRatingId);

        if (!error) {
          if (targetUserId === profile.id) {
            setUserRating(null);
            setRatingInput(5);
            setReviewInput('');
          }
          await fetchRatings();
          setIsSubmittingRating(false);
          return;
        }
      } catch (dbErr) {
        console.warn('DB delete failed, falling back to local storage deletion:', dbErr);
        setIsUsingLocalStorageBackup(true);
      }
    }

    try {
      localData = localData.filter((r: any) => r.id !== targetRatingId && r.user_id !== targetUserId);
      localStorage.setItem(localRatingsKey, JSON.stringify(localData));
      if (targetUserId === profile.id) {
        setUserRating(null);
        setRatingInput(5);
        setReviewInput('');
      }
      setRatings(localData);
    } catch (localErr) {
      console.error('Local backup delete failed:', localErr);
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleDownloadClick = async (link: any) => {
    window.open(link.url, '_blank');
    if (!supabase || !movie) return;

    // Start active real-time tracking if user is logged in
    if (profile) {
      startDownload(profile.id, {
        id: movie.id,
        title: movie.title,
        poster_url: movie.poster_url
      }, {
        id: link.id,
        server_name: link.server_name,
        quality: link.quality,
        file_size: link.file_size,
        url: link.url
      });
      setShowDownloadsPanel(true);
    }

    try {
      // 1. Log activity directly
      await supabase.from('activity_logs').insert({
        user_id: profile ? profile.id : null,
        action: 'link_click',
        details: `${profile ? profile.full_name || profile.email : 'Guest user'} initiated download mirror: ${link.server_name} (${link.quality || '1080p'}) for film "${movie.title}"`,
        metadata: { movie_id: movie.id, movie_title: movie.title, server_name: link.server_name, quality: link.quality }
      });

      // 2. Increment click count in db
      if (link.id && link.id !== '1' && link.id !== '2' && link.id !== '3') {
        const { data: currentLink } = await supabase
          .from('download_links')
          .select('clicks')
          .eq('id', link.id)
          .single();

        await supabase
          .from('download_links')
          .update({ clicks: (currentLink?.clicks || 0) + 1 })
          .eq('id', link.id);
      }
    } catch (err) {
      console.error('Could not log download action:', err);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-950 text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-zinc-500 gap-4">
        <AlertTriangle className="w-12 h-12 text-zinc-600 animate-pulse" />
        <p className="text-zinc-400 font-medium font-mono text-xs uppercase tracking-widest">TITLE_NOT_FOUND</p>
      </div>
    );
  }

  // Calculate dynamic average rating
  const avgUserRating = ratings.length > 0
    ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
    : null;

  const displayLinks = links.length > 0 ? links : [
    { id: '1', server_name: 'Google Drive', quality: '1080p BluRay', file_size: '2.4 GB', url: '#', status: 'active' },
    { id: '2', server_name: 'Mega.nz', quality: '1080p BluRay', file_size: '2.4 GB', url: '#', status: 'active' },
    { id: '3', server_name: 'Terabox', quality: '4K HDR', file_size: '12.1 GB', url: '#', status: 'active' },
  ];

  // Default high-quality static comments as baseline if nobody rated yet
  const defaultComments = [
    {
      id: 'default-1',
      rating: 5,
      review_text: 'Excellent video speed and flawless 1080p stream! Absolute banger upload, thank you super admin jobayer! 🍿',
      created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
      profiles: { full_name: 'Anisul Islam', role: 'user' }
    },
    {
      id: 'default-2',
      rating: 4,
      review_text: 'Audio is synchronized correctly. Subtitles are included in the G-Drive download. Verified super easy!',
      created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
      profiles: { full_name: 'Fahim Rahman', role: 'moderator' }
    }
  ];

  const activeComments = ratings.filter(r => !deletedCommentIds.includes(r.id?.toString()));
  const displayedRatings = ratings.length > 0 ? activeComments : defaultComments.filter(r => !deletedCommentIds.includes(r.id?.toString()));

  return (
    <div className="flex-1 w-full bg-zinc-950 pb-20">
      <Helmet>
        <title>{`${movie.title} (${movie.release_year || 'N/A'}) Direct Premium Links | CineVault`}</title>
        <meta name="description" content={`Download ${movie.title} (${movie.release_year || 'N/A'}) in full quality formats. Category genres: ${movie.genre || 'Cinema'}. IMDb Rating: ${movie.imdb_rating || 'N/A'}. ${movie.description || 'Experience highest quality files.'}`} />
        <meta property="og:title" content={`${movie.title} (${movie.release_year}) downloads | CineVault`} />
        <meta property="og:description" content={movie.description || 'Experience highest quality files.'} />
        {movie.poster_url && <meta property="og:image" content={movie.poster_url} />}
        <meta property="og:type" content="video.movie" />
      </Helmet>
      {/* Backdrop Header */}
      <div className="relative w-full h-[50vh] bg-[#050505] border-b border-white/5">
        <div className="absolute inset-0">
          <img 
            src={movie.cover_url || movie.poster_url || ''} 
            alt={movie.title}
            className="w-full h-full object-cover opacity-20 mix-blend-overlay"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.src = "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1200&auto=format&fit=crop";
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent"></div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 -mt-48 relative z-10 flex flex-col md:flex-row gap-8">
        {/* Poster */}
        <div className="w-64 flex-shrink-0 mx-auto md:mx-0">
          <div className="aspect-[2/3] rounded-xl overflow-hidden shadow-2xl glass">
            {movie.poster_url ? (
               <img 
                 src={movie.poster_url} 
                 className="w-full h-full object-cover animate-fade-in" 
                 alt={movie.title} 
                 referrerPolicy="no-referrer"
                 onError={(e) => {
                   e.currentTarget.src = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600&auto=format&fit=crop";
                 }}
               />
            ) : (
              <div className="w-full h-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">No Poster</div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 pt-4 md:pt-16 space-y-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">{movie.title}</h1>
            <div className="flex flex-wrap items-center gap-6 text-sm font-medium text-zinc-300">
              <span className="flex items-center gap-1.5 text-yellow-500" title="Official Rating">
                <Star className="w-4 h-4 fill-current" />
                <span className="text-white text-base">{movie.imdb_rating || 'N/A'}</span>
                <span className="text-zinc-500 text-xs font-mono uppercase tracking-wider">IMDb</span>
              </span>

              {avgUserRating && (
                <span className="flex items-center gap-1.5 text-red-500 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20" title="User Average Rating">
                  <Star className="w-4 h-4 fill-current" />
                  <span className="text-white text-base font-bold">{avgUserRating}</span>
                  <span className="text-zinc-400 text-xs font-medium">User Avg ({ratings.length})</span>
                </span>
              )}

              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-zinc-500" />
                {movie.release_year || 'Unknown'}
              </span>
              {movie.runtime && (
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-zinc-500" />
                  {movie.runtime} min
                </span>
              )}
            </div>

            {/* Watchlist & Share Buttons Controls */}
            <div className="flex flex-wrap items-center gap-3 mt-5">
              <button
                onClick={handleToggleWatchlist}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider font-mono border transition-all duration-300 cursor-pointer ${
                  isOnWatchlist 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' 
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                }`}
              >
                <Bookmark className={`w-4 h-4 ${isOnWatchlist ? 'fill-current text-emerald-400' : ''}`} />
                {isOnWatchlist ? 'Saved on Watchlist' : 'Add to Watchlist'}
              </button>

              <button
                onClick={handleCopyShare}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 rounded-xl text-xs font-semibold uppercase tracking-wider font-mono transition-all cursor-pointer relative"
              >
                {shareCopied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400 animate-bounce" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span>Share Movie</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <p className="text-lg text-zinc-400 leading-relaxed max-w-3xl">
            {movie.description || 'No description available for this title.'}
          </p>
        </div>
      </div>

      {/* Trailer Section */}
      {movie.trailer_url && (() => {
        const media = getEmbedOrVideoUrl(movie.trailer_url);
        if (!media) return null;
        return (
          <div className="max-w-7xl mx-auto px-4 pt-16 -mb-8">
            <div className="glass rounded-2xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                <div className="bg-red-500/10 text-red-500 p-2.5 rounded-xl">
                  <Play className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Official Cinematic Trailer</h2>
                  <p className="text-xs text-zinc-400">Stream the official promo or teaser directly on our web player.</p>
                </div>
              </div>
              
              <div className="aspect-video w-full max-w-4xl mx-auto rounded-xl overflow-hidden border border-white/5 bg-black/40 shadow-2xl">
                {media?.type === 'direct' ? (
                  <video
                    src={media.url}
                    controls
                    preload="metadata"
                    playsInline
                    className="w-full h-full object-contain bg-black"
                  />
                ) : media?.type === 'youtube' || media?.type === 'vimeo' ? (
                  <iframe
                    src={media.url}
                    title={`${movie.title} Official Trailer`}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="w-full h-full"
                  />
                ) : (
                  <iframe
                    src={movie.trailer_url}
                    title={`${movie.title} Official Trailer`}
                    frameBorder="0"
                    allowFullScreen
                    className="w-full h-full"
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                  />
                )}
              </div>
              <div className="mt-4 flex justify-center">
                <a 
                  href={movie.trailer_url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600/10 hover:bg-red-600/15 border border-red-500/20 text-red-500 hover:text-red-400 text-xs font-semibold uppercase tracking-wider font-mono transition-all duration-300 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4 text-red-500" />
                  YouTube-এ ট্রেইলার দেখুন / Open Trailer in New Tab ↗
                </a>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Download Section */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="glass rounded-2xl p-6 md:p-8 mb-8">
          <div className="flex items-center gap-3 mb-8 pb-6 border-b border-white/10">
            <div className="bg-red-500/10 text-red-500 p-3 rounded-xl animate-pulse">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Download Links</h2>
              <p className="text-sm text-zinc-400">Select a server below to begin your download.</p>
            </div>
          </div>

          {!movie.download_enabled ? (
            <div className="bg-rose-900/20 border border-rose-900/50 p-6 rounded-xl flex items-center justify-center text-center">
              <div className="space-y-2">
                <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
                <h3 className="text-rose-500 font-semibold tracking-wide">DOWNLOADS DISABLED</h3>
                <p className="text-sm text-rose-400/80">The administrator has disabled downloads for this title.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayLinks.map((link: any, i) => (
                <div key={link.id || i} className="group glass card-hover p-4 rounded-xl flex items-center justify-between transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-zinc-400 group-hover:text-white transition-colors">
                      <HardDrive className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-zinc-200">{link.server_name}</h4>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-[10px] font-mono tracking-wider px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded uppercase">
                          {link.quality || 'HD'}
                        </span>
                        <span className="text-xs text-zinc-500 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-500" /> Verified
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs font-mono text-zinc-500">{link.file_size || 'Unknown Size'}</span>
                    <Button size="sm" onClick={() => handleDownloadClick(link)} className="gap-2 shrink-0 group-hover:bg-red-500 select-none">
                      Get Link <Download className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rating and Comment System Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Review Column Box */}
          <div className="lg:col-span-1">
            <div className="glass rounded-xl p-6 border border-white/10 flex flex-col h-full">
              <div className="flex items-center gap-2.5 pb-4 border-b border-white/10 mb-6">
                <MessageSquare className="w-5 h-5 text-red-500 animate-pulse" />
                <h3 className="text-lg font-bold text-white">Rate & Review</h3>
              </div>

              {profile ? (
                <form onSubmit={handleSubmitRating} className="space-y-4 flex-1 flex flex-col">
                  {submitError && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-xl flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5 animate-pulse" />
                      <span className="leading-snug">{submitError}</span>
                    </div>
                  )}

                  {submitSuccess && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-3 rounded-xl flex items-start gap-2.5">
                      <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
                      <span className="leading-snug">Your feedback was published successfully!</span>
                    </div>
                  )}
                  {/* Stars input */}
                  <div>
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-widest block mb-2">
                      Your Rating ({ratingInput} / 5)
                    </label>
                    <div className="flex items-center gap-1.5 bg-white/5 rounded-xl p-3 border border-white/5 justify-center">
                      {[1, 2, 3, 4, 5].map((starValue) => {
                        const isSelected = starValue <= (ratingHover !== null ? ratingHover : ratingInput);
                        return (
                          <button
                            key={starValue}
                            type="button"
                            onClick={() => setRatingInput(starValue)}
                            onMouseEnter={() => setRatingHover(starValue)}
                            onMouseLeave={() => setRatingHover(null)}
                            className="bg-transparent hover:scale-125 hover:rotate-12 outline-none p-1 cursor-pointer transition-transform"
                            aria-label={`Rate ${starValue} stars`}
                          >
                            <Star 
                              className={`w-7 h-7 transition-colors ${
                                isSelected 
                                  ? 'fill-current text-amber-500' 
                                  : 'text-zinc-600 hover:text-zinc-400'
                              }`} 
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Review Text */}
                  <div className="flex-1 flex flex-col">
                    <label htmlFor="review_text" className="text-xs font-medium text-zinc-400 uppercase tracking-widest block mb-2">
                      Add Critic, Request, or Review
                    </label>
                    <textarea
                      id="review_text"
                      className="w-full flex-1 min-h-[120px] bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-red-500/50 resize-none font-sans"
                      placeholder="Share your experience about server download speed, file quality, subtitles, or write movie reviews..."
                      value={reviewInput}
                      onChange={(e) => setReviewInput(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    {userRating && (
                      <button
                        type="button"
                        onClick={handleDeleteRating}
                        disabled={isSubmittingRating}
                        className="text-xs font-semibold text-zinc-500 hover:text-red-500 rounded p-1.5 transition-colors flex items-center gap-1 cursor-pointer hover:bg-neutral-900/50"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    )}
                    <Button 
                      type="submit" 
                      disabled={isSubmittingRating} 
                      className={`text-xs ml-auto font-bold tracking-wide uppercase px-5 py-2.5 flex items-center gap-1.5 bg-red-600 hover:bg-red-700 max-w-full ${
                        isSubmittingRating ? 'animate-pulse' : ''
                      }`}
                    >
                      {userRating ? (
                        <>
                          <Edit3 className="w-3.5 h-3.5" /> Update Review
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3.5 h-3.5" /> Submit Review
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex-1 flex flex-col justify-center items-center text-center py-12 p-4 bg-white/5 rounded-xl border border-dashed border-white/10">
                  <AlertTriangle className="w-8 h-8 text-zinc-500 mb-2" />
                  <h4 className="text-sm font-semibold text-white mb-1">MEMBERSHIP REQUIRED</h4>
                  <p className="text-xs text-zinc-400 max-w-[240px] mb-4 leading-relaxed">
                    You must be registered and signed in to rate movies and write reviews.
                  </p>
                  <Link to="/login" className="bg-red-600 hover:bg-red-700 text-white font-medium text-xs rounded-lg px-4 py-2 transition-all">
                    Sign In
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Review List Column */}
          <div className="lg:col-span-2">
            <div className="glass rounded-xl p-6 border border-white/10 min-h-64 h-full flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6 font-bold text-white text-lg">
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="w-5 h-5 text-red-500" />
                  <div>
                    <h3 className="text-base tracking-tight font-bold md:text-lg">Live Community Chat & Feed</h3>
                    <p className="text-[10px] font-normal text-zinc-400">Discuss down speeds, file quality & cast performances.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-mono font-bold tracking-wider text-emerald-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  <span>SYNCED</span>
                </div>
              </div>

              <div className="space-y-4 max-h-[480px] overflow-y-auto pr-2 custom-scrollbar">
                {displayedRatings.map((userReview) => (
                  <div key={userReview.id} className="p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs uppercase text-zinc-300">
                          {userReview.profiles?.full_name?.substring(0, 2) || 'US'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-white hover:text-red-400 transition-colors">
                              {userReview.profiles?.full_name || 'Anonymous User'}
                            </span>
                            {userReview.profiles?.role && userReview.profiles.role !== 'user' && (
                              <span className="text-[9px] font-mono uppercase bg-red-600/10 text-red-400 border border-red-500/10 px-1.5 py-0.5 rounded">
                                {userReview.profiles.role}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {new Date(userReview.created_at).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Display stars and conditional delete action */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-zinc-500">
                          {[1, 2, 3, 4, 5].map((starNum) => (
                            <Star 
                              key={starNum} 
                              className={`w-3.5 h-3.5 ${
                                starNum <= userReview.rating 
                                  ? 'fill-current text-amber-500' 
                                  : 'text-zinc-700 dark:text-zinc-800'
                              }`} 
                            />
                          ))}
                        </div>
                        {profile && (profile.id === userReview.user_id || profile.role === 'super_admin' || profile.role === 'moderator') && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRating(userReview.id, userReview.user_id)}
                            disabled={isSubmittingRating}
                            className="bg-transparent hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 text-zinc-500 hover:text-rose-400 rounded-lg p-1.5 transition-all cursor-pointer inline-flex items-center justify-center hover:scale-105"
                            title="Delete feedback / feedback মুছুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-sm text-zinc-300 mt-3 leading-relaxed whitespace-pre-wrap pl-1">
                      {userReview.review_text || 'Just rated the movie.'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Download Progress Panel */}
      <AnimatePresence>
        {showDownloadsPanel && profile && downloads.some(d => d.userId === profile.id && d.status !== 'completed') && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] glass border border-white/10 rounded-2xl shadow-2xl p-4 overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </div>
                <h4 className="font-bold text-white text-sm">Active Downloads ({downloads.filter(d => d.userId === profile.id && d.status === 'downloading').length})</h4>
              </div>
              <div className="flex items-center gap-1">
                <Link to="/profile" className="text-[10px] uppercase font-mono font-bold text-red-500 hover:text-red-400 px-2 py-0.5 rounded transition-all">
                  Manage Panel
                </Link>
                <button
                  onClick={() => setShowDownloadsPanel(false)}
                  className="text-zinc-400 hover:text-white p-1 rounded transition-all cursor-pointer bg-transparent border-0"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3.5 max-h-64 overflow-y-auto pr-1">
              {downloads
                .filter(d => d.userId === profile.id && d.status !== 'completed')
                .map(dl => (
                  <div key={dl.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <h5 className="text-xs font-bold text-white truncate max-w-[120px]">{dl.movieTitle}</h5>
                          <span className="text-[8px] font-mono bg-zinc-800 text-zinc-350 px-1 rounded">{dl.quality}</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 font-mono truncate">{dl.serverName} • {dl.fileSize}</p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {dl.status === 'downloading' && (
                          <button
                            onClick={() => pauseDownload(dl.id)}
                            className="text-zinc-400 hover:text-white p-1 bg-zinc-900 border border-white/5 rounded-lg transition-all cursor-pointer"
                            title="Pause"
                          >
                            <Pause className="w-3 h-3" />
                          </button>
                        )}
                        {dl.status === 'paused' && (
                          <button
                            onClick={() => resumeDownload(dl.id)}
                            className="text-zinc-400 hover:text-white p-1 bg-zinc-900 border border-white/5 rounded-lg transition-all cursor-pointer"
                            title="Resume"
                          >
                            <Play className="w-3 h-3 text-red-500" />
                          </button>
                        )}
                        <button
                          onClick={() => cancelDownload(dl.id)}
                          className="text-zinc-500 hover:text-red-400 p-1 bg-zinc-900 border border-white/5 rounded-lg transition-all cursor-pointer"
                          title="Cancel"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mb-1">
                        <span className="text-red-400 font-bold">{dl.downloadSpeed}</span>
                        <span>{dl.progress}%</span>
                      </div>
                      <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden border border-white/5">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            dl.status === 'paused' ? 'bg-zinc-700' : 'bg-gradient-to-r from-red-650 to-rose-500'
                          }`}
                          style={{ width: `${dl.progress}%` }}
                        />
                      </div>
                      <div className="text-[9px] text-zinc-500 font-mono text-right mt-1">{dl.timeLeft}</div>
                    </div>
                  </div>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
