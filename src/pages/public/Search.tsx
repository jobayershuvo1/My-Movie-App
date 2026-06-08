import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Film, Star, Search as SearchIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Movie } from '../../types/database.types';

export default function Search() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const performSearch = async () => {
      if (!supabase || !query) return;
      
      setLoading(true);
      const { data } = await supabase
        .from('movies')
        .select('*')
        .eq('published', true)
        .ilike('title', `%${query}%`)
        .order('created_at', { ascending: false });
        
      if (data) setResults(data);
      setLoading(false);
    };

    performSearch();
  }, [query]);

  return (
    <div className="flex-1 w-full bg-[#050505] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-16 space-y-8">
        <div className="flex items-center gap-4 border-b border-white/5 pb-8 mb-8">
          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-zinc-400">
            <SearchIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-1">
              Search Results
            </h1>
            <p className="text-sm text-zinc-400">
              {loading 
                ? `Searching for "${query}"...` 
                : `Found ${results.length} result(s) for "${query}"`}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="aspect-[2/3] rounded-lg overflow-hidden glass animate-pulse"></div>
                <div className="space-y-1">
                  <div className="h-4 w-3/4 bg-white/10 rounded animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        ) : results.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6">
            {results.map((movie) => (
              <Link key={movie.id} to={`/movie/${movie.id}`} className="space-y-3 group block">
                <div className="aspect-[2/3] rounded-lg overflow-hidden glass relative">
                  {movie.poster_url ? (
                    <img 
                      src={movie.poster_url} 
                      alt={movie.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.src = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600&auto=format&fit=crop";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col justify-center items-center p-4 text-center">
                      <Film className="w-8 h-8 text-zinc-700 mb-2" />
                      <span className="text-xs text-zinc-600 font-medium">NO POSTER</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050505]/90 via-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm text-zinc-200 group-hover:text-red-400 transition-colors truncate">
                    {movie.title}
                  </h3>
                  <div className="flex items-center justify-between text-xs font-mono text-zinc-500">
                    <span>{movie.release_year || 'TBA'}</span>
                    <span className="flex items-center gap-1 text-yellow-600">
                      <Star className="w-3 h-3 fill-current" />
                      {movie.imdb_rating || 'N/A'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-16 h-16 glass rounded-full flex items-center justify-center">
              <SearchIcon className="w-8 h-8 text-zinc-600" />
            </div>
            <div className="space-y-2">
              <p className="text-xl font-medium text-zinc-300">No movies found matching "{query}"</p>
              <p className="text-sm text-zinc-550 max-w-md mx-auto leading-relaxed">
                We couldn't find any results for your query. But don't worry! Normal users can request movie uploads anytime.
              </p>
            </div>
            <Link 
              to="/requests" 
              className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors inline-flex items-center gap-2"
            >
              Request "{query}" Now
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
