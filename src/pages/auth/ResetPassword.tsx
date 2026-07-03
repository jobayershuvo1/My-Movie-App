import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, CheckCircle2, ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // Whether Supabase established a recovery session from the email link.
  const [ready, setReady] = useState(false);

  // When the user arrives from the recovery email, supabase-js parses the
  // access token in the URL and fires a PASSWORD_RECOVERY event with a session.
  useEffect(() => {
    if (!supabase) {
      setError('Supabase is not configured yet.');
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setReady(true);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return setError('Supabase is not configured yet.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');

    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.updateUser({ password });

    if (authError) {
      setError(authError.message);
    } else {
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm glass p-8 rounded-2xl text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Password Updated</h2>
          <p className="text-sm text-zinc-400">
            Your password has been changed. Redirecting you to login…
          </p>
          <Link to="/login" className="block mt-6">
            <Button variant="outline" className="w-full">Go to Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Set New Password</h2>
          <p className="text-sm text-zinc-400">Choose a new password for your CineVault account.</p>
        </div>

        <form onSubmit={handleUpdate} className="space-y-4 glass p-6 rounded-2xl">
          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg">
              {error}
            </div>
          )}

          {!ready && !error && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 text-left rounded-xl flex gap-2.5">
              <ShieldAlert className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
              <p className="text-xs text-zinc-300 leading-relaxed">
                Open this page from the recovery link in your email. If you got here directly,
                request a new link from <Link to="/forgot-password" className="text-red-400 hover:underline">Forgot Password</Link>.
              </p>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium text-zinc-300">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-5 w-5 text-zinc-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-zinc-300">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-5 w-5 text-zinc-500" />
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <Button type="submit" className="w-full mt-6 accent-glow" size="lg" disabled={loading || !ready}>
            {loading ? 'Updating…' : 'Update Password'}
          </Button>

          <p className="text-center text-sm text-zinc-500 pt-4">
            Remembered your password? <Link to="/login" className="font-medium text-red-500 hover:text-red-400 hover:underline">Log In</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
