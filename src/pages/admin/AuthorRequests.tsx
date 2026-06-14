import { useEffect, useState } from 'react';
import {
  UserPlus,
  Check,
  X,
  Clock,
  RefreshCw,
  ShieldAlert,
  Mail,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { Button } from '../../components/ui/Button';
import type { AuthorRequest } from '../../types/database.types';

export default function AuthorRequests() {
  const { profile } = useAuthStore();
  const [requests, setRequests] = useState<AuthorRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canReview = ['super_admin', 'admin', 'moderator'].includes(profile?.role || '');

  const fetchRequests = async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('author_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (err) throw err;
      setRequests(data || []);
    } catch (err: any) {
      console.error('Error fetching author requests:', err);
      setError(err.message || 'Could not load author requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleReview = async (id: string, approve: boolean) => {
    if (!supabase) return;
    setProcessingId(id);
    setError(null);
    try {
      const { error: rpcErr } = await supabase.rpc('review_author_request', {
        p_request_id: id,
        p_approve: approve,
        p_notes: null,
      });
      if (rpcErr) throw rpcErr;
      setRequests(prev =>
        prev.map(r => (r.id === id ? { ...r, status: approve ? 'approved' : 'rejected' } : r))
      );
    } catch (err: any) {
      console.error('Error reviewing request:', err);
      setError(err.message || 'Could not process this request. Make sure blog.sql has been run.');
    } finally {
      setProcessingId(null);
    }
  };

  if (!canReview) {
    return (
      <div className="p-8 text-center bg-zinc-950 text-white flex flex-col items-center justify-center min-h-[50vh]">
        <ShieldAlert className="w-12 h-12 text-red-500 mb-4 animate-bounce" />
        <h3 className="text-xl font-bold mb-2">Access Denied</h3>
        <p className="text-zinc-400 max-w-md">Only Super Admins, Admins, and Moderators can review author applications.</p>
      </div>
    );
  }

  const pending = requests.filter(r => r.status === 'pending');

  const statusBadge = (status: string) => {
    if (status === 'approved') return <span className="text-xs font-semibold px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">Approved</span>;
    if (status === 'rejected') return <span className="text-xs font-semibold px-2.5 py-0.5 bg-rose-500/10 text-rose-400 rounded-full border border-rose-500/20">Rejected</span>;
    return <span className="text-xs font-semibold px-2.5 py-0.5 bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20">Pending</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white mb-1">Author Applications</h2>
          <p className="text-sm text-zinc-400">Review requests from members who want to write blog posts. Approving promotes them to the Author role.</p>
        </div>
        <Button variant="secondary" onClick={fetchRequests} disabled={loading} className="flex items-center gap-1.5 self-start sm:self-auto">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Reload
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-900/10 border border-red-500/20 rounded-xl text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="glass p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 font-medium">Pending</p>
            <p className="text-xl sm:text-2xl font-bold text-amber-400 mt-1">{pending.length}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>
        <div className="glass p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 font-medium">Approved</p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-400 mt-1">{requests.filter(r => r.status === 'approved').length}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <UserPlus className="w-5 h-5" />
          </div>
        </div>
        <div className="glass p-4 rounded-xl flex items-center justify-between col-span-2 lg:col-span-1">
          <div>
            <p className="text-xs text-zinc-500 font-medium">Total Applications</p>
            <p className="text-xl sm:text-2xl font-bold text-white mt-1">{requests.length}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-zinc-800 text-zinc-400 flex items-center justify-center">
            <Mail className="w-5 h-5" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-zinc-500 font-mono text-xs">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-red-500" />
          Loading applications...
        </div>
      ) : requests.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center text-zinc-500">
          <UserPlus className="w-12 h-12 mx-auto mb-4 text-zinc-700" />
          <p className="text-lg font-medium text-zinc-300">No author applications yet</p>
          <p className="text-sm mt-1">Member requests will appear here for review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map(req => (
            <div key={req.id} className="glass rounded-xl p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-zinc-800 text-zinc-200 flex items-center justify-center font-bold shrink-0">
                    {(req.full_name || req.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{req.full_name || 'Unnamed Member'}</p>
                    <p className="text-xs text-zinc-500 font-mono truncate">{req.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {statusBadge(req.status)}
                  <span className="text-[11px] text-zinc-500 font-mono">{new Date(req.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {req.bio && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">Bio</p>
                  <p className="text-sm text-zinc-300">{req.bio}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">Why they want to write</p>
                <p className="text-sm text-zinc-300">{req.reason}</p>
              </div>
              {req.sample_link && (
                <a href={req.sample_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300">
                  <ExternalLink className="w-3.5 h-3.5" /> Sample work
                </a>
              )}

              {req.status === 'pending' && (
                <div className="flex items-center gap-3 pt-3 border-t border-white/5">
                  <Button
                    onClick={() => handleReview(req.id, true)}
                    disabled={processingId === req.id}
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 border-none"
                    size="sm"
                  >
                    {processingId === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Approve &amp; Promote
                  </Button>
                  <Button
                    onClick={() => handleReview(req.id, false)}
                    disabled={processingId === req.id}
                    variant="danger"
                    size="sm"
                    className="gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" /> Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
