import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, TrendingUp, Download, Star, Film, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Movie } from '../../types/database.types';

export default function Home() {
  const [featured, setFeatured] = useState<Movie[]>([]);
  const [latest, setLatest] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSlide, setActiveSlide] = useState(0);
  
  useEffect(() => {
    // Attempt to load mock or real data
    const fetchMovies = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }
      
      try {
        const { data: featuredData } = await supabase
          .from('movies')
          .select('*')
          .eq('published', true)
          .order('created_at', { ascending: false })
          .limit(5);
          
        if (featuredData) setFeatured(featuredData);

        const { data: latestData } = await supabase
          .from('movies')
          .select('*')
          .eq('published', true)
          .order('created_at', { ascending: false })
          .limit(12);
          
        if (latestData) setLatest(latestData);
      } catch (err) {
        console.error('Error fetching movies:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMovies();
  }, []);

  const slides = featured.length > 0 ? featured : latest.slice(0, 5);

  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [slides.length]);

  const handleNextSlide = () => {
    setActiveSlide((prev) => (prev + 1) % slides.length);
  };

  const handlePrevSlide = () => {
    setActiveSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const currentHero = slides[activeSlide];

  return (
    <div className="flex-1 w-full bg-[#050505]">
      {/* Hero Banner Slider */}
      {currentHero ? (
        <div className="relative w-full h-[70vh] md:h-[80vh] bg-[#050505] border-b border-white/5 group">
          <div className="absolute inset-0 transition-all duration-700 ease-in-out">
            <img 
              src={currentHero.cover_url || currentHero.poster_url || ''} 
              alt={currentHero.title}
              className="w-full h-full object-cover opacity-40 mix-blend-overlay transition-opacity duration-1000"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.src = "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1200&auto=format&fit=crop";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/60 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/80 to-transparent"></div>
          </div>

          <div className="relative h-full max-w-7xl mx-auto px-4 flex flex-col justify-center pb-12">
            <div className="max-w-2xl space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-600/10 text-red-500 rounded-full text-xs font-semibold tracking-wider font-mono">
                <TrendingUp className="w-3.5 h-3.5" />
                #SLIDESHOW FEATURED
              </div>
              
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white transition-all duration-500 ease-out">
                {currentHero.title}
              </h1>
              
              <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-zinc-300">
                <span className="flex items-center gap-1 text-yellow-500">
                  <Star className="w-4 h-4 fill-current" />
                  {currentHero.imdb_rating} IMDb
                </span>
                <span>{currentHero.release_year}</span>
                <span className="px-1.5 py-0.5 border border-zinc-700 rounded text-xs text-zinc-400">4K HDR</span>
              </div>

              <p className="text-lg text-zinc-400 leading-relaxed line-clamp-3">
                {currentHero.description || "Experience the highest quality cinematic releases with resume support and active mirrors."}
              </p>

              <div className="flex items-center gap-4 pt-4">
                <Link to={`/movie/${currentHero.id}`} className="bg-red-600 hover:bg-red-700 text-white px-8 py-3.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-2 accent-glow">
                  <Download className="w-5 h-5" />
                  Download Options
                </Link>
              </div>
            </div>
          </div>

          {/* Slider Arrows */}
          {slides.length > 1 && (
            <>
              <button 
                onClick={handlePrevSlide}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-red-600 border border-white/10 hover:border-red-500 text-white rounded-full transition-all focus:outline-none opacity-0 group-hover:opacity-100 cursor-pointer"
                aria-label="Previous Slide"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={handleNextSlide}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-red-600 border border-white/10 hover:border-red-500 text-white rounded-full transition-all focus:outline-none opacity-0 group-hover:opacity-100 cursor-pointer"
                aria-label="Next Slide"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Slide Indicator Dots */}
          {slides.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2.5">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveSlide(idx)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    activeSlide === idx ? 'w-8 bg-red-600' : 'w-2 bg-zinc-650 hover:bg-zinc-400'
                  }`}
                  title={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="relative w-full h-[70vh] md:h-[80vh] bg-[#050505] border-b border-white/5 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Film className="w-16 h-16 text-zinc-800 mx-auto" />
            <h1 className="text-3xl font-bold text-zinc-600">No Movies Available</h1>
            <p className="text-zinc-500">Configure your database or check back later.</p>
          </div>
        </div>
      )}

      {/* Latest Uploads Section */}
      <div className="max-w-7xl mx-auto px-4 py-16 space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight text-white">Latest Added</h2>
          <Link to="/movies" className="text-sm font-medium text-red-500 hover:text-red-400">View All</Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6">
          {loading ? (
            // Mock placeholders for loading state
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3 group cursor-pointer">
                <div className="aspect-[2/3] rounded-lg overflow-hidden bg-zinc-850 relative z-0">
                  <div className="absolute inset-0 bg-zinc-900/80 animate-pulse"></div>
                </div>
                <div className="space-y-1">
                  <div className="h-4 w-3/4 bg-zinc-800 rounded animate-pulse"></div>
                  <div className="h-3 w-1/4 bg-zinc-800 rounded animate-pulse"></div>
                </div>
              </div>
            ))
          ) : latest.length > 0 ? (
            latest.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))
          ) : (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-center space-y-3 bg-zinc-900/20 border border-white/5 rounded-2xl p-6">
              <Film className="w-8 h-8 text-zinc-700 animate-pulse" />
              <p className="text-zinc-300 text-sm font-medium">No movies uploaded yet</p>
              <p className="text-xs text-zinc-500">Go to Admin CMS to upload your favorite titles and start downloading!</p>
            </div>
          )}
        </div>
      </div>

      {/* Requests Callout Section */}
      <div className="max-w-7xl mx-auto px-4 pb-20">
        <div className="relative rounded-2xl overflow-hidden glass border border-white/5 p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-6 bg-gradient-to-r from-red-950/20 to-zinc-950">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="text-2xl font-bold tracking-tight text-white">Can't find your favorite movie?</h3>
            <p className="text-zinc-400 max-w-xl text-sm leading-relaxed">
              Normal users and guests can request any movie or web series. Our team of moderators and editors will find and upload it for you with ultra high quality download links as soon as possible!
            </p>
          </div>
          <Link 
            to="/requests" 
            className="shrink-0 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-red-600/10 cursor-pointer text-sm"
          >
            Request a Movie Now
          </Link>
        </div>
      </div>
    </div>
  );
}

const MovieCard: React.FC<{ movie: Movie }> = ({ movie }) => {
  return (
    <Link to={`/movie/${movie.id}`} className="space-y-3 group block">
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
  );
}
