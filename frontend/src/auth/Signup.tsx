import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Apple, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

interface SignupProps {
  onShowLogin: () => void;
}

export default function Signup({ onShowLogin }: SignupProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) throw signUpError;
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'An error occurred during signup.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-black text-white px-4 relative overflow-hidden">
      {/* Decorative subtle background gradients */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-zinc-900/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-zinc-900/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-zinc-950/80 border border-zinc-900 rounded-2xl p-6 min-[370px]:p-8 backdrop-blur-md shadow-2xl relative z-10">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-black mb-3 shadow">
            <Apple className="w-7 h-7 fill-black/10" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Create an Account</h2>
          <p className="text-zinc-500 text-xs mt-1">Get started with your digital food diary</p>
        </div>

        {error && (
          <div className="mb-5 sm:mb-6 p-4 rounded-xl bg-red-950/30 border border-red-900/50 flex items-start gap-3 animate-fade-in">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <span className="text-xs text-red-200 leading-relaxed">{error}</span>
          </div>
        )}

        {success ? (
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-950/50 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-white">Registration Successful!</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Check your email to confirm your account, then click the button below to sign in.
              </p>
            </div>
            <button
              onClick={onShowLogin}
              className="w-full py-3 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 transition duration-200 text-sm shadow-sm active:scale-[0.98]"
            >
              Go to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Email Address</label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition duration-200"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Password</label>
              <input
                type="password"
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition duration-200"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Confirm Password</label>
              <input
                type="password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition duration-200"
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
                  Creating account...
                </>
              ) : (
                'Sign Up'
              )}
            </button>
          </form>
        )}

        {!success && (
          <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-zinc-900 text-center">
            <p className="text-zinc-500 text-xs">
              Already have an account?{' '}
              <button
                onClick={onShowLogin}
                className="text-white hover:underline font-semibold"
              >
                Sign in
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
