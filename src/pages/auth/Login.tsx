import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Lock, Mail } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';

export default function Login() {
  const { profile } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  if (profile) return <Navigate to="/" replace />;
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return setError("Local database is not available yet.");
    setLoading(true);
    setError(null);
    
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (authError) {
      setError(authError.message);
    } else if (data?.user) {
      // Track login action manually
      await supabase.from('activity_logs').insert({
        user_id: data.user.id,
        action: 'auth_sign_in',
        details: `User session opened for ${email} following email credentials login`,
        metadata: { email }
      });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Welcome Back</h2>
          <p className="text-sm text-zinc-400">Sign in to your CineVault account to access downloads.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 glass p-6 rounded-2xl">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-200">
            <p className="font-semibold">Local admin account</p>
            <p className="mt-1 font-mono">admin@cinevault.local / admin123</p>
          </div>
          {error && (
            <div className="space-y-3">
              <div className="p-3 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg">
                {error}
              </div>
              {(error.toLowerCase().includes('confirm') || error.toLowerCase().includes('verify')) && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 text-left rounded-xl space-y-2">
                  <h4 className="text-xs font-bold text-yellow-500 font-mono flex items-center gap-1.5 uppercase">
                    💡 Email Verification Issue?
                  </h4>
                  <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                    By default, Supabase requires you to confirm your email. To bypass this requirement for testing:
                  </p>
                  <ol className="text-xs text-zinc-400 list-decimal list-inside space-y-1">
                    <li>Go to your <span className="text-zinc-200 font-semibold">Supabase Dashboard &gt; Auth &gt; Providers &gt; Email</span>.</li>
                    <li>Toggle OFF <span className="text-zinc-200 font-semibold">"Confirm email"</span> and save.</li>
                    <li>Or, go to the <span className="text-zinc-200 font-semibold">Auth &gt; Users</span> tab, click the three dots next to your user, and choose <span className="text-zinc-200 font-semibold">"Confirm User"</span>.</li>
                  </ol>
                </div>
              )}
            </div>
          )}
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-zinc-300">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-5 w-5 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-300">Password</label>
              <Link to="/forgot-password" className="text-xs text-red-500 hover:text-red-400 hover:underline">Forgot password?</Link>
            </div>
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

          <Button type="submit" className="w-full mt-6" size="lg" disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In'}
          </Button>
          
          <p className="text-center text-sm text-zinc-500 pt-4">
            Don't have an account? <Link to="/register" className="font-medium text-red-500 hover:text-red-400 hover:underline">Register</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
