import React, { useEffect, useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Search, 
  Film, 
  Check, 
  X,
  RefreshCw,
  Eye,
  EyeOff,
  Download,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import type { Movie } from '../../types/database.types';
import AddMovieDialog from '../../components/admin/AddMovieDialog';

export default function AdminMovies() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const fetchMovies = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('movies')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setMovies(data || []);
    } catch (err) {
      console.error('Error loading movies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovies();
  }, []);

  const handleTogglePublished = async (id: string, currentPublished: boolean) => {
    if (!supabase) return;
    setSyncingId(id);
    try {
      const nextVal = !currentPublished;
      const { error } = await supabase
        .from('movies')
        .update({ published: nextVal })
        .eq('id', id);

      if (error) throw error;
      
      // Live state update
      setMovies(prev => prev.map(m => m.id === id ? { ...m, published: nextVal } : m));
    } catch (err) {
      console.error('Error toggling publish state:', err);
    } finally {
      setSyncingId(null);
    }
  };

  const handleToggleDownloads = async (id: string, currentEnabled: boolean) => {
    if (!supabase) return;
    setSyncingId(id);
    try {
      const nextVal = !currentEnabled;
      const { error } = await supabase
        .from('movies')
        .update({ download_enabled: nextVal })
        .eq('id', id);

      if (error) throw error;
      
      // Live state update
      setMovies(prev => prev.map(m => m.id === id ? { ...m, download_enabled: nextVal } : m));
    } catch (err) {
      console.error('Error toggling downloads:', err);
    } finally {
      setSyncingId(null);
    }
  };

  const deleteMovie = async (id: string) => {
    if (!supabase || !confirm('Are you sure you want to permanently delete this movie listing along with its categories and links?')) return;
    await supabase.from('movies').delete().eq('id', id);
    setMovies(prev => prev.filter(m => m.id !== id));
  };

  const filteredMovies = movies.filter(movie => {
    return (
      movie.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (movie.release_year && String(movie.release_year).includes(searchQuery)) ||
      (movie.language && movie.language.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Page Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white mb-1">Cinematic Catalog</h2>
          <p className="text-sm text-zinc-400">Add detailed meta options, manage statuses, and track links live in real-time.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Search by title, year, or country..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-zinc-90 w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 sm:w-64"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchMovies}
              className="flex items-center justify-center p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all cursor-pointer"
              title="Refresh Catalog List"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Button onClick={() => setIsAdding(true)} className="gap-2 text-xs sm:text-sm font-bold flex-1 sm:flex-none">
              <Plus className="w-4 h-4" /> Add Movie
            </Button>
          </div>
        </div>
      </div>

      {/* Main Database Content View */}
      {loading ? (
        <div className="text-center py-16 text-zinc-500 font-mono text-xs">
          <Loader2 className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Synchronizing CineVault Directory...
        </div>
      ) : (
        <>
          {/* Desktop Table - Hidden on smaller screens */}
          <div className="glass rounded-xl overflow-hidden hidden lg:block">
            <table className="w-full text-left text-sm text-zinc-300 border-collapse">
              <thead className="bg-[#1D1D1F] border-b border-white/5 text-[10px] uppercase tracking-widest text-zinc-400 font-bold">
                <tr>
                  <th className="px-6 py-4">Cinematic Metadata</th>
                  <th className="px-6 py-4">Publish Status</th>
                  <th className="px-6 py-4">Download Access</th>
                  <th className="px-6 py-4">Uploade Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-black/20">
                {filteredMovies.length > 0 ? (
                  filteredMovies.map(movie => (
                    <tr key={movie.id} className="card-hover transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-14 bg-zinc-900 rounded overflow-hidden shrink-0 border border-white/5">
                            {movie.poster_url ? (
                              <img src={movie.poster_url} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                            ) : (
                              <Film className="w-5 h-5 m-2.5 text-zinc-600 mx-auto mt-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-zinc-200 block truncate max-w-[240px]">{movie.title}</span>
                            <span className="text-xs text-zinc-500 font-mono mt-0.5 inline-flex items-center gap-1">
                              {movie.release_year || 'Unknown Year'} • {movie.language || 'English'}
                              {movie.imdb_rating && <span className="text-amber-500 ml-1 font-bold">★ {movie.imdb_rating}</span>}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleTogglePublished(movie.id, movie.published)}
                          disabled={syncingId === movie.id}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-all border ${
                            movie.published 
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                              : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                          }`}
                        >
                          {movie.published ? (
                            <>
                              <Eye className="w-3.5 h-3.5" /> Published
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5" /> Draft/Hidden
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleDownloads(movie.id, movie.download_enabled)}
                          disabled={syncingId === movie.id}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-all border ${
                            movie.download_enabled 
                              ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' 
                              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                          }`}
                        >
                          <Download className="w-3.5 h-3.5" />
                          {movie.download_enabled ? 'Links Active' : 'Links Locked'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-zinc-500">
                        {new Date(movie.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => deleteMovie(movie.id)} 
                            className="p-2 text-rose-500 hover:text-rose-400 rounded-lg hover:bg-rose-950/20 border border-transparent hover:border-rose-500/10 transition-colors cursor-pointer"
                            title="Delete Catalog Content"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500 bg-black/5">
                      No movies found in database matching your searchQuery.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Responsive Mobile Layout (Card view block) - Shows on smaller screens */}
          <div className="lg:hidden space-y-4">
            {filteredMovies.length > 0 ? (
              filteredMovies.map(movie => (
                <div key={movie.id} className="p-4 bg-zinc-950 border border-white/5 rounded-xl space-y-3 relative card-hover overflow-hidden transition-all">
                  
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-16 bg-zinc-900 rounded overflow-hidden shrink-0 border border-white/5">
                      {movie.poster_url ? (
                        <img src={movie.poster_url} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <Film className="w-5 h-5 text-zinc-600 m-auto mt-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="text-zinc-500 text-[9px] uppercase font-mono block">Cinema entry</span>
                      <h4 className="font-bold text-zinc-200 text-sm truncate leading-tight">{movie.title}</h4>
                      <p className="text-xs text-zinc-500 font-mono mt-1">
                        Release: <span className="text-zinc-300 font-semibold">{movie.release_year || 'N/A'}</span>
                        {movie.imdb_rating && <span className="text-amber-500 ml-1.5">★ {movie.imdb_rating}</span>}
                      </p>
                    </div>
                  </div>

                  {/* Actions summary row */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-zinc-500 uppercase font-mono">Published Toggle</span>
                      <button
                        onClick={() => handleTogglePublished(movie.id, movie.published)}
                        disabled={syncingId === movie.id}
                        className={`px-2 py-1.5 rounded-lg text-xs font-semibold cursor-pointer text-center flex items-center justify-center gap-1 border ${
                          movie.published 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                            : 'bg-zinc-900 border-zinc-800 text-zinc-550'
                        }`}
                      >
                        {movie.published ? 'Live' : 'Hidden Draft'}
                      </button>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-zinc-500 uppercase font-mono">Downloads Row</span>
                      <button
                        onClick={() => handleToggleDownloads(movie.id, movie.download_enabled)}
                        disabled={syncingId === movie.id}
                        className={`px-2 py-1.5 rounded-lg text-xs font-semibold cursor-pointer text-center flex items-center justify-center gap-1 border ${
                          movie.download_enabled 
                            ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' 
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                        }`}
                      >
                        {movie.download_enabled ? 'Active Links' : 'Links Locked'}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-zinc-550">
                    <span className="text-[10px] text-zinc-600 font-mono">Created {new Date(movie.created_at).toLocaleDateString()}</span>
                    
                    <button 
                      onClick={() => deleteMovie(movie.id)}
                      className="px-2.5 py-1.5 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 font-bold border border-rose-500/20 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Erase Entry
                    </button>
                  </div>

                </div>
              ))
            ) : (
              <div className="text-center py-10 text-sm text-zinc-500">
                No catalog entries match criteria filters.
              </div>
            )}
          </div>
        </>
      )}

      {/* Dynamic add dialog */}
      <AddMovieDialog 
        isOpen={isAdding} 
        onClose={() => setIsAdding(false)} 
        onSuccess={fetchMovies} 
      />
    </div>
  );
}
