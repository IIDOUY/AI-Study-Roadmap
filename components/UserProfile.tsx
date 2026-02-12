
import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile as UserProfileType, Roadmap, ProjectInvitation } from '../types';
import { 
  X, Moon, Sun, Bell, Clock, LogOut, Layout, Settings as SettingsIcon, 
  FileText, Search, Plus, Trash2, Check, Key, ChevronRight, UserPlus, Inbox, Sparkles, Shield,
  Wallet, BarChart2, PieChart as PieChartIcon, CreditCard, HelpCircle, MessageSquare, Star, Mail,
  ChevronDown, ChevronUp, User, Menu, BrainCircuit, Download, Printer, CheckCircle2, Loader2
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { fetchPendingInvitations, respondToInvitation } from '../services/roadmapService';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import Flashcards from './Flashcards';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

type Tab = 'dashboard' | 'notifications' | 'settings' | 'flashcards' | 'reports';

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
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
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
  const totalEstMinutes = projects.reduce((acc, p) => acc + p.modules.reduce((mAcc, m) => mAcc + m.tasks.reduce((tAcc, t) => tAcc + (t.estimatedMinutes || 0), 0), 0), 0);
  
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

  const generateReport = () => {
    setIsGeneratingPdf(true);
    
    // Slight delay to allow UI to update
    setTimeout(() => {
        try {
            const doc = new jsPDF();
            
            // --- HEADER ---
            doc.setFillColor(31, 41, 55); // Dark gray
            doc.rect(0, 0, 210, 40, 'F');
            
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text("ThinkNode Study Report", 14, 20);
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Generated for: ${profile?.full_name || user.email}`, 14, 30);
            doc.text(`Date: ${new Date().toLocaleDateString()}`, 150, 30);

            // --- SUMMARY STATS ---
            let yPos = 55;
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text("Executive Summary", 14, yPos);

            yPos += 10;
            const stats = [
                ['Total Projects', projects.length.toString()],
                ['Total Tasks', totalTasks.toString()],
                ['Tasks Completed', completedTasks.toString()],
                ['Completion Rate', `${Math.round((completedTasks / Math.max(totalTasks, 1)) * 100)}%`],
                ['Est. Hours Required', `${(totalEstMinutes / 60).toFixed(1)} hrs`]
            ];

            autoTable(doc, {
                startY: yPos,
                head: [['Metric', 'Value']],
                body: stats,
                theme: 'striped',
                headStyles: { fillColor: [79, 70, 229] }, // Indigo
                margin: { left: 14, right: 100 },
            });

            // --- PROJECT DETAILS ---
            yPos = (doc as any).lastAutoTable.finalY + 20;
            doc.setFontSize(14);
            doc.text("Project Breakdown", 14, yPos);
            
            const projectRows = projects.map(p => {
                const pTotal = p.modules.reduce((a, m) => a + m.tasks.length, 0);
                const pComp = p.modules.reduce((a, m) => a + m.tasks.filter(t => t.isCompleted).length, 0);
                const percent = pTotal === 0 ? 0 : Math.round((pComp / pTotal) * 100);
                const status = percent === 100 ? 'Completed' : percent > 0 ? 'In Progress' : 'Not Started';
                return [p.title, `${percent}%`, status, new Date(p.createdAt || Date.now()).toLocaleDateString()];
            });

            autoTable(doc, {
                startY: yPos + 5,
                head: [['Project Name', 'Progress', 'Status', 'Created']],
                body: projectRows,
                theme: 'grid',
                headStyles: { fillColor: [55, 65, 81] },
            });

            // --- DETAILED TASK LIST (New Page if needed) ---
            doc.addPage();
            yPos = 20;
            doc.setFontSize(14);
            doc.text("Detailed Task Status", 14, yPos);

            const allTasksRows: any[] = [];
            projects.forEach(p => {
                p.modules.forEach(m => {
                    m.tasks.forEach(t => {
                        allTasksRows.push([
                            p.title.substring(0, 20) + (p.title.length > 20 ? '...' : ''),
                            t.title.substring(0, 40) + (t.title.length > 40 ? '...' : ''),
                            t.isCompleted ? 'Done' : 'Pending',
                            t.priority
                        ]);
                    });
                });
            });

            autoTable(doc, {
                startY: yPos + 5,
                head: [['Project', 'Task', 'Status', 'Priority']],
                body: allTasksRows,
                theme: 'plain',
                styles: { fontSize: 8 },
                columnStyles: { 0: { fontStyle: 'bold' } }
            });

            doc.save(`ThinkNode_Report_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (e) {
            console.error(e);
            alert("Error generating PDF");
        } finally {
            setIsGeneratingPdf(false);
        }
    }, 100);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100 overflow-hidden transition-colors duration-200">
      
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-[200] w-64 bg-white dark:bg-gray-900 flex flex-col border-r border-gray-100 dark:border-gray-800 
        transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 lg:z-0
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-8 pb-4">
           <div className="flex items-center gap-2 mb-10">
              <span className="font-bold text-xl tracking-tight text-gray-900 dark:text-white">ThinkNode</span>
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
                         onClick={() => { setActiveTab('flashcards'); setMobileMenuOpen(false); }}
                         className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl transition-colors ${activeTab === 'flashcards' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                      >
                         <BrainCircuit className="w-4 h-4" />
                         Flashcards
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
                      <button 
                         onClick={() => { setActiveTab('reports'); setMobileMenuOpen(false); }}
                         className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl transition-colors ${activeTab === 'reports' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                      >
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
                    <p className="text-sm text-gray-400 truncate">{user.email}</p>
                 </div>
            </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[190] lg:hidden"
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
                 <span className="font-bold text-lg text-gray-900 dark:text-white">ThinkNode</span>
             </div>
             <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                {user.email?.charAt(0).toUpperCase()}
             </div>
        </header>

        {/* Tab Content */}
        {activeTab === 'flashcards' ? (
          <Flashcards apiKey={apiKey} onBack={() => setActiveTab('dashboard')} />
        ) : (
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
                                      {focusDistribution.map((item, idx) => (
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
                    <div className="max-w-3xl mx-auto"> 
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Notifications</h2>
                        
                        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden min-h-[50vh]">
                            {loadingInvites ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                                </div>
                            ) : invitations.length > 0 ? (
                                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {invitations.map(invite => {
                                        const isExpanded = expandedInviteId === invite.id;
                                        return (
                                            <div key={invite.id} className="transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                                                {/* Summary Row */}
                                                <div 
                                                    className="p-4 flex items-center justify-between cursor-pointer"
                                                    onClick={() => setExpandedInviteId(isExpanded ? null : invite.id)}
                                                >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                                                <Mail className="w-4 h-4" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                                    Join project <span className="font-bold">"{invite.roadmap_title}"</span>
                                                                </p>
                                                                <p className="text-xs text-gray-500">{new Date(invite.added_at).toLocaleDateString()}</p>
                                                            </div>
                                                        </div>
                                                        <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                        </button>
                                                </div>

                                                {/* Expanded Details */}
                                                {isExpanded && (
                                                    <div className="px-4 pb-4 pl-[3.25rem] animate-fade-in">
                                                            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-4 border border-gray-100 dark:border-gray-700/50">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-full bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                                                                        {invite.invited_by?.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs font-bold text-gray-900 dark:text-white">{invite.invited_by}</p>
                                                                        <p className="text-xs text-gray-500">{invite.sender_email}</p>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div className="flex gap-2">
                                                                    <button 
                                                                        onClick={() => handleRespondToInvite(invite.id, true)}
                                                                        className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold rounded-lg hover:opacity-90 transition-opacity"
                                                                    >
                                                                        Accept
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleRespondToInvite(invite.id, false)}
                                                                        className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs font-bold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                                    >
                                                                        Decline
                                                                    </button>
                                                                </div>
                                                            </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-gray-300 dark:text-gray-600 mb-4">
                                        <Inbox className="w-8 h-8" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">No new notifications</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                                        You're all caught up! Check back later for project invitations.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                  )}

                  {activeTab === 'reports' && (
                      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden min-h-[50vh]">
                          <div className="p-8 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                               <div>
                                   <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                       <FileText className="w-6 h-6 text-indigo-600" />
                                       Progress Report
                                   </h2>
                                   <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                       Generate a PDF summary of all your projects and study metrics.
                                   </p>
                               </div>
                               <button 
                                  onClick={generateReport}
                                  disabled={isGeneratingPdf}
                                  className="px-6 py-3 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-xl font-bold text-sm hover:bg-indigo-100 dark:hover:bg-indigo-900/50 disabled:opacity-70 transition-all flex items-center gap-2"
                               >
                                   {isGeneratingPdf ? <Clock className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                   Export PDF
                               </button>
                          </div>

                          <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                               <div className="space-y-6">
                                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Report Preview</h3>
                                    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-inner">
                                         <div className="flex items-center justify-between mb-6 border-b border-gray-200 dark:border-gray-700 pb-4">
                                              <span className="font-bold text-lg text-gray-900 dark:text-white">ThinkNode Report</span>
                                              <span className="text-xs text-gray-500">{new Date().toLocaleDateString()}</span>
                                         </div>
                                         <div className="space-y-4">
                                              <div className="flex justify-between items-center text-sm">
                                                  <span className="text-gray-600 dark:text-gray-400">Student:</span>
                                                  <span className="font-medium dark:text-white">{profile?.full_name || user.email}</span>
                                              </div>
                                              <div className="flex justify-between items-center text-sm">
                                                  <span className="text-gray-600 dark:text-gray-400">Total Projects:</span>
                                                  <span className="font-medium dark:text-white">{projects.length}</span>
                                              </div>
                                              <div className="flex justify-between items-center text-sm">
                                                  <span className="text-gray-600 dark:text-gray-400">Tasks Completed:</span>
                                                  <span className="font-medium text-green-600">{completedTasks} / {totalTasks}</span>
                                              </div>
                                              <div className="flex justify-between items-center text-sm">
                                                  <span className="text-gray-600 dark:text-gray-400">Est. Hours:</span>
                                                  <span className="font-medium dark:text-white">{(totalEstMinutes / 60).toFixed(1)} hrs</span>
                                              </div>
                                         </div>
                                         <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
                                             <p className="text-xs text-gray-400 italic">This is a preview of the data included in your export.</p>
                                         </div>
                                    </div>
                               </div>

                               <div className="space-y-6">
                                   <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Included Projects</h3>
                                   <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
                                       {projects.length > 0 ? (
                                           <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                               {projects.slice(0, 5).map(p => {
                                                   const pTotal = p.modules.reduce((a, m) => a + m.tasks.length, 0);
                                                   const pComp = p.modules.reduce((a, m) => a + m.tasks.filter(t => t.isCompleted).length, 0);
                                                   const percent = pTotal === 0 ? 0 : Math.round((pComp / pTotal) * 100);
                                                   return (
                                                       <div key={p.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                                            <div className="flex items-center gap-3">
                                                                {percent === 100 ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <div className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600" />}
                                                                <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[150px]">{p.title}</span>
                                                            </div>
                                                            <span className="text-xs font-bold text-gray-500">{percent}%</span>
                                                       </div>
                                                   );
                                               })}
                                               {projects.length > 5 && (
                                                   <div className="p-3 text-center text-xs text-gray-500 bg-gray-50 dark:bg-gray-800/50">
                                                       + {projects.length - 5} more projects
                                                   </div>
                                               )}
                                           </div>
                                       ) : (
                                           <div className="p-8 text-center text-gray-400 text-sm">No projects found.</div>
                                       )}
                                   </div>
                               </div>
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
        )}
      </main>
    </div>
  );
};

export default UserProfile;
