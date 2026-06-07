import { useEffect, useState } from 'react';
import { 
  Activity, 
  Download, 
  Film, 
  HardDrive, 
  Users, 
  ShieldAlert, 
  Calendar, 
  Tv, 
  Link2,
  RefreshCw 
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';

interface DashboardStats {
  movies: number;
  users: number;
  downloads: number;
  storage: string;
  uptime: number;
}

interface IngestedMovie {
  id: string;
  title: string;
  poster_url: string | null;
  release_year: number | null;
  imdb_rating: number | null;
  created_at: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    movies: 0,
    users: 0,
    downloads: 0,
    storage: '0 GB',
    uptime: 100
  });
  const [recentMovies, setRecentMovies] = useState<IngestedMovie[]>([]);
  const [linkMetrics, setLinkMetrics] = useState({
    driveProgress: 100,
    megaProgress: 100,
    mediafireProgress: 100,
    totalCount: 0,
    brokenCount: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      // 1. Core aggregates
      const { count: movies } = await supabase.from('movies').select('*', { count: 'exact', head: true });
      const { count: users } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      
      // Calculate total mirror clicks
      const { data: linksData } = await supabase.from('download_links').select('clicks, status, server_name');
      
      let totalClicks = 0;
      let driveTotal = 0;
      let driveBroken = 0;
      let megaTotal = 0;
      let megaBroken = 0;
      let mfTotal = 0;
      let mfBroken = 0;
      let brokenSum = 0;

      if (linksData) {
        linksData.forEach(link => {
          totalClicks += link.clicks || 0;
          const isBroken = link.status === 'broken';
          if (isBroken) brokenSum++;

          const name = (link.server_name || '').toLowerCase();
          if (name.includes('drive')) {
            driveTotal++;
            if (isBroken) driveBroken++;
          } else if (name.includes('mega')) {
            megaTotal++;
            if (isBroken) megaBroken++;
          } else if (name.includes('mediafire') || name.includes('fire')) {
            mfTotal++;
            if (isBroken) mfBroken++;
          }
        });
      }

      // Compute dynamic percentages
      const getPct = (total: number, broken: number) => {
        if (total === 0) return 100;
        return Math.max(0, Math.min(100, Math.round(((total - broken) / total) * 100)));
      };

      const driveProgress = getPct(driveTotal, driveBroken);
      const megaProgress = getPct(megaTotal, megaBroken);
      const mediafireProgress = getPct(mfTotal, mfBroken);

      const totalLinks = linksData?.length || 0;
      const uptime = totalLinks > 0 ? getPct(totalLinks, brokenSum) : 100;

      // Real storage used estimate (Assume average of 1.4 GB archive payload per registered catalog item)
      const estimatedSizeGB = Math.round((movies || 0) * 1.4 * 10) / 10;
      const storageStr = estimatedSizeGB > 1024 
        ? `${(estimatedSizeGB / 1024).toFixed(1)} TB` 
        : `${estimatedSizeGB} GB`;

      setStats({
        movies: movies || 0,
        users: users || 0,
        downloads: totalClicks,
        storage: storageStr,
        uptime
      });

      setLinkMetrics({
        driveProgress,
        megaProgress,
        mediafireProgress,
        totalCount: totalLinks,
        brokenCount: brokenSum
      });

      // 2. Fetch actual latest movies
      const { data: fetchedMovies } = await supabase
        .from('movies')
        .select('id, title, poster_url, release_year, imdb_rating, created_at')
        .order('created_at', { ascending: false })
        .limit(4);

      setRecentMovies((fetchedMovies as any) || []);

    } catch (err) {
      console.error('Error compiling dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white mb-1">Operational Overview</h2>
          <p className="text-sm text-zinc-400">Welcome to the CineVault administrative control center.</p>
        </div>
        <button 
          onClick={fetchDashboardData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 text-xs text-zinc-300 font-semibold rounded-lg border border-white/5 transition-all self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Reload Analytics
        </button>
      </div>

      {/* KPI Cards (Fully adaptive layouts) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Movies', value: stats.movies.toLocaleString(), icon: Film, trend: 'Catalog items live', color: 'text-red-500', bg: 'bg-red-500/10' },
          { label: 'Total Users', value: stats.users.toLocaleString(), icon: Users, trend: 'Registered profiles', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
          { label: 'Mirror Clicks', value: stats.downloads.toLocaleString(), icon: Download, trend: 'Hits tracked', color: 'text-sky-400', bg: 'bg-sky-400/10' },
          { label: 'Payload Storage', value: stats.storage, icon: HardDrive, trend: 'Estimated archive', color: 'text-amber-400', bg: 'bg-amber-400/10' }
        ].map((stat, i) => (
          <div key={i} className="glass card-hover rounded-xl p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-zinc-500 font-medium mb-1">{stat.label}</p>
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-tight">{stat.value}</h3>
              </div>
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center ${stat.bg} ${stat.color} shrink-0`}>
                <stat.icon className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <p className="text-[10px] font-mono text-zinc-400 flex items-center gap-1 mt-4 pt-2 border-t border-white/5">
              <Activity className="w-3 h-3" /> {stat.trend}
            </p>
          </div>
        ))}
      </div>

      {/* Recent Activity / System Integrity Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        
        {/* Real Dynamic Recent Ingests */}
        <div className="lg:col-span-2 glass rounded-xl overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/5">
              <h3 className="font-semibold text-sm tracking-wide text-zinc-200">Recent Movie Ingests</h3>
              <Link to="/admin/movies" className="text-xs font-semibold text-red-500 hover:text-red-400 transition-colors">
                Manage Catalog
              </Link>
            </div>
            <div className="divide-y divide-white/5">
              {loading ? (
                // Skeletons
                [1, 2, 3].map((_, idx) => (
                  <div key={idx} className="px-6 py-4 flex items-center gap-4 animate-pulse">
                    <div className="w-8 h-12 bg-zinc-900 rounded shrink-0 border border-white/5"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-zinc-800 rounded w-1/3"></div>
                      <div className="h-2.5 bg-zinc-900 rounded w-1/4"></div>
                    </div>
                  </div>
                ))
              ) : recentMovies.length > 0 ? (
                recentMovies.map(movie => (
                  <div key={movie.id} className="px-6 py-4 flex items-center justify-between gap-4 card-hover transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      {movie.poster_url ? (
                        <div className="w-8 h-12 bg-zinc-900 rounded overflow-hidden flex-shrink-0 border border-white/10">
                          <img src={movie.poster_url} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <div className="w-8 h-12 bg-zinc-900 rounded flex items-center justify-center flex-shrink-0 border border-white/5 text-zinc-600">
                          <Film className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-zinc-300 truncate">{movie.title}</h4>
                        <p className="text-xs text-zinc-500 font-mono mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-zinc-600" /> {movie.release_year || 'Unknown Year'} 
                          {movie.imdb_rating && <span className="text-amber-500 font-bold ml-1">★ {movie.imdb_rating}</span>}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono shrink-0 hidden sm:inline">
                      Added: {new Date(movie.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))
              ) : (
                <div className="px-6 py-12 text-center text-sm text-zinc-500 font-sans">
                  No cinema catalog entries found. Go add some!
                </div>
              )}
            </div>
          </div>

          <div className="p-4 bg-white/[0.01] border-t border-white/5 px-6 flex justify-between items-center text-xs">
            <span className="text-zinc-500">Awaiting automatic scraper nodes...</span>
            <span className="text-emerald-500 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span> Sync Active
            </span>
          </div>
        </div>

        {/* Global Link Health Breakdown */}
        <div className="glass rounded-xl overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-6 py-4 border-b border-white/5 bg-white/5">
              <h3 className="font-semibold text-zinc-200 text-sm tracking-wide">Dynamic Link Health</h3>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400 font-semibold">Google Drive Mirrors</span>
                  <span className="text-emerald-400 font-mono font-bold">{linkMetrics.driveProgress}% Live</span>
                </div>
                <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${linkMetrics.driveProgress}%` }}></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400 font-semibold">Mega.nz Host</span>
                  <span className="text-amber-400 font-mono font-bold">{linkMetrics.megaProgress}% Live</span>
                </div>
                <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${linkMetrics.megaProgress}%` }}></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400 font-semibold">Mediafire Cloud</span>
                  <span className="text-rose-400 font-mono font-bold">{linkMetrics.mediafireProgress}% Live</span>
                </div>
                <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${linkMetrics.mediafireProgress}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-zinc-950 border-t border-white/5 mx-2 my-2 rounded-lg flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="flex items-center gap-1 font-mono text-[10px]">
                <Link2 className="w-3.5 h-3.5 text-zinc-600" /> Mirrors Registered:
              </span>
              <span className="text-zinc-200 font-mono font-bold">{linkMetrics.totalCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="flex items-center gap-1 font-mono text-[10px]">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-500/80" /> Critical Failures:
              </span>
              <span className={`font-mono font-bold ${linkMetrics.brokenCount > 0 ? 'text-rose-500 animate-pulse' : 'text-zinc-400'}`}>
                {linkMetrics.brokenCount}
              </span>
            </div>
            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400">
              <span>Weighted Index:</span>
              <span className="text-emerald-400 font-bold">{stats.uptime}% Uptime</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
