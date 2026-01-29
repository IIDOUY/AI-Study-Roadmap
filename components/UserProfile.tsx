import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile as UserProfileType, Roadmap, ProjectInvitation } from '../types';
import { 
  X, Moon, Sun, Bell, Clock, LogOut, Layout, Settings as SettingsIcon, 
  FileText, Search, Plus, Trash2, Check, Key, ChevronRight, UserPlus, Inbox, Sparkles, Shield,
  Wallet, BarChart2, PieChart as PieChartIcon, CreditCard, HelpCircle, MessageSquare, Star, Mail,
  ChevronDown, User, Menu
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { fetchPendingInvitations, respondToInvitation } from '../services/roadmapService';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface UserProfileProps {
  user: any;
  projects: Roadmap[];
  onStartProject: () => void;
  onOpenProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onLogout: () => void;
  apiKey: string;
  onUpdateApiKey: (key: string) => void;
  isPro: boolean;
  onUpgrade: () => void;
  maxFreeProjects: number;
  onRefreshProjects: () => void;
}

type Tab = 'dashboard' | 'notifications' | 'settings';

const UserProfile: React.FC<UserProfileProps> = ({ 
  user, 
  projects, 
  onStartProject, 
  onOpenProject,
  onDeleteProject,
  onLogout, 
  apiKey, 
  onUpdateApiKey, 
  isPro, 
  onUpgrade,
  maxFreeProjects,
  onRefreshProjects
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [profile, setProfile] = useState<UserProfileType | null>(null);
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Notification State
  const [invitations, setInvitations] = useState<ProjectInvitation[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [expandedInviteId, setExpandedInviteId] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
    setLocalApiKey(apiKey);
    loadInvitations();
  }, [user, apiKey]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        setProfile(data);
        if (data.preferences?.darkMode) {
           document.documentElement.classList.add('dark');
        } else {
           document.documentElement.classList.remove('dark');
        }
      } else {
        setProfile({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || '',
            preferences: { darkMode: false, emailNotifications: true, focusTimerMinutes: 25 },
            is_pro: false
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const loadInvitations = async () => {
      setLoadingInvites(true);
      try {
          const invites = await fetchPendingInvitations();
          setInvitations(invites);
      } catch (e) {
          console.error(e);
      } finally {
          setLoadingInvites(false);
      }
  };

  const handleRespondToInvite = async (invitationId: string, accept: boolean) => {
      try {
          await respondToInvitation(invitationId, accept);
          // Remove from local list
          setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
          setExpandedInviteId(null);
          
          if (accept) {
              onRefreshProjects(); // Fetch new projects
              setActiveTab('dashboard'); // Switch back to view new project
          }
      } catch (e) {
          console.error("Failed to respond", e);
          alert("Failed to process invitation.");
      }
  };

  const updatePreference = async (key: keyof UserProfileType['preferences'], value: any) => {
    if (!profile) return;
    const newPreferences = { ...profile.preferences, [key]: value };
    const updatedProfile = { ...profile, preferences: newPreferences };
    setProfile(updatedProfile);

    if (key === 'darkMode') {
        if (value) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }

    try {
        await supabase
            .from('profiles')
            .upsert({
                id: user.id,
                email: user.email,
                updated_at: new Date().toISOString(),
                preferences: newPreferences
            }, { onConflict: 'id' });
    } catch (error) {
        console.error("Error saving preferences", error);
    }
  };

  // Robust Search Filtering with useMemo
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    
    const lowerQuery = searchQuery.toLowerCase().trim();
    return projects.filter(p => 
      (p.title?.toLowerCase() || '').includes(lowerQuery) || 
      (p.description?.toLowerCase() || '').includes(lowerQuery)
    );
  }, [projects, searchQuery]);

  // Stats Calculations
  const totalTasks = projects.reduce((acc, p) => acc + p.modules.reduce((mAcc, m) => mAcc + m.tasks.length, 0), 0);
  const completedTasks = projects.reduce((acc, p) => acc + p.modules.reduce((mAcc, m) => mAcc + m.tasks.filter(t => t.isCompleted).length, 0), 0);
  
  // Dynamic Daily Progress Calculation (Last 7 Days) for "Study Activity" Card
  const dailyProgressData = useMemo(() => {
    const days = [];
    const today = new Date();
    // Generate last 7 days keys
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        days.push(d.toISOString().split('T')[0]); // YYYY-MM-DD
    }

    const dataMap = new Map<string, { minutes: number, count: number }>();
    days.forEach(day => dataMap.set(day, { minutes: 0, count: 0 }));

    projects.forEach(p => {
        p.modules.forEach(m => {
            m.tasks.forEach(t => {
                if (t.isCompleted && t.completedAt) {
                    const dateKey = t.completedAt.split('T')[0];
                    if (dataMap.has(dateKey)) {
                        const entry = dataMap.get(dateKey)!;
                        entry.minutes += t.estimatedMinutes || 0;
                        entry.count += 1;
                    }
                }
            });
        });
    });

    const chartData = days.map(day => {
        const date = new Date(day);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' }); // Mon, Tue
        const entry = dataMap.get(day)!;
        return {
            name: dayName,
            minutes: entry.minutes,
            count: entry.count,
            fullDate: day
        };
    });

    return { chartData };
  }, [projects]);

  const maxDailyCount = Math.max(...dailyProgressData.chartData.map(d => d.count), 1);

  // Focus Distribution Calculation (For Pie Chart)
  const focusDistribution = useMemo(() => {
    const distribution: Record<string, number> = {};
    let totalMinutes = 0;

    projects.forEach(p => {
      let projectTime = 0;
      p.modules.forEach(m => {
        m.tasks.forEach(t => {
          if (t.isCompleted) {
            projectTime += t.estimatedMinutes || 0;
          }
        });
      });
      if (projectTime > 0) {
        distribution[p.title] = projectTime;
        totalMinutes += projectTime;
      }
    });

    // Convert to array and sort
    return Object.entries(distribution)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5 projects
  }, [projects]);

  const PIE_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100 overflow-hidden transition-colors duration-200">
      
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 flex flex-col border-r border-gray-100 dark:border-gray-800 
        transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-8 pb-4">
           <div className="flex items-center gap-2 mb-10">
              <span className="font-bold text-xl tracking-tight text-gray-900 dark:text-white">Cortexa</span>
           </div>

           <div className="space-y-8">
               <div>
                   <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-4 px-2">Menu</h3>
                   <nav className="space-y-1">
                      <button 
                        onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl transition-colors ${activeTab === 'dashboard' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                      >
                         <Layout className="w-4 h-4" />
                         Dashboard
                      </button>
                      <button 
                        onClick={() => { setActiveTab('notifications'); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl transition-colors ${activeTab === 'notifications' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                      >
                         <Bell className="w-4 h-4" />
                         Notification
                         {invitations.length > 0 && (
                             <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold">
                                 {invitations.length}
                             </span>
                         )}
                      </button>
                      <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                         <Wallet className="w-4 h-4" />
                         Earnings
                      </button>
                      <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                         <PieChartIcon className="w-4 h-4" />
                         Spending
                      </button>
                      <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                         <FileText className="w-4 h-4" />
                         Reports
                      </button>
                   </nav>
               </div>

               <div>
                   <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-4 px-2">General</h3>
                   <nav className="space-y-1">
                      <button 
                         onClick={() => { setActiveTab('settings'); setMobileMenuOpen(false); }}
                         className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl transition-colors ${activeTab === 'settings' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                      >
                         <SettingsIcon className="w-4 h-4" />
                         Settings
                      </button>
                      <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                         <HelpCircle className="w-4 h-4" />
                         Help Center
                      </button>
                      <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                         <MessageSquare className="w-4 h-4" />
                         Feedback
                      </button>
                      <button 
                         onClick={onLogout}
                         className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                         <LogOut className="w-4 h-4" />
                         Log Out
                      </button>
                   </nav>
               </div>
           </div>
        </div>

        <div className="mt-auto p-6">
            <div className="flex items-center gap-3 px-2">
                 <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                    {user.email?.charAt(0).toUpperCase()}
                 </div>
                 <div className="flex-1 overflow-hidden">
                    <p className="text-xs font-bold truncate text-gray-900 dark:text-white">{profile?.full_name || 'User'}</p>
                    <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
                 </div>
            </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-950 flex flex-col">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between p-4 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 shrink-0">
             <div className="flex items-center gap-3">
                 <button 
                    onClick={() => setMobileMenuOpen(true)}
                    className="p-2 -ml-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                 >
                    <Menu className="w-6 h-6" />
                 </button>
                 <span className="font-bold text-lg text-gray-900 dark:text-white">Cortexa</span>
             </div>
             <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                {user.email?.charAt(0).toUpperCase()}
             </div>
        </header>

        <div className="flex-1 p-4 lg:p-8">
            <div className="max-w-[1200px] mx-auto space-y-8">
                
                {activeTab === 'dashboard' && (
                   <>
                     {/* Header & Greeting */}
                     <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Overview</h2>
                            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2">Good Morning, {profile?.full_name?.split(' ')[0] || 'Student'}</h1>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Here's an overview of your study progress and recent activities.</p>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Column: Stats Cards */}
                        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Total Balance Style Card */}
                            <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-between h-48 relative overflow-hidden group">
                               <div className="flex justify-between items-start z-10">
                                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                                    <Wallet className="w-6 h-6 text-gray-900 dark:text-white" />
                                  </div>
                               </div>
                               <div className="z-10">
                                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Tasks Completed</p>
                                  <div className="flex items-center gap-3">
                                    <span className="text-3xl font-bold text-gray-900 dark:text-white">{completedTasks}</span>
                                    <span className="px-2 py-1 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-xs font-bold rounded-lg flex items-center gap-1">
                                        <Sparkles className="w-3 h-3" /> +{Math.round((completedTasks / Math.max(totalTasks, 1)) * 100)}%
                                    </span>
                                  </div>
                               </div>
                               <div className="absolute right-0 bottom-8 opacity-5 scale-150 transform translate-x-4">
                                  <Wallet className="w-32 h-32 dark:text-gray-700" />
                               </div>
                            </div>

                            {/* Chart Preview Style Card (Study Activity) */}
                            <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col h-48">
                               <div className="flex justify-between items-center mb-4">
                                   <p className="text-sm font-bold text-gray-900 dark:text-white">Study Activity (Tasks)</p>
                                   <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-xl">
                                      <CreditCard className="w-4 h-4 text-gray-900 dark:text-white" />
                                    </div>
                               </div>
                               <div className="flex-1 w-full flex items-end justify-between gap-2">
                                   {dailyProgressData.chartData.map((d, i) => (
                                       <div 
                                         key={i} 
                                         className="w-full bg-gray-100 dark:bg-gray-800 rounded-t-sm relative group cursor-pointer transition-all hover:bg-gray-200 dark:hover:bg-gray-700" 
                                         style={{ height: `${d.count > 0 ? (d.count / maxDailyCount) * 80 + 10 : 5}%` }}
                                         title={`${d.count} tasks on ${d.fullDate}`}
                                       >
                                           <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black dark:bg-white text-white dark:text-black text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                               {d.count}
                                           </div>
                                       </div>
                                   ))}
                               </div>
                               <div className="flex justify-between mt-2 text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                                    {dailyProgressData.chartData.map(d => <span key={d.name}>{d.name}</span>)}
                               </div>
                            </div>
                        </div>

                        {/* Right Column: Focus Distribution (Pie Chart) */}
                        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 lg:row-span-2">
                            <div className="h-64 w-full relative">
                                {focusDistribution.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={focusDistribution}
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {focusDistribution.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip 
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', backgroundColor: '#1F2937', color: '#fff' }}
                                                itemStyle={{ fontSize: '12px', color: '#D1D5DB' }}
                                                formatter={(value) => [`${value} mins`, '']}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 dark:text-gray-600">
                                        <PieChartIcon className="w-8 h-8 mb-2 opacity-20" />
                                        <p className="text-xs">No completed tasks yet.</p>
                                    </div>
                                )}
                            </div>
                            {focusDistribution.length > 0 && (
                                <div className="mt-4 space-y-2">
                                    {focusDistribution.slice(0, 3).map((item, idx) => (
                                        <div key={item.name} className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></div>
                                                <span className="text-gray-600 dark:text-gray-300 truncate max-w-[100px]">{item.name}</span>
                                            </div>
                                            <span className="font-bold text-gray-900 dark:text-white">{item.value}m</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Transaction List (Projects Table) */}
                        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col">
                            <div className="p-6 pb-4 flex flex-col sm:flex-row items-center justify-between border-b border-gray-50 dark:border-gray-800 gap-4">
                                 <div className="flex items-center gap-4 w-full sm:w-auto">
                                     <div className="relative w-full sm:w-auto">
                                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input 
                                            type="text" 
                                            placeholder="Search projects..." 
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-9 pr-8 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm outline-none focus:bg-gray-100 dark:focus:bg-gray-700 transition-all w-full sm:w-48 focus:w-full sm:focus:w-64 dark:text-white placeholder-gray-400"
                                        />
                                        {searchQuery && (
                                            <button 
                                                onClick={() => setSearchQuery('')}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                     </div>
                                 </div>
                                 <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                    <button className="hidden sm:block px-3 py-1.5 text-xs font-bold bg-gray-50 dark:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Date</button>
                                    <button className="hidden sm:block px-3 py-1.5 text-xs font-bold bg-gray-50 dark:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">All Status</button>
                                    <button onClick={onStartProject} className="p-1.5 bg-black dark:bg-white text-white dark:text-gray-900 rounded-lg hover:opacity-80 transition-opacity">
                                        <Plus className="w-4 h-4" />
                                    </button>
                                 </div>
                            </div>
                            
                            <div className="flex-1 overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[600px]">
                                    <thead className="bg-gray-50/50 dark:bg-gray-800/50 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4 font-medium">Project Name</th>
                                            <th className="px-6 py-4 font-medium">Date Created</th>
                                            <th className="px-6 py-4 font-medium">Progress</th>
                                            <th className="px-6 py-4 font-medium text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {filteredProjects.length > 0 ? filteredProjects.map((project, idx) => {
                                            const pTotal = project.modules.reduce((a, m) => a + m.tasks.length, 0);
                                            const pComp = project.modules.reduce((a, m) => a + m.tasks.filter(t => t.isCompleted).length, 0);
                                            const percent = pTotal === 0 ? 0 : Math.round((pComp / pTotal) * 100);

                                            return (
                                                <tr key={project.id} onClick={() => onOpenProject(project.id!)} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 cursor-pointer border-b border-gray-50 dark:border-gray-800 last:border-0 group">
                                                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400">
                                                            <FileText className="w-4 h-4" />
                                                        </div>
                                                        {project.title}
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                                                        {new Date(project.createdAt || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold text-gray-900 dark:text-white w-8">{percent}%</span>
                                                            <div className="w-24 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                                <div className="h-full bg-black dark:bg-white rounded-full" style={{ width: `${percent}%` }}></div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id!); }}
                                                            className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        }) : (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-12 text-center text-gray-400 dark:text-gray-500 text-sm">
                                                    {searchQuery ? "No matching projects found." : "No projects found. Start a new one!"}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                     </div>
                   </>
                )}

                {activeTab === 'notifications' && (
                    <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 min-h-[50vh] flex flex-col items-center justify-center">
                        <div className="w-full max-w-2xl">
                            {loadingInvites ? (
                                <p className="text-sm text-gray-400 text-center">Loading invitations...</p>
                            ) : invitations.length > 0 ? (
                                <div className="space-y-4">
                                    {invitations.map((invite) => (
                                        <div key={invite.id} className="border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl overflow-hidden transition-all hover:shadow-sm">
                                            <div 
                                                onClick={() => setExpandedInviteId(expandedInviteId === invite.id ? null : invite.id)}
                                                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                                                        <Mail className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-gray-900 dark:text-white font-medium">
                                                            Invitation to collaborate on <span className="font-bold">"{invite.roadmap_title}"</span>
                                                        </p>
                                                        {!expandedInviteId && (
                                                           <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                               Tap to view sender details
                                                           </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expandedInviteId === invite.id ? 'rotate-180' : ''}`} />
                                            </div>

                                            {/* Expanded Details */}
                                            {expandedInviteId === invite.id && (
                                                <div className="px-4 pb-4 pl-16 animate-fade-in">
                                                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 space-y-4">
                                                        
                                                        {/* Sender Info */}
                                                        <div className="flex items-start gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-400 shrink-0">
                                                                <User className="w-4 h-4" />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sender Information</p>
                                                                <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">{invite.sender_name || 'Project Owner'}</p>
                                                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{invite.sender_email}</p>
                                                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Sent on {new Date(invite.added_at).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                                            </div>
                                                        </div>

                                                        <div className="h-px bg-gray-200 dark:bg-gray-700 w-full" />

                                                        {/* Actions */}
                                                        <div className="flex items-center gap-3">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleRespondToInvite(invite.id, false); }}
                                                                className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700"
                                                            >
                                                                Decline
                                                            </button>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleRespondToInvite(invite.id, true); }}
                                                                className="px-4 py-2 text-xs font-bold bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90 rounded-lg transition-colors shadow-sm"
                                                            >
                                                                Accept Invitation
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-center">
                                    <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                                        <Inbox className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                                    </div>
                                    <h3 className="font-bold text-gray-900 dark:text-white text-lg">All caught up</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">You have no pending invitations.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Settings</h2>
                        
                        {/* Simplified Settings for the UI Demo */}
                        <div className="space-y-6 max-w-lg">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Gemini API Key</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="password"
                                        value={localApiKey}
                                        onChange={(e) => setLocalApiKey(e.target.value)}
                                        onBlur={() => onUpdateApiKey(localApiKey)}
                                        placeholder="Enter API Key"
                                        className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 dark:text-white dark:placeholder-gray-500 border border-gray-200 dark:border-gray-700"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Appearance</label>
                                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">Dark Mode</span>
                                    <button 
                                        onClick={() => updatePreference('darkMode', !profile?.preferences.darkMode)}
                                        className={`w-11 h-6 rounded-full relative transition-colors ${profile?.preferences.darkMode ? 'bg-black dark:bg-white' : 'bg-gray-300'}`}
                                    >
                                        <div className={`w-4 h-4 rounded-full absolute top-1 transition-transform ${profile?.preferences.darkMode ? 'bg-gray-900 left-6' : 'bg-white left-1'}`} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </main>
    </div>
  );
};

export default UserProfile;