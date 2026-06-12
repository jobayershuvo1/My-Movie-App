import React, { useEffect, useState } from 'react';
import { X, Plus, Trash2, Film, Check, Loader2, Upload, Star, Calendar, Clock, Globe, Wand2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import type { Category, Movie } from '../../types/database.types';

interface AddMovieDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  movieToEdit?: Movie | null;
}

interface DownloadLinkInput {
  server_name: string;
  url: string;
  quality: string;
  file_size: string;
}

const DEFAULT_GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 
  'Documentary', 'Drama', 'Family', 'Fantasy', 'History', 
  'Horror', 'Music', 'Mystery', 'Romance', 'Sci-Fi', 
  'Thriller', 'War', 'Western'
];

export default function AddMovieDialog({ isOpen, onClose, onSuccess, movieToEdit }: AddMovieDialogProps) {
  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRlsError, setIsRlsError] = useState(false);

  // AI State
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [aiMovieName, setAiMovieName] = useState('');

  // Form Fields State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [releaseYear, setReleaseYear] = useState('');
  const [imdbRating, setImdbRating] = useState('');
  const [runtime, setRuntime] = useState('');
  const [language, setLanguage] = useState('English');
  const [country, setCountry] = useState('United States');
  const [trailerUrl, setTrailerUrl] = useState('');
  const [downloadEnabled, setDownloadEnabled] = useState(true);
  const [published, setPublished] = useState(true);
  const [featured, setFeatured] = useState(false);
  const [trending, setTrending] = useState(false);

  // Categories / Genres State
  const [dbCategories, setDbCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [customGenres, setCustomGenres] = useState<string[]>([]);

  // Download Links State
  const [downloadLinks, setDownloadLinks] = useState<DownloadLinkInput[]>( [
    { server_name: 'Google Drive', url: '', quality: '1080p', file_size: '1.4 GB' }
  ]);

  // Load existing categories from Supabase, or insert default ones
  useEffect(() => {
    if (isOpen) {
      setIsRlsError(false);
      setError(null);
      fetchCategories();
      
      if (movieToEdit) {
        setTitle(movieToEdit.title || '');
        setDescription(movieToEdit.description || '');
        setPosterUrl(movieToEdit.poster_url || '');
        setCoverUrl(movieToEdit.cover_url || '');
        setReleaseYear(movieToEdit.release_year ? movieToEdit.release_year.toString() : '');
        setImdbRating(movieToEdit.imdb_rating ? movieToEdit.imdb_rating.toString() : '');
        setRuntime(movieToEdit.runtime ? movieToEdit.runtime.toString() : '');
        setLanguage(movieToEdit.language || 'English');
        setCountry(movieToEdit.country || 'United States');
        setTrailerUrl(movieToEdit.trailer_url || '');
        setDownloadEnabled(movieToEdit.download_enabled);
        setPublished(movieToEdit.published);
        setFeatured(movieToEdit.featured || false);
        setTrending(movieToEdit.trending || false);
        
        // Fetch relations
        fetchMovieCategories(movieToEdit.id);
        fetchMovieDownloadLinks(movieToEdit.id);
      } else {
        // Reset form for blank slate
        setTitle('');
        setDescription('');
        setPosterUrl('');
        setCoverUrl('');
        setReleaseYear('');
        setImdbRating('');
        setRuntime('');
        setLanguage('English');
        setCountry('United States');
        setTrailerUrl('');
        setDownloadEnabled(true);
        setPublished(true);
        setFeatured(false);
        setTrending(false);
        setSelectedCategoryIds([]);
        setCustomGenres([]);
        setDownloadLinks([
          { server_name: 'Google Drive', url: '', quality: '1080p', file_size: '1.4 GB' }
        ]);
      }
    }
  }, [isOpen, movieToEdit]);

  const fetchMovieCategories = async (movieId: string) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('movie_categories')
        .select('category_id')
        .eq('movie_id', movieId);
        
      if (error) throw error;
      if (data) {
        setSelectedCategoryIds(data.map(item => item.category_id));
      }
    } catch (err) {
      console.error('Error fetching movie categories:', err);
    }
  };

  const fetchMovieDownloadLinks = async (movieId: string) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('download_links')
        .select('server_name, url, quality, file_size')
        .eq('movie_id', movieId)
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      if (data && data.length > 0) {
        setDownloadLinks(data);
      } else {
        setDownloadLinks([
          { server_name: 'Google Drive', url: '', quality: '1080p', file_size: '1.4 GB' }
        ]);
      }
    } catch (err) {
      console.error('Error fetching movie download links:', err);
    }
  };

  const fetchCategories = async () => {
    if (!supabase) return;
    setCategoriesLoading(true);
    try {
      const { data, error: catError } = await supabase
        .from('categories')
        .select('*')
        .order('name');
        
      if (!catError && data) {
        setDbCategories(data);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setCategoriesLoading(false);
    }
  };

  if (!isOpen) return null;

  // AI Auto-Fill Handler
  const handleAiAutoFill = async () => {
    if (!aiMovieName.trim()) {
      setError("Please enter a movie name for AI Auto-Fill.");
      return;
    }
    
    setIsAutoFilling(true);
    setError(null);
    
    try {
      const response = await fetch('/api/movies/autofill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movieName: aiMovieName })
      });
      
      const responseText = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        throw new Error(responseText.substring(0, 200) || 'Failed to parse server response.');
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch AI details.');
      }
      
      // Populate fields
      if (data.title) setTitle(data.title);
      if (data.description) setDescription(data.description);
      if (data.releaseYear) setReleaseYear(data.releaseYear.toString());
      if (data.imdbRating) setImdbRating(data.imdbRating.toString());
      if (data.runtime) setRuntime(data.runtime.toString());
      if (data.language) setLanguage(data.language);
      if (data.country) setCountry(data.country);
      if (data.posterUrl) setPosterUrl(data.posterUrl);
      if (data.coverUrl) setCoverUrl(data.coverUrl);
      if (data.trailerUrl) setTrailerUrl(data.trailerUrl);
      
      // Auto-tag categories
      if (data.genres && Array.isArray(data.genres)) {
        const newCustomGenres = [...customGenres];
        for (const genre of data.genres) {
          if (!newCustomGenres.includes(genre) && !DEFAULT_GENRES.includes(genre)) {
             newCustomGenres.push(genre);
          } else if (DEFAULT_GENRES.includes(genre) && !newCustomGenres.includes(genre)) {
             newCustomGenres.push(genre);
          }
        }
        setCustomGenres(newCustomGenres);
      }
      
      setAiMovieName(''); // clear after success
    } catch (err: any) {
      console.error(err);
      setError(`AI Auto-Fill Error: ${err.message}`);
    } finally {
      setIsAutoFilling(false);
    }
  };

  // File Upload Handlers (for Supabase Storage)
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>, 
    setUrl: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const files = event.target.files;
    if (!supabase || !files || files.length === 0) return;
    
    setLoading(true);
    setError(null);
    try {
      const file = files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from('media').getPublicUrl(filePath);
      setUrl(data.publicUrl);
    } catch (err: any) {
      console.error(err);
      setError(`Upload failed: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Add / Remove dynamic download link fields
  const addDownloadLinkField = () => {
    setDownloadLinks([...downloadLinks, { server_name: 'Direct Link', url: '', quality: '1080p', file_size: '' }]);
  };

  const removeDownloadLinkField = (index: number) => {
    if (downloadLinks.length === 1) return;
    setDownloadLinks(downloadLinks.filter((_, i) => i !== index));
  };

  const updateDownloadLinkField = (index: number, key: keyof DownloadLinkInput, value: string) => {
    const updated = [...downloadLinks];
    updated[index][key] = value;
    setDownloadLinks(updated);
  };

  // Toggle Category selection
  const handleCategoryToggle = (id: string) => {
    if (selectedCategoryIds.includes(id)) {
      setSelectedCategoryIds(selectedCategoryIds.filter(cid => cid !== id));
    } else {
      setSelectedCategoryIds([...selectedCategoryIds, id]);
    }
  };

  // Toggle dynamic DEFAULT tag list selection (if we want to create/link them on submission)
  const handleCustomGenreToggle = (genreName: string) => {
    if (customGenres.includes(genreName)) {
      setCustomGenres(customGenres.filter(g => g !== genreName));
    } else {
      setCustomGenres([...customGenres, genreName]);
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Create or Update Movie
      const movieDoc = {
        title,
        description,
        poster_url: posterUrl || null,
        cover_url: coverUrl || null,
        trailer_url: trailerUrl || null,
        release_year: parseInt(releaseYear) || null,
        imdb_rating: parseFloat(imdbRating) || null,
        runtime: parseInt(runtime) || null,
        language: language || null,
        country: country || null,
        download_enabled: downloadEnabled,
        published,
        featured,
        trending
      };

      let movieId: string;

      if (movieToEdit) {
        const { error: movieError } = await supabase
          .from('movies')
          .update(movieDoc)
          .eq('id', movieToEdit.id);

        if (movieError) throw movieError;
        movieId = movieToEdit.id;
      } else {
        const { data: movieData, error: movieError } = await supabase
          .from('movies')
          .insert([movieDoc])
          .select()
          .single();

        if (movieError) throw movieError;
        if (!movieData) throw new Error('Failed to create movie record.');
        movieId = movieData.id;
      }

      // 2. Resolve final category IDs (using selected DB categories and newly selected custom default genre tags)
      let finalCategoryIds = [...selectedCategoryIds];

      if (customGenres.length > 0) {
        for (const genreName of customGenres) {
          // Check if it already exists in the loaded database categories
          const existing = dbCategories.find(c => c.name.toLowerCase() === genreName.toLowerCase());
          if (existing) {
            if (!finalCategoryIds.includes(existing.id)) {
              finalCategoryIds.push(existing.id);
            }
          } else {
            // Create the category on the fly
            const slug = genreName.toLowerCase().replace(/[^a-z0-9]/g, '-');
            const { data: newCat, error: catError } = await supabase
              .from('categories')
              .insert([{ name: genreName, slug, type: 'genre' }])
              .select()
              .single();
              
            if (!catError && newCat) {
              finalCategoryIds.push(newCat.id);
            }
          }
        }
      }

      // Clear existing associations if editing
      if (movieToEdit) {
        await supabase
          .from('movie_categories')
          .delete()
          .eq('movie_id', movieId);
      }

      // 3. Link Categories
      if (finalCategoryIds.length > 0) {
        const movieCategoryRelations = finalCategoryIds.map(catId => ({
          movie_id: movieId,
          category_id: catId
        }));

        const { error: relError } = await supabase
          .from('movie_categories')
          .insert(movieCategoryRelations);
          
        if (relError) console.error('Failed linking categories:', relError);
      }

      // Clear existing download links if editing
      if (movieToEdit) {
        await supabase
          .from('download_links')
          .delete()
          .eq('movie_id', movieId);
      }

      // 4. Save Download Links
      const linksToInsert = downloadLinks
        .filter(l => l.url.trim() !== '')
        .map(l => ({
          movie_id: movieId,
          server_name: l.server_name,
          url: l.url,
          quality: l.quality,
          file_size: l.file_size || null,
          status: 'active' as const
        }));

      if (linksToInsert.length > 0) {
        const { error: linksError } = await supabase
          .from('download_links')
          .insert(linksToInsert);

        if (linksError) throw linksError;
      }

      // Reset Form State
      setTitle('');
      setDescription('');
      setPosterUrl('');
      setCoverUrl('');
      setReleaseYear('');
      setImdbRating('');
      setRuntime('');
      setLanguage('English');
      setCountry('United States');
      setTrailerUrl('');
      setDownloadEnabled(true);
      setPublished(true);
      setFeatured(false);
      setTrending(false);
      setSelectedCategoryIds([]);
      setCustomGenres([]);
      setDownloadLinks([{ server_name: 'Google Drive', url: '', quality: '1080p', file_size: '1.4 GB' }]);

      // Trigger callback
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while saving the movie.');
      if (err.message && (err.message.includes('row-level security') || err.message.includes('RLS') || err.message.includes('violates row-level security'))) {
        setIsRlsError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-zinc-950 border border-white/5 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-red-500/10 flex items-center justify-center text-red-500">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">
                {movieToEdit ? 'Edit Movie Catalog Entry' : 'Create Movie Catalog Entry'}
              </h2>
              <p className="text-xs text-zinc-500">
                {movieToEdit ? 'Modify cinematic metadata, categories, and direct paths.' : 'Add detailed cinema meta info, genres, and high quality download paths.'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="space-y-4">
              <div className="p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
                {error}
              </div>
              
              {isRlsError && (
                <div className="p-5 text-zinc-100 bg-zinc-900 border border-red-500/30 rounded-xl space-y-4 shadow-xl">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    <h4 className="text-sm font-bold text-red-400">Database Permission Bypass Required</h4>
                  </div>
                  
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    By default, your Supabase Row Level Security (RLS) restricts database write permissions for the <strong>Moderator</strong> role. To immediately unlock full write access for Moderators, copy and run the SQL query below in your <span className="text-zinc-200">Supabase SQL Editor</span>:
                  </p>
                  
                  <div className="relative group bg-black/60 rounded-lg border border-white/5 p-3.5">
                    <pre className="text-xs text-green-400 font-mono overflow-x-auto whitespace-pre select-all max-h-48 leading-relaxed scrollbar-thin">
{`-- SQL PATCH: Grant moderator write access to movies & links
-- 1. Movies Table Write Policies
DROP POLICY IF EXISTS "Allow curators to manage movies" ON movies;
DROP POLICY IF EXISTS "Insert policy for admin/super_admin/moderator" ON movies;
DROP POLICY IF EXISTS "Update policy for admin/super_admin/moderator" ON movies;
DROP POLICY IF EXISTS "Delete policy for admin/super_admin/moderator" ON movies;

CREATE POLICY "Allow privileged roles to insert movies" ON movies
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'moderator')
    )
  );

