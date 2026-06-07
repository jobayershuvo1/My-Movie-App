import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Film, Star, Search, SlidersHorizontal, RefreshCw, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Movie, Category } from '../../types/database.types';

export default function Movies() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movieCategories, setMovieCategories] = useState<{ movie_id: string; category_id: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [selectedYearRange, setSelectedYearRange] = useState('All');
  const [minImdbRating, setMinImdbRating] = useState('All');
  const [sortBy, setSortBy] = useState('latest');
  const [selectedCategoryId, setSelectedCategoryId] = useState('All');

  useEffect(() => {
    const fetchMovies = async () => {
      if (!supabase) return;
      setLoading(true);
      try {
        const { data: moviesData } = await supabase
          .from('movies')
          .select('*')
          .eq('published', true)
          .order('created_at', { ascending: false });
          
        if (moviesData) setMovies(moviesData);

        const { data: categoriesData } = await supabase
          .from('categories')
          .select('*');

        if (categoriesData) setCategories(categoriesData);

        const { data: movieCategoriesData } = await supabase
          .from('movie_categories')
          .select('*');

        if (movieCategoriesData) setMovieCategories(movieCategoriesData);
      } catch (err) {
        console.error('Error fetching movies and genres:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMovies();
  }, []);

  // Dynamically calculate category counts for existing movies
  const categoryCounts = categories.reduce((acc, cat) => {
    const linkedMovieIds = movieCategories
      .filter((mc) => mc.category_id === cat.id)
      .map((mc) => mc.movie_id);
    const count = movies.filter((m) => linkedMovieIds.includes(m.id)).length;
    acc[cat.id] = count;
    return acc;
  }, {} as Record<string, number>);

  const sortedCategories = [...categories].sort((a, b) => {
    const countA = categoryCounts[a.id] || 0;
    const countB = categoryCounts[b.id] || 0;
    if (countB !== countA) return countB - countA;
    return a.name.localeCompare(b.name);
  });

  // Dynamically extract values for filters
  const languages = ['All', ...Array.from(new Set(movies.map((m) => m.language || '').filter(Boolean)))];

  const yearRanges = [
    { label: 'All Years', value: 'All' },
    { label: '2025 & Newer', value: '2025+' },
    { label: '2020 - 2024', value: '2020-2024' },
    { label: '2015 - 2019', value: '2015-2019' },
    { label: 'Before 2015', value: 'older' }
  ];

  const ratingsChoices = [
    { label: 'All Ratings', value: 'All' },
    { label: '8.0+ Premium', value: '8' },
    { label: '7.0+ Recommended', value: '7' },
    { label: '6.0+ High Quality', value: '6' }
  ];

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedLanguage('All');
    setSelectedYearRange('All');
    setMinImdbRating('All');
    setSortBy('latest');
    setSelectedCategoryId('All');
  };

  // Filter & Sort Logic Client-side for instant responsive typing experience
  const filteredMovies = movies.filter((movie) => {
    // 0. Category Filter
    if (selectedCategoryId !== 'All') {
      const linkedCatIds = movieCategories
        .filter((mc) => mc.movie_id === movie.id)
        .map((mc) => mc.category_id);
      if (!linkedCatIds.includes(selectedCategoryId)) return false;
    }

    // 1. Search Query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchTitle = movie.title.toLowerCase().includes(q);
      const matchDesc = (movie.description || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }

    // 2. Language
    if (selectedLanguage !== 'All') {
      if (movie.language !== selectedLanguage) return false;
    }

    // 3. Year limits
    if (selectedYearRange !== 'All') {
      const year = movie.release_year || 0;
      if (selectedYearRange === '2025+') {
        if (year < 2025) return false;
      } else if (selectedYearRange === '2020-2024') {
        if (year < 2020 || year > 2024) return false;
      } else if (selectedYearRange === '2015-2019') {
        if (year < 2015 || year > 2019) return false;
      } else if (selectedYearRange === 'older') {
        if (year >= 2015) return false;
      }
    }

    // 4. IMDb Rating
    if (minImdbRating !== 'All') {
      const rating = movie.imdb_rating || 0;
      const targetRating = parseFloat(minImdbRating);
      if (rating < targetRating) return false;
    }

    return true;
  }).sort((a, b) => {
    if (sortBy === 'latest') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    if (sortBy === 'rating') {
      return (b.imdb_rating || 0) - (a.imdb_rating || 0);
    }
    if (sortBy === 'year-desc') {
      return (b.release_year || 0) - (a.release_year || 0);
    }
    if (sortBy === 'year-asc') {
      return (a.release_year || 0) - (b.release_year || 0);
    }
    if (sortBy === 'title') {
      return a.title.localeCompare(b.title);
    }
    return 0;
  });

  return (
    <div className="flex-1 w-full bg-[#050505] min-h-screen pb-20">
      <div className="max-w-7xl mx-auto px-4 py-16 space-y-10">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
              Cinema Catalogue
            </h1>
            <p className="text-sm text-zinc-400">
              Browse, filter, and instantly locate premium physical and digital movie copy releases.
            </p>
          </div>
          <span className="inline-flex h-fit bg-red-600/10 text-red-500 text-xs font-mono font-bold tracking-wider px-3.5 py-1.5 rounded-full border border-red-500/10 uppercase">
            Total Available: {filteredMovies.length} Titles
          </span>
        </div>

        {/* Live Filter Control Panel Box */}
        <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <SlidersHorizontal className="w-4 h-4 text-red-500" />
            <span>Search & Advanced Filters</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            
            {/* 1. Search query bar */}
            <div className="relative group">
              <span className="block text-[10px] font-mono text-zinc-500 uppercase mb-1.5 tracking-wider">Search Name</span>
              <div className="relative">
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type film name..."
                  className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-700 focus:border-red-500 rounded-xl py-2 px-3 pl-9 text-xs text-white placeholder-zinc-600 focus:outline-none transition-all font-medium"
                />
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer hover:bg-zinc-800 p-0.5 rounded">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* 2. Language dropdown */}
            <div>
              <span className="block text-[10px] font-mono text-zinc-500 uppercase mb-1.5 tracking-wider">Language</span>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-700 focus:border-red-500 rounded-xl py-2 px-3 text-xs text-zinc-300 focus:outline-none transition-all font-medium cursor-pointer"
              >
                {languages.map((lang) => (
                  <option key={lang} value={lang}>{lang === 'All' ? 'All Languages' : lang}</option>
                ))}
              </select>
            </div>

            {/* 3. Year Range Dropdown */}
            <div>
              <span className="block text-[10px] font-mono text-zinc-500 uppercase mb-1.5 tracking-wider">Release Era</span>
              <select
                value={selectedYearRange}
                onChange={(e) => setSelectedYearRange(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-700 focus:border-red-500 rounded-xl py-2 px-3 text-xs text-zinc-300 focus:outline-none transition-all font-medium cursor-pointer"
              >
                {yearRanges.map((yr) => (
                  <option key={yr.value} value={yr.value}>{yr.label}</option>
                ))}
              </select>
            </div>

            {/* 4. IMDb Rating Filter */}
            <div>
              <span className="block text-[10px] font-mono text-zinc-500 uppercase mb-1.5 tracking-wider">IMDb Score</span>
              <select
                value={minImdbRating}
                onChange={(e) => setMinImdbRating(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-700 focus:border-red-500 rounded-xl py-2 px-3 text-xs text-zinc-300 focus:outline-none transition-all font-medium cursor-pointer"
              >
                {ratingsChoices.map((rt) => (
                  <option key={rt.value} value={rt.value}>{rt.label}</option>
                ))}
              </select>
            </div>

            {/* 5. Sort Dropdown */}
            <div>
              <span className="block text-[10px] font-mono text-zinc-500 uppercase mb-1.5 tracking-wider">Sort Order</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-700 focus:border-red-500 rounded-xl py-2 px-3 text-xs text-zinc-300 focus:outline-none transition-all font-medium cursor-pointer animate-none"
              >
                <option value="latest">Latest Uploads</option>
                <option value="rating">IMDb Rating (High-Low)</option>
                <option value="year-desc">Year (Recent First)</option>
                <option value="year-asc">Year (Oldest First)</option>
                <option value="title">Title (A-Z)</option>
              </select>
            </div>

          </div>

          {/* Reset Filters Quick Button */}
          {(searchQuery || selectedLanguage !== 'All' || selectedYearRange !== 'All' || minImdbRating !== 'All' || sortBy !== 'latest' || selectedCategoryId !== 'All') && (
            <div className="flex items-center justify-end border-t border-white/5 pt-4">
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1.5 text-zinc-500 hover:text-red-400 text-xs font-mono uppercase tracking-wider cursor-pointer bg-zinc-950/40 hover:bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-850 hover:border-red-950 transition-all font-semibold"
              >
                <RefreshCw className="w-3 h-3 animate-spin duration-[4000ms]" />
                Reset Filter Values
              </button>
            </div>
          )}
        </div>

        {/* Dynamic Category Sidebar & Movies Listing Wrapper */}
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          
          {/* Sidebar Area */}
          <div className="w-full lg:w-64 shrink-0 space-y-6">
            
            {/* Desktop Sidebar (Sticky placement) */}
            <div className="hidden lg:block sticky top-24 space-y-4 w-full">
              <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 space-y-4 backdrop-blur-md">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <span className="text-xs font-mono uppercase text-zinc-400 font-bold tracking-widest">
                    Categories
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500 font-bold">
                    {categories.length} GENRES
                  </span>
                </div>
                
                <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                  <button
                    onClick={() => setSelectedCategoryId('All')}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium font-mono text-left transition-all duration-300 cursor-pointer ${
                      selectedCategoryId === 'All'
                        ? 'bg-red-650 text-white font-bold shadow-lg shadow-red-650/10'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/5'
                    }`}
                  >
                    <span className="truncate">All Genres / Categories</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] ${selectedCategoryId === 'All' ? 'bg-black/20 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                      {movies.length}
                    </span>
                  </button>

                  {sortedCategories.map((cat) => {
                    const count = categoryCounts[cat.id] || 0;
                    const isActive = selectedCategoryId === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategoryId(cat.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium font-mono text-left transition-all duration-300 cursor-pointer ${
                          isActive
                            ? 'bg-red-650 text-white font-bold shadow-lg shadow-red-650/10'
                            : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/5'
                        }`}
                      >
                        <span className="truncate">{cat.name}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] ${isActive ? 'bg-black/20 text-white' : 'bg-zinc-850 text-zinc-500'}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Mobile Horizonally Scrollable Genre Badges */}
            <div className="block lg:hidden w-full">
              <span className="block text-[10px] font-mono text-zinc-500 uppercase mb-2 tracking-wider">Quick Genre Select</span>
              <div className="flex gap-2.5 overflow-x-auto pb-3 pr-4 no-scrollbar scroll-smooth snap-x text-xs">
                <button
                  onClick={() => setSelectedCategoryId('All')}
                  className={`px-4 py-2 rounded-full text-xs font-semibold font-mono whitespace-nowrap snap-align-start cursor-pointer transition-all duration-300 ${
                    selectedCategoryId === 'All'
                      ? 'bg-red-650 text-white shadow-md'
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-400'
                  }`}
                >
                  All ({movies.length})
                </button>
                {sortedCategories.map((cat) => {
                  const count = categoryCounts[cat.id] || 0;
                  const isActive = selectedCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={`px-4 py-2 rounded-full text-xs font-semibold font-mono whitespace-nowrap snap-align-start cursor-pointer transition-all duration-300 ${
                        isActive
                          ? 'bg-red-650 text-white shadow-md'
                          : 'bg-zinc-900 border border-zinc-800 text-zinc-400'
                      }`}
                    >
                      {cat.name} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Right Column: Dynamic filtered movie lists */}
          <div className="flex-1 w-full space-y-6">
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="space-y-3">
                    <div className="aspect-[2/3] rounded-lg overflow-hidden glass animate-pulse"></div>
                    <div className="space-y-1">
                      <div className="h-4 w-3/4 bg-white/10 rounded animate-pulse"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredMovies.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 pt-0">
                {filteredMovies.map((movie) => (
                  <Link key={movie.id} to={`/movie/${movie.id}`} className="space-y-3 group block">
                    <div className="aspect-[2/3] rounded-lg overflow-hidden glass relative">
                      {movie.poster_url ? (
                        <img 
                          src={movie.poster_url} 
                          alt={movie.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col justify-center items-center p-4 text-center">
                          <Film className="w-8 h-8 text-zinc-700 mb-2" />
                          <span className="text-xs text-zinc-600 font-medium font-mono">NO POSTER</span>
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
              <div className="py-24 flex flex-col items-center justify-center text-center space-y-4 bg-zinc-900/10 border border-white/5 rounded-3xl p-8">
                <div className="w-16 h-16 glass border border-white/5 rounded-2xl flex items-center justify-center">
                  <Film className="w-7 h-7 text-zinc-600" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-bold text-zinc-300">No Movies Found</p>
                  <p className="text-sm text-zinc-500 max-w-md mx-auto">No published titles match your requested queries. Try clearing the search query, changing category, or resetting active filters.</p>
                </div>
                <button
                  onClick={handleResetFilters}
                  className="mt-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:text-white text-zinc-400 px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase transition-all"
                >
                  Reset Filters
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
