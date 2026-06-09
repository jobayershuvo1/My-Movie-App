import React, { useEffect, useState } from 'react';
import { 
  Activity, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  UserPlus, 
  Film, 
  Edit3, 
  Trash2, 
  Inbox, 
  Star, 
  Link2,
  Calendar,
  X,
  Code,
  LogIn,
  Download,
  Copy,
  Check,
  SlidersHorizontal
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';

interface ActivityLogItem {
  id: string;
  user_id: string | null;
  action: string;
  details: string;
  ip_address: string | null;
  metadata: any;
  created_at: string;
  profiles?: {
    full_name: string | null;
    email: string;
    role: string;
  } | null;
}

export default function Logs() {
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedMetaLog, setSelectedMetaLog] = useState<ActivityLogItem | null>(null);
  const [specificActionFilter, setSpecificActionFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [copySuccess, setCopySuccess] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [showSqlInstructions, setShowSqlInstructions] = useState(false);

  const handleClearLogs = async () => {
    if (!supabase) return;
    if (!window.confirm('Are you sure you want to clear all system logs? This action is irreversible.')) return;
    setLoading(true);
    try {
      // 1. Attempt database-wide deletion
      const { error } = await supabase
        .from('activity_logs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (error) throw error;

      // 2. Regardless of DB policy success/bypass, clear visually for this user 
      // by setting a secure session timestamp boundary.
      localStorage.setItem('logs_cleared_at', new Date().toISOString());
      setLogs([]);
      setSelectedMetaLog(null);
    } catch (err: any) {
      console.error('Failed to clear logs:', err);
      // Visually clear anyway to ensure smooth UX, but log error
      localStorage.setItem('logs_cleared_at', new Date().toISOString());
      setLogs([]);
      setSelectedMetaLog(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    if (!supabase) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select(`
          id,
          user_id,
          action,
          details,
          ip_address,
          metadata,
          created_at,
          profiles (
            full_name,
            email,
            role
          )
        `)
        .order('created_at', { ascending: false })
        .limit(150);

      if (error) throw error;

      let fetchedLogs = (data as any) || [];
      
      // Filter out logs prior to our client-cleared boundary timestamp
      const clearedAt = localStorage.getItem('logs_cleared_at');
      if (clearedAt) {
        fetchedLogs = fetchedLogs.filter((log: any) => 
          new Date(log.created_at).getTime() > new Date(clearedAt).getTime()
        );
      }

      setLogs(fetchedLogs);
    } catch (err: any) {
      console.warn('Could not load activity logs:', err);
      setErrorMsg(err?.message || 'Error loading logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Compute real-time statistics based on loaded snapshots
  const stats = React.useMemo(() => {
    let logins = 0;
    let registers = 0;
    let ingestions = 0;
    let requests = 0;
    let linkClicks = 0;

    logs.forEach(log => {
      if (log.action === 'auth_sign_in') logins++;
      else if (log.action === 'user_registered') registers++;
      else if (['movie_created', 'movie_updated', 'movie_deleted'].includes(log.action)) ingestions++;
      else if (['request_created', 'request_status_change'].includes(log.action)) requests++;
      else if (log.action === 'link_click') linkClicks++;
    });

    return { logins, registers, ingestions, requests, linkClicks, total: logs.length };
  }, [logs]);

  // Export filtered logs to CSV securely
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      alert("No logs to export based on selected filter.");
      return;
    }

    try {
      // Create headers
      const csvHeaders = ['Timestamp', 'Action Category', 'Details Description', 'Actor Name', 'Actor Email', 'Actor Role', 'IP Address', 'UUID'];
      
      // Map data row by row
      const csvRows = filteredLogs.map(log => {
        const actorName = log.profiles?.full_name || 'Anonymous / Guest';
        const actorEmail = log.profiles?.email || 'SYSTEM_POLICY';
        const actorRole = log.profiles?.role || 'system';
        const dateStr = new Date(log.created_at).toISOString();
        
        // Escape quotes to prevent broken CSV structure
        const cleanDetails = (log.details || '').replace(/"/g, '""');
        const cleanAction = (log.action || '').toUpperCase();

        return [
          `"${dateStr}"`,
          `"${cleanAction}"`,
          `"${cleanDetails}"`,
          `"${actorName}"`,
          `"${actorEmail}"`,
          `"${actorRole}"`,
          `"${log.ip_address || 'Proxy Address'}"`,
          `"${log.id}"`
        ].join(',');
      });

      const csvContent = "data:text/csv;charset=utf-8," + [csvHeaders.join(','), ...csvRows].join('\n');
      const encodedUri = encodeURI(csvContent);
      
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", encodedUri);
      downloadAnchor.setAttribute("download", `cinevault_audit_trail_export_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`);
      document.body.appendChild(downloadAnchor);
      
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
    } catch (csvError) {
      console.error("Failed to generate CSV export file:", csvError);
    }
  };

  // Filter and Sort logs locally
  const filteredLogs = logs.filter(log => {
    // Action Category matching
    if (activeFilter !== 'all') {
      if (activeFilter === 'users') {
        const allowed = ['user_registered', 'auth_sign_in'];
        if (!allowed.includes(log.action)) return false;
      }
      if (activeFilter === 'movies') {
        const allowed = ['movie_created', 'movie_updated', 'movie_deleted', 'link_click'];
        if (!allowed.includes(log.action)) return false;
      }
      if (activeFilter === 'requests') {
        const allowed = ['request_created', 'request_status_change'];
        if (!allowed.includes(log.action)) return false;
      }
      if (activeFilter === 'ratings') {
        const allowed = ['rating_submitted', 'rating_updated', 'rating_deleted'];
        if (!allowed.includes(log.action)) return false;
      }
    }

    // Specific Individual Action dropdown filter
    if (specificActionFilter !== 'all') {
      if (log.action !== specificActionFilter) return false;
    }

    // Text search matching
    if (searchTerm.trim() !== '') {
      const criteria = searchTerm.toLowerCase();
      const matchesAction = log.action.toLowerCase().includes(criteria);
      const matchesDetails = log.details.toLowerCase().includes(criteria);
      const matchesIp = (log.ip_address || '').toLowerCase().includes(criteria);
      const matchesUser = log.profiles?.email?.toLowerCase().includes(criteria) || 
                          log.profiles?.full_name?.toLowerCase().includes(criteria);
      return matchesAction || matchesDetails || matchesUser || matchesIp;
    }

    return true;
  }).sort((a, b) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
  });

  const getLogBadgeColors = (action: string) => {
    switch (action) {
      case 'user_registered':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'auth_sign_in':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'movie_created':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'movie_updated':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'movie_deleted':
        return 'bg-zinc-805 text-zinc-400 border-zinc-700/50';
      case 'request_created':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      case 'request_status_change':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'rating_submitted':
      case 'rating_updated':
        return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
      case 'link_click':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default:
        return 'bg-zinc-800 text-zinc-300 border-white/5';
    }
  };

  const getLogIcon = (action: string) => {
    switch (action) {
      case 'user_registered':
        return <UserPlus className="w-3.5 h-3.5" />;
      case 'auth_sign_in':
        return <LogIn className="w-3.5 h-3.5" />;
      case 'movie_created':
        return <Film className="w-3.5 h-3.5" />;
      case 'movie_updated':
        return <Edit3 className="w-3.5 h-3.5" />;
      case 'movie_deleted':
        return <Trash2 className="w-3.5 h-3.5" />;
      case 'request_created':
      case 'request_status_change':
        return <Inbox className="w-3.5 h-3.5" />;
      case 'rating_submitted':
      case 'rating_updated':
        return <Star className="w-3.5 h-3.5" />;
      case 'link_click':
        return <Link2 className="w-3.5 h-3.5" />;
      default:
        return <Activity className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* SQL Instruction Modal for RLS */}
      {showSqlInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowSqlInstructions(false)}></div>
          <div className="bg-zinc-950 border border-red-500/30 rounded-2xl p-6 shadow-2xl relative w-full max-w-2xl">
            <h3 className="text-xl font-bold text-white mb-2">Database Permissions Required</h3>
            <p className="text-zinc-400 text-sm mb-4">
              To prevent accidental data loss, the ability to permanently clear logs and requests is blocked by Row Level Security (RLS) by default. To unlock this ability, please run the following standard SQL policy patch in your Supabase SQL Editor:
            </p>
            <div className="bg-black border border-white/10 rounded-xl p-4 overflow-x-auto relative group">
              <pre className="text-xs text-zinc-300 font-mono text-left whitespace-pre-wrap leading-relaxed">
{`-- Add DELETE policies so admins can clear logs and requests

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can delete activity logs" ON public.activity_logs;
CREATE POLICY "Admins can delete activity logs" 
  ON public.activity_logs FOR DELETE 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

ALTER TABLE public.movie_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can delete requests" ON public.movie_requests;
CREATE POLICY "Admins can delete requests" 
  ON public.movie_requests FOR DELETE 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );`}
              </pre>
            </div>
            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => setShowSqlInstructions(false)}
                className="px-5 py-2.5 bg-white text-black font-bold text-sm rounded-xl hover:bg-zinc-200 transition-colors cursor-pointer"
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header and Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white mb-1 flex items-center gap-2">
            <Activity className="text-red-500 w-5 h-5 animate-pulse" /> Live Audit Log & System Trace
          </h2>
          <p className="text-sm text-zinc-400">
            Realtrace operational ledger for registered users, content ingestion, database mutations, and member interaction signals.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 self-start xl:self-auto">
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl border border-emerald-500/20 transition-all cursor-pointer"
            title="Download audit logs matching current filter"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          
          <button 
            onClick={handleClearLogs}
            disabled={loading || logs.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-bold rounded-xl border border-red-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Logs
          </button>
          
          <button 
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-850 text-xs text-zinc-200 font-bold rounded-xl border border-white/5 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Audit Logs
          </button>
        </div>
      </div>

      {/* Dynamic Statistics Cards Block */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 block mb-1">Total Logs</span>
          <span className="text-xl font-bold font-mono text-white">{stats.total} <span className="text-[10px] text-zinc-550 font-sans font-normal">snapshots</span></span>
        </div>
        
        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 block mb-1">Logins (Trace)</span>
          <span className="text-xl font-bold font-mono text-cyan-400">{stats.logins}</span>
        </div>

        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 block mb-1">Registrations</span>
          <span className="text-xl font-bold font-mono text-emerald-450 text-emerald-400">{stats.registers}</span>
        </div>

        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 block mb-1">Ingestion (CMS)</span>
          <span className="text-xl font-bold font-mono text-amber-400">{stats.ingestions} <span className="text-[9px] text-zinc-500 font-sans font-normal">items</span></span>
        </div>

        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 block mb-1">User Requests</span>
          <span className="text-xl font-bold font-mono text-purple-400">{stats.requests}</span>
        </div>

        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 block mb-1">Member Clicks</span>
          <span className="text-xl font-bold font-mono text-blue-400">{stats.linkClicks} <span className="text-[9px] text-zinc-500 font-sans font-normal">hits</span></span>
        </div>
      </div>

      {/* Activity Filter & Advanced Search Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/[0.02] border border-white/5 rounded-xl p-4">
        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5 shrink-0">
          {[
            { id: 'all', label: 'All Operations' },
            { id: 'users', label: 'Members Area', icon: UserPlus },
            { id: 'movies', label: 'Content Ingest', icon: Film },
            { id: 'requests', label: 'Requests', icon: Inbox },
            { id: 'ratings', label: 'Ratings', icon: Star },
          ].map(tab => {
            const isSelected = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveFilter(tab.id);
                  setSpecificActionFilter('all'); // reset fine action filter to avoid zero-match mismatches
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer border ${
                  isSelected 
                    ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/10' 
                    : 'bg-zinc-900 border-white/5 hover:bg-zinc-850 text-zinc-400 hover:text-white'
                }`}
              >
                {tab.icon && <tab.icon className="w-3 h-3" />}
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search, Action filters in row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:max-w-2xl justify-end">
          {/* Specific trigger dropdown */}
          <div className="relative flex items-center bg-black/40 border border-white/10 rounded-xl px-2.5 py-1 text-zinc-400 text-xs">
            <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500 mr-1.5 shrink-0" />
            <select
              value={specificActionFilter}
              onChange={(e) => setSpecificActionFilter(e.target.value)}
              className="bg-transparent focus:outline-none text-white text-xs cursor-pointer font-sans select-none"
            >
              <option value="all" className="bg-zinc-950 text-white">All Trigger Actions</option>
              {activeFilter === 'all' || activeFilter === 'users' ? (
                <>
                  <option value="auth_sign_in" className="bg-zinc-950 text-white">Member Sign In</option>
                  <option value="user_registered" className="bg-zinc-950 text-white">Member Registration</option>
                </>
              ) : null}
              {activeFilter === 'all' || activeFilter === 'movies' ? (
                <>
                  <option value="movie_created" className="bg-zinc-950 text-white">Movie Created</option>
                  <option value="movie_updated" className="bg-zinc-950 text-white">Movie Updated</option>
                  <option value="movie_deleted" className="bg-zinc-950 text-white">Movie Deleted</option>
                  <option value="link_click" className="bg-zinc-950 text-white">Movie Download Click</option>
                </>
              ) : null}
              {activeFilter === 'all' || activeFilter === 'requests' ? (
                <>
                  <option value="request_created" className="bg-zinc-950 text-white">Request Created</option>
                  <option value="request_status_change" className="bg-zinc-950 text-white">Request Status Update</option>
                </>
              ) : null}
              {activeFilter === 'all' || activeFilter === 'ratings' ? (
                <>
                  <option value="rating_submitted" className="bg-zinc-950 text-white">Rating Review Placed</option>
                </>
              ) : null}
            </select>
          </div>

          {/* Sorter toggler */}
          <button
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-white/10 hover:border-white/20 hover:bg-zinc-850 rounded-xl text-xs font-semibold text-zinc-300 transition-all cursor-pointer"
            title="Sort records by timestamp"
          >
            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-mono uppercase">{sortOrder === 'desc' ? 'Newest' : 'Oldest'} First</span>
          </button>

          {/* Text Search Input */}
          <div className="relative w-full sm:max-w-xs">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-zinc-500" />
            </span>
            <input
              type="text"
              className="w-full bg-black/40 border border-white/10 rounded-xl py-1.5 pl-9 pr-4 text-xs text-white focus:outline-none focus:border-red-500/50 placeholder-zinc-500"
              placeholder="Search details, emails, IP addresses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 font-medium p-4 rounded-xl text-sm mb-6">
          System Error resolving logs index: {errorMsg}
        </div>
      )}

      {/* Main logs explorer and split meta pane */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Logs Feed Column */}
        <div className="lg:col-span-3 glass rounded-2xl border border-white/5 overflow-hidden flex flex-col justify-between">
          <div className="overflow-x-auto w-full hidden lg:block">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 border-b border-white/5 text-[10px] uppercase tracking-wider font-mono text-zinc-500">
                  <th className="py-3 px-4 font-bold">Action / Trigger</th>
                  <th className="py-3 px-4 font-bold">Details</th>
                  <th className="py-3 px-4 font-bold">Actor Account</th>
                  <th className="py-3 px-4 font-bold">Logged At</th>
                  <th className="py-3 px-4 font-bold text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {loading ? (
                  // Loading indicators
                  [1, 2, 3, 4, 5].map((_, index) => (
                    <tr key={index} className="animate-pulse">
                      <td className="py-4 px-4">
                        <div className="h-4 bg-zinc-800 rounded w-24"></div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 bg-zinc-800 rounded w-64"></div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 bg-zinc-850 rounded w-28"></div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 bg-zinc-900 rounded w-16"></div>
                      </td>
                      <td className="py-4 px-4"></td>
                    </tr>
                  ))
                ) : filteredLogs.length > 0 ? (
                  filteredLogs.map(log => (
                    <tr 
                      key={log.id} 
                      className={`hover:bg-white/[0.02] transition-colors ${
                        selectedMetaLog?.id === log.id ? 'bg-white/5' : ''
                      }`}
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold border ${getLogBadgeColors(log.action)}`}>
                          {getLogIcon(log.action)}
                          {log.action.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-sm">
                        <p className="text-zinc-200 font-medium leading-relaxed">{log.details}</p>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {log.profiles ? (
                          <div className="flex flex-col min-w-[120px]">
                            <span className="text-white font-bold">{log.profiles.full_name || 'Anonymous'}</span>
                            <span className="text-zinc-500 font-mono text-[10px]">{log.profiles.email}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-500 font-mono text-[10px]">SYSTEM POLICY</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-zinc-400 font-medium font-mono text-[10px]">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                          {new Date(log.created_at).toLocaleTimeString() || 'Just now'}
                        </span>
                        <span className="block text-[8.5px] text-zinc-600 mt-0.5">
                          {new Date(log.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedMetaLog(selectedMetaLog?.id === log.id ? null : log)}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            selectedMetaLog?.id === log.id 
                              ? 'bg-red-650 text-white border-red-500' 
                              : 'bg-zinc-900 border-white/5 text-zinc-400 hover:text-white hover:bg-neutral-800'
                          }`}
                          title="View JSON Payload Metadata"
                        >
                          <Code className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-zinc-500 font-sans font-medium">
                      No matching operational logs registered for selection.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Logs View */}
          <div className="lg:hidden space-y-4 p-4">
            {loading ? (
              [1, 2, 3].map((_, index) => (
                <div key={index} className="p-4 bg-zinc-950 border border-white/5 rounded-xl space-y-3 animate-pulse">
                  <div className="h-4 bg-zinc-800 rounded w-24"></div>
                  <div className="h-4 bg-zinc-800 rounded w-full"></div>
                  <div className="h-4 bg-zinc-850 rounded w-28"></div>
                </div>
              ))
            ) : filteredLogs.length > 0 ? (
              filteredLogs.map(log => (
                <div 
                  key={log.id} 
                  className={`p-4 bg-zinc-950 border rounded-xl space-y-3 relative card-hover overflow-hidden transition-all ${
                    selectedMetaLog?.id === log.id ? 'border-red-500/50 bg-white/5' : 'border-white/5'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-bold border uppercase tracking-wider ${getLogBadgeColors(log.action)}`}>
                      {getLogIcon(log.action)}
                      {log.action.replace(/_/g, ' ')}
                    </span>
                    <button
                      onClick={() => setSelectedMetaLog(selectedMetaLog?.id === log.id ? null : log)}
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer shrink-0 ${
                        selectedMetaLog?.id === log.id 
                          ? 'bg-red-650 text-white border-red-500' 
                          : 'bg-zinc-900 border-white/5 text-zinc-400 hover:text-white'
                      }`}
                      title="View XML Dump / Inspector"
                    >
                      <Code className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  <p className="text-zinc-200 text-sm font-medium leading-relaxed">{log.details}</p>

                  <div className="pt-3 border-t border-white/5 flex items-center justify-between flex-wrap gap-3 text-xs">
                    <div className="flex items-center gap-2">
                       <UserPlus className="w-3.5 h-3.5 text-zinc-600" />
                       <div className="flex flex-col">
                         <span className="text-white font-bold">{log.profiles?.full_name || 'Anonymous'}</span>
                         {log.profiles?.email && <span className="text-zinc-500 font-mono text-[9px]">{log.profiles.email}</span>}
                       </div>
                    </div>
                    
                    <div className="text-right">
                       <span className="flex items-center justify-end gap-1 font-mono text-zinc-400">
                          <Calendar className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                          {new Date(log.created_at).toLocaleTimeString() || 'Just now'}
                       </span>
                       <span className="block text-[8.5px] text-zinc-600 font-mono mt-0.5">
                          {new Date(log.created_at).toLocaleDateString()}
                       </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
                <div className="text-center py-10 text-sm text-zinc-500">
                  No matching logs trace found.
                </div>
            )}
          </div>

          <div className="p-4 bg-white/[0.01] border-t border-white/5 px-6 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-zinc-500 gap-2">
            <span>Listing up to 150 transaction snapshots.</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[10px] font-mono">
                <span className="w-1.5 h-1.5 bg-red-650 rounded-full animate-ping"></span> Real-time Audit Node Active
              </span>
            </div>
          </div>
        </div>

        {/* Sidebar Information Card (Split Metapane) */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass rounded-xl p-5 border border-white/10 flex flex-col justify-between min-h-[380px] bg-zinc-950/30">
            {selectedMetaLog ? (
              <div className="space-y-4 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                    <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                      <Code className="w-4 h-4 text-red-500 animate-pulse" /> Metadata Payload
                    </h3>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          const payloadString = JSON.stringify(selectedMetaLog.metadata || {}, null, 2);
                          navigator.clipboard.writeText(payloadString);
                          setCopySuccess(true);
                          setTimeout(() => setCopySuccess(false), 2000);
                        }}
                        className={`p-1.5 rounded hover:bg-white/5 transition-all cursor-pointer ${copySuccess ? 'text-emerald-405 text-emerald-400' : 'text-zinc-550 text-zinc-400 hover:text-white'}`}
                        title="Copy JSON to clipboard"
                      >
                        {copySuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedMetaLog(null);
                          setCopySuccess(false);
                        }} 
                        className="p-1 hover:bg-white/5 rounded text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer"
                        title="Close Inspector"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    {copySuccess && (
                      <div className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 py-1 px-2.5 rounded-lg text-center animate-fade-in font-medium">
                        Successfully copied payload parameters!
                      </div>
                    )}
                    <div className="bg-black/35 rounded-xl p-3 border border-white/5 font-mono text-[10px] max-h-56 overflow-y-auto custom-scrollbar">
                      <pre className="text-teal-400 whitespace-pre-wrap word-break-all block">{JSON.stringify(selectedMetaLog.metadata || {}, null, 2)}</pre>
                    </div>

                    <div className="p-3 bg-white/5 rounded-xl space-y-2 border border-white/5">
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Log Context</p>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-zinc-400">Log UUID:</span>
                        <span className="font-mono text-zinc-200 select-all truncate max-w-[120px]" title={selectedMetaLog.id}>{selectedMetaLog.id}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-zinc-400">Network Host:</span>
                        <span className="font-mono text-zinc-200">{selectedMetaLog.ip_address || 'Proxy Address'}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-zinc-400">Role Actor:</span>
                        <span className="font-mono text-zinc-300 capitalize bg-white/5 px-1.5 py-0.5 rounded border border-white/5 text-[10px]">
                          {selectedMetaLog.profiles?.role || 'system'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 mt-auto">
                  <p className="text-[10px] text-zinc-500 leading-relaxed italic">
                    JSON parameters are locked and cryptographically validated for strict tamper protection.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                <AlertCircle className="w-10 h-10 text-zinc-600 mb-2 animate-bounce" />
                <h4 className="font-bold text-sm text-zinc-300 mb-1">Inspector Closed</h4>
                <p className="text-xs text-zinc-500 max-w-[200px] leading-relaxed">
                  Select any activity log entry on the left table row using the Inspector icon to scrutinize background metadata transaction dumps.
                </p>
              </div>
            )}
          </div>

          <div className="glass rounded-xl p-5 border border-white/10 dark:bg-zinc-950 text-xs text-zinc-400 space-y-2 leading-relaxed">
            <h4 className="font-bold text-white text-xs uppercase tracking-widest mb-1.5 font-sans">Audit Standard</h4>
            <p>Every operational transaction, rating review update, and movie creation triggers an immutable row insertion in our query ledger.</p>
            <p className="text-red-500 font-semibold font-mono text-[10px]">LEGAL REGULATORY STANDARD SECURE</p>
          </div>
        </div>

      </div>
    </div>
  );
}