CREATE POLICY "Allow privileged roles to update movies" ON movies
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'moderator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'moderator')
    )
  );

CREATE POLICY "Allow privileged roles to delete movies" ON movies
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'moderator')
    )
  );

-- 2. Movies & Categories Joint Tables Policies
DROP POLICY IF EXISTS "Allow curators to manage movie_categories" ON movie_categories;
CREATE POLICY "Allow privileged roles to manage movie_categories" ON movie_categories
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'moderator')
    )
  );

DROP POLICY IF EXISTS "Allow curators to manage categories" ON categories;
CREATE POLICY "Allow privileged roles to manage categories" ON categories
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'moderator')
    )
  );

-- 3. Download Links Policies
DROP POLICY IF EXISTS "Allow curators to manage download_links" ON download_links;
CREATE POLICY "Allow privileged roles to manage download_links" ON download_links
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'moderator')
    )
  );`}
                    </pre>
                    <button
                      type="button"
                      onClick={() => {
                        const sqlText = `-- SQL PATCH: Grant moderator write access to movies & links
-- 1. Movies Table Write Policies
DROP POLICY IF EXISTS "Allow curators to manage movies" ON movies;
DROP POLICY IF EXISTS "Insert policy for admin/super_admin/moderator" ON movies;
DROP POLICY IF EXISTS "Update policy for admin/super_admin/moderator" ON movies;
DROP POLICY IF EXISTS "Delete policy for admin/super_admin/moderator" ON movies;

