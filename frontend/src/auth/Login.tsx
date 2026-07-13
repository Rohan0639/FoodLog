import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Apple, Loader2, AlertCircle } from 'lucide-react';

interface LoginProps {
  onShowSignup: () => void;
  onSuccess: () => void;
}

export default function Login({ onShowSignup, onSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'An error occurred during login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 text-zinc-100 px-4 relative overflow-hidden">
      {/* Decorative monochrome background blooms */}
      <div className="absolute -top-24 left-1/4 w-[500px] h-[500px] bg-white/[0.04] rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-24 right-1/4 w-[500px] h-[500px] bg-white/[0.03] rounded-full blur-[130px] pointer-events-none" />

      <div className="w-full max-w-md bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 min-[370px]:p-8 backdrop-blur-md shadow-soft-lg relative z-10 animate-pop-in">

        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-black mb-4 shadow-white-sm">
            <Apple className="w-7 h-7 fill-black/10" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Welcome back</h2>
          <p className="text-zinc-500 text-sm mt-1.5">Sign in to track your meals and macros</p>
        </div>

        {error && (
          <div className="mb-5 sm:mb-6 p-4 rounded-2xl bg-zinc-950 border border-zinc-700 flex items-start gap-3 animate-fade-in">
            <AlertCircle className="w-5 h-5 text-zinc-300 shrink-0 mt-0.5" />
            <span className="text-xs text-zinc-300 leading-relaxed font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400 font-semibold block pl-1">Email address</label>
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-zinc-800 bg-zinc-950 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-4 focus:ring-white/5 transition duration-200"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400 font-semibold block pl-1">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-zinc-800 bg-zinc-950 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-4 focus:ring-white/5 transition duration-200"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-white text-black font-semibold rounded-2xl hover:bg-zinc-200 transition duration-200 flex items-center justify-center gap-2 text-sm shadow-white-sm active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-zinc-800 text-center">
          <p className="text-zinc-500 text-xs">
            Don't have an account?{' '}
            <button
              onClick={onShowSignup}
              className="text-white hover:underline font-semibold"
            >
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
