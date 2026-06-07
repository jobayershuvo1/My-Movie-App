import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return setError("Supabase is not configured yet.");
    setLoading(true);
    setError(null);
    
    // In production, the redirectTo URL should be pointing to a reset-password page
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
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
        <div className="w-full max-w-sm glass p-8 rounded-2xl text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Email Sent</h2>
          <p className="text-sm text-zinc-400">
            Check your inbox for a password reset link.
          </p>
          <Link to="/login" className="block mt-6">
            <Button variant="outline" className="w-full">Return to Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Reset Password</h2>
          <p className="text-sm text-zinc-400">Enter your email and we'll send you a recovery link.</p>
        </div>

        <form onSubmit={handleReset} className="space-y-4 glass p-6 rounded-2xl">
          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg">
              {error}
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

          <Button type="submit" className="w-full mt-6 accent-glow" size="lg" disabled={loading}>
            {loading ? 'Sending Link...' : 'Send Recovery Link'}
          </Button>
          
          <p className="text-center text-sm text-zinc-500 pt-4">
            Remembered your password? <Link to="/login" className="font-medium text-red-500 hover:text-red-400 hover:underline">Log In</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
