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
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 text-zinc-100 px-4 relative overflow-hidden">
      {/* Decorative monochrome background blooms */}
      <div className="absolute -top-24 right-1/4 w-[500px] h-[500px] bg-white/[0.04] rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-24 left-1/4 w-[500px] h-[500px] bg-white/[0.03] rounded-full blur-[130px] pointer-events-none" />

      <div className="w-full max-w-md bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 min-[370px]:p-8 backdrop-blur-md shadow-soft-lg relative z-10 animate-pop-in">

        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-black mb-4 shadow-white-sm">
            <Apple className="w-7 h-7 fill-black/10" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Create an account</h2>
          <p className="text-zinc-500 text-sm mt-1.5">Get started with your digital food diary</p>
        </div>

        {error && (
          <div className="mb-5 sm:mb-6 p-4 rounded-2xl bg-zinc-950 border border-zinc-700 flex items-start gap-3 animate-fade-in">
            <AlertCircle className="w-5 h-5 text-zinc-300 shrink-0 mt-0.5" />
            <span className="text-xs text-zinc-300 leading-relaxed font-medium">{error}</span>
          </div>
        )}

        {success ? (
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 rounded-full bg-zinc-950 border border-zinc-700 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Registration successful!</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Check your email to confirm your account, then click the button below to sign in.
              </p>
            </div>
            <button
              onClick={onShowLogin}
              className="w-full py-3.5 bg-white text-black font-semibold rounded-2xl hover:bg-zinc-200 transition duration-200 text-sm shadow-white-sm active:scale-[0.98]"
            >
              Go to Sign In
            </button>
          </div>
        ) : (
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
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-zinc-800 bg-zinc-950 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-4 focus:ring-white/5 transition duration-200"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-semibold block pl-1">Confirm password</label>
              <input
                type="password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
                  Creating account...
                </>
              ) : (
                'Sign Up'
              )}
            </button>
          </form>
        )}

        {!success && (
          <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-zinc-800 text-center">
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
