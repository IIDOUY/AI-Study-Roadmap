import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { X, Moon, Sun, Bell, Clock, LogOut, User, Shield, Check, Key, Sparkles, CreditCard } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface SettingsProps {
  user: any;
  onClose: () => void;
  onLogout: () => void;
  apiKey: string;
  onUpdateApiKey: (key: string) => void;
  isPro: boolean;
  onUpgrade: () => void;
}

const Settings: React.FC<SettingsProps> = ({ user, onClose, onLogout, apiKey, onUpdateApiKey, isPro, onUpgrade }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [theme, setTheme] = useState<'light' | 'dark'>(
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );

  useEffect(() => {
    fetchProfile();
    setLocalApiKey(apiKey);
  }, [user, apiKey]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setProfile(data);
        // Sync theme with DB preference if available
        if (data.preferences?.darkMode) {
           setTheme('dark');
           document.documentElement.classList.add('dark');
           localStorage.setItem('theme', 'dark');
        } else {
           setTheme('light');
           document.documentElement.classList.remove('dark');
           localStorage.setItem('theme', 'light');
        }
      } else {
        // Create skeleton if no profile exists yet
        setProfile({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || '',
            preferences: { darkMode: false, emailNotifications: true, focusTimerMinutes: 25 }
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: keyof UserProfile['preferences'], value: any) => {
    if (!profile) return;
    
    // 1. Calculate new state
    const newPreferences = {
        ...profile.preferences,
        [key]: value
    };

    const updatedProfile = {
        ...profile,
        preferences: newPreferences
    };

    // 2. Optimistic Update
    setProfile(updatedProfile);

    // 3. Side Effects
    if (key === 'darkMode') {
        if (value) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            setTheme('dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
            setTheme('light');
        }
    }

    // 4. Database Persistence
    try {
        setSaving(true);
        const { error } = await supabase
            .from('profiles')
            .upsert({
                id: user.id,
                email: user.email, // Include email to be safe
                updated_at: new Date().toISOString(),
                preferences: newPreferences
            }, { onConflict: 'id' });

        if (error) {
            console.error("Supabase update error:", error);
            // Revert changes if strictly necessary, or notify user
        }
    } catch (error) {
        console.error("Error saving preferences", error);
    } finally {
        setSaving(false);
    }
  };

  const handleApiKeyBlur = () => {
    if (localApiKey !== apiKey) {
       onUpdateApiKey(localApiKey);
    }
  };

  if (loading) return null; // Or a spinner

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 dark:border-gray-800 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
           <h3 className="font-bold text-gray-900 dark:text-white text-lg flex items-center gap-2">
             Settings & Profile
           </h3>
           <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <X className="w-5 h-5" />
           </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
            
            {/* User Profile Section */}
            <section className="flex items-center gap-4">
               <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 text-2xl font-bold font-serif italic border-2 border-white dark:border-gray-700 shadow-sm">
                  {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
               </div>
               <div className="flex-1">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                    {profile?.full_name || 'Student'}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${isPro ? 'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800' : 'bg-gray-50 text-gray-700 border-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'}`}>
                        {isPro ? <Sparkles className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                        {isPro ? 'Pro Plan' : 'Free Plan'}
                    </span>
                    {!isPro && (
                        <button 
                            onClick={onUpgrade}
                            className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                            Upgrade
                        </button>
                    )}
                  </div>
               </div>
            </section>
            
            {!isPro && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg relative overflow-hidden group cursor-pointer" onClick={onUpgrade}>
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Sparkles className="w-24 h-24" />
                    </div>
                    <div className="relative z-10">
                        <h4 className="font-bold flex items-center gap-2 text-sm mb-1">
                            <Sparkles className="w-4 h-4" /> Upgrade to Pro
                        </h4>
                        <p className="text-xs text-indigo-100 mb-3">
                            Unlock unlimited projects and AI insights for just $1/month.
                        </p>
                        <button className="px-3 py-1.5 bg-white text-indigo-600 rounded-lg text-xs font-bold shadow-sm hover:bg-indigo-50 transition-colors">
                            Upgrade Now
                        </button>
                    </div>
                </div>
            )}

            <div className="h-px bg-gray-100 dark:bg-gray-800" />

            {/* API Key Configuration */}
            <section>
                <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Configuration</h5>
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                            <Key className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">Gemini API Key</p>
                            <p className="text-xs text-gray-500">Required for AI analysis features.</p>
                        </div>
                    </div>
                    <input 
                        type="password"
                        value={localApiKey}
                        onChange={(e) => setLocalApiKey(e.target.value)}
                        onBlur={handleApiKeyBlur}
                        placeholder="AIzaSy..."
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white transition-all"
                    />
                    <p className="text-[10px] text-gray-400 mt-2">
                        Stored locally on your device. Never sent to our servers.
                    </p>
                  </div>
                </div>
            </section>

            {/* Appearance */}
            <section>
                <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Appearance</h5>
                <div className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer" onClick={() => updatePreference('darkMode', !profile?.preferences.darkMode)}>
                   <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${profile?.preferences.darkMode ? 'bg-indigo-100 text-indigo-600' : 'bg-orange-100 text-orange-600'}`}>
                         {profile?.preferences.darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                      </div>
                      <div>
                         <p className="font-medium text-gray-900 dark:text-white">Dark Mode</p>
                         <p className="text-xs text-gray-500">Adjust the interface for low light.</p>
                      </div>
                   </div>
                   <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${profile?.preferences.darkMode ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`}>
                      <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-300 ${profile?.preferences.darkMode ? 'translate-x-5' : 'translate-x-0'}`} />
                   </div>
                </div>
            </section>

            {/* Preferences */}
            <section>
                <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Study Preferences</h5>
                
                <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                                <Bell className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="font-medium text-gray-900 dark:text-white">Email Notifications</p>
                                <p className="text-xs text-gray-500">Weekly progress summaries.</p>
                            </div>
                        </div>
                         <button 
                            onClick={() => updatePreference('emailNotifications', !profile?.preferences.emailNotifications)}
                            className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${profile?.preferences.emailNotifications ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 dark:border-gray-600'}`}
                         >
                            {profile?.preferences.emailNotifications && <Check className="w-3.5 h-3.5 text-white" />}
                         </button>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="font-medium text-gray-900 dark:text-white">Focus Session Length</p>
                                <p className="text-xs text-gray-500">Default duration for tasks.</p>
                            </div>
                        </div>
                        <select 
                            value={profile?.preferences.focusTimerMinutes}
                            onChange={(e) => updatePreference('focusTimerMinutes', parseInt(e.target.value))}
                            className="text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 outline-none focus:border-indigo-500 dark:text-white"
                        >
                            <option value={25}>25 min</option>
                            <option value={45}>45 min</option>
                            <option value={60}>60 min</option>
                        </select>
                    </div>
                </div>
            </section>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
           <button 
             onClick={onLogout}
             className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-100 dark:hover:border-red-800 rounded-lg font-medium transition-colors"
           >
              <LogOut className="w-4 h-4" />
              Sign Out
           </button>
           <p className="text-center text-[10px] text-gray-400 mt-4">Version 1.2.0 • Cortexa AI</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;