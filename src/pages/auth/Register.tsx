import React, { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Lock, Mail, User } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';

export default function Register() {
  const { profile } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  if (profile) return <Navigate to="/" replace />;
  
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return setError("Supabase is not configured yet.");
    setLoading(true);
    setError(null);
    
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        }
      }
    });
    
    if (authError) {
      setError(authError.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md glass p-8 rounded-2xl text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Check your email</h2>
          <p className="text-sm text-zinc-400">
            We've sent a verification link to <strong>{email}</strong>. Please check your inbox or spam folder to verify your account.
          </p>
          
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 text-left rounded-xl mt-4 space-y-2">
            <h4 className="text-xs font-bold text-yellow-500 font-mono flex items-center gap-1.5 uppercase">
              💡 Developer Sandbox Quick Tip:
            </h4>
            <p className="text-xs text-zinc-300 leading-relaxed">
              If you aren't receiving the activation email, or want to register instantly without email confirmation:
            </p>
            <ol className="text-xs text-zinc-400 list-decimal list-inside space-y-1">
              <li>Open your <span className="text-zinc-200 font-semibold">Supabase Dashboard</span>.</li>
              <li>Navigate to <span className="text-zinc-200 font-semibold">Auth &gt; Providers &gt; Email</span>.</li>
              <li>Turn OFF <span className="text-zinc-200 font-semibold">"Confirm email"</span> and save.</li>
              <li>Now, newly registered users can log in instantly without verification!</li>
            </ol>
          </div>

          <Link to="/login" className="block mt-6">
            <Button variant="outline" className="w-full">Back to Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Create Account</h2>
          <p className="text-sm text-zinc-400">Join CineVault to request movies and access premium links.</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4 glass p-6 rounded-2xl">
          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg">
              {error}
            </div>
          )}
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-zinc-300">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-5 w-5 text-zinc-500" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                placeholder="John Doe"
              />
            </div>
          </div>

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
            <label className="text-sm font-medium text-zinc-300">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-5 w-5 text-zinc-500" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <Button type="submit" className="w-full mt-6 accent-glow" size="lg" disabled={loading}>
            {loading ? 'Creating Account...' : 'Sign Up'}
          </Button>
          
          <p className="text-center text-sm text-zinc-500 pt-4">
            Already have an account? <Link to="/login" className="font-medium text-red-500 hover:text-red-400 hover:underline">Sign In</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
