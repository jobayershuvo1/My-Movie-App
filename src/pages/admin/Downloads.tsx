import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Inbox, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  RotateCcw,
  RefreshCw, 
  Filter, 
  Search, 
  Calendar,
  MessageSquare,
  Sparkles,
  User,
  MoreVertical
} from 'lucide-react';
import { Button } from '../../components/ui/Button';

interface Request {
  id: string;
  user_id: string | null;
  title: string;
  year: number | null;
  status: 'pending' | 'approved' | 'fulfilled' | 'rejected';
  notes: string | null;
  created_at: string;
  profiles: {
    full_name: string | null;
    email: string | null;
  } | null;
}

export default function Downloads() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [notesInput, setNotesInput] = useState<{ [id: string]: string }>({});

  const fetchRequests = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('movie_requests')
        .select(`
          *,
          profiles:user_id (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
      
      // Initialize states for notes
      const initialNotes: { [id: string]: string } = {};
      data?.forEach(r => {
        initialNotes[r.id] = r.notes || '';
      });
      setNotesInput(initialNotes);

    } catch (err) {
      console.error('Error fetching requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleUpdateStatus = async (id: string, status: 'pending' | 'approved' | 'fulfilled' | 'rejected') => {
    if (!supabase) return;
    try {
      const currentNotes = notesInput[id] || '';
      const { error } = await supabase
        .from('movie_requests')
        .update({ status, notes: currentNotes })
        .eq('id', id);

      if (error) throw error;
      
      // Update local state in real-time
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status, notes: currentNotes } : r));
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update request');
    }
  };

  const handleSaveNotes = async (id: string) => {
    if (!supabase) return;
    try {
      const currentNotes = notesInput[id] || '';
      const { error } = await supabase
        .from('movie_requests')
        .update({ notes: currentNotes })
        .eq('id', id);

      if (error) throw error;
      
      // Update local state in real-time
      setRequests(prev => prev.map(r => r.id === id ? { ...r, notes: currentNotes } : r));
      alert('Notes saved successfully!');
    } catch (err) {
      console.error('Error saving notes:', err);
      alert('Failed to save notes');
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (!supabase || !confirm('Are you sure you want to delete this archive request?')) return;
    try {
      const { error } = await supabase
        .from('movie_requests')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setRequests(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error('Error deleting request:', err);
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch = 
      req.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (req.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (req.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase()) || false);

    const matchesStatus = 
      statusFilter === 'all' || 
      req.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const total = requests.length;
  const pending = requests.filter(r => r.status === 'pending').length;
  const approved = requests.filter(r => r.status === 'approved').length;
  const fulfilled = requests.filter(r => r.status === 'fulfilled').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white mb-1">Movie Request Center</h2>
          <p className="text-sm text-zinc-400">Streamline user suggestions, track pending licenses, and publish status updates.</p>
        </div>
        <Button 
          variant="secondary" 
          onClick={fetchRequests} 
          className="flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Registry
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 font-medium">Total Requests</p>
            <p className="text-xl sm:text-2xl font-bold text-white mt-1">{total}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-zinc-800 text-zinc-400 flex items-center justify-center">
            <Inbox className="w-5 h-5" />
          </div>
        </div>
        <div className="glass p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 font-medium">Pending Approvals</p>
            <p className="text-xl sm:text-2xl font-bold text-amber-400 mt-1">{pending}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>
        <div className="glass p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 font-medium">Approved Queue</p>
            <p className="text-xl sm:text-2xl font-bold text-indigo-400 mt-1">{approved}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>
        <div className="glass p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 font-medium">Fulfilled Posts</p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-400 mt-1">{fulfilled}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Requests Database View */}
      <div className="glass rounded-xl overflow-hidden p-4 sm:p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Search request by title or username..." 
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
              <option value="all">All Request Status</option>
              <option value="pending">⏳ Pending Review</option>
              <option value="approved">✨ Approved</option>
              <option value="fulfilled">✅ Fulfilled</option>
              <option value="rejected">❌ Rejected</option>
            </select>
          </div>
        </div>

        {/* Content list (Table view for Desktop, Beautiful Cards view for Mobile) */}
        {loading ? (
          <div className="text-center py-12 text-zinc-500 font-mono text-xs">
            <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            Acquiring Suggesions Data...
          </div>
        ) : (
          <>
            {/* Desktop View */}
            <div className="overflow-x-auto rounded-xl border border-white/5 hidden lg:block">
              <table className="w-full text-left text-sm text-zinc-300 border-collapse">
                <thead className="bg-[#1D1D1F] border-b border-white/5 text-[10px] uppercase tracking-widest text-zinc-400 font-bold">
                  <tr>
                    <th className="px-6 py-4">Title & Year</th>
                    <th className="px-6 py-4">Requested By</th>
                    <th className="px-6 py-4">Created Date</th>
                    <th className="px-6 py-4">Status & Notes</th>
                    <th className="px-6 py-4 text-right">Approve Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-black/20">
                  {filteredRequests.length > 0 ? (
                    filteredRequests.map(req => (
                      <tr key={req.id} className="card-hover transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <span className="font-bold text-zinc-200 block text-sm">{req.title}</span>
                            <span className="text-xs text-zinc-500 font-mono inline-flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3 h-3" /> {req.year || 'Unknown Year'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-xs">
                            <div className="w-6 h-6 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center font-bold">
                              {req.profiles?.full_name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div>
                              <span className="font-medium text-zinc-300 block">{req.profiles?.full_name || 'Anonymous User'}</span>
                              <span className="text-[10px] text-zinc-500 block font-mono">{req.profiles?.email || 'No email'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-mono text-zinc-500">
                          {new Date(req.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 space-y-2">
                          <div className="flex items-center gap-2">
                            {req.status === 'pending' && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-semibold">⏳ Pending Review</span>}
                            {req.status === 'approved' && <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-semibold">✨ Approved</span>}
                            {req.status === 'fulfilled' && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold">✅ Fulfilled</span>}
                            {req.status === 'rejected' && <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-semibold">❌ Rejected</span>}
                          </div>
                          <div className="flex items-center gap-1">
                            <input 
                              type="text"
                              value={notesInput[req.id] || ''}
                              onChange={e => setNotesInput(prev => ({ ...prev, [req.id]: e.target.value }))}
                              placeholder="Add admin remarks..."
                              className="bg-black/40 border border-white/5 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-red-500/40 w-44 font-sans text-ellipsis"
                            />
                            <button 
                              onClick={() => handleSaveNotes(req.id)}
                              className="px-2 py-1 text-[10px] font-bold border border-white/10 rounded hover:bg-white/5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                            >
                              Save
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap max-w-[200px] ml-auto">
                            {req.status === 'pending' && (
                              <>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/10 font-bold" onClick={() => handleUpdateStatus(req.id, 'approved')}>
                                  Approve
                                </Button>
                                <button onClick={() => handleUpdateStatus(req.id, 'rejected')} className="p-1 text-rose-500 hover:text-rose-400 hover:bg-rose-500/5 rounded transition-all cursor-pointer" title="Reject">
                                  <XCircle className="w-5 h-5" />
                                </button>
                              </>
                            )}
                            {req.status === 'approved' && (
                              <Button size="sm" className="h-7 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700 font-bold" onClick={() => handleUpdateStatus(req.id, 'fulfilled')}>
                                Fulfill Entry
                              </Button>
                            )}
                            {(req.status === 'fulfilled' || req.status === 'rejected') && (
                              <button onClick={() => handleUpdateStatus(req.id, 'pending')} className="p-1 px-2 border border-white/5 rounded-lg text-xs hover:bg-white/5 text-zinc-400 hover:text-white transition-all inline-flex items-center gap-1 cursor-pointer" title="Reset to review state">
                                <RotateCcw className="w-3.5 h-3.5" /> Re-open
                              </button>
                            )}
                            <button 
                              onClick={() => handleDeleteRequest(req.id)}
                              className="p-1 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/5 rounded transition-all cursor-pointer"
                              title="Delete suggestions"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                        No movie suggestions mapped current settings.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="lg:hidden space-y-4">
              {filteredRequests.length > 0 ? (
                filteredRequests.map(req => (
                  <div key={req.id} className="p-4 bg-zinc-950 border border-white/5 rounded-xl space-y-3 relative card-hover overflow-hidden transition-all">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-zinc-500 text-[9px] uppercase font-mono block">suggestions catalog</span>
                        <h4 className="font-bold text-zinc-200 text-sm leading-snug">{req.title}</h4>
                        <span className="text-xs text-zinc-500 font-mono mt-0.5 inline-block">Release: {req.year || 'Unknown'}</span>
                      </div>
                      
                      {/* Badge badge */}
                      <div>
                        {req.status === 'pending' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-semibold font-mono">Pending</span>}
                        {req.status === 'approved' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-semibold font-mono font-mono">Approved</span>}
                        {req.status === 'fulfilled' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold font-mono font-mono font-semibold">Fulfilled</span>}
                        {req.status === 'rejected' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-semibold font-mono font-semibold">Rejected</span>}
                      </div>
                    </div>

                    <div className="p-2.5 bg-black/40 border border-white/5 rounded-lg space-y-2">
                      <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                        <User className="w-3.5 h-3.5" /> Ordered by: <span className="text-zinc-400 truncate">{req.profiles?.full_name || req.profiles?.email || 'Anon User'}</span>
                      </div>
                      <div className="space-y-1.5 pt-1.5 border-t border-white/5">
                        <span className="text-[10px] text-zinc-500 block uppercase font-mono font-bold">Admin remarks</span>
                        <div className="flex items-center gap-1.5 w-full">
                          <input 
                            type="text"
                            value={notesInput[req.id] || ''}
                            onChange={e => setNotesInput(prev => ({ ...prev, [req.id]: e.target.value }))}
                            placeholder="Add remarks..."
                            className="bg-zinc-900 border border-white/10 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-red-500 w-full"
                          />
                          <button 
                            onClick={() => handleSaveNotes(req.id)}
                            className="p-1 px-2 py-1 bg-white/5 hover:bg-white/10 text-xs rounded border border-white/10 cursor-pointer text-white whitespace-nowrap transition-all"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between flex-wrap gap-2">
                      <span className="text-[9px] text-zinc-600 font-mono">Ordered {new Date(req.created_at).toLocaleDateString()}</span>
                      <div className="flex items-center gap-1">
                        {req.status === 'pending' && (
                          <>
                            <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs bg-indigo-500/15 text-indigo-400 border-indigo-500/25 hover:bg-indigo-500/25 font-bold" onClick={() => handleUpdateStatus(req.id, 'approved')}>
                              Approve
                            </Button>
                            <Button size="sm" variant="danger" className="h-8 px-2.5 text-xs font-bold" onClick={() => handleUpdateStatus(req.id, 'rejected')}>
                              Reject
                            </Button>
                          </>
                        )}
                        {req.status === 'approved' && (
                          <Button size="sm" className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 font-bold" onClick={() => handleUpdateStatus(req.id, 'fulfilled')}>
                            Mark Fulfilled
                          </Button>
                        )}
                        {(req.status === 'fulfilled' || req.status === 'rejected') && (
                          <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs" onClick={() => handleUpdateStatus(req.id, 'pending')}>
                            Re-Open Request
                          </Button>
                        )}
                        <button 
                          onClick={() => handleDeleteRequest(req.id)} 
                          className="p-2 text-zinc-500 hover:text-rose-400 rounded-lg bg-zinc-900 transition-all cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-sm text-zinc-500">
                  No suggests current match standard.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
