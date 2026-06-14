import { useState, useEffect } from 'react';
import { supabase } from './config/supabase';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import type { User } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authScreen, setAuthScreen] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    // Check current user session on mount
    const checkUser = async () => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        setUser(currentUser);
      } catch (err) {
        console.error('Error fetching user:', err);
      } finally {
        setLoading(false);
      }
    };

    checkUser();

    // Listen for auth state changes (login, logout, token refresh, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (err) {
      console.error('Error logging out:', err);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-black text-white gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
        <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Loading Session...</span>
      </div>
    );
  }

  if (!user) {
    if (authScreen === 'signup') {
      return <Signup onShowLogin={() => setAuthScreen('login')} />;
    }
    return (
      <Login
        onShowSignup={() => setAuthScreen('signup')}
        onSuccess={() => setAuthScreen('login')}
      />
    );
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
}
