import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { PenLine, CheckCircle2, Clock, XCircle, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { Button } from '../../components/ui/Button';
import type { AuthorRequest } from '../../types/database.types';

export default function BecomeAuthor() {
  const { profile } = useAuthStore();
  const [existing, setExisting] = useState<AuthorRequest | null>(null);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bio, setBio] = useState('');
  const [reason, setReason] = useState('');
  const [sampleLink, setSampleLink] = useState('');

  const isAlreadyAuthor = profile && ['author', 'editor', 'moderator', 'admin', 'super_admin'].includes(profile.role);

  useEffect(() => {
    const checkExisting = async () => {
      if (!supabase || !profile) { setChecking(false); return; }
      try {
        const { data } = await supabase
          .from('author_requests')
          .select('*')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) setExisting(data);
      } catch (err) {
        console.error('Error checking author request:', err);
      } finally {
        setChecking(false);
      }
    };
    checkExisting();
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !profile) return;
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Your session expired. Please sign in again.');
        setLoading(false);
        return;
      }

      const { error: insErr } = await supabase.from('author_requests').insert([{
        user_id: session.user.id,
        full_name: profile.full_name,
        email: profile.email,
        bio: bio.trim() || null,
        reason: reason.trim(),
        sample_link: sampleLink.trim() || null,
      }]);
      if (insErr) throw insErr;
      setSubmitted(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Could not submit your application.');
    } finally {
      setLoading(false);
    }
  };

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="flex-1 w-full bg-[#050505] min-h-screen">
      <Helmet>
        <title>Become an Author | CineVault Blog</title>
        <meta name="description" content="Apply to become a CineVault author and publish your own movie reviews, news, and editorials." />
      </Helmet>
      <div className="max-w-2xl mx-auto px-4 py-16">{children}</div>
    </div>
  );

  // Not signed in
  if (!profile) {
    return (
      <Shell>
        <div className="glass rounded-2xl p-10 text-center space-y-4">
          <PenLine className="w-12 h-12 mx-auto text-red-500" />
          <h1 className="text-2xl font-bold text-white">Become an Author</h1>
          <p className="text-zinc-400">You need an account to apply. Sign in or create one to get started.</p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link to="/login" className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">Sign In</Link>
            <Link to="/register" className="border border-white/10 hover:bg-white/5 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">Register</Link>
          </div>
        </div>
      </Shell>
    );
  }

  // Already has writing access
  if (isAlreadyAuthor) {
    return (
      <Shell>
        <div className="glass rounded-2xl p-10 text-center space-y-4">
          <Sparkles className="w-12 h-12 mx-auto text-emerald-400" />
          <h1 className="text-2xl font-bold text-white">You can already write!</h1>
          <p className="text-zinc-400">Your account has author privileges. Head to your dashboard to create and manage posts.</p>
          <Link to="/admin/posts" className="inline-block bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">Go to Blog Posts</Link>
        </div>
      </Shell>
    );
  }

  if (checking) {
    return (
      <Shell>
        <div className="text-center py-20 text-zinc-500">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-red-500" />
        </div>
      </Shell>
    );
  }

  // Existing pending / approved / rejected request, or just submitted
  if (submitted || (existing && existing.status !== 'rejected')) {
    const status = submitted ? 'pending' : existing!.status;
    return (
      <Shell>
        <div className="glass rounded-2xl p-10 text-center space-y-4">
          {status === 'approved' ? (
            <>
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400" />
              <h1 className="text-2xl font-bold text-white">Application Approved 🎉</h1>
              <p className="text-zinc-400">You're now an author! Start writing from your dashboard.</p>
              <Link to="/admin/posts" className="inline-block bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">Go to Blog Posts</Link>
            </>
          ) : (
            <>
              <Clock className="w-12 h-12 mx-auto text-amber-400" />
              <h1 className="text-2xl font-bold text-white">Application Submitted</h1>
              <p className="text-zinc-400">Thanks for applying! Our team is reviewing your request to become an author. You'll get a notification once it's been reviewed.</p>
              <Link to="/blog" className="inline-block border border-white/10 hover:bg-white/5 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">Browse the Blog</Link>
            </>
          )}
        </div>
      </Shell>
    );
  }

  // Form (new applicant or re-applying after rejection)
  return (
    <Shell>
      <div className="space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-red-500 mb-2">
            <PenLine className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-widest">Author Program</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Become an Author</h1>
          <p className="text-sm text-zinc-400 max-w-lg mx-auto">
            Want to publish movie reviews, news, and editorials on CineVault? Tell us a bit about yourself and our team will review your application.
          </p>
        </div>

        {existing && existing.status === 'rejected' && (
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-sm text-rose-300 flex items-start gap-2">
            <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Your previous application wasn't approved{existing.review_notes ? `: ${existing.review_notes}` : ''}. You're welcome to apply again below.</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-sm text-rose-400">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="glass p-6 rounded-2xl space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-300">Short Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-red-500/50 resize-none"
              placeholder="Tell us about yourself and your interest in film..."
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-300">Why do you want to write for us? <span className="text-red-500">*</span></label>
            <textarea
              required
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-red-500/50 resize-none"
              placeholder="What topics would you cover? What experience do you have?"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-300">Sample work link (optional)</label>
            <input
              type="url"
              value={sampleLink}
              onChange={e => setSampleLink(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-red-500/50"
              placeholder="https://... a blog, portfolio, or article you've written"
            />
          </div>
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={loading} className="gap-2 accent-glow">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : <><PenLine className="w-4 h-4" /> Submit Application</>}
            </Button>
          </div>
        </form>
      </div>
    </Shell>
  );
}
