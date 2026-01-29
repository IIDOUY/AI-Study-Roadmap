import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Loader2, Mail, Lock, ArrowLeft, Chrome } from 'lucide-react';

interface AuthProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const Auth: React.FC<AuthProps> = ({ onSuccess, onCancel }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });
        if (error) throw error;
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 animate-fade-in bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        
        {/* Header */}
        <div className="px-8 pt-10 pb-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {isLogin ? 'Welcome back' : 'Create an account'}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {isLogin ? 'Enter your details to access your roadmaps.' : 'Start your learning journey with Cortexa.'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleAuth} className="px-8 pb-10 space-y-5">
          {error && (
            <div className="p-4 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-800">
              {error}
            </div>
          )}

          {!isLogin && (
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2 ml-1">Full Name</label>
              <div className="relative">
                <input
                  type="text"
                  required={!isLogin}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent outline-none transition-all dark:text-white"
                  placeholder="John Doe"
                />
                <Chrome className="w-5 h-5 text-gray-400 absolute left-3.5 top-3" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2 ml-1">Email Address</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent outline-none transition-all dark:text-white"
                placeholder="you@example.com"
              />
              <Mail className="w-5 h-5 text-gray-400 absolute left-3.5 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2 ml-1">Password</label>
            <div className="relative">
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent outline-none transition-all dark:text-white"
                placeholder="••••••••"
              />
              <Lock className="w-5 h-5 text-gray-400 absolute left-3.5 top-3" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold text-sm hover:opacity-90 transition-transform active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? 'Sign In' : 'Create Account')}
          </button>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase font-bold tracking-wider">
              <span className="bg-white dark:bg-gray-900 px-3 text-gray-400">or</span>
            </div>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(null); }}
              className="text-sm font-bold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </form>

        <div className="bg-gray-50 dark:bg-gray-950 px-8 py-4 border-t border-gray-100 dark:border-gray-800 flex justify-center">
           <button 
             onClick={onCancel}
             className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors uppercase tracking-wide"
           >
             <ArrowLeft className="w-3 h-3" />
             Back to Home
           </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;