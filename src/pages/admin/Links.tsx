import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Link2, 
  CheckCircle, 
  AlertTriangle, 
  Settings2, 
  Trash2, 
  ExternalLink, 
  RefreshCw, 
  X, 
  Check, 
  Search,
  Filter,
  Film,
  User,
  ShieldAlert
} from 'lucide-react';
import { Button } from '../../components/ui/Button';

interface ExtDownloadLink {
  id: string;
  movie_id: string;
  server_name: string;
  url: string;
  quality: string;
  file_size: string | null;
  status: 'active' | 'broken' | 'maintenance';
  clicks: number;
  created_at: string;
  movies: {
    title: string;
  } | null;
}

interface Report {
  id: string;
  link_id: string;
  user_id: string | null;
  issue_type: string;
  status: string;
  created_at: string;
  download_links: {
    url: string;
    server_name: string;
    movie_id: string;
  } | null;
  profiles: {
    full_name: string | null;
    email: string | null;
  } | null;
}

export default function Links() {
  const [links, setLinks] = useState<ExtDownloadLink[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'broken' | 'maintenance'>('active');

  const fetchData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      // Fetch download links with movie titles
      const { data: linksData, error: linksError } = await supabase
        .from('download_links')
        .select(`
          *,
          movies:movie_id (
            title
          )
        `)
        .order('created_at', { ascending: false });

      if (linksError) throw linksError;
      setLinks((linksData as any) || []);

      // Fetch pending reports
      const { data: reportsData, error: reportsError } = await supabase
        .from('download_reports')
        .select(`
          *,
          download_links:link_id (
            url,
            server_name,
            movie_id
          ),
          profiles:user_id (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (reportsError) throw reportsError;
      setReports((reportsData as any) || []);
    } catch (err) {
      console.error('Error fetching links & reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateLink = async (linkId: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('download_links')
        .update({
          url: editUrl,
          status: editStatus
        })
        .eq('id', linkId);

      if (error) throw error;
      
      // Update local state in real-time
      setLinks(prev => prev.map(l => l.id === linkId ? { ...l, url: editUrl, status: editStatus } : l));
      setEditingLinkId(null);
      
      // Auto resolve associated reports for this link
      const { error: repErr } = await supabase
        .from('download_reports')
        .update({ status: 'resolved' })
        .eq('link_id', linkId);
        
      if (!repErr) {
        setReports(prev => prev.map(r => r.link_id === linkId ? { ...r, status: 'resolved' } : r));
      }
    } catch (err) {
      console.error('Error updating link:', err);
      alert('Failed to update URL');
    }
  };

  const handleResolveReport = async (reportId: string, linkId?: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('download_reports')
        .update({ status: 'resolved' })
        .eq('id', reportId);

      if (error) throw error;

      // Update local report status
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));

      // If resolving because link is active, update link status to active
      if (linkId) {
        await supabase
          .from('download_links')
          .update({ status: 'active' })
          .eq('id', linkId);
          
        setLinks(prev => prev.map(l => l.id === linkId ? { ...l, status: 'active' } : l));
      }
    } catch (err) {
      console.error('Error resolving report:', err);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!supabase || !confirm('Are you sure you want to dismiss this report?')) return;
    try {
      const { error } = await supabase
        .from('download_reports')
        .delete()
        .eq('id', reportId);

      if (error) throw error;
      setReports(prev => prev.filter(r => r.id !== reportId));
    } catch (err) {
      console.error('Error deleting report:', err);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!supabase || !confirm('Are you sure you want to permanently delete this download link?')) return;
    try {
      const { error } = await supabase
        .from('download_links')
        .delete()
        .eq('id', linkId);

      if (error) throw error;
      setLinks(prev => prev.filter(l => l.id !== linkId));
      // Also clear reports for this link in real-time
      setReports(prev => prev.filter(r => r.link_id !== linkId));
    } catch (err) {
      console.error('Error deleting link:', err);
    }
  };

  const startEditing = (link: ExtDownloadLink) => {
    setEditingLinkId(link.id);
    setEditUrl(link.url);
    setEditStatus(link.status);
  };

  const filteredLinks = links.filter(link => {
    const matchesSearch = 
      link.server_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      link.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (link.movies?.title && link.movies.title.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = 
      statusFilter === 'all' || 
      link.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalLinks = links.length;
  const activeCount = links.filter(l => l.status === 'active').length;
  const brokenCount = links.filter(l => l.status === 'broken').length;
  const maintenanceCount = links.filter(l => l.status === 'maintenance').length;
  const pendingReportsCount = reports.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white mb-1">Link Uptime Control</h2>
          <p className="text-sm text-zinc-400">Validate host endpoints, track bug reports, and update broken links instantly.</p>
        </div>
        <Button 
          variant="secondary" 
          onClick={fetchData} 
          className="flex items-center gap-1.5 self-start cursor-pointer sm:self-auto"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Reload Matrix
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 font-medium">Total Servers</p>
            <p className="text-xl sm:text-2xl font-bold text-white mt-1">{totalLinks}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-zinc-800 text-zinc-400 flex items-center justify-center">
            <Link2 className="w-5 h-5" />
          </div>
        </div>
        <div className="glass p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 font-medium">Active Links</p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-400 mt-1">{activeCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>
        <div className="glass p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 font-medium">Broken Paths</p>
            <p className="text-xl sm:text-2xl font-bold text-rose-500 mt-1">{brokenCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
        <div className="glass p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 font-medium">Pending Alerts</p>
            <p className="text-xl sm:text-2xl font-bold text-amber-500 mt-1">{pendingReportsCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* User Bug Reports Section */}
      {reports.filter(r => r.status === 'pending').length > 0 && (
        <div className="glass rounded-xl border border-amber-500/20 overflow-hidden bg-amber-500/[0.01]">
          <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-amber-500/5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <h3 className="font-semibold text-amber-400 text-sm tracking-wide uppercase">Active Broken Link Alerts</h3>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-mono">
              {reports.filter(r => r.status === 'pending').length} Reported
            </span>
          </div>
          <div className="divide-y divide-white/5 max-h-72 overflow-y-auto">
            {reports.filter(r => r.status === 'pending').map(report => (
              <div key={report.id} className="p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 card-hover transition-all">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded">
                      {report.issue_type === 'broken_link' ? 'Broken Link' : report.issue_type.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-zinc-500">
                      Reported by {report.profiles?.full_name || report.profiles?.email || 'Anonymous'}
                    </span>
                    <span className="text-xs text-zinc-600 font-mono">
                      • {new Date(report.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300 font-medium truncate">
                    Server: <span className="text-red-400 font-semibold">{report.download_links?.server_name || 'Unknown'}</span>
                  </p>
                  <p className="text-xs text-zinc-500 font-mono truncate max-w-lg">
                    Raw Link: <a href={report.download_links?.url} target="_blank" rel="noreferrer" className="hover:underline hover:text-zinc-300 inline-flex items-center gap-0.5">{report.download_links?.url} <ExternalLink className="w-3 h-3" /></a>
                  </p>
                </div>
                <div className="flex items-center gap-2 self-end md:self-auto uppercase tracking-wider text-xs">
                  <Button 
                    size="sm" 
                    variant="primary" 
                    onClick={() => {
                      const associatedLink = links.find(l => l.id === report.link_id);
                      if (associatedLink) {
                        startEditing(associatedLink);
                        // scroll to input
                        document.getElementById('catalog-search')?.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    className="gap-1 bg-amber-600 hover:bg-amber-700 font-bold"
                  >
                    <Settings2 className="w-3.5 h-3.5" /> Fix Link
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleResolveReport(report.id, report.link_id)}
                    className="gap-1 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 font-bold"
                  >
                    <Check className="w-3.5 h-3.5" /> Mark Active
                  </Button>
                  <button 
                    onClick={() => handleDeleteReport(report.id)}
                    className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Database Links Section */}
      <div className="glass rounded-xl overflow-hidden p-4 sm:p-6 space-y-4">
        {/* Filter Toolbar */}
        <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
            <input 
              id="catalog-search"
              type="text" 
              placeholder="Search by server name, URL, or movie title..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-zinc-90 w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
            />
          </div>
          
          <div className="flex gap-2 items-center">
            <Filter className="w-4 h-4 text-zinc-500 hidden sm:inline" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-red-500 min-w-[140px] cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">🟢 Active</option>
              <option value="broken">🔴 Broken</option>
              <option value="maintenance">🟠 Maintenance</option>
            </select>
          </div>
        </div>

        {/* Editing Inline Form Overlay */}
        {editingLinkId && (
          <div className="p-4 bg-zinc-900 border border-amber-500/40 rounded-xl space-y-3 animate-fadeIn">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-amber-500 font-mono tracking-wider uppercase flex items-center gap-1">Update Server Link Configuration</h4>
              <button onClick={() => setEditingLinkId(null)} className="p-1 hover:bg-white/5 text-zinc-400 hover:text-white rounded-lg transition-all cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Download Address (URL)</label>
                <input 
                  type="text"
                  value={editUrl}
                  onChange={e => setEditUrl(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Path Status</label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value as any)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-red-500 font-semibold cursor-pointer"
                >
                  <option value="active">🟢 Active (Online)</option>
                  <option value="broken">🔴 Broken (Reported Dead)</option>
                  <option value="maintenance">🟠 Pending Audit</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 text-xs" size="sm" onClick={() => handleUpdateLink(editingLinkId)}>
                  Save Link
                </Button>
                <Button className="flex-1 text-xs" variant="outline" size="sm" onClick={() => setEditingLinkId(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Database List Display */}
        <div className="overflow-x-auto rounded-xl border border-white/5 hidden lg:block">
          <table className="w-full text-left text-sm text-zinc-300 border-collapse">
            <thead className="bg-[#1D1D1F] border-b border-white/5 text-[10px] uppercase tracking-widest text-zinc-400 font-bold">
              <tr>
                <th className="px-6 py-4">Associated Movie</th>
                <th className="px-6 py-4">Server Host</th>
                <th className="px-6 py-4">Quality & Size</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Clicks</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-black/20">
              {filteredLinks.length > 0 ? (
                filteredLinks.map(link => (
                  <tr key={link.id} className="card-hover transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <Film className="w-4 h-4 text-zinc-500 shrink-0" />
                        <div>
                          <span className="font-semibold text-zinc-200 block truncate max-w-[200px]">
                            {link.movies?.title || 'Unknown Film'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-zinc-300">
                      <span className="px-2 py-1 rounded bg-white/5 text-xs text-red-400 font-bold">{link.server_name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs">
                        <span className="text-zinc-300 font-semibold">{link.quality}</span>
                        {link.file_size && <span className="text-zinc-500 font-mono block mt-0.5">{link.file_size}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {link.status === 'active' && <span className="inline-flex items-center gap-1 text-emerald-400 text-xs bg-emerald-500/10 px-2 py-0.5 rounded-full font-semibold">🟢 Active</span>}
                      {link.status === 'broken' && <span className="inline-flex items-center gap-1 text-rose-400 text-xs bg-rose-500/10 px-2 py-0.5 rounded-full font-semibold">🔴 Broken</span>}
                      {link.status === 'maintenance' && <span className="inline-flex items-center gap-1 text-amber-400 text-xs bg-amber-500/10 px-2 py-0.5 rounded-full font-semibold font-mono">🟠 Maintenance</span>}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-zinc-400">
                      {link.clicks.toLocaleString()} hits
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a 
                          href={link.url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="p-1 px-2 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded border border-white/5 text-xs inline-flex items-center gap-1 transition-all"
                        >
                          Visit <ExternalLink className="w-3 h-3" />
                        </a>
                        <button 
                          onClick={() => startEditing(link)} 
                          className="p-1.5 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                          <Settings2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteLink(link.id)} 
                          className="p-1.5 text-rose-500 hover:text-rose-400 rounded hover:bg-rose-900/30 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 bg-black/10">
                    No custom links found matching the query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Responsive Mobile Layout (Card View) */}
        <div className="lg:hidden space-y-4">
          {filteredLinks.length > 0 ? (
            filteredLinks.map(link => (
              <div key={link.id} className="p-4 bg-zinc-950 border border-white/5 rounded-xl space-y-3 relative card-hover overflow-hidden transition-all">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <span className="text-zinc-400 text-[10px] uppercase font-mono block">Associated Film</span>
                    <span className="font-semibold text-zinc-200 block truncate">{link.movies?.title || 'Unknown Film'}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-white/5 text-xs text-red-500 font-bold shrink-0">{link.server_name}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Quality</span>
                    <span className="font-semibold text-zinc-300">{link.quality} • {link.file_size || 'Unknown'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Uptime Status</span>
                    {link.status === 'active' && <span className="text-emerald-400">🟢 Live Active</span>}
                    {link.status === 'broken' && <span className="text-rose-400">🔴 Broken Row</span>}
                    {link.status === 'maintenance' && <span className="text-amber-400">🟠 Pending Audit</span>}
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 font-mono">{link.clicks.toLocaleString()} downloads tracked</span>
                  <div className="flex items-center gap-1 text-xs">
                    <a 
                      href={link.url} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="px-2 py-1 bg-white/5 text-zinc-300 hover:text-white rounded border border-white/5 flex items-center gap-1 transition-all"
                    >
                      Visit <ExternalLink className="w-3 h-3" />
                    </a>
                    <button 
                      onClick={() => startEditing(link)} 
                      className="p-2 text-zinc-400 hover:text-white rounded bg-white/5 border border-white/5 transition-all cursor-pointer"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => handleDeleteLink(link.id)} 
                      className="p-2 text-rose-500 hover:text-rose-400 rounded bg-white/5 border border-white/5 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-10 text-sm text-zinc-500">
              No custom mirror links found matching the query.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
