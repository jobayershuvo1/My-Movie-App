import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { Plus, Clock, CheckCircle2, XCircle, Search as SearchIcon } from 'lucide-react';
import { Button } from '../../components/ui/Button';

interface Request {
  id: string;
  title: string;
  year: number;
  status: string;
  notes: string;
  created_at: string;
}

export default function Requests() {
  const { profile } = useAuthStore();
  const [requests, setRequests] = useState<Request[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [notes, setNotes] = useState('');

  const fetchRequests = async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('movie_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setRequests(data);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !profile) return;
    setLoading(true);
    setFeedback(null);

    // Verify session to prevent stale token RLS errors
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setFeedback({ type: 'error', message: 'Your login session is expired. Please log in again.' });
      setLoading(false);
      return;
    }

    const requestData = {
      user_id: session.user.id,
      title,
      year: parseInt(year) || null,
      notes,
      status: 'pending'
    };

    const { error, data: insertedReq } = await supabase.from('movie_requests').insert([requestData]).select().single();

    if (!error) {
      // Manually add to activity_logs to ensure it displays in the CMS logs if DB trigger fails
      await supabase.from('activity_logs').insert([{
        user_id: session.user.id,
        action: 'request_created',
        details: `Submitted movie request for "${title}"`,
        metadata: { request_id: insertedReq?.id, title: title }
      }]);

      setIsAdding(false);
      fetchRequests();
      setTitle(''); setYear(''); setNotes('');
      setFeedback({ type: 'success', message: 'Movie request submitted successfully! Our editors will publish it soon.' });
    } else {
      setFeedback({ type: 'error', message: 'Error submitting request: ' + error.message });
    }
    setLoading(false);
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'fulfilled': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'rejected': return <XCircle className="w-4 h-4 text-rose-500" />;
      default: return <Clock className="w-4 h-4 text-amber-500" />;
    }
  };

  return (
    <div className="flex-1 w-full bg-[#050505] min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-16 space-y-8">
        
        <div className="flex items-center justify-between border-b border-white/5 pb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Movie Requests</h1>
            <p className="text-sm text-zinc-400">Can't find a movie? Request it here and our moderators will upload it.</p>
          </div>
          {profile ? (
            <Button onClick={() => { setIsAdding(!isAdding); setFeedback(null); }} className="gap-2 accent-glow">
              <Plus className="w-4 h-4" /> New Request
            </Button>
          ) : (
            <p className="text-sm text-zinc-500">Log in to create requests.</p>
          )}
        </div>

        {feedback && (
          <div className={`p-4 rounded-xl border text-sm flex items-center justify-between gap-3 ${
            feedback.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            <span>{feedback.message}</span>
            <button onClick={() => setFeedback(null)} className="text-xs hover:underline cursor-pointer opacity-80">Close</button>
          </div>
        )}

        {isAdding && profile && (
          <form onSubmit={handleSubmit} className="glass p-6 rounded-xl space-y-4 mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">Submit New Request</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Movie Title <span className="text-red-500">*</span></label>
                <input required value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500/50" placeholder="e.g. The Matrix" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Release Year</label>
                <input type="number" value={year} onChange={e => setYear(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500/50" placeholder="1999" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Additional Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500/50 resize-none h-24" placeholder="Any specific quality or language requests?"></textarea>
            </div>
            <div className="flex justify-end pt-2 gap-3">
              <Button variant="ghost" type="button" onClick={() => setIsAdding(false)}>Cancel</Button>
              <Button type="submit" disabled={loading} className="accent-glow">
                {loading ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </form>
        )}

        <div className="glass rounded-xl overflow-hidden">
          <div className="divide-y divide-white/5">
            {requests.map((request) => (
              <div key={request.id} className="p-6 flex items-start justify-between card-hover transition-colors">
                <div>
                  <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                    {request.title} <span className="text-sm text-zinc-500 font-normal">({request.year || 'N/A'})</span>
                  </h4>
                  {request.notes && <p className="text-sm text-zinc-400 mt-2">{request.notes}</p>}
                  <p className="text-xs text-zinc-500 font-mono mt-3">Requested on {new Date(request.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 glass rounded-full text-sm font-medium capitalize">
                  {getStatusIcon(request.status)}
                  <span className={
                    request.status === 'fulfilled' ? 'text-emerald-400' :
                    request.status === 'rejected' ? 'text-rose-400' :
                    'text-amber-400'
                  }>{request.status}</span>
                </div>
              </div>
            ))}
            
            {requests.length === 0 && (
              <div className="p-12 text-center text-zinc-500">
                <SearchIcon className="w-12 h-12 mx-auto mb-4 text-zinc-700" />
                <p className="text-lg font-medium text-zinc-300">No requests found</p>
                <p className="text-sm mt-1">Be the first to request a movie!</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
