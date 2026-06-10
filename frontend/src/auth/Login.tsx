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
    <div className="min-h-screen w-full flex items-center justify-center bg-black text-white px-4 relative overflow-hidden">
      {/* Decorative subtle background gradients */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-zinc-900/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-zinc-900/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-zinc-950/80 border border-zinc-900 rounded-2xl p-8 backdrop-blur-md shadow-2xl relative z-10">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-black mb-3 shadow">
            <Apple className="w-7 h-7 fill-black/10" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Welcome to FoodLog</h2>
          <p className="text-zinc-500 text-xs mt-1">Sign in to track your meals and macros</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/30 border border-red-900/50 flex items-start gap-3 animate-fade-in">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <span className="text-xs text-red-200 leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Email Address</label>
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-zinc-850 bg-zinc-900 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition duration-200"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-zinc-850 bg-zinc-900 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition duration-200"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 transition duration-200 flex items-center justify-center gap-2 text-sm shadow-sm active:scale-[0.98]"
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

        <div className="mt-8 pt-6 border-t border-zinc-900 text-center">
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