CREATE POLICY "Allow privileged roles to insert movies" ON movies
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'moderator')
    )
  );

CREATE POLICY "Allow privileged roles to update movies" ON movies
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'moderator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'moderator')
    )
  );

CREATE POLICY "Allow privileged roles to delete movies" ON movies
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'moderator')
    )
  );

-- 2. Movies & Categories Joint Tables Policies
DROP POLICY IF EXISTS "Allow curators to manage movie_categories" ON movie_categories;
CREATE POLICY "Allow privileged roles to manage movie_categories" ON movie_categories
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'moderator')
    )
  );

DROP POLICY IF EXISTS "Allow curators to manage categories" ON categories;
CREATE POLICY "Allow privileged roles to manage categories" ON categories
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'moderator')
    )
  );

-- 3. Download Links Policies
DROP POLICY IF EXISTS "Allow curators to manage download_links" ON download_links;
CREATE POLICY "Allow privileged roles to manage download_links" ON download_links
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'moderator')
    )
  );`;
                        navigator.clipboard.writeText(sqlText);
                        alert("SQL Query Copied to Clipboard! Run it inside your Supabase Project's SQL Editor to immediately enable Moderator permissions.");
                      }}
                      className="absolute top-2 right-2 px-2.5 py-1.5 bg-zinc-800 text-zinc-300 hover:text-white rounded text-[11px] font-semibold transition-all border border-white/5 cursor-pointer"
                    >
                      Copy SQL Code
                    </button>
                  </div>
                  <div className="text-zinc-500 font-mono text-[10px] text-center">
                    Copy the query and run it on <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-red-400 underline">Supabase Console</a> SQL Editor.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI Auto-Fill Tool Banner */}
          <div className="p-4 bg-gradient-to-r from-violet-500/10 to-transparent border border-violet-500/20 rounded-xl space-y-3">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-violet-400" />
              <h3 className="text-sm font-bold text-violet-100">AI Auto-Fill Assistant</h3>
            </div>
            <p className="text-xs text-violet-300/70">
              Enter a movie name and Gemini AI will automatically fetch and fill out the metadata, cover, poster, and tags for you.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
               <input
                 type="text"
                 value={aiMovieName}
                 onChange={e => setAiMovieName(e.target.value)}
                 onKeyDown={(e) => {
                   if (e.key === 'Enter') {
                     e.preventDefault();
                     handleAiAutoFill();
                   }
                 }}
                 placeholder="e.g. Inception 2010"
                 className="flex-1 bg-black/40 border border-violet-500/20 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
                 disabled={isAutoFilling}
               />
               <Button
                 type="button"
                 onClick={handleAiAutoFill}
                 disabled={isAutoFilling}
                 className="bg-violet-600 hover:bg-violet-500 text-white gap-2 shrink-0 border-none"
               >
                 {isAutoFilling ? (
                   <>
                     <Loader2 className="w-4 h-4 animate-spin text-white" /> Querying Gemini...
                   </>
                 ) : (
                   <>
                     <Wand2 className="w-4 h-4" /> Auto-Fill
                   </>
                 )}
               </Button>
            </div>
          </div>

          {/* Section 1: Basic Information */}
          <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-bold border-b border-white/5 pb-2">1. Cinematic Metadata</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3 space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Movie Title *</label>
                <input 
                  required 
                  type="text"
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-red-500/50" 
                  placeholder="e.g. Interstellar" 
                />
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Synopsis / Description</label>
                <textarea 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-red-500/50 resize-none" 
                  placeholder="Insert a clean, summary synopsis of the movie release..." 
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Release Year
                </label>
                <input 
                  type="number"
                  value={releaseYear} 
                  onChange={e => setReleaseYear(e.target.value)} 
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-red-500/50" 
                  placeholder="e.g. 2014" 
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  <Star className="w-3.5 h-3.5" /> IMDb Rating
                </label>
                <input 
                  type="number"
                  step="0.1"
                  value={imdbRating} 
                  onChange={e => setImdbRating(e.target.value)} 
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-red-500/50" 
                  placeholder="e.g. 8.6" 
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Runtime (mins)
                </label>
                <input 
                  type="number"
                  value={runtime} 
                  onChange={e => setRuntime(e.target.value)} 
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-red-500/50" 
                  placeholder="e.g. 169" 
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5" /> Language
                </label>
                <input 
                  type="text"
                  value={language} 
                  onChange={e => setLanguage(e.target.value)} 
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-red-500/50" 
                  placeholder="e.g. English" 
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Country of Origin</label>
                <input 
                  type="text"
                  value={country} 
                  onChange={e => setCountry(e.target.value)} 
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-red-500/50" 
                  placeholder="e.g. United States, United Kingdom" 
                />
              </div>

              <div className="space-y-1.5 md:col-span-3">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">YouTube Trailer URL / Link</label>
                <input 
                  type="url"
                  value={trailerUrl} 
                  onChange={e => setTrailerUrl(e.target.value)} 
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-red-500/50" 
                  placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ" 
                />
              </div>
            </div>
          </div>

          {/* Section 2: Poster & Covers Graphic Uploads */}
          <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-bold border-b border-white/5 pb-2">2. Visual Assets & Media</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Poster Upload/URL */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Poster Image URL / File</label>
                <div className="flex flex-col gap-2 p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2">
                    <input 
                      type="file" 
                      accept="image/*" 
                      id="dialog-poster-upload"
                      onChange={e => handleFileUpload(e, setPosterUrl)} 
                      className="hidden" 
                    />
                    <label 
                      htmlFor="dialog-poster-upload"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/10 text-red-500 hover:bg-red-600/20 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" /> Upload File
                    </label>
                    <span className="text-[10px] text-zinc-500 font-mono">Accepts JPG/PNG</span>
                  </div>
                  <input 
                    type="text"
                    value={posterUrl}
                    onChange={e => setPosterUrl(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-red-500/50"
                    placeholder="Or enter image external link directly..."
                  />
                  {posterUrl && (
                    <div className="mt-1 flex items-center gap-2">
                      <div className="w-8 h-12 rounded overflow-hidden border border-white/10 bg-zinc-900">
                        <img src={posterUrl} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono truncate max-w-xs">{posterUrl}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Cover Upload/URL */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Backdrop / Hero Cover Image URL</label>
                <div className="flex flex-col gap-2 p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2">
                    <input 
                      type="file" 
                      accept="image/*" 
                      id="dialog-cover-upload"
                      onChange={e => handleFileUpload(e, setCoverUrl)} 
                      className="hidden" 
                    />
                    <label 
                      htmlFor="dialog-cover-upload"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/10 text-red-500 hover:bg-red-600/20 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" /> Upload File
                    </label>
                    <span className="text-[10px] text-zinc-500 font-mono">Accepts JPG/PNG</span>
                  </div>
                  <input 
                    type="text"
                    value={coverUrl}
                    onChange={e => setCoverUrl(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-red-500/50"
                    placeholder="Or enter cover backdrop link directly..."
                  />
                  {coverUrl && (
                    <div className="mt-1 flex items-center gap-2">
                      <div className="w-16 h-10 rounded overflow-hidden border border-white/10 bg-zinc-900">
                        <img src={coverUrl} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono truncate max-w-xs">{coverUrl}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Categories & Genres Tagging */}
          <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-bold border-b border-white/5 pb-2">3. Media Cataloging & Genres</h3>
            
            <div className="space-y-3">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">Select Genres / Tag Categories</span>
              
              {/* Existing Db Categories */}
              {categoriesLoading ? (
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <Loader2 className="w-4 h-4 animate-spin text-red-500" /> Loading database genres...
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {/* DB Category list */}
                  {dbCategories.map(cat => {
                    const isSelected = selectedCategoryIds.includes(cat.id);
                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => handleCategoryToggle(cat.id)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full cursor-pointer transition-all border ${
                          isSelected 
                            ? 'bg-red-500/15 border-red-500/40 text-red-400 font-semibold shadow-sm' 
                            : 'bg-white/5 border-white/5 text-zinc-400 hover:border-white/10 hover:text-zinc-200'
                        }`}
                      >
                        {cat.name}
                      </button>
                    );
                  })}
                  
                  {/* Prompt standard categories if none created or for fast adding */}
                  {DEFAULT_GENRES.map(genreName => {
                    // Skip showing standard genre if it exists as a db category to avoid redundancy
                    if (dbCategories.some(c => c.name.toLowerCase() === genreName.toLowerCase())) return null;
                    
                    const isSelected = customGenres.includes(genreName);
                    return (
                      <button
                        type="button"
                        key={genreName}
                        onClick={() => handleCustomGenreToggle(genreName)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full cursor-pointer transition-all border ${
                          isSelected
                            ? 'bg-red-500/15 border-red-500/40 text-red-400 font-semibold shadow-sm'
                            : 'bg-white/5 border-white/5 text-zinc-500 hover:border-white/10 hover:text-zinc-300'
                        }`}
                      >
                        + {genreName}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Dynamic Download Links */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-bold">4. Safe Download Links</h3>
              <button
                type="button"
                onClick={addDownloadLinkField}
                className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-400 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Path Line
              </button>
            </div>

            <div className="space-y-3">
              {downloadLinks.map((link, idx) => (
                <div key={idx} className="flex flex-col md:flex-row gap-3 p-3 bg-white/5 rounded-xl border border-white/5 items-stretch relative group">
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Host Server Name</label>
                    <select
                      value={link.server_name}
                      onChange={e => updateDownloadLinkField(idx, 'server_name', e.target.value)}
                      className="w-full bg-zinc-950 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-red-500/50"
                    >
                      <option value="Google Drive">Google Drive</option>
                      <option value="Mega">Mega</option>
                      <option value="MediaFire">MediaFire</option>
                      <option value="OneDrive">OneDrive</option>
                      <option value="Dropbox">Dropbox</option>
                      <option value="Direct Download">Direct Download</option>
                      <option value="Stream Link">Stream Link</option>
                      <option value="Torrent Magnet">Torrent Magnet</option>
                      <option value="Premium Mirror">Premium Mirror</option>
                    </select>
                  </div>

                  <div className="flex-[3] space-y-1">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Secured Download URL *</label>
                    <input
                      type="text"
                      required
                      value={link.url}
                      onChange={e => updateDownloadLinkField(idx, 'url', e.target.value)}
                      className="w-full bg-zinc-950 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-red-500/50"
                      placeholder="https://drive.google.com/..."
                    />
                  </div>

                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Quality</label>
                    <select
                      value={link.quality}
                      onChange={e => updateDownloadLinkField(idx, 'quality', e.target.value)}
                      className="w-full bg-zinc-950 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-red-500/50"
                    >
                      <option value="4K HDR">4K HDR</option>
                      <option value="2K QHD">2K QHD</option>
                      <option value="1080p BluRay">1080p BluRay</option>
                      <option value="1080p WEB-DL">1080p WEB-DL</option>
                      <option value="1080p HEVC">1080p HEVC</option>
                      <option value="720p WEB-DL">720p WEB-DL</option>
                      <option value="480p SD">480p SD</option>
                    </select>
                  </div>

                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Archive Size</label>
                    <input
                      type="text"
                      value={link.file_size}
                      onChange={e => updateDownloadLinkField(idx, 'file_size', e.target.value)}
                      className="w-full bg-zinc-950 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-red-500/50"
                      placeholder="e.g. 1.4 GB"
                    />
                  </div>

                  {downloadLinks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDownloadLinkField(idx)}
                      className="self-end mb-1 p-2 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Delete Download Path"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Config Checkboxes & Permissions */}
          <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-bold border-b border-white/5 pb-2">5. Privacy, Promotion, & Access</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <label className="flex items-center gap-3 p-3 border border-white/5 rounded-xl bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                <input 
                  type="checkbox" 
                  checked={published} 
                  onChange={e => setPublished(e.target.checked)} 
                  className="w-4 h-4 accent-red-600 rounded border-white/10 cursor-pointer" 
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">Publish Direct</span>
                  <span className="text-[10px] text-zinc-500">Live to catalog</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border border-white/5 rounded-xl bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                <input 
                  type="checkbox" 
                  checked={downloadEnabled} 
                  onChange={e => setDownloadEnabled(e.target.checked)} 
                  className="w-4 h-4 accent-red-600 rounded border-white/10 cursor-pointer" 
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">Enable Links</span>
                  <span className="text-[10px] text-zinc-500">Display download rows</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border border-white/5 rounded-xl bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                <input 
                  type="checkbox" 
                  checked={featured} 
                  onChange={e => setFeatured(e.target.checked)} 
                  className="w-4 h-4 accent-red-600 rounded border-white/10 cursor-pointer" 
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">Promo Featured</span>
                  <span className="text-[10px] text-zinc-500">Spotlight hero bar</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border border-white/5 rounded-xl bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                <input 
                  type="checkbox" 
                  checked={trending} 
                  onChange={e => setTrending(e.target.checked)} 
                  className="w-4 h-4 accent-red-600 rounded border-white/10 cursor-pointer" 
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">Trending Row</span>
                  <span className="text-[10px] text-zinc-500">High traffic spotlight</span>
                </div>
              </label>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/5 bg-zinc-950 flex justify-end gap-3 rounded-b-2xl">
          <Button 
            variant="outline" 
            type="button" 
            onClick={onClose} 
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading}
            className="gap-2 accent-glow"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" /> {movieToEdit ? 'Updating catalog entry...' : 'Saving catalog entry...'}
              </>
            ) : (
              <>
                <Check className="w-4 h-4" /> {movieToEdit ? 'Update Cinema Entry' : 'Save Cinema Entry'}
              </>
            )}
          </Button>
        </div>

      </div>
    </div>
  );
}
